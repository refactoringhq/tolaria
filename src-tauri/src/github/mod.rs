mod api;
mod auth;
mod clone;

use serde::{Deserialize, Serialize};

pub use api::{github_create_repo, github_get_user, github_list_repos};
pub use auth::{github_device_flow_poll, github_device_flow_start};
pub use clone::clone_repo;

/// GitHub App client ID for OAuth device flow.
/// To set up: GitHub Settings → Developer settings → GitHub Apps → New GitHub App.
/// Enable "Device authorization flow" under Optional features. Webhook can be disabled.
const GITHUB_CLIENT_ID: &str = "Ov23liwee215tDMs9u4L";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GithubRepo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub private: bool,
    pub clone_url: String,
    pub html_url: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DeviceFlowStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct DeviceFlowPollResult {
    pub status: String,
    pub access_token: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct GitHubUser {
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_repo_serialization_roundtrip() {
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
        assert_eq!(serde_json::from_str::<GithubRepo>(&json).unwrap(), repo);
    }

    #[test]
    fn test_github_repo_deserialization_null_fields() {
        let json = r#"{"name":"r","full_name":"u/r","description":null,"private":false,"clone_url":"https://x","html_url":"https://y","updated_at":null}"#;
        let repo: GithubRepo = serde_json::from_str(json).unwrap();
        assert_eq!(repo.name, "r");
        assert!(!repo.private);
        assert!(repo.description.is_none());
        assert!(repo.updated_at.is_none());
    }

    #[test]
    fn test_device_flow_start_serialization_roundtrip() {
        let start = DeviceFlowStart {
            device_code: "dc_123".to_string(),
            user_code: "ABCD-1234".to_string(),
            verification_uri: "https://github.com/login/device".to_string(),
            expires_in: 900,
            interval: 5,
        };
        let json = serde_json::to_string(&start).unwrap();
        assert_eq!(
            serde_json::from_str::<DeviceFlowStart>(&json).unwrap(),
            start
        );
    }

    #[test]
    fn test_device_flow_poll_result_roundtrip() {
        let complete = DeviceFlowPollResult {
            status: "complete".to_string(),
            access_token: Some("gho_abc123".to_string()),
            error: None,
        };
        let json = serde_json::to_string(&complete).unwrap();
        assert_eq!(
            serde_json::from_str::<DeviceFlowPollResult>(&json).unwrap(),
            complete
        );

        let pending = DeviceFlowPollResult {
            status: "pending".to_string(),
            access_token: None,
            error: Some("authorization_pending".to_string()),
        };
        let json = serde_json::to_string(&pending).unwrap();
        assert_eq!(
            serde_json::from_str::<DeviceFlowPollResult>(&json).unwrap(),
            pending
        );
    }

    #[test]
    fn test_github_user_serialization_roundtrip() {
        let user = GitHubUser {
            login: "lucaong".to_string(),
            name: Some("Luca Ongaro".to_string()),
            avatar_url: "https://avatars.githubusercontent.com/u/123".to_string(),
        };
        let json = serde_json::to_string(&user).unwrap();
        assert_eq!(serde_json::from_str::<GitHubUser>(&json).unwrap(), user);
    }

    #[test]
    fn test_github_user_deserialization_null_name() {
        let user: GitHubUser =
            serde_json::from_str(r#"{"login":"bot","name":null,"avatar_url":"https://x"}"#)
                .unwrap();
        assert_eq!(user.login, "bot");
        assert!(user.name.is_none());
    }
}
