use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

/// Get git log history for a specific file in the vault.
pub fn get_file_history(vault_path: &str, file_path: &str) -> Result<Vec<GitCommit>, String> {
    let vault = Path::new(vault_path);
    let file = Path::new(file_path);

    let relative = file
        .strip_prefix(vault)
        .map_err(|_| format!("File {} is not inside vault {}", file_path, vault_path))?;

    let relative_str = relative
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;

    let output = Command::new("git")
        .args([
            "log",
            "--format=%H|%h|%an|%aI|%s",
            "-n",
            "20",
            "--",
            relative_str,
        ])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // No commits yet is not an error - just return empty history
        if stderr.contains("does not have any commits yet") {
            return Ok(Vec::new());
        }
        return Err(format!("git log failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            // Format: hash|short_hash|author|date|message
            // Use splitn(5) so message (last) can contain '|'
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() != 5 {
                return None;
            }
            let date = chrono::DateTime::parse_from_rfc3339(parts[3])
                .map(|dt| dt.timestamp())
                .unwrap_or(0);

            Some(GitCommit {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                date,
                message: parts[4].to_string(),
            })
        })
        .collect();

    Ok(commits)
}

/// Get list of modified/added/deleted files in the vault (uncommitted changes).
pub fn get_modified_files(vault_path: &str) -> Result<Vec<ModifiedFile>, String> {
    let vault = Path::new(vault_path);

    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git status failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            let status_code = &line[..2];
            let path = line[3..].trim().to_string();

            // Only include markdown files
            if !path.ends_with(".md") {
                return None;
            }

            let status = match status_code.trim() {
                "M" | "MM" | "AM" => "modified",
                "A" => "added",
                "D" => "deleted",
                "??" => "untracked",
                "R" | "RM" => "renamed",
                _ => "modified",
            };

            let full_path = vault.join(&path).to_string_lossy().to_string();

            Some(ModifiedFile {
                path: full_path,
                relative_path: path,
                status: status.to_string(),
            })
        })
        .collect();

    Ok(files)
}

#[derive(Debug, Serialize, Clone)]
pub struct ModifiedFile {
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub status: String,
}

/// Get git diff for a specific file.
pub fn get_file_diff(vault_path: &str, file_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);
    let file = Path::new(file_path);

    let relative = file
        .strip_prefix(vault)
        .map_err(|_| format!("File {} is not inside vault {}", file_path, vault_path))?;

    let relative_str = relative
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;

    // First try tracked file diff
    let output = Command::new("git")
        .args(["diff", "--", relative_str])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // If no diff (maybe staged or untracked), try diff --cached
    if stdout.is_empty() {
        let cached = Command::new("git")
            .args(["diff", "--cached", "--", relative_str])
            .current_dir(vault)
            .output()
            .map_err(|e| format!("Failed to run git diff --cached: {}", e))?;

        let cached_stdout = String::from_utf8_lossy(&cached.stdout).to_string();
        if !cached_stdout.is_empty() {
            return Ok(cached_stdout);
        }

        // Try showing untracked file as all-new
        let status = Command::new("git")
            .args(["status", "--porcelain", "--", relative_str])
            .current_dir(vault)
            .output()
            .map_err(|e| format!("Failed to run git status: {}", e))?;

        let status_out = String::from_utf8_lossy(&status.stdout);
        if status_out.starts_with("??") {
            // Untracked file: show entire content as added
            let content =
                std::fs::read_to_string(file).map_err(|e| format!("Failed to read file: {}", e))?;
            let lines: Vec<String> = content.lines().map(|l| format!("+{}", l)).collect();
            return Ok(format!(
                "diff --git a/{0} b/{0}\nnew file\n--- /dev/null\n+++ b/{0}\n@@ -0,0 +1,{1} @@\n{2}",
                relative_str,
                lines.len(),
                lines.join("\n")
            ));
        }
    }

    Ok(stdout)
}

