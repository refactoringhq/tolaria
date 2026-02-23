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
    github_list_repos_with_base(token, "https://api.github.com").await
}

async fn github_list_repos_with_base(
    token: &str,
    api_base: &str,
) -> Result<Vec<GithubRepo>, String> {
    let client = reqwest::Client::new();
    let mut all_repos: Vec<GithubRepo> = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!(
            "{}/user/repos?per_page=100&sort=updated&page={}",
            api_base, page
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
    github_create_repo_with_base(token, name, private, "https://api.github.com").await
}

async fn github_create_repo_with_base(
    token: &str,
    name: &str,
    private: bool,
    api_base: &str,
) -> Result<GithubRepo, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "name": name,
        "private": private,
        "auto_init": true,
        "description": "Laputa vault"
    });

    let response = client
        .post(format!("{}/user/repos", api_base))
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
    github_device_flow_start_with_base("https://github.com").await
}

async fn github_device_flow_start_with_base(base_url: &str) -> Result<DeviceFlowStart, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/login/device/code", base_url))
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
    github_device_flow_poll_with_base(device_code, "https://github.com").await
}

async fn github_device_flow_poll_with_base(
    device_code: &str,
    base_url: &str,
) -> Result<DeviceFlowPollResult, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/login/oauth/access_token", base_url))
        .header("Accept", "application/json")
        .form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
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
    github_get_user_with_base(token, "https://api.github.com").await
}

