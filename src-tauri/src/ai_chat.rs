use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct AiChatRequest {
    pub model: Option<String>,
    pub messages: Vec<AiMessage>,
    pub system: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct AiChatResponse {
    pub content: String,
    pub model: String,
    pub stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
    model: String,
    stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
}

fn get_api_key() -> Result<String, String> {
    std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY environment variable not set".to_string())
}

fn build_request(req: &AiChatRequest) -> AnthropicRequest {
    AnthropicRequest {
        model: req
            .model
            .clone()
            .unwrap_or_else(|| "claude-3-5-haiku-20241022".to_string()),
        max_tokens: req.max_tokens.unwrap_or(4096),
        messages: req.messages.clone(),
        system: req.system.clone(),
    }
}

fn extract_response_text(resp: &AnthropicResponse) -> String {
    resp.content
        .iter()
        .filter_map(|block| block.text.as_ref())
        .cloned()
        .collect::<Vec<_>>()
        .join("")
}

pub async fn send_chat(req: AiChatRequest) -> Result<AiChatResponse, String> {
    let api_key = get_api_key()?;
    send_chat_with_base(req, "https://api.anthropic.com", &api_key).await
}

async fn send_chat_with_base(
    req: AiChatRequest,
    api_base: &str,
    api_key: &str,
) -> Result<AiChatResponse, String> {
    let anthropic_req = build_request(&req);

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/v1/messages", api_base))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&anthropic_req)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error ({}): {}", status, body));
    }

    let anthropic_resp: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(AiChatResponse {
        content: extract_response_text(&anthropic_resp),
        model: anthropic_resp.model,
        stop_reason: anthropic_resp.stop_reason,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Pure logic tests ─────────────────────────────────────────────────────

    #[test]
    fn test_build_request_defaults() {
        let req = AiChatRequest {
            model: None,
            messages: vec![AiMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            system: None,
            max_tokens: None,
        };
        let built = build_request(&req);
        assert_eq!(built.model, "claude-3-5-haiku-20241022");
        assert_eq!(built.max_tokens, 4096);
        assert!(built.system.is_none());
    }

    #[test]
    fn test_build_request_custom() {
        let req = AiChatRequest {
            model: Some("claude-sonnet-4-20250514".to_string()),
            messages: vec![],
            system: Some("You are helpful".to_string()),
            max_tokens: Some(1024),
        };
        let built = build_request(&req);
        assert_eq!(built.model, "claude-sonnet-4-20250514");
        assert_eq!(built.max_tokens, 1024);
        assert_eq!(built.system.unwrap(), "You are helpful");
    }

    #[test]
    fn test_extract_response_text() {
        let resp = AnthropicResponse {
            content: vec![
                ContentBlock {
                    text: Some("Hello ".to_string()),
                },
                ContentBlock {
                    text: Some("world".to_string()),
                },
                ContentBlock { text: None },
            ],
            model: "test".to_string(),
            stop_reason: Some("end_turn".to_string()),
        };
        assert_eq!(extract_response_text(&resp), "Hello world");
    }

    #[test]
    fn test_extract_response_text_empty() {
        let resp = AnthropicResponse {
            content: vec![],
            model: "test".to_string(),
            stop_reason: None,
        };
        assert_eq!(extract_response_text(&resp), "");
    }

    #[test]
    fn test_extract_response_text_all_none() {
        let resp = AnthropicResponse {
            content: vec![
                ContentBlock { text: None },
                ContentBlock { text: None },
            ],
            model: "test".to_string(),
            stop_reason: None,
        };
        assert_eq!(extract_response_text(&resp), "");
    }

    #[test]
    fn test_get_api_key_missing() {
        // Temporarily clear the env var
        let prev = std::env::var("ANTHROPIC_API_KEY").ok();
        unsafe {
            std::env::remove_var("ANTHROPIC_API_KEY");
        }
        let result = get_api_key();
        // Restore
        if let Some(val) = prev {
            unsafe {
                std::env::set_var("ANTHROPIC_API_KEY", val);
            }
        }
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("ANTHROPIC_API_KEY environment variable not set"));
    }

    #[test]
    fn test_get_api_key_present() {
        let prev = std::env::var("ANTHROPIC_API_KEY").ok();
        unsafe {
            std::env::set_var("ANTHROPIC_API_KEY", "sk-test-key-123");
        }
        let result = get_api_key();
        if let Some(val) = prev {
            unsafe {
                std::env::set_var("ANTHROPIC_API_KEY", val);
            }
        } else {
            unsafe {
                std::env::remove_var("ANTHROPIC_API_KEY");
            }
        }
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "sk-test-key-123");
    }

    // ── HTTP mock tests ──────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_send_chat_success() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"id":"msg_01","type":"message","role":"assistant","content":[{"type":"text","text":"Hello there!"}],"model":"claude-3-5-haiku-20241022","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}"#,
            )
            .create_async()
            .await;

        let req = AiChatRequest {
            model: None,
            messages: vec![AiMessage {
                role: "user".to_string(),
                content: "Say hello".to_string(),
            }],
            system: None,
            max_tokens: None,
        };

        let result = send_chat_with_base(req, &server.url(), "sk-test-key").await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert_eq!(resp.content, "Hello there!");
        assert_eq!(resp.model, "claude-3-5-haiku-20241022");
        assert_eq!(resp.stop_reason, Some("end_turn".to_string()));
    }

    #[tokio::test]
    async fn test_send_chat_with_system_prompt() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"id":"msg_02","type":"message","role":"assistant","content":[{"type":"text","text":"I am a helpful assistant."}],"model":"claude-sonnet-4-20250514","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":20,"output_tokens":8}}"#,
            )
            .create_async()
            .await;

        let req = AiChatRequest {
            model: Some("claude-sonnet-4-20250514".to_string()),
            messages: vec![AiMessage {
                role: "user".to_string(),
                content: "Who are you?".to_string(),
            }],
            system: Some("You are a helpful assistant.".to_string()),
            max_tokens: Some(512),
        };

        let result = send_chat_with_base(req, &server.url(), "sk-key").await;
        mock.assert_async().await;
        assert!(result.is_ok());
        let resp = result.unwrap();
        assert_eq!(resp.model, "claude-sonnet-4-20250514");
        assert_eq!(resp.content, "I am a helpful assistant.");
    }

    #[tokio::test]
    async fn test_send_chat_api_error() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .with_status(401)
            .with_header("content-type", "application/json")
            .with_body(r#"{"type":"error","error":{"type":"authentication_error","message":"Invalid API key"}}"#)
            .create_async()
            .await;

        let req = AiChatRequest {
            model: None,
            messages: vec![AiMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            system: None,
            max_tokens: None,
        };

        let result = send_chat_with_base(req, &server.url(), "bad-key").await;
        mock.assert_async().await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Anthropic API error") && err.contains("401"),
            "unexpected error: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_send_chat_rate_limit() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .with_status(429)
            .with_header("content-type", "application/json")
            .with_body(r#"{"type":"error","error":{"type":"rate_limit_error","message":"Rate limit exceeded"}}"#)
            .create_async()
            .await;

        let req = AiChatRequest {
            model: None,
            messages: vec![],
            system: None,
            max_tokens: None,
        };

        let result = send_chat_with_base(req, &server.url(), "sk-key").await;
        mock.assert_async().await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Anthropic API error") && err.contains("429"),
            "unexpected error: {}",
            err
        );
    }

    #[tokio::test]
    async fn test_send_chat_multiple_content_blocks() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("POST", "/v1/messages")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"id":"msg_03","type":"message","role":"assistant","content":[{"type":"text","text":"Part one. "},{"type":"text","text":"Part two."}],"model":"claude-3-5-haiku-20241022","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":5,"output_tokens":10}}"#,
            )
            .create_async()
            .await;

        let req = AiChatRequest {
            model: None,
            messages: vec![AiMessage {
                role: "user".to_string(),
                content: "Give me two parts".to_string(),
            }],
            system: None,
            max_tokens: None,
        };

        let result = send_chat_with_base(req, &server.url(), "sk-key").await;
        mock.assert_async().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().content, "Part one. Part two.");
    }
}
