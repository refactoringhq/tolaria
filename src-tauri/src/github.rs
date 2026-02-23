use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// GitHub OAuth App client ID. Replace with your registered GitHub App's client_id.
const GITHUB_CLIENT_ID: &str = "Ov23liCuBz7Z5hKk6T8c";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubRepo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub private: bool,
    pub clone_url: String,
    pub html_url: String,
    pub updated_at: Option<String>,
}

/// Lists the authenticated user's GitHub repositories.
pub async fn github_list_repos(token: &str) -> Result<Vec<GithubRepo>, String> {
    let client = reqwest::Client::new();
    let mut all_repos: Vec<GithubRepo> = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!(
            "https://api.github.com/user/repos?per_page=100&sort=updated&page={}",
            page
        );
        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Laputa-App")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .await
            .map_err(|e| format!("GitHub API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API error {}: {}", status, body));
        }

        let repos: Vec<GithubRepo> = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

        let count = repos.len();
        all_repos.extend(repos);

        if count < 100 {
            break;
        }
        page += 1;
        if page > 10 {
            break; // safety limit: 1000 repos max
        }
    }

    Ok(all_repos)
}

#[derive(Debug, Deserialize, Serialize)]
struct CreateRepoResponse {
    name: String,
    full_name: String,
    description: Option<String>,
    private: bool,
    clone_url: String,
    html_url: String,
    updated_at: Option<String>,
}

/// Creates a new GitHub repository for the authenticated user.
pub async fn github_create_repo(
    token: &str,
    name: &str,
    private: bool,
) -> Result<GithubRepo, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
        "description": "Laputa vault"
    });

    let response = client
        .post("https://api.github.com/user/repos")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Laputa-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if status.as_u16() == 422 && body.contains("name already exists") {
            return Err("Repository name already exists on your account".to_string());
        }
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    let created: CreateRepoResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    Ok(GithubRepo {
        name: created.name,
        full_name: created.full_name,
        description: created.description,
        private: created.private,
        clone_url: created.clone_url,
        html_url: created.html_url,
        updated_at: created.updated_at,
    })
}

// --- OAuth Device Flow ---

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceFlowStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceFlowPollResult {
    pub status: String,
    pub access_token: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

/// Starts the GitHub OAuth device flow. Returns device code info for user authorization.
pub async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo")])
        .send()
        .await
        .map_err(|e| format!("Device flow request failed: {}", e))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Device flow start failed: {}", body));
    }

    response
        .json::<DeviceFlowStart>()
        .await
        .map_err(|e| format!("Failed to parse device flow response: {}", e))
}

/// Polls GitHub for the device flow authorization result.
pub async fn github_device_flow_poll(device_code: &str) -> Result<DeviceFlowPollResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
        ])
        .send()
        .await
        .map_err(|e| format!("Device flow poll failed: {}", e))?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Device flow poll HTTP error: {}", body));
    }

    #[derive(Deserialize)]
    struct RawResponse {
        access_token: Option<String>,
        error: Option<String>,
    }

    let raw: RawResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse poll response: {}", e))?;

    if let Some(token) = raw.access_token {
        Ok(DeviceFlowPollResult {
            status: "complete".to_string(),
            access_token: Some(token),
            error: None,
        })
    } else {
        let error = raw.error.unwrap_or_else(|| "unknown".to_string());
        let status = match error.as_str() {
            "authorization_pending" | "slow_down" => "pending",
            "expired_token" => "expired",
            _ => "error",
        };
        Ok(DeviceFlowPollResult {
            status: status.to_string(),
            access_token: None,
            error: Some(error),
        })
    }
}

