use std::path::Path;
use std::process::Command;

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::tests::setup_git_repo;
    use std::fs;
    use std::process::Command;

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
}