/// Get git diff for a specific file at a given commit (compared to its parent).
pub fn get_file_diff_at_commit(
    vault_path: &str,
    file_path: &str,
    commit_hash: &str,
) -> Result<String, String> {
    let vault = Path::new(vault_path);
    let file = Path::new(file_path);

    let relative = file
        .strip_prefix(vault)
        .map_err(|_| format!("File {} is not inside vault {}", file_path, vault_path))?;

    let relative_str = relative
        .to_str()
        .ok_or_else(|| "Invalid UTF-8 in path".to_string())?;

    // Show diff between commit^ and commit for this file
    let output = Command::new("git")
        .args([
            "diff",
            &format!("{}^", commit_hash),
            commit_hash,
            "--",
            relative_str,
        ])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git diff: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // If diff is empty, it might be the initial commit (no parent).
    // Fall back to showing the full file content as added.
    if stdout.is_empty() {
        let show = Command::new("git")
            .args(["show", &format!("{}:{}", commit_hash, relative_str)])
            .current_dir(vault)
            .output()
            .map_err(|e| format!("Failed to run git show: {}", e))?;

        if show.status.success() {
            let content = String::from_utf8_lossy(&show.stdout);
            let lines: Vec<String> = content.lines().map(|l| format!("+{}", l)).collect();
            return Ok(format!(
                "diff --git a/{0} b/{0}\nnew file\n--- /dev/null\n+++ b/{0}\n@@ -0,0 +1,{1} @@\n{2}",
                relative_str,
                lines.len(),
                lines.join("\n")
            ));
        }
    }

    Ok(stdout)
}

