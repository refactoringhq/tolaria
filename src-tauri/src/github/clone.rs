use std::path::Path;
use std::process::Command;

/// Clones a GitHub repo to a local path using HTTPS + token auth.
pub fn clone_repo(url: &str, token: &str, local_path: &str) -> Result<String, String> {
    let dest = Path::new(local_path);

    if dest.exists()
        && dest
            .read_dir()
            .map(|mut d| d.next().is_some())
            .unwrap_or(false)
    {
        return Err(format!(
            "Destination '{}' already exists and is not empty",
            local_path
        ));
    }

    // Inject token into HTTPS URL: https://github.com/... → https://oauth2:TOKEN@github.com/...
    let auth_url = inject_token_into_url(url, token)?;

    let output = Command::new("git")
        .args(["clone", "--progress", &auth_url, local_path])
        .output()
        .map_err(|e| format!("Failed to run git clone: {}", e))?;

    if !output.status.success() {
        // Clean up partial clone on failure
        if dest.exists() {
            let _ = std::fs::remove_dir_all(dest);
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git clone failed: {}", stderr));
    }

    // Configure the remote to use token auth for future pushes
    configure_remote_auth(local_path, url, token)?;

    Ok(format!("Cloned to {}", local_path))
}

/// Injects an OAuth token into an HTTPS GitHub URL.
fn inject_token_into_url(url: &str, token: &str) -> Result<String, String> {
    if let Some(rest) = url.strip_prefix("https://github.com/") {
        Ok(format!("https://oauth2:{}@github.com/{}", token, rest))
    } else if let Some(rest) = url.strip_prefix("https://") {
        // Handle URLs that already have a host
        Ok(format!("https://oauth2:{}@{}", token, rest))
    } else {
        Err(format!(
            "Unsupported URL format: {}. Use an HTTPS URL.",
            url
        ))
    }
}

/// Sets up the git remote to use token-based HTTPS auth.
fn configure_remote_auth(local_path: &str, original_url: &str, token: &str) -> Result<(), String> {
    let auth_url = inject_token_into_url(original_url, token)?;
    let vault = Path::new(local_path);

    let output = Command::new("git")
        .args(["remote", "set-url", "origin", &auth_url])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to configure remote: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to set remote URL: {}", stderr));
    }

    // Also configure git user if not set
    let _ = Command::new("git")
        .args(["config", "user.email", "laputa@app.local"])
        .current_dir(vault)
        .output();
    let _ = Command::new("git")
        .args(["config", "user.name", "Laputa App"])
        .current_dir(vault)
        .output();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command as StdCommand;

    fn clone_err_contains(url: &str, expected: &str) {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("dest");
        let result = clone_repo(url, "token", dest.to_str().unwrap());
        assert!(result.unwrap_err().contains(expected));
    }

    #[test]
    fn test_inject_token_basic_github_url() {
        let result = inject_token_into_url("https://github.com/user/repo.git", "gho_abc123");
        assert_eq!(
            result.unwrap(),
            "https://oauth2:gho_abc123@github.com/user/repo.git"
        );
    }

    #[test]
    fn test_inject_token_generic_https_url() {
        let result = inject_token_into_url("https://gitlab.com/user/repo.git", "glpat-abc");
        assert_eq!(
            result.unwrap(),
            "https://oauth2:glpat-abc@gitlab.com/user/repo.git"
        );
    }

    #[test]
    fn test_inject_token_ssh_url_rejected() {
        let err = inject_token_into_url("git@github.com:user/repo.git", "token").unwrap_err();
        assert!(err.contains("Unsupported URL format"));
    }

    #[test]
    fn test_inject_token_http_url_rejected() {
        assert!(inject_token_into_url("http://github.com/user/repo.git", "token").is_err());
    }

    #[test]
    fn test_inject_token_github_without_dot_git() {
        let result = inject_token_into_url("https://github.com/user/repo", "tok");
        assert_eq!(result.unwrap(), "https://oauth2:tok@github.com/user/repo");
    }

    #[test]
    fn test_clone_repo_nonempty_dest() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::write(dir.path().join("existing.txt"), "data").unwrap();

        let result = clone_repo(
            "https://github.com/test/repo.git",
            "token",
            dir.path().to_str().unwrap(),
        );
        assert!(result.unwrap_err().contains("not empty"));
    }

    #[test]
    fn test_clone_repo_ssh_url_rejected() {
        clone_err_contains("git@github.com:user/repo.git", "Unsupported URL format");
    }

    #[test]
    fn test_clone_repo_empty_dest_allowed() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("empty-dir");
        std::fs::create_dir(&dest).unwrap();

        let result = clone_repo(
            "https://github.com/nonexistent/repo.git",
            "token",
            dest.to_str().unwrap(),
        );
        // Should fail at git clone, not at directory check
        assert!(result.unwrap_err().contains("git clone failed"));
    }

    #[test]
    fn test_configure_remote_auth_on_git_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path();

        StdCommand::new("git")
            .args(["init"])
            .current_dir(path)
            .output()
            .unwrap();
        StdCommand::new("git")
            .args([
                "remote",
                "add",
                "origin",
                "https://github.com/user/repo.git",
            ])
            .current_dir(path)
            .output()
            .unwrap();

        configure_remote_auth(
            path.to_str().unwrap(),
            "https://github.com/user/repo.git",
            "gho_test123",
        )
        .unwrap();

        let output = StdCommand::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(path)
            .output()
            .unwrap();
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        assert_eq!(url, "https://oauth2:gho_test123@github.com/user/repo.git");
    }
}
