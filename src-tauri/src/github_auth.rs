use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Placeholder — Luca will register the GitHub OAuth App and replace this.
const LAPUTA_GITHUB_CLIENT_ID: &str = "LAPUTA_GITHUB_CLIENT_ID";

/// Scope: read user profile + repo access for vault-from-GitHub features.
const GITHUB_SCOPE: &str = "read:user,repo";

// ---------- Types ----------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceFlowResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeApiResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Debug, Deserialize)]
struct TokenApiResponse {
    access_token: Option<String>,
    error: Option<String>,
}

// ---------- Token storage ----------

fn token_path() -> Result<PathBuf, String> {
    let config = dirs::config_dir()
        .ok_or_else(|| "Cannot determine app config directory".to_string())?;
    Ok(config.join("com.laputa.app").join("github_token"))
}

fn read_token_at(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let token = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read token: {}", e))?;
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

fn store_token_at(path: &Path, token: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    fs::write(path, token)
        .map_err(|e| format!("Failed to write token: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("Failed to set token permissions: {}", e))?;
    }

    Ok(())
}

fn delete_token_at(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Failed to delete token: {}", e))?;
    }
    Ok(())
}

pub fn read_stored_token() -> Result<Option<String>, String> {
    read_token_at(&token_path()?)
}

fn store_token(token: &str) -> Result<(), String> {
    store_token_at(&token_path()?, token)
}

fn delete_token() -> Result<(), String> {
    delete_token_at(&token_path()?)
}

/// Classify a poll response into the appropriate result.
fn classify_poll_response(token_resp: TokenApiResponse) -> Result<Option<String>, String> {
    if let Some(token) = token_resp.access_token {
        return Ok(Some(token));
    }
    match token_resp.error.as_deref() {
        Some("authorization_pending") | Some("slow_down") => Ok(None),
        Some("expired_token") => Err("Device code expired. Please try again.".to_string()),
        Some("access_denied") => Err("Authorization was denied by the user.".to_string()),
        Some(other) => Err(format!("GitHub OAuth error: {}", other)),
        None => Err("Unexpected response: no token and no error".to_string()),
    }
}

// ---------- GitHub API calls ----------

pub async fn start_device_flow() -> Result<DeviceFlowResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", LAPUTA_GITHUB_CLIENT_ID),
            ("scope", GITHUB_SCOPE),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub device flow error ({}): {}", status, body));
    }

    let api_resp: DeviceCodeApiResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse device flow response: {}", e))?;

    Ok(DeviceFlowResponse {
        device_code: api_resp.device_code,
        user_code: api_resp.user_code,
        verification_uri: api_resp.verification_uri,
        expires_in: api_resp.expires_in,
        interval: api_resp.interval,
    })
}

pub async fn poll_token(device_code: &str) -> Result<Option<String>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", LAPUTA_GITHUB_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to poll token: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub token poll error ({}): {}", status, body));
    }

    let token_resp: TokenApiResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let result = classify_poll_response(token_resp)?;
    if let Some(ref token) = result {
        store_token(token)?;
    }
    Ok(result)
}

pub async fn get_user(token: &str) -> Result<GithubUser, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Laputa-App")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch GitHub user: {}", e))?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Token is invalid or revoked".to_string());
    }

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error ({}): {}", status, body));
    }

    let user: GithubUser = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub user: {}", e))?;

    Ok(user)
}

