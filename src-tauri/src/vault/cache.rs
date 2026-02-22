use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

use super::git::{git_changed_files, git_head_hash, git_uncommitted_new_files};
use super::parse::{parse_md_file, VaultEntry};
use super::scan::scan_vault;

#[derive(Debug, Serialize, Deserialize)]
struct VaultCache {
    commit_hash: String,
    entries: Vec<VaultEntry>,
}

fn cache_path(vault: &Path) -> std::path::PathBuf {
    vault.join(".laputa-cache.json")
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
    abs_path.strip_prefix(&with_slash)
        .or_else(|| abs_path.strip_prefix(vault_str.as_ref()))
        .unwrap_or(abs_path)
        .to_string()
}

/// Parse .md files from a list of relative paths, skipping any that don't exist.
fn parse_files_at(vault: &Path, rel_paths: &[String]) -> Vec<VaultEntry> {
    rel_paths.iter()
        .filter_map(|rel| {
            let abs = vault.join(rel);
            if abs.is_file() { parse_md_file(&abs).ok() } else { None }
        })
        .collect()
}

/// Sort entries by modified_at descending and write the cache.
fn finalize_and_cache(vault: &Path, mut entries: Vec<VaultEntry>, hash: String) -> Vec<VaultEntry> {
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    write_cache(vault, &VaultCache { commit_hash: hash, entries: entries.clone() });
    entries
}

/// Handle same-commit cache hit: add any uncommitted new files.
fn update_same_commit(vault: &Path, cache: VaultCache) -> Vec<VaultEntry> {
    let new_files = git_uncommitted_new_files(vault);
    let mut entries = cache.entries;
    let existing: HashSet<String> = entries.iter()
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
fn update_different_commit(vault: &Path, cache: VaultCache, current_hash: String) -> Vec<VaultEntry> {
    let changed_files = git_changed_files(vault, &cache.commit_hash, &current_hash);
    let changed_set: HashSet<String> = changed_files.iter().cloned().collect();

    let mut entries: Vec<VaultEntry> = cache.entries.into_iter()
        .filter(|e| !changed_set.contains(&to_relative_path(&e.path, vault)))
        .collect();
    entries.extend(parse_files_at(vault, &changed_files));

    finalize_and_cache(vault, entries, current_hash)
}

/// Scan vault with incremental caching via git.
/// Falls back to full scan if cache is missing/corrupt or git is unavailable.
pub fn scan_vault_cached(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!("Vault path does not exist or is not a directory: {}", vault_path));
    }

    let current_hash = match git_head_hash(vault) {
        Some(h) => h,
        None => return scan_vault(vault_path),
    };

    if let Some(cache) = load_cache(vault) {
        return if cache.commit_hash == current_hash {
            Ok(update_same_commit(vault, cache))
        } else {
            Ok(update_different_commit(vault, cache, current_hash))
        };
    }

    // No cache — full scan and write cache
    let entries = scan_vault(vault_path)?;
    Ok(finalize_and_cache(vault, entries, current_hash))
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
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "note.md", "# Note\n\nContent here.");

        let entries = scan_vault_cached(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Note");
        assert_eq!(entries[0].snippet, "Content here.");
    }

    #[test]
    fn test_scan_vault_cached_with_git() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        std::process::Command::new("git").args(["init"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.name", "Test"]).current_dir(vault).output().unwrap();

        create_test_file(vault, "note.md", "# Note\n\nFirst version.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "init"]).current_dir(vault).output().unwrap();

        let entries = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(cache_path(vault).exists());

        let entries2 = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries2.len(), 1);
        assert_eq!(entries2[0].title, "Note");
    }

    #[test]
    fn test_scan_vault_cached_incremental_different_commit() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        std::process::Command::new("git").args(["init"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.name", "Test"]).current_dir(vault).output().unwrap();

        create_test_file(vault, "first.md", "# First\n\nFirst note.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "first"]).current_dir(vault).output().unwrap();

        let entries = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);

        create_test_file(vault, "second.md", "# Second\n\nSecond note.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "second"]).current_dir(vault).output().unwrap();

        let entries2 = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries2.len(), 2);
        let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
        assert!(titles.contains(&"First"));
        assert!(titles.contains(&"Second"));
    }
}
