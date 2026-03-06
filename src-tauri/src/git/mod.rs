mod commit;
mod conflict;
mod history;
mod pulse;
mod remote;
mod status;

use std::path::Path;
use std::process::Command;

pub use commit::git_commit;
pub use conflict::{
    get_conflict_files, get_conflict_mode, git_commit_conflict_resolution, git_resolve_conflict,
    is_merge_in_progress, is_rebase_in_progress,
};
pub use history::{get_file_diff, get_file_diff_at_commit, get_file_history};
pub use pulse::{get_last_commit_info, get_vault_pulse, LastCommitInfo, PulseCommit, PulseFile};
pub use remote::{git_pull, git_push, has_remote, GitPullResult};
pub use status::{get_modified_files, ModifiedFile};

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

/// Initialize a new git repository, stage all files, and create an initial commit.
pub fn init_repo(path: &str) -> Result<(), String> {
    let dir = Path::new(path);

    run_git(dir, &["init"])?;
    ensure_author_config(dir)?;

    // Write .gitignore before the first commit so machine-specific and
    // macOS metadata files are never tracked and don't cause conflicts.
    let gitignore_path = dir.join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(
            &gitignore_path,
            "# Laputa app files (machine-specific, never commit)\n\
.laputa-cache.json\n\
.laputa/settings.json\n\
\n\
# macOS\n\
.DS_Store\n\
.AppleDouble\n\
.LSOverride\n\
\n\
# Thumbnails\n\
._*\n\
\n\
# Editors\n\
.vscode/\n\
.idea/\n\
*.swp\n\
*.swo\n",
        )
        .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
    }

    run_git(dir, &["add", "."])?;
    run_git(dir, &["commit", "-m", "Initial vault setup"])?;

    Ok(())
}

/// Run a git command in the given directory, returning an error on failure.
fn run_git(dir: &Path, args: &[&str]) -> Result<(), String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git {}: {}", args[0], e))?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git {} failed: {}",
        args[0],
        String::from_utf8_lossy(&output.stderr)
    ))
}

/// Set local user.name and user.email if not already configured.
fn ensure_author_config(dir: &Path) -> Result<(), String> {
    for (key, fallback) in [("user.name", "Laputa"), ("user.email", "vault@laputa.app")] {
        let check = Command::new("git")
            .args(["config", key])
            .current_dir(dir)
            .output()
            .map_err(|e| format!("Failed to check git config: {}", e))?;

        let value = String::from_utf8_lossy(&check.stdout);
        if !check.status.success() || value.trim().is_empty() {
            run_git(dir, &["config", key, fallback])?;
        }
    }
    Ok(())
}