pub fn disconnect() -> Result<(), String> {
    delete_token()
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // --- Token storage tests (using path-parameterized helpers) ---

    #[test]
    fn test_store_and_read_token() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        // Store
        store_token_at(&token_file, "gho_test_token_123").unwrap();
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, Some("gho_test_token_123".to_string()));

        // Overwrite
        store_token_at(&token_file, "gho_new_token").unwrap();
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, Some("gho_new_token".to_string()));
    }

    #[test]
    fn test_read_token_nonexistent_file() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("does_not_exist");
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_read_token_empty_file() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");
        fs::write(&token_file, "  \n  ").unwrap();
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_read_token_whitespace_trimmed() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");
        fs::write(&token_file, "  gho_trimmed  \n").unwrap();
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, Some("gho_trimmed".to_string()));
    }

    #[test]
    fn test_delete_token() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        store_token_at(&token_file, "gho_to_delete").unwrap();
        assert!(token_file.exists());

        delete_token_at(&token_file).unwrap();
        assert!(!token_file.exists());
    }

    #[test]
    fn test_delete_nonexistent_token() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("nonexistent");
        // Should not error
        delete_token_at(&token_file).unwrap();
    }

    #[test]
    fn test_store_creates_parent_dirs() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("nested").join("dir").join("github_token");
        store_token_at(&token_file, "gho_nested").unwrap();
        let result = read_token_at(&token_file).unwrap();
        assert_eq!(result, Some("gho_nested".to_string()));
    }

    #[cfg(unix)]
    #[test]
    fn test_store_sets_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        store_token_at(&token_file, "secret_token").unwrap();

        let meta = fs::metadata(&token_file).unwrap();
        let mode = meta.permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[test]
    fn test_token_path_structure() {
        let path = token_path().unwrap();
        assert!(path.ends_with("com.laputa.app/github_token"));
    }

    // --- Token storage via public API (touches real config dir) ---

    #[test]
    fn test_read_stored_token_runs_without_panic() {
        // May return None or Some depending on actual state — that's fine
        let _ = read_stored_token();
    }

    #[test]
    fn test_disconnect_runs_without_panic() {
        let _ = disconnect();
    }

    // --- Poll response classification ---

    #[test]
    fn test_classify_poll_with_token() {
        let resp = TokenApiResponse {
            access_token: Some("gho_abc123".to_string()),
            error: None,
        };
        let result = classify_poll_response(resp).unwrap();
        assert_eq!(result, Some("gho_abc123".to_string()));
    }

    #[test]
    fn test_classify_poll_pending() {
        let resp = TokenApiResponse {
            access_token: None,
            error: Some("authorization_pending".to_string()),
        };
        let result = classify_poll_response(resp).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_classify_poll_slow_down() {
        let resp = TokenApiResponse {
            access_token: None,
            error: Some("slow_down".to_string()),
        };
        let result = classify_poll_response(resp).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn test_classify_poll_expired() {
        let resp = TokenApiResponse {
            access_token: None,
            error: Some("expired_token".to_string()),
        };
        let result = classify_poll_response(resp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("expired"));
    }

    #[test]
    fn test_classify_poll_denied() {
        let resp = TokenApiResponse {
            access_token: None,
            error: Some("access_denied".to_string()),
        };
        let result = classify_poll_response(resp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("denied"));
    }

    #[test]
    fn test_classify_poll_unknown_error() {
        let resp = TokenApiResponse {
            access_token: None,
            error: Some("some_weird_error".to_string()),
        };
        let result = classify_poll_response(resp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("some_weird_error"));
    }

    #[test]
    fn test_classify_poll_no_token_no_error() {
        let resp = TokenApiResponse {
            access_token: None,
            error: None,
        };
        let result = classify_poll_response(resp);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unexpected"));
    }

    // --- Serialization / deserialization ---

    #[test]
    fn test_device_flow_response_serialization() {
        let resp = DeviceFlowResponse {
            device_code: "abc123".to_string(),
            user_code: "ABCD-1234".to_string(),
            verification_uri: "https://github.com/login/device".to_string(),
            expires_in: 900,
            interval: 5,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("ABCD-1234"));

        let deserialized: DeviceFlowResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.user_code, "ABCD-1234");
        assert_eq!(deserialized.expires_in, 900);
    }

    #[test]
    fn test_github_user_serialization() {
        let user = GithubUser {
            login: "octocat".to_string(),
            name: Some("The Octocat".to_string()),
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4".to_string(),
        };
        let json = serde_json::to_string(&user).unwrap();
        let deserialized: GithubUser = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.login, "octocat");
        assert_eq!(deserialized.name, Some("The Octocat".to_string()));
    }

    #[test]
    fn test_github_user_with_null_name() {
        let json = r#"{"login":"bot","name":null,"avatar_url":"https://example.com/bot.png"}"#;
        let user: GithubUser = serde_json::from_str(json).unwrap();
        assert_eq!(user.login, "bot");
        assert!(user.name.is_none());
    }

    #[test]
    fn test_token_api_response_with_token() {
        let json = r#"{"access_token":"gho_abc123","token_type":"bearer","scope":"read:user,repo"}"#;
        let resp: TokenApiResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.access_token, Some("gho_abc123".to_string()));
        assert!(resp.error.is_none());
    }

    #[test]
    fn test_token_api_response_pending() {
        let json = r#"{"error":"authorization_pending","error_description":"waiting"}"#;
        let resp: TokenApiResponse = serde_json::from_str(json).unwrap();
        assert!(resp.access_token.is_none());
        assert_eq!(resp.error, Some("authorization_pending".to_string()));
    }

    #[test]
    fn test_token_api_response_denied() {
        let json = r#"{"error":"access_denied","error_description":"denied by user"}"#;
        let resp: TokenApiResponse = serde_json::from_str(json).unwrap();
        assert!(resp.access_token.is_none());
        assert_eq!(resp.error, Some("access_denied".to_string()));
    }

    #[test]
    fn test_device_code_api_response_deserialization() {
        let json = r#"{
            "device_code": "dc_abc",
            "user_code": "ABCD-1234",
            "verification_uri": "https://github.com/login/device",
            "expires_in": 900,
            "interval": 5
        }"#;
        let resp: DeviceCodeApiResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.device_code, "dc_abc");
        assert_eq!(resp.user_code, "ABCD-1234");
        assert_eq!(resp.interval, 5);
    }

    #[test]
    fn test_device_flow_response_clone() {
        let resp = DeviceFlowResponse {
            device_code: "dc".to_string(),
            user_code: "UC".to_string(),
            verification_uri: "https://example.com".to_string(),
            expires_in: 300,
            interval: 10,
        };
        let cloned = resp.clone();
        assert_eq!(cloned.device_code, "dc");
        assert_eq!(cloned.interval, 10);
    }

    #[test]
    fn test_github_user_clone() {
        let user = GithubUser {
            login: "test".to_string(),
            name: None,
            avatar_url: "https://example.com".to_string(),
        };
        let cloned = user.clone();
        assert_eq!(cloned.login, "test");
        assert!(cloned.name.is_none());
    }

    #[test]
    fn test_github_user_debug() {
        let user = GithubUser {
            login: "test".to_string(),
            name: Some("Test User".to_string()),
            avatar_url: "https://example.com".to_string(),
        };
        let debug = format!("{:?}", user);
        assert!(debug.contains("test"));
        assert!(debug.contains("Test User"));
    }
}