async fn github_get_user_with_base(token: &str, api_base: &str) -> Result<GitHubUser, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/user", api_base))
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

    // ── Sync/pure logic tests ────────────────────────────────────────────────

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

    // ── Serialization/struct tests ───────────────────────────────────────────

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

    #[test]
    fn test_device_flow_start_serialization() {
        let start = DeviceFlowStart {
            device_code: "dc_123".to_string(),
            user_code: "ABCD-1234".to_string(),
            verification_uri: "https://github.com/login/device".to_string(),
            expires_in: 900,
            interval: 5,
        };
        let json = serde_json::to_string(&start).unwrap();
        let parsed: DeviceFlowStart = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.device_code, "dc_123");
        assert_eq!(parsed.user_code, "ABCD-1234");
        assert_eq!(parsed.verification_uri, "https://github.com/login/device");
        assert_eq!(parsed.expires_in, 900);
        assert_eq!(parsed.interval, 5);
    }

    #[test]
    fn test_device_flow_poll_result_complete() {
        let result = DeviceFlowPollResult {
            status: "complete".to_string(),
            access_token: Some("gho_abc123".to_string()),
            error: None,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: DeviceFlowPollResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "complete");
        assert_eq!(parsed.access_token, Some("gho_abc123".to_string()));
        assert!(parsed.error.is_none());
    }

    #[test]
    fn test_device_flow_poll_result_pending() {
        let result = DeviceFlowPollResult {
            status: "pending".to_string(),
            access_token: None,
            error: Some("authorization_pending".to_string()),
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: DeviceFlowPollResult = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, "pending");
        assert!(parsed.access_token.is_none());
        assert_eq!(parsed.error, Some("authorization_pending".to_string()));
    }

    #[test]
    fn test_github_user_serialization() {
        let user = GitHubUser {
            login: "lucaong".to_string(),
            name: Some("Luca Ongaro".to_string()),
            avatar_url: "https://avatars.githubusercontent.com/u/123".to_string(),
        };
        let json = serde_json::to_string(&user).unwrap();
        let parsed: GitHubUser = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.login, "lucaong");
        assert_eq!(parsed.name, Some("Luca Ongaro".to_string()));
    }

    #[test]
    fn test_github_user_deserialization_null_name() {
        let json = r#"{"login":"bot","name":null,"avatar_url":"https://x"}"#;
        let user: GitHubUser = serde_json::from_str(json).unwrap();
        assert_eq!(user.login, "bot");
        assert!(user.name.is_none());
    }

    // ── HTTP mock tests ──────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_github_list_repos_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=1")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"[{"name":"my-repo","full_name":"user/my-repo","description":"A repo","private":false,"clone_url":"https://github.com/user/my-repo.git","html_url":"https://github.com/user/my-repo","updated_at":"2026-02-01T00:00:00Z"}]"#,
            )
            .create_async()
            .await;

        let result = github_list_repos_with_base("token123", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let repos = result.unwrap();
        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].name, "my-repo");
        assert_eq!(repos[0].full_name, "user/my-repo");
        assert!(!repos[0].private);
    }

    #[tokio::test]
    async fn test_github_list_repos_empty() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=1")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body("[]")
            .create_async()
            .await;

        let result = github_list_repos_with_base("token123", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_github_list_repos_auth_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=1")
            .with_status(401)
            .with_header("content-type", "application/json")
            .with_body(r#"{"message":"Bad credentials"}"#)
            .create_async()
            .await;

        let result = github_list_repos_with_base("bad_token", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("GitHub API error"));
    }

    #[tokio::test]
    async fn test_github_list_repos_paginated() {
        // Return 100 repos on page 1 (triggers pagination), then fewer on page 2
        let mut server = mockito::Server::new_async().await;

        // Build 100 repos for page 1
        let repos_page1: Vec<serde_json::Value> = (0..100)
            .map(|i| {
                serde_json::json!({
                    "name": format!("repo-{}", i),
                    "full_name": format!("user/repo-{}", i),
                    "description": null,
                    "private": false,
                    "clone_url": format!("https://github.com/user/repo-{}.git", i),
                    "html_url": format!("https://github.com/user/repo-{}", i),
                    "updated_at": null
                })
            })
            .collect();

        let mock1 = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=1")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(serde_json::to_string(&repos_page1).unwrap())
            .create_async()
            .await;

        let mock2 = server
            .mock("GET", "/user/repos?per_page=100&sort=updated&page=2")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"[{"name":"extra-repo","full_name":"user/extra-repo","description":null,"private":true,"clone_url":"https://github.com/user/extra-repo.git","html_url":"https://github.com/user/extra-repo","updated_at":null}]"#,
            )
            .create_async()
            .await;

        let result = github_list_repos_with_base("token", &server.url()).await;
        mock1.assert_async().await;
        mock2.assert_async().await;
        assert!(result.is_ok());
        let repos = result.unwrap();
        assert_eq!(repos.len(), 101);
        assert_eq!(repos[100].name, "extra-repo");
    }

    #[tokio::test]
    async fn test_github_create_repo_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/user/repos")
            .with_status(201)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"name":"new-repo","full_name":"user/new-repo","description":"Laputa vault","private":true,"clone_url":"https://github.com/user/new-repo.git","html_url":"https://github.com/user/new-repo","updated_at":"2026-02-01T00:00:00Z"}"#,
            )
            .create_async()
            .await;

        let result = github_create_repo_with_base("token", "new-repo", true, &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let repo = result.unwrap();
        assert_eq!(repo.name, "new-repo");
        assert!(repo.private);
    }

    #[tokio::test]
    async fn test_github_create_repo_name_exists() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/user/repos")
            .with_status(422)
            .with_header("content-type", "application/json")
            .with_body(r#"{"message":"Validation Failed","errors":[{"resource":"Repository","code":"custom","field":"name","message":"name already exists on this account"}]}"#)
            .create_async()
            .await;

        let result =
            github_create_repo_with_base("token", "existing-repo", false, &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Repository name already exists"));
    }

    #[tokio::test]
    async fn test_github_create_repo_server_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/user/repos")
            .with_status(500)
            .with_header("content-type", "application/json")
            .with_body(r#"{"message":"Internal Server Error"}"#)
            .create_async()
            .await;

        let result = github_create_repo_with_base("token", "new-repo", false, &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("GitHub API error 500"));
    }

    #[tokio::test]
    async fn test_github_device_flow_start_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/device/code")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"device_code":"dev_abc","user_code":"ABCD-1234","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}"#,
            )
            .create_async()
            .await;

        let result = github_device_flow_start_with_base(&server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let start = result.unwrap();
        assert_eq!(start.device_code, "dev_abc");
        assert_eq!(start.user_code, "ABCD-1234");
        assert_eq!(start.expires_in, 900);
        assert_eq!(start.interval, 5);
    }

    #[tokio::test]
    async fn test_github_device_flow_start_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/device/code")
            .with_status(400)
            .with_body("bad request")
            .create_async()
            .await;

        let result = github_device_flow_start_with_base(&server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Device flow start failed"));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_complete() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"access_token":"gho_secret123","token_type":"bearer","scope":"repo"}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "complete");
        assert_eq!(poll.access_token, Some("gho_secret123".to_string()));
        assert!(poll.error.is_none());
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_pending() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error":"authorization_pending","error_description":"The authorization request is still pending."}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "pending");
        assert!(poll.access_token.is_none());
        assert_eq!(poll.error, Some("authorization_pending".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_slow_down() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error":"slow_down"}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "pending");
        assert_eq!(poll.error, Some("slow_down".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_expired() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error":"expired_token"}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "expired");
        assert_eq!(poll.error, Some("expired_token".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_other_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"error":"access_denied"}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "error");
        assert_eq!(poll.error, Some("access_denied".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_http_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(503)
            .with_body("Service Unavailable")
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Device flow poll HTTP error"));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_unknown_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/login/oauth/access_token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{}"#)
            .create_async()
            .await;

        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let poll = result.unwrap();
        assert_eq!(poll.status, "error");
        assert_eq!(poll.error, Some("unknown".to_string()));
    }

    #[tokio::test]
    async fn test_github_get_user_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"login":"lucaong","name":"Luca Ongaro","avatar_url":"https://avatars.githubusercontent.com/u/12345"}"#,
            )
            .create_async()
            .await;

        let result = github_get_user_with_base("gho_token", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.login, "lucaong");
        assert_eq!(user.name, Some("Luca Ongaro".to_string()));
    }

    #[tokio::test]
    async fn test_github_get_user_unauthorized() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user")
            .with_status(401)
            .with_header("content-type", "application/json")
            .with_body(r#"{"message":"Bad credentials"}"#)
            .create_async()
            .await;

        let result = github_get_user_with_base("bad_token", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("GitHub API error 401"));
    }

    #[tokio::test]
    async fn test_github_get_user_null_name() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/user")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"login":"bot-account","name":null,"avatar_url":"https://avatars.githubusercontent.com/u/99"}"#)
            .create_async()
            .await;

        let result = github_get_user_with_base("token", &server.url()).await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let user = result.unwrap();
        assert_eq!(user.login, "bot-account");
        assert!(user.name.is_none());
    }
}