/// Gets the authenticated GitHub user's profile.
pub async fn github_get_user(token: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Laputa-App")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| format!("GitHub user request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {}: {}", status, body));
    }

    response
        .json::<GitHubUser>()
        .await
        .map_err(|e| format!("Failed to parse user response: {}", e))
}

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

    #[test]
    fn test_inject_token_basic_github_url() {
        let url = "https://github.com/user/repo.git";
        let token = "gho_abc123";
        let result = inject_token_into_url(url, token).unwrap();
        assert_eq!(result, "https://oauth2:gho_abc123@github.com/user/repo.git");
    }

    #[test]
    fn test_inject_token_generic_https_url() {
        let url = "https://gitlab.com/user/repo.git";
        let token = "glpat-abc";
        let result = inject_token_into_url(url, token).unwrap();
        assert_eq!(result, "https://oauth2:glpat-abc@gitlab.com/user/repo.git");
    }

    #[test]
    fn test_inject_token_ssh_url_rejected() {
        let url = "git@github.com:user/repo.git";
        let result = inject_token_into_url(url, "token");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported URL format"));
    }

    #[test]
    fn test_inject_token_http_url_rejected() {
        let url = "http://github.com/user/repo.git";
        let result = inject_token_into_url(url, "token");
        assert!(result.is_err());
    }

    #[test]
    fn test_inject_token_github_without_dot_git() {
        let url = "https://github.com/user/repo";
        let result = inject_token_into_url(url, "tok").unwrap();
        assert_eq!(result, "https://oauth2:tok@github.com/user/repo");
    }

    #[test]
    fn test_clone_repo_nonempty_dest() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path();
        std::fs::write(path.join("existing.txt"), "data").unwrap();

        let result = clone_repo(
            "https://github.com/test/repo.git",
            "token",
            path.to_str().unwrap(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not empty"));
    }

    #[test]
    fn test_clone_repo_ssh_url_rejected() {
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("new-clone");

        let result = clone_repo(
            "git@github.com:user/repo.git",
            "token",
            dest.to_str().unwrap(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported URL format"));
    }

    #[test]
    fn test_clone_repo_empty_dest_allowed() {
        // An empty existing directory should not be rejected
        let dir = tempfile::TempDir::new().unwrap();
        let dest = dir.path().join("empty-dir");
        std::fs::create_dir(&dest).unwrap();

        // This will fail at the git clone step (invalid URL) but should pass the directory check
        let result = clone_repo(
            "https://github.com/nonexistent/repo.git",
            "token",
            dest.to_str().unwrap(),
        );
        assert!(result.is_err());
        // Should fail at git clone, not at directory check
        assert!(result.unwrap_err().contains("git clone failed"));
    }

    #[test]
    fn test_configure_remote_auth_on_git_repo() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path();

        // Initialize a git repo
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

        let result = configure_remote_auth(
            path.to_str().unwrap(),
            "https://github.com/user/repo.git",
            "gho_test123",
        );
        assert!(result.is_ok());

        // Verify the remote URL was updated
        let output = StdCommand::new("git")
            .args(["remote", "get-url", "origin"])
            .current_dir(path)
            .output()
            .unwrap();
        let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        assert_eq!(url, "https://oauth2:gho_test123@github.com/user/repo.git");
    }

    #[test]
    fn test_github_repo_serialization() {
        let repo = GithubRepo {
            name: "test-repo".to_string(),
            full_name: "user/test-repo".to_string(),
            description: Some("A test repo".to_string()),
            private: true,
            clone_url: "https://github.com/user/test-repo.git".to_string(),
            html_url: "https://github.com/user/test-repo".to_string(),
            updated_at: Some("2026-02-20T10:00:00Z".to_string()),
        };
        let json = serde_json::to_string(&repo).unwrap();
        let parsed: GithubRepo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "test-repo");
        assert_eq!(parsed.full_name, "user/test-repo");
        assert!(parsed.private);
        assert_eq!(parsed.description, Some("A test repo".to_string()));
    }

    #[test]
    fn test_github_repo_deserialization_null_fields() {
        let json = r#"{"name":"r","full_name":"u/r","description":null,"private":false,"clone_url":"https://x","html_url":"https://y","updated_at":null}"#;
        let repo: GithubRepo = serde_json::from_str(json).unwrap();
        assert_eq!(repo.name, "r");
        assert!(repo.description.is_none());
        assert!(repo.updated_at.is_none());
        assert!(!repo.private);
    }
}