/// Commit all changes with a message.
pub fn git_commit(vault_path: &str, message: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);

    // Stage all changes
    let add = Command::new("git")
        .args(["add", "-A"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git add: {}", e))?;

    if !add.status.success() {
        let stderr = String::from_utf8_lossy(&add.stderr);
        return Err(format!("git add failed: {}", stderr));
    }

    // Commit
    let commit = Command::new("git")
        .args(["commit", "-m", message])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git commit: {}", e))?;

    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr);
        let stdout = String::from_utf8_lossy(&commit.stdout);
        // git writes "nothing to commit" to stdout, not stderr
        let detail = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        return Err(format!("git commit failed: {}", detail.trim()));
    }

    Ok(String::from_utf8_lossy(&commit.stdout).to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GitPullResult {
    pub status: String, // "up_to_date" | "updated" | "conflict" | "no_remote" | "error"
    pub message: String,
    #[serde(rename = "updatedFiles")]
    pub updated_files: Vec<String>,
    #[serde(rename = "conflictFiles")]
    pub conflict_files: Vec<String>,
}

/// Check whether the vault repo has at least one remote configured.
pub fn has_remote(vault_path: &str) -> Result<bool, String> {
    let vault = Path::new(vault_path);
    let output = Command::new("git")
        .args(["remote"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git remote: {}", e))?;

    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
}

/// Pull latest changes from remote. Uses --no-rebase to merge.
/// Returns a structured result with status and affected files.
pub fn git_pull(vault_path: &str) -> Result<GitPullResult, String> {
    let vault = Path::new(vault_path);

    if !has_remote(vault_path)? {
        return Ok(GitPullResult {
            status: "no_remote".to_string(),
            message: "No remote configured".to_string(),
            updated_files: vec![],
            conflict_files: vec![],
        });
    }

    let output = Command::new("git")
        .args(["pull", "--no-rebase"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git pull: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        if stdout.contains("Already up to date") || stdout.contains("Already up-to-date") {
            return Ok(GitPullResult {
                status: "up_to_date".to_string(),
                message: "Already up to date".to_string(),
                updated_files: vec![],
                conflict_files: vec![],
            });
        }
        let updated = parse_updated_files(&stdout);
        return Ok(GitPullResult {
            status: "updated".to_string(),
            message: format!("{} file(s) updated", updated.len()),
            updated_files: updated,
            conflict_files: vec![],
        });
    }

    // Check for merge conflicts
    let conflicts = get_conflict_files(vault_path).unwrap_or_default();
    if !conflicts.is_empty() {
        return Ok(GitPullResult {
            status: "conflict".to_string(),
            message: format!("Merge conflict in {} file(s)", conflicts.len()),
            updated_files: vec![],
            conflict_files: conflicts,
        });
    }

    // Network error or other failure — report as error
    let detail = if stderr.trim().is_empty() {
        stdout.trim().to_string()
    } else {
        stderr.trim().to_string()
    };
    Ok(GitPullResult {
        status: "error".to_string(),
        message: detail,
        updated_files: vec![],
        conflict_files: vec![],
    })
}

/// List files with merge conflicts (unmerged paths).
pub fn get_conflict_files(vault_path: &str) -> Result<Vec<String>, String> {
    let vault = Path::new(vault_path);
    let output = Command::new("git")
        .args(["diff", "--name-only", "--diff-filter=U"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to check conflicts: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect())
}

/// Parse `git pull` output to extract updated file paths.
fn parse_updated_files(stdout: &str) -> Vec<String> {
    stdout
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            // Lines like " path/to/file.md | 5 ++-" in diffstat
            if trimmed.contains('|') {
                let path = trimmed.split('|').next()?.trim();
                if !path.is_empty() {
                    return Some(path.to_string());
                }
            }
            None
        })
        .collect()
}

/// Push to remote.
pub fn git_push(vault_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);

    let output = Command::new("git")
        .args(["push"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git push: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git push failed: {}", stderr));
    }

    // git push often writes to stderr even on success
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(format!("{}{}", stdout, stderr))
}

#[derive(Debug, Serialize, Clone)]
pub struct LastCommitInfo {
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    #[serde(rename = "commitUrl")]
    pub commit_url: Option<String>,
}

/// Get the last commit's short hash and a GitHub URL (if remote is GitHub).
pub fn get_last_commit_info(vault_path: &str) -> Result<Option<LastCommitInfo>, String> {
    let vault = Path::new(vault_path);

    let output = Command::new("git")
        .args(["log", "-1", "--format=%H|%h"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("does not have any commits yet") {
            return Ok(None);
        }
        return Err(format!("git log failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.trim();
    if line.is_empty() {
        return Ok(None);
    }

    let parts: Vec<&str> = line.splitn(2, '|').collect();
    if parts.len() != 2 {
        return Ok(None);
    }

    let full_hash = parts[0];
    let short_hash = parts[1].to_string();

    let commit_url = get_github_commit_url(vault_path, full_hash);

    Ok(Some(LastCommitInfo {
        short_hash,
        commit_url,
    }))
}

/// Try to build a GitHub commit URL from the origin remote URL.
fn get_github_commit_url(vault_path: &str, full_hash: &str) -> Option<String> {
    let vault = Path::new(vault_path);
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(vault)
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let repo_path = parse_github_repo_path(&url)?;
    Some(format!(
        "https://github.com/{}/commit/{}",
        repo_path, full_hash
    ))
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

    fn setup_git_repo() -> TempDir {
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

    #[test]
    fn test_get_file_history_with_commits() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let file = vault.join("test.md");

        fs::write(&file, "# Initial\n").unwrap();
        Command::new("git")
            .args(["add", "test.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(vault)
            .output()
            .unwrap();

        fs::write(&file, "# Updated\n\nNew content.").unwrap();
        Command::new("git")
            .args(["add", "test.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Update test"])
            .current_dir(vault)
            .output()
            .unwrap();

        let history = get_file_history(vault.to_str().unwrap(), file.to_str().unwrap()).unwrap();

        assert_eq!(history.len(), 2);
        assert_eq!(history[0].message, "Update test");
        assert_eq!(history[1].message, "Initial commit");
        assert_eq!(history[0].author, "Test User");
        assert!(!history[0].hash.is_empty());
        assert!(!history[0].short_hash.is_empty());
    }

    #[test]
    fn test_get_file_history_no_commits() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let file = vault.join("new.md");
        fs::write(&file, "# New\n").unwrap();

        let history = get_file_history(vault.to_str().unwrap(), file.to_str().unwrap()).unwrap();

        assert!(history.is_empty());
    }

    #[test]
    fn test_get_modified_files() {
        let dir = setup_git_repo();
        let vault = dir.path();

        // Create and commit a file
        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        Command::new("git")
            .args(["add", "note.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Add note"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Modify it
        fs::write(vault.join("note.md"), "# Note\n\nUpdated.").unwrap();
        // Add an untracked file
        fs::write(vault.join("new.md"), "# New\n").unwrap();

        let modified = get_modified_files(vault.to_str().unwrap()).unwrap();

        assert!(modified.len() >= 2);
        let statuses: Vec<&str> = modified.iter().map(|f| f.status.as_str()).collect();
        assert!(statuses.contains(&"modified") || statuses.contains(&"untracked"));
    }

    #[test]
    fn test_get_file_diff() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let file = vault.join("diff-test.md");

        fs::write(&file, "# Test\n\nOriginal content.").unwrap();
        Command::new("git")
            .args(["add", "diff-test.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Add diff-test"])
            .current_dir(vault)
            .output()
            .unwrap();

        fs::write(&file, "# Test\n\nModified content.").unwrap();

        let diff = get_file_diff(vault.to_str().unwrap(), file.to_str().unwrap()).unwrap();

        assert!(!diff.is_empty());
        assert!(diff.contains("-Original content."));
        assert!(diff.contains("+Modified content."));
    }

    #[test]
    fn test_get_file_diff_at_commit() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let file = vault.join("diff-at-commit.md");

        fs::write(&file, "# First\n\nOriginal content.").unwrap();
        Command::new("git")
            .args(["add", "diff-at-commit.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "First commit"])
            .current_dir(vault)
            .output()
            .unwrap();

        fs::write(&file, "# First\n\nModified content.").unwrap();
        Command::new("git")
            .args(["add", "diff-at-commit.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Second commit"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Get hash of second commit
        let log = Command::new("git")
            .args(["log", "--format=%H", "-1"])
            .current_dir(vault)
            .output()
            .unwrap();
        let hash = String::from_utf8_lossy(&log.stdout).trim().to_string();

        let diff = get_file_diff_at_commit(vault.to_str().unwrap(), file.to_str().unwrap(), &hash)
            .unwrap();

        assert!(!diff.is_empty());
        assert!(diff.contains("-Original content."));
        assert!(diff.contains("+Modified content."));
    }

    #[test]
    fn test_get_file_diff_at_initial_commit() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let file = vault.join("initial.md");

        fs::write(&file, "# Initial\n\nHello world.").unwrap();
        Command::new("git")
            .args(["add", "initial.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Initial commit"])
            .current_dir(vault)
            .output()
            .unwrap();

        let log = Command::new("git")
            .args(["log", "--format=%H", "-1"])
            .current_dir(vault)
            .output()
            .unwrap();
        let hash = String::from_utf8_lossy(&log.stdout).trim().to_string();

        let diff = get_file_diff_at_commit(vault.to_str().unwrap(), file.to_str().unwrap(), &hash)
            .unwrap();

        assert!(!diff.is_empty());
        assert!(diff.contains("+# Initial"));
        assert!(diff.contains("+Hello world."));
    }

    #[test]
    fn test_git_commit() {
        let dir = setup_git_repo();
        let vault = dir.path();

        fs::write(vault.join("commit-test.md"), "# Test\n").unwrap();

        let result = git_commit(vault.to_str().unwrap(), "Test commit");
        assert!(result.is_ok());

        // Verify the commit exists
        let log = Command::new("git")
            .args(["log", "--oneline", "-1"])
            .current_dir(vault)
            .output()
            .unwrap();
        let log_str = String::from_utf8_lossy(&log.stdout);
        assert!(log_str.contains("Test commit"));
    }

    #[test]
    fn test_commit_flow_modified_files_then_commit_clears() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        // Create and commit initial file
        fs::write(vault.join("flow.md"), "# Original\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Modify the file on disk
        fs::write(vault.join("flow.md"), "# Modified\n").unwrap();

        // get_modified_files should detect the change
        let modified = get_modified_files(vp).unwrap();
        assert!(
            modified.iter().any(|f| f.relative_path == "flow.md"),
            "Modified file should be detected after write"
        );

        // Commit the change
        let result = git_commit(vp, "update flow").unwrap();
        assert!(
            result.contains("1 file changed") || result.contains("flow.md"),
            "Commit output should reference the changed file: {}",
            result
        );

        // After commit, get_modified_files should return empty
        let after = get_modified_files(vp).unwrap();
        assert!(
            after.is_empty(),
            "No modified files should remain after commit, found: {:?}",
            after
        );
    }

    #[test]
    fn test_commit_nothing_to_commit_returns_error() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        // Create and commit, so working tree is clean
        fs::write(vault.join("clean.md"), "# Clean\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Committing again with no changes should fail
        let result = git_commit(vp, "nothing here");
        assert!(result.is_err(), "Commit should fail when nothing to commit");
        assert!(
            result.unwrap_err().contains("nothing to commit"),
            "Error should mention 'nothing to commit'"
        );
    }

    #[test]
    fn test_has_remote_returns_false_for_local_repo() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        // A fresh local repo has no remote
        assert!(!has_remote(vp).unwrap());
    }

    #[test]
    fn test_has_remote_returns_true_when_remote_exists() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        Command::new("git")
            .args(["remote", "add", "origin", "https://example.com/repo.git"])
            .current_dir(vault)
            .output()
            .unwrap();

        assert!(has_remote(vp).unwrap());
    }

    #[test]
    fn test_git_pull_no_remote_returns_no_remote() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        git_commit(vp, "initial").unwrap();

        let result = git_pull(vp).unwrap();
        assert_eq!(result.status, "no_remote");
        assert!(result.updated_files.is_empty());
        assert!(result.conflict_files.is_empty());
    }

    /// Set up a bare "remote" and a clone that acts as the working vault.
    fn setup_remote_pair() -> (TempDir, TempDir, TempDir) {
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
    fn test_git_pull_up_to_date() {
        let (_bare, clone_a, _clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();

        // Push a commit from A
        fs::write(clone_a.path().join("note.md"), "# Note\n").unwrap();
        git_commit(vp_a, "initial").unwrap();
        git_push(vp_a).unwrap();

        // Pulling again from A should be up to date
        let result = git_pull(vp_a).unwrap();
        assert_eq!(result.status, "up_to_date");
    }

    #[test]
    fn test_git_pull_updated_files() {
        let (_bare, clone_a, clone_b) = setup_remote_pair();
        let vp_a = clone_a.path().to_str().unwrap();
        let vp_b = clone_b.path().to_str().unwrap();

        // A pushes a commit
        fs::write(clone_a.path().join("note.md"), "# Note\n").unwrap();
        git_commit(vp_a, "initial").unwrap();
        git_push(vp_a).unwrap();

        // B pulls to get initial
        git_pull(vp_b).unwrap();

        // A makes a change and pushes
        fs::write(clone_a.path().join("note.md"), "# Updated Note\n").unwrap();
        git_commit(vp_a, "update note").unwrap();
        git_push(vp_a).unwrap();

        // B pulls and should see the update
        let result = git_pull(vp_b).unwrap();
        assert_eq!(result.status, "updated");
        assert!(result.conflict_files.is_empty());
    }

    #[test]
    fn test_get_conflict_files_empty_when_clean() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        git_commit(vp, "initial").unwrap();

        let conflicts = get_conflict_files(vp).unwrap();
        assert!(conflicts.is_empty());
    }

    #[test]
    fn test_parse_updated_files_diffstat() {
        let stdout =
            " Fast-forward\n note.md | 2 +-\n project/plan.md | 4 ++--\n 2 files changed\n";
        let files = parse_updated_files(stdout);
        assert_eq!(files, vec!["note.md", "project/plan.md"]);
    }

    #[test]
    fn test_parse_updated_files_empty() {
        let stdout = "Already up to date.\n";
        let files = parse_updated_files(stdout);
        assert!(files.is_empty());
    }

    #[test]
    fn test_git_pull_result_serialization() {
        let result = GitPullResult {
            status: "updated".to_string(),
            message: "2 file(s) updated".to_string(),
            updated_files: vec!["note.md".to_string()],
            conflict_files: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"updatedFiles\""));
        assert!(json.contains("\"conflictFiles\""));

        let parsed: GitPullResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "updated");
        assert_eq!(parsed.updated_files.len(), 1);
    }

    #[test]
    fn test_get_last_commit_info_with_commit() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        git_commit(vp, "initial").unwrap();

        let info = get_last_commit_info(vp).unwrap();
        assert!(info.is_some());
        let info = info.unwrap();
        assert_eq!(info.short_hash.len(), 7);
        // No remote configured, so commit_url should be None
        assert!(info.commit_url.is_none());
    }

    #[test]
    fn test_get_last_commit_info_no_commits() {
        let dir = setup_git_repo();
        let vp = dir.path().to_str().unwrap();

        let info = get_last_commit_info(vp).unwrap();
        assert!(info.is_none());
    }

    #[test]
    fn test_get_last_commit_info_with_github_remote() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        git_commit(vp, "initial").unwrap();

        Command::new("git")
            .args([
                "remote",
                "add",
                "origin",
                "https://github.com/lucaong/laputa-vault.git",
            ])
            .current_dir(vault)
            .output()
            .unwrap();

        let info = get_last_commit_info(vp).unwrap().unwrap();
        assert!(info.commit_url.is_some());
        let url = info.commit_url.unwrap();
        assert!(url.starts_with("https://github.com/lucaong/laputa-vault/commit/"));
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
