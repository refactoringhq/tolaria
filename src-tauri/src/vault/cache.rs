use serde::{Deserialize, Serialize};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use crate::git::{get_all_file_dates_for_workspace, GitDates, GitWorkspace};
use std::collections::HashMap;
#[cfg(test)]
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use super::path_identity::{
    normalize_path_for_identity, push_unique_relative_path, relative_path_key,
    vault_relative_path_string,
};
use super::{is_md_file, parse_md_file, parse_non_md_file, scan_vault, VaultEntry};

#[path = "cache_io.rs"]
mod cache_io;

#[cfg(test)]
use cache_io::cache_lock_path;
use cache_io::{
    load_cache, read_cache_fingerprint, remove_cache_file, write_cache, CacheFileFingerprint,
    CacheLoadState, CacheWriteOutcome, LoadedCache,
};

// --- Vault Cache ---

/// Bump this when VaultEntry fields change to force a full rescan.
/// v12: fix gray_matter YAML sanitization (unquoted colons / hash comments in list items)
/// v14: preserve scalar-array custom frontmatter properties in VaultEntry
const CACHE_VERSION: u32 = 14;
const CACHE_WRITE_LOCK_STALE_SECS: u64 = 30;

#[cfg(test)]
static PANIC_ON_GIT_DATE_LOOKUP: AtomicBool = AtomicBool::new(false);
#[cfg(test)]
static GIT_WORKSPACE_RESOLUTION_COUNT: AtomicUsize = AtomicUsize::new(0);
#[cfg(test)]
static CACHE_WRITE_COUNT: AtomicUsize = AtomicUsize::new(0);

#[cfg(test)]
struct GitDateLookupPanicGuard;

