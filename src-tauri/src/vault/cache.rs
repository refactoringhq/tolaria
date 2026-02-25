use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use super::{parse_md_file, scan_vault, VaultEntry};

// --- Vault Cache ---

/// Bump this when VaultEntry fields change to force a full rescan.
const CACHE_VERSION: u32 = 2;

#[derive(Debug, Serialize, Deserialize)]
struct VaultCache {
    #[serde(default = "default_cache_version")]
    version: u32,
    commit_hash: String,
    entries: Vec<VaultEntry>,
}

fn default_cache_version() -> u32 {
    1
}

fn cache_path(vault: &Path) -> std::path::PathBuf {
    vault.join(".laputa-cache.json")
}

fn git_head_hash(vault: &Path) -> Option<String> {
    run_git(vault, &["rev-parse", "HEAD"]).map(|s| s.trim().to_string())
}

/// Run a git command in the given directory and return stdout if successful.
fn run_git(vault: &Path, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(vault)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Parse a git status porcelain line into (status_code, file_path).
fn parse_porcelain_line(line: &str) -> Option<(&str, String)> {
    if line.len() < 3 {
        return None;
    }
    Some((&line[..2], line[3..].trim().to_string()))
}

/// Check if a porcelain status indicates a new/untracked file.
fn is_new_file_status(status: &str) -> bool {
    status == "??" || status.starts_with('A')
}

/// Extract .md file paths from git diff --name-only output.
fn collect_md_paths_from_diff(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter(|line| !line.is_empty() && line.ends_with(".md"))
        .map(|line| line.to_string())
        .collect()
}

/// Extract .md file paths from git status --porcelain output.
fn collect_md_paths_from_porcelain(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(parse_porcelain_line)
        .filter(|(_, path)| path.ends_with(".md"))
        .map(|(_, path)| path)
        .collect()
}

fn git_changed_files(vault: &Path, from_hash: &str, to_hash: &str) -> Vec<String> {
    let diff_arg = format!("{}..{}", from_hash, to_hash);
    let mut files = run_git(vault, &["diff", &diff_arg, "--name-only"])
        .map(|s| collect_md_paths_from_diff(&s))
        .unwrap_or_default();

    let uncommitted = run_git(vault, &["status", "--porcelain"])
        .map(|s| collect_md_paths_from_porcelain(&s))
        .unwrap_or_default();

    for path in uncommitted {
        if !files.contains(&path) {
            files.push(path);
        }
    }

    files
}

fn git_uncommitted_new_files(vault: &Path) -> Vec<String> {
    let stdout = match run_git(vault, &["status", "--porcelain"]) {
        Some(s) => s,
        None => return Vec::new(),
    };
    stdout
        .lines()
        .filter_map(parse_porcelain_line)
        .filter(|(status, path)| path.ends_with(".md") && is_new_file_status(status))
        .map(|(_, path)| path)
        .collect()
}

fn load_cache(vault: &Path) -> Option<VaultCache> {
    let data = fs::read_to_string(cache_path(vault)).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_cache(vault: &Path, cache: &VaultCache) {
    if let Ok(data) = serde_json::to_string(cache) {
        let _ = fs::write(cache_path(vault), data);
    }
}

/// Normalize an absolute path to a relative path for comparison with git output.
fn to_relative_path(abs_path: &str, vault: &Path) -> String {
    let vault_str = vault.to_string_lossy();
    let with_slash = format!("{}/", vault_str);
    abs_path
        .strip_prefix(&with_slash)
        .or_else(|| abs_path.strip_prefix(vault_str.as_ref()))
        .unwrap_or(abs_path)
        .to_string()
}

/// Parse .md files from a list of relative paths, skipping any that don't exist.
fn parse_files_at(vault: &Path, rel_paths: &[String]) -> Vec<VaultEntry> {
    rel_paths
        .iter()
        .filter_map(|rel| {
            let abs = vault.join(rel);
            if abs.is_file() {
                parse_md_file(&abs).ok()
            } else {
                None
            }
        })
        .collect()
}

/// Sort entries by modified_at descending and write the cache.
fn finalize_and_cache(vault: &Path, mut entries: Vec<VaultEntry>, hash: String) -> Vec<VaultEntry> {
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    write_cache(
        vault,
        &VaultCache {
            version: CACHE_VERSION,
            commit_hash: hash,
            entries: entries.clone(),
        },
    );
    entries
}

/// Handle same-commit cache hit: add any uncommitted new files.
fn update_same_commit(vault: &Path, cache: VaultCache) -> Vec<VaultEntry> {
    let new_files = git_uncommitted_new_files(vault);
    let mut entries = cache.entries;
    let existing: std::collections::HashSet<String> = entries
        .iter()
        .map(|e| to_relative_path(&e.path, vault))
        .collect();

    let new_entries = parse_files_at(vault, &new_files);
    for entry in new_entries {
        let rel = to_relative_path(&entry.path, vault);
        if !existing.contains(&rel) {
            entries.push(entry);
        }
    }

    finalize_and_cache(vault, entries, cache.commit_hash)
}

/// Handle different-commit cache: incremental update via git diff.
fn update_different_commit(
    vault: &Path,
    cache: VaultCache,
    current_hash: String,
) -> Vec<VaultEntry> {
    let changed_files = git_changed_files(vault, &cache.commit_hash, &current_hash);
    let changed_set: std::collections::HashSet<String> = changed_files.iter().cloned().collect();

    let mut entries: Vec<VaultEntry> = cache
        .entries
        .into_iter()
        .filter(|e| !changed_set.contains(&to_relative_path(&e.path, vault)))
        .collect();
    entries.extend(parse_files_at(vault, &changed_files));

    finalize_and_cache(vault, entries, current_hash)
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

    let current_hash = match git_head_hash(vault_path) {
        Some(h) => h,
        None => return scan_vault(vault_path),
    };

    if let Some(cache) = load_cache(vault_path) {
        if cache.version != CACHE_VERSION {
            let entries = scan_vault(vault_path)?;
            return Ok(finalize_and_cache(vault_path, entries, current_hash));
        }
        return if cache.commit_hash == current_hash {
            Ok(update_same_commit(vault_path, cache))
        } else {
            Ok(update_different_commit(vault_path, cache, current_hash))
        };
    }

    // No cache — full scan and write cache
    let entries = scan_vault(vault_path)?;
    Ok(finalize_and_cache(vault_path, entries, current_hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_scan_vault_cached_no_git() {
        // Without git, scan_vault_cached falls back to scan_vault
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "note.md", "# Note\n\nContent here.");

        let entries = scan_vault_cached(dir.path()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Note");
        assert_eq!(entries[0].snippet, "Content here.");
    }

    #[test]
    fn test_scan_vault_cached_with_git() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        // Init git repo
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(vault)
            .output()
            .unwrap();

        create_test_file(vault, "note.md", "# Note\n\nFirst version.");
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(vault)
            .output()
            .unwrap();

        // First call: full scan, writes cache
        let entries = scan_vault_cached(vault).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(cache_path(vault).exists());

        // Second call: uses cache (same HEAD)
        let entries2 = scan_vault_cached(vault).unwrap();
        assert_eq!(entries2.len(), 1);
        assert_eq!(entries2[0].title, "Note");
    }

    #[test]
    fn test_scan_vault_cached_incremental_different_commit() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        // Init git repo
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "Test"])
            .current_dir(vault)
            .output()
            .unwrap();

        create_test_file(vault, "first.md", "# First\n\nFirst note.");
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "first"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Build cache
        let entries = scan_vault_cached(vault).unwrap();
        assert_eq!(entries.len(), 1);

        // Add a second file and commit
        create_test_file(vault, "second.md", "# Second\n\nSecond note.");
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "second"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Incremental update: cache has old commit, new commit adds second.md
        let entries2 = scan_vault_cached(vault).unwrap();
        assert_eq!(entries2.len(), 2);
        let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
        assert!(titles.contains(&"First"));
        assert!(titles.contains(&"Second"));
    }
}
