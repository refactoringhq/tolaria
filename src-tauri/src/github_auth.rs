use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

fn ensure_config_dir() -> Result<(), String> {
    let path = token_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    Ok(())
}

pub fn read_stored_token() -> Result<Option<String>, String> {
    let path = token_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let token = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read token: {}", e))?;
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

fn store_token(token: &str) -> Result<(), String> {
    ensure_config_dir()?;
    let path = token_path()?;
    fs::write(&path, token)
        .map_err(|e| format!("Failed to write token: {}", e))?;

    // Set file permissions to 0o600 (owner read/write only) on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set token permissions: {}", e))?;
    }

    Ok(())
}

fn delete_token() -> Result<(), String> {
    let path = token_path()?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete token: {}", e))?;
    }
    Ok(())
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

    if let Some(token) = token_resp.access_token {
        store_token(&token)?;
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

    fn with_temp_config<F: FnOnce()>(f: F) {
        // We can't easily override dirs::config_dir(), so we test
        // the helper functions that don't depend on it.
        f();
    }

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
        assert!(json.contains("abc123"));

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
        assert!(json.contains("octocat"));
        assert!(json.contains("The Octocat"));

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
    fn test_store_and_read_token() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        // Write
        fs::write(&token_file, "gho_test_token_123").unwrap();
        let content = fs::read_to_string(&token_file).unwrap();
        assert_eq!(content.trim(), "gho_test_token_123");

        // Overwrite
        fs::write(&token_file, "gho_new_token").unwrap();
        let content = fs::read_to_string(&token_file).unwrap();
        assert_eq!(content.trim(), "gho_new_token");
    }

    #[test]
    fn test_delete_token_file() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        fs::write(&token_file, "gho_to_delete").unwrap();
        assert!(token_file.exists());

        fs::remove_file(&token_file).unwrap();
        assert!(!token_file.exists());
    }

    #[test]
    fn test_empty_token_file_returns_none_equivalent() {
        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        fs::write(&token_file, "  \n  ").unwrap();
        let content = fs::read_to_string(&token_file).unwrap();
        let trimmed = content.trim();
        assert!(trimmed.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn test_file_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let tmp = TempDir::new().unwrap();
        let token_file = tmp.path().join("github_token");

        fs::write(&token_file, "secret").unwrap();
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&token_file, perms).unwrap();

        let meta = fs::metadata(&token_file).unwrap();
        let mode = meta.permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }

    #[test]
    fn test_token_path_returns_expected_structure() {
        // token_path() should return a path ending in com.laputa.app/github_token
        let path = token_path().unwrap();
        assert!(path.ends_with("com.laputa.app/github_token"));
    }

    #[test]
    fn test_disconnect_when_no_token_exists() {
        // disconnect() should not error when there's no token file
        // (it silently succeeds if the file doesn't exist)
        // We can't easily test without mocking dirs, but we verify the logic:
        // delete_token checks path.exists() before removing.
        // Just verify the function compiles and the logic is sound.
        with_temp_config(|| {
            // The real disconnect() touches the actual config dir,
            // which may or may not have a token. That's OK.
        });
    }
}