#[cfg(test)]
impl Drop for GitDateLookupPanicGuard {
    fn drop(&mut self) {
        PANIC_ON_GIT_DATE_LOOKUP.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
fn panic_on_git_date_lookup() -> GitDateLookupPanicGuard {
    PANIC_ON_GIT_DATE_LOOKUP.store(true, Ordering::SeqCst);
    GitDateLookupPanicGuard
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct VaultCache {
    #[serde(default = "default_cache_version")]
    version: u32,
    /// The vault path when the cache was written. Used to detect stale caches
    /// from a different machine or a moved vault directory.
    #[serde(default)]
    vault_path: String,
    commit_hash: String,
    entries: Vec<VaultEntry>,
}

fn default_cache_version() -> u32 {
    1
}

/// Compute a deterministic hex hash of the vault path for use as cache filename.
fn vault_path_hash(vault: &Path) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    normalize_path_for_identity(&vault.to_string_lossy()).hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Return the cache directory. Override with `LAPUTA_CACHE_DIR` env var (for tests).
fn cache_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("LAPUTA_CACHE_DIR") {
        return PathBuf::from(dir);
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".laputa")
        .join("cache")
}

fn cache_path(vault: &Path) -> PathBuf {
    cache_dir().join(format!("{}.json", vault_path_hash(vault)))
}

fn legacy_cache_path(vault: &Path) -> PathBuf {
    vault.join(".laputa-cache.json")
}

fn resolve_git_workspace(vault: &Path) -> Option<GitWorkspace> {
    #[cfg(test)]
    GIT_WORKSPACE_RESOLUTION_COUNT.fetch_add(1, Ordering::SeqCst);

    crate::git::GitWorkspace::resolve(vault).ok().flatten()
}

fn git_head_hash(workspace: &GitWorkspace) -> Option<String> {
    run_git(workspace.git_root(), &["rev-parse", "HEAD"]).map(|s| s.trim().to_string())
}

/// Run a git command in the given directory and return stdout if successful.
fn run_git(vault: &Path, args: &[&str]) -> Option<String> {
    let output = crate::git::git_command_at(vault)
        .and_then(|mut command| command.args(args).output())
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

fn load_git_dates(workspace: &GitWorkspace) -> HashMap<String, GitDates> {
    #[cfg(test)]
    if PANIC_ON_GIT_DATE_LOOKUP.load(Ordering::SeqCst) {
        panic!("warm cache hit must not load full git date history");
    }

    get_all_file_dates_for_workspace(workspace)
}

/// Parse a git status porcelain line into (status_code, file_path).
fn parse_porcelain_line(line: &str) -> Option<(&str, String)> {
    if line.len() < 3 {
        return None;
    }
    Some((&line[..2], line[3..].trim().to_string()))
}

fn push_changed_path_prefer_existing(paths: &mut Vec<String>, vault: &Path, path: &str) {
    let normalized = super::path_identity::normalize_relative_path(path);
    if normalized.is_empty() || super::path_identity::has_hidden_segment(&normalized) {
        return;
    }

    let key = relative_path_key(&normalized);
    if let Some(existing_index) = paths
        .iter()
        .position(|existing| relative_path_key(existing) == key)
    {
        let existing_path = vault.join(&paths[existing_index]);
        let candidate_path = vault.join(&normalized);
        if !existing_path.is_file() && candidate_path.is_file() {
            paths[existing_index] = normalized;
        }
        return;
    }

    paths.push(normalized);
}

/// Extract file paths from git diff --name-only output.
/// Includes all non-hidden files (not just .md) so the cache picks up
/// view files (.yml), binary assets, etc.
fn collect_paths_from_diff(
    vault: &Path,
    workspace: &crate::git::GitWorkspace,
    stdout: &str,
) -> Vec<String> {
    let mut paths = Vec::new();
    for line in stdout.lines() {
        if let Some(path) = workspace.vault_relative_path(line) {
            push_changed_path_prefer_existing(&mut paths, vault, &path);
        }
    }
    paths
}

/// Extract file paths from git status --porcelain output.
/// Includes all non-hidden files so incremental cache updates cover
/// every file type the vault scanner recognises.
fn collect_paths_from_porcelain(workspace: &crate::git::GitWorkspace, stdout: &str) -> Vec<String> {
    let mut paths = Vec::new();
    for (_, path) in stdout.lines().filter_map(parse_porcelain_line) {
        if let Some(path) = workspace.vault_relative_path(&path) {
            push_unique_relative_path(&mut paths, path);
        }
    }
    paths
}

fn git_changed_files(
    vault: &Path,
    workspace: &GitWorkspace,
    from_hash: &str,
    to_hash: &str,
) -> Vec<String> {
    let diff_arg = format!("{}..{}", from_hash, to_hash);
    let mut files = run_git(
        workspace.git_root(),
        &[
            "diff",
            &diff_arg,
            "--name-only",
            "--",
            workspace.vault_pathspec(),
        ],
    )
    .map(|s| collect_paths_from_diff(vault, workspace, &s))
    .unwrap_or_default();

    // Include uncommitted changes (modified, staged, and untracked files).
    let uncommitted = git_uncommitted_files(workspace);

    for path in uncommitted.into_iter() {
        push_unique_relative_path(&mut files, path);
    }

    files
}

fn git_uncommitted_files(workspace: &GitWorkspace) -> Vec<String> {
    // Modified/staged tracked files from git status --porcelain
    let mut files: Vec<String> = run_git(
        workspace.git_root(),
        &["status", "--porcelain", "--", workspace.vault_pathspec()],
    )
    .map(|s| collect_paths_from_porcelain(workspace, &s))
    .unwrap_or_default();

    // Untracked files via ls-files (lists individual files, not just directories).
    // git status --porcelain shows `?? dir/` for new directories, hiding individual
    // files inside — ls-files resolves them so the cache picks up all new files.
    let untracked = run_git(
        workspace.git_root(),
        &[
            "ls-files",
            "--others",
            "--exclude-standard",
            "--",
            workspace.vault_pathspec(),
        ],
    )
    .map(|s| {
        let mut paths = Vec::new();
        for line in s.lines() {
            if let Some(path) = workspace.vault_relative_path(line) {
                push_unique_relative_path(&mut paths, path);
            }
        }
        paths
    })
    .unwrap_or_default();

    for path in untracked {
        push_unique_relative_path(&mut files, path);
    }

    files
}

/// Normalize an absolute path to a relative path for comparison with git output.
fn to_relative_path(abs_path: &str, vault: &Path) -> String {
    vault_relative_path_string(vault, Path::new(abs_path))
        .unwrap_or_else(|_| normalize_path_for_identity(abs_path))
}

fn to_relative_path_key(abs_path: &str, vault: &Path) -> String {
    relative_path_key(&to_relative_path(abs_path, vault))
}

/// Parse files from a list of relative paths, skipping any that don't exist.
/// Dispatches to the appropriate parser based on file extension.
fn parse_files_at(
    vault: &Path,
    rel_paths: &[String],
    git_dates: &HashMap<String, GitDates>,
) -> Vec<VaultEntry> {
    rel_paths
        .iter()
        .filter_map(|rel| {
            let abs = vault.join(rel);
            if abs.is_file() {
                let dates = git_dates
                    .get(rel.as_str())
                    .map(|d| (d.modified_at, d.created_at));
                if is_md_file(&abs) {
                    parse_md_file(&abs, dates).ok()
                } else {
                    parse_non_md_file(&abs, dates).ok()
                }
            } else {
                None
            }
        })
        .collect()
}

/// Copy legacy cache data to the new external location via temp file + rename.
fn copy_legacy_cache_to(legacy: &Path, dest: &Path) {
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let tmp_path = dest.with_extension("tmp");
    if let Ok(data) = fs::read_to_string(legacy) {
        if fs::write(&tmp_path, &data).is_ok() {
            let _ = fs::rename(&tmp_path, dest);
        }
    }
}

/// Migrate legacy cache from inside the vault to the new external location.
/// Also removes the legacy file from git tracking if present.
fn migrate_legacy_cache(vault: &Path) {
    let legacy = legacy_cache_path(vault);
    if !legacy.exists() {
        return;
    }

    let new_path = cache_path(vault);
    if !new_path.exists() {
        copy_legacy_cache_to(&legacy, &new_path);
    }

    // Remove legacy file from git tracking if present
    let _ = crate::hidden_command("git")
        .args([
            "rm",
            "--cached",
            "--quiet",
            "--ignore-unmatch",
            ".laputa-cache.json",
        ])
        .current_dir(vault)
        .output();

    // Delete the legacy file from disk
    let _ = fs::remove_file(&legacy);
}

/// Remove entries for files that no longer exist on disk and deduplicate
/// by case-folded relative path (handles case-insensitive filesystems like macOS APFS).
/// Returns `true` if any entries were removed.
fn prune_stale_entries(vault: &Path, entries: &mut Vec<VaultEntry>) -> bool {
    let before = entries.len();
    // Remove entries whose files no longer exist on disk
    entries.retain(|e| std::path::Path::new(&e.path).is_file());
    // Deduplicate by case-folded relative path
    let mut seen = std::collections::HashSet::new();
    entries.retain(|e| {
        let rel = to_relative_path_key(&e.path, vault);
        seen.insert(rel)
    });
    entries.len() != before
}

/// Sort entries by modified_at descending and write the cache.
fn finalize_and_cache(
    vault: &Path,
    mut entries: Vec<VaultEntry>,
    hash: String,
    expected_previous: Option<CacheFileFingerprint>,
) -> Vec<VaultEntry> {
    prune_stale_entries(vault, &mut entries);
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.modified_at));
    let outcome = write_cache(
        vault,
        &VaultCache {
            version: CACHE_VERSION,
            vault_path: vault.to_string_lossy().to_string(),
            commit_hash: hash,
            entries: entries.clone(),
        },
        expected_previous,
    );
    match outcome {
        Ok(CacheWriteOutcome::Replaced) => {}
        Ok(CacheWriteOutcome::SkippedConcurrentUpdate) => log::info!(
            "Skipped replacing cache {} because another scan refreshed it first",
            cache_path(vault).display()
        ),
        Ok(CacheWriteOutcome::SkippedActiveWriter) => log::info!(
            "Skipped replacing cache {} because another writer is active",
            cache_path(vault).display()
        ),
        Err(error) => log::warn!("{error}"),
    }
    entries
}

/// Handle same-commit cache hit: re-parse any uncommitted changes (new or modified files).
/// Always prunes stale entries even when git reports no changes, so that files
/// deleted outside git (e.g., via Finder) are removed from the cache on vault open.
fn update_same_commit(
    vault: &Path,
    workspace: &GitWorkspace,
    loaded_cache: LoadedCache,
) -> Vec<VaultEntry> {
    let LoadedCache { cache, fingerprint } = loaded_cache;
    let changed = git_uncommitted_files(workspace);
    let mut entries = cache.entries;
    if !changed.is_empty() {
        let git_dates = load_git_dates(workspace);
        let changed_set: std::collections::HashSet<String> =
            changed.iter().map(|path| relative_path_key(path)).collect();
        entries.retain(|e| !changed_set.contains(&to_relative_path_key(&e.path, vault)));
        entries.extend(parse_files_at(vault, &changed, &git_dates));
    }
    let pruned = prune_stale_entries(vault, &mut entries);
    if changed.is_empty() && !pruned {
        return entries;
    }
    finalize_and_cache(vault, entries, cache.commit_hash, Some(fingerprint))
}

/// Handle different-commit cache: incremental update via git diff.
fn update_different_commit(
    vault: &Path,
    workspace: &GitWorkspace,
    loaded_cache: LoadedCache,
    current_hash: String,
    git_dates: &HashMap<String, GitDates>,
) -> Vec<VaultEntry> {
    let LoadedCache { cache, fingerprint } = loaded_cache;
    let changed_files = git_changed_files(vault, workspace, &cache.commit_hash, &current_hash);
    let changed_set: std::collections::HashSet<String> = changed_files
        .iter()
        .map(|path| relative_path_key(path))
        .collect();

    let mut entries: Vec<VaultEntry> = cache
        .entries
        .into_iter()
        .filter(|e| !changed_set.contains(&to_relative_path_key(&e.path, vault)))
        .collect();
    entries.extend(parse_files_at(vault, &changed_files, git_dates));

    finalize_and_cache(vault, entries, current_hash, Some(fingerprint))
}

fn cache_requires_full_rescan(cache: &VaultCache, vault_path: &Path) -> bool {
    let current_vault_str = normalize_path_for_identity(&vault_path.to_string_lossy());
    cache.version != CACHE_VERSION
        || (!cache.vault_path.is_empty()
            && normalize_path_for_identity(&cache.vault_path) != current_vault_str)
}

fn scan_and_cache_full(
    vault_path: &Path,
    git_dates: &HashMap<String, GitDates>,
    current_hash: String,
    expected_previous: Option<CacheFileFingerprint>,
) -> Result<Vec<VaultEntry>, String> {
    let entries = scan_vault(vault_path, git_dates)?;
    Ok(finalize_and_cache(
        vault_path,
        entries,
        current_hash,
        expected_previous,
    ))
}

/// Delete the cache file for a vault, forcing a full rescan on the next
/// call to `scan_vault_cached`. Used by the `reload_vault` command so that
/// explicit user-triggered reloads always read from the filesystem.
pub fn invalidate_cache(vault_path: &Path) {
    let path = cache_path(vault_path);
    remove_cache_file(&path, "cache file");
}

/// Read a structurally valid cache without consulting Git or touching vault files.
/// The caller must reconcile this potentially stale snapshot in the background.
pub fn read_vault_snapshot(vault_path: &Path) -> Result<Option<Vec<VaultEntry>>, String> {
    match load_cache(vault_path) {
        CacheLoadState::Loaded(loaded) => {
            if cache_requires_full_rescan(&loaded.cache, vault_path) {
                return Ok(None);
            }
            Ok(Some(loaded.cache.entries))
        }
        CacheLoadState::Missing => Ok(None),
        CacheLoadState::Invalid(error) | CacheLoadState::Unreadable(error) => {
            log::warn!("{error}");
            Ok(None)
        }
    }
}

/// Scan vault with incremental caching via git.
/// Falls back to full scan if cache is missing/corrupt or git is unavailable.
pub fn scan_vault_cached(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    if !vault_path.exists() || !vault_path.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path.display()
        ));
    }

    // Migrate legacy in-vault cache to external location on first run
    migrate_legacy_cache(vault_path);

    let Some(workspace) = resolve_git_workspace(vault_path) else {
        return scan_vault(vault_path, &HashMap::new());
    };
    let current_hash = match git_head_hash(&workspace) {
        Some(h) => h,
        None => return scan_vault(vault_path, &HashMap::new()),
    };

    match load_cache(vault_path) {
        CacheLoadState::Missing => {}
        CacheLoadState::Unreadable(error) => log::warn!("{error}"),
        CacheLoadState::Invalid(error) => {
            log::warn!("{error}");
            remove_cache_file(&cache_path(vault_path), "invalid cache file");
        }
        CacheLoadState::Loaded(loaded_cache) => {
            if cache_requires_full_rescan(&loaded_cache.cache, vault_path) {
                let git_dates = load_git_dates(&workspace);
                return scan_and_cache_full(
                    vault_path,
                    &git_dates,
                    current_hash,
                    Some(loaded_cache.fingerprint),
                );
            }
            return if loaded_cache.cache.commit_hash == current_hash {
                Ok(update_same_commit(vault_path, &workspace, loaded_cache))
            } else {
                let git_dates = load_git_dates(&workspace);
                Ok(update_different_commit(
                    vault_path,
                    &workspace,
                    loaded_cache,
                    current_hash,
                    &git_dates,
                ))
            };
        }
    }

    // No cache — full scan and write cache
    let git_dates = load_git_dates(&workspace);
    scan_and_cache_full(vault_path, &git_dates, current_hash, None)
}

/// Rebuild a vault from disk while keeping the previous snapshot readable until
/// the replacement is complete. This makes explicit reloads crash-safe: an app
/// exit during the scan cannot leave the next startup without a usable cache.
pub fn refresh_vault_cache(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    if !vault_path.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path.display()
        ));
    }

    migrate_legacy_cache(vault_path);
    // Fingerprint the bytes directly so even an invalid cache can be replaced
    // transactionally. Parsing it first would lose the expected fingerprint
    // and make `write_cache` treat the same corrupt file as a concurrent write.
    let expected_previous = read_cache_fingerprint(&cache_path(vault_path))?;
    let Some(workspace) = resolve_git_workspace(vault_path) else {
        return scan_vault(vault_path, &HashMap::new());
    };
    let Some(current_hash) = git_head_hash(&workspace) else {
        return scan_vault(vault_path, &HashMap::new());
    };
    let git_dates = load_git_dates(&workspace);
    scan_and_cache_full(vault_path, &git_dates, current_hash, expected_previous)
}

#[cfg(test)]
#[path = "cache_tests.rs"]
mod tests;
