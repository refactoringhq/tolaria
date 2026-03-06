use serde::Deserialize;

use super::{DeviceFlowPollResult, DeviceFlowStart, GITHUB_CLIENT_ID};

/// Starts the GitHub OAuth device flow. Returns device code info for user authorization.
pub async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    github_device_flow_start_with_base("https://github.com").await
}

async fn github_device_flow_start_with_base(base_url: &str) -> Result<DeviceFlowStart, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/login/device/code", base_url))
        .header("Accept", "application/json")
        .header("User-Agent", "Laputa-App")
        .form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo")])
        .send()
        .await
        .map_err(|e| format!("Device flow request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if status.as_u16() == 404 {
            return Err(
                "GitHub device flow not available. Ensure a GitHub App is registered with \
                 'Device authorization flow' enabled (Settings → Developer settings → GitHub Apps)."
                    .to_string(),
            );
        }
        return Err(format!("Device flow start failed ({}): {}", status, body));
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
        .header("User-Agent", "Laputa-App")
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

#[cfg(test)]
mod tests {
    use super::*;

    async fn mock_json(
        method: &str,
        path: &str,
        status: usize,
        body: &str,
    ) -> (mockito::ServerGuard, mockito::Mock) {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock(method, path)
            .with_status(status)
            .with_header("content-type", "application/json")
            .with_body(body)
            .create_async()
            .await;
        (server, mock)
    }

    async fn mock_device_start(status: usize, body: &str) -> Result<DeviceFlowStart, String> {
        let (server, mock) = mock_json("POST", "/login/device/code", status, body).await;
        let result = github_device_flow_start_with_base(&server.url()).await;
        mock.assert_async().await;
        result
    }

    async fn mock_poll(body: &str) -> DeviceFlowPollResult {
        let (server, mock) = mock_json("POST", "/login/oauth/access_token", 200, body).await;
        let result = github_device_flow_poll_with_base("dev_code_xyz", &server.url())
            .await
            .unwrap();
        mock.assert_async().await;
        result
    }

    #[tokio::test]
    async fn test_github_device_flow_start_success() {
        let start = mock_device_start(
            200,
            r#"{"device_code":"dev_abc","user_code":"ABCD-1234","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}"#,
        )
        .await
        .unwrap();

        assert_eq!(
            start,
            DeviceFlowStart {
                device_code: "dev_abc".to_string(),
                user_code: "ABCD-1234".to_string(),
                verification_uri: "https://github.com/login/device".to_string(),
                expires_in: 900,
                interval: 5,
            }
        );
    }

    #[tokio::test]
    async fn test_github_device_flow_start_error() {
        let err = mock_device_start(400, "bad request").await.unwrap_err();
        assert!(err.contains("Device flow start failed"));
    }

    #[tokio::test]
    async fn test_github_device_flow_start_404_gives_clear_message() {
        let err = mock_device_start(404, r#"{"error":"Not Found"}"#)
            .await
            .unwrap_err();
        assert!(err.contains("device flow not available"));
        assert!(err.contains("Device authorization flow"));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_complete() {
        let poll =
            mock_poll(r#"{"access_token":"gho_secret123","token_type":"bearer","scope":"repo"}"#)
                .await;
        assert_eq!(
            poll,
            DeviceFlowPollResult {
                status: "complete".to_string(),
                access_token: Some("gho_secret123".to_string()),
                error: None,
            }
        );
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_pending() {
        let poll = mock_poll(
            r#"{"error":"authorization_pending","error_description":"The authorization request is still pending."}"#,
        )
        .await;
        assert_eq!(poll.status, "pending");
        assert_eq!(poll.error, Some("authorization_pending".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_slow_down() {
        let poll = mock_poll(r#"{"error":"slow_down"}"#).await;
        assert_eq!(poll.status, "pending");
        assert_eq!(poll.error, Some("slow_down".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_expired() {
        let poll = mock_poll(r#"{"error":"expired_token"}"#).await;
        assert_eq!(poll.status, "expired");
        assert_eq!(poll.error, Some("expired_token".to_string()));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_other_error() {
        let poll = mock_poll(r#"{"error":"access_denied"}"#).await;
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

        let err = github_device_flow_poll_with_base("dev_code_xyz", &server.url())
            .await
            .unwrap_err();
        mock.assert_async().await;
        assert!(err.contains("Device flow poll HTTP error"));
    }

    #[tokio::test]
    async fn test_github_device_flow_poll_unknown_error() {
        let poll = mock_poll(r#"{}"#).await;
        assert_eq!(poll.status, "error");
        assert_eq!(poll.error, Some("unknown".to_string()));
    }
}