/// Extract "owner/repo" from a GitHub remote URL.
/// Supports HTTPS (https://github.com/owner/repo.git) and
/// SSH (git@github.com:owner/repo.git) formats.
fn parse_github_repo_path(url: &str) -> Option<String> {
    let trimmed = url.trim();

    // SSH format: git@github.com:owner/repo.git
    if let Some(rest) = trimmed.strip_prefix("git@github.com:") {
        let path = rest.strip_suffix(".git").unwrap_or(rest);
        if path.contains('/') {
            return Some(path.to_string());
        }
    }

    // HTTPS format: https://github.com/owner/repo.git
    // Also handle token-embedded URLs: https://token@github.com/owner/repo.git
    if trimmed.contains("github.com/") {
        let after = trimmed.split("github.com/").nth(1)?;
        let path = after.strip_suffix(".git").unwrap_or(after);
        if path.contains('/') {
            return Some(path.to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::TempDir;

    pub(crate) fn setup_git_repo() -> TempDir {
        let dir = TempDir::new().unwrap();
        let path = dir.path();

        Command::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();

        Command::new("git")
            .args(["config", "user.email", "test@test.com"])
            .current_dir(path)
            .output()
            .unwrap();

        Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .unwrap();

        dir
    }

    /// Set up a bare "remote" and a clone that acts as the working vault.
    pub(crate) fn setup_remote_pair() -> (TempDir, TempDir, TempDir) {
        let bare_dir = TempDir::new().unwrap();
        let bare = bare_dir.path();

        Command::new("git")
            .args(["init", "--bare"])
            .current_dir(bare)
            .output()
            .unwrap();

        let clone_a_dir = TempDir::new().unwrap();
        Command::new("git")
            .args(["clone", bare.to_str().unwrap(), "."])
            .current_dir(clone_a_dir.path())
            .output()
            .unwrap();
        for cmd in &[
            &["config", "user.email", "a@test.com"][..],
            &["config", "user.name", "User A"][..],
        ] {
            Command::new("git")
                .args(*cmd)
                .current_dir(clone_a_dir.path())
                .output()
                .unwrap();
        }

        let clone_b_dir = TempDir::new().unwrap();
        Command::new("git")
            .args(["clone", bare.to_str().unwrap(), "."])
            .current_dir(clone_b_dir.path())
            .output()
            .unwrap();
        for cmd in &[
            &["config", "user.email", "b@test.com"][..],
            &["config", "user.name", "User B"][..],
        ] {
            Command::new("git")
                .args(*cmd)
                .current_dir(clone_b_dir.path())
                .output()
                .unwrap();
        }

        (bare_dir, clone_a_dir, clone_b_dir)
    }

    #[test]
    fn test_init_repo_creates_git_directory() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("new-vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("note.md"), "# Test\n").unwrap();

        init_repo(vault.to_str().unwrap()).unwrap();

        assert!(vault.join(".git").exists());
    }

    #[test]
    fn test_init_repo_creates_initial_commit() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("new-vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("note.md"), "# Test\n").unwrap();

        init_repo(vault.to_str().unwrap()).unwrap();

        let log = Command::new("git")
            .args(["log", "--oneline"])
            .current_dir(&vault)
            .output()
            .unwrap();
        let log_str = String::from_utf8_lossy(&log.stdout);
        assert!(log_str.contains("Initial vault setup"));
    }

    #[test]
    fn test_init_repo_stages_all_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("new-vault");
        fs::create_dir_all(vault.join("sub")).unwrap();
        fs::write(vault.join("note.md"), "# Test\n").unwrap();
        fs::write(vault.join("sub/nested.md"), "# Nested\n").unwrap();

        init_repo(vault.to_str().unwrap()).unwrap();

        let status = Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&vault)
            .output()
            .unwrap();
        assert!(
            String::from_utf8_lossy(&status.stdout).trim().is_empty(),
            "All files should be committed"
        );
    }

    #[test]
    fn test_init_repo_creates_gitignore_with_ds_store() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("new-vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("note.md"), "# Test\n").unwrap();

        init_repo(vault.to_str().unwrap()).unwrap();

        let gitignore = vault.join(".gitignore");
        assert!(gitignore.exists(), ".gitignore should be created by init_repo");
        let content = fs::read_to_string(&gitignore).unwrap();
        assert!(content.contains(".DS_Store"), ".gitignore should exclude .DS_Store");
        assert!(content.contains(".laputa-cache.json"), ".gitignore should exclude .laputa-cache.json");
        assert!(content.contains(".laputa/settings.json"), ".gitignore should exclude settings.json");
    }

    #[test]
    fn test_init_repo_does_not_overwrite_existing_gitignore() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("new-vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("note.md"), "# Test\n").unwrap();
        fs::write(vault.join(".gitignore"), "custom-rule\n").unwrap();

        init_repo(vault.to_str().unwrap()).unwrap();

        let content = fs::read_to_string(vault.join(".gitignore")).unwrap();
        assert_eq!(content, "custom-rule\n", "existing .gitignore should not be overwritten");
    }

    #[test]
    fn test_parse_github_repo_path_https() {
        assert_eq!(
            parse_github_repo_path("https://github.com/owner/repo.git"),
            Some("owner/repo".to_string())
        );
        assert_eq!(
            parse_github_repo_path("https://github.com/owner/repo"),
            Some("owner/repo".to_string())
        );
    }

    #[test]
    fn test_parse_github_repo_path_ssh() {
        assert_eq!(
            parse_github_repo_path("git@github.com:owner/repo.git"),
            Some("owner/repo".to_string())
        );
        assert_eq!(
            parse_github_repo_path("git@github.com:owner/repo"),
            Some("owner/repo".to_string())
        );
    }

    #[test]
    fn test_parse_github_repo_path_token_embedded() {
        assert_eq!(
            parse_github_repo_path("https://gho_abc123@github.com/owner/repo.git"),
            Some("owner/repo".to_string())
        );
    }

    #[test]
    fn test_parse_github_repo_path_non_github() {
        assert_eq!(
            parse_github_repo_path("https://gitlab.com/owner/repo.git"),
            None
        );
    }
}
