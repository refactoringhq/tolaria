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
        model: req.model.clone().unwrap_or_else(|| "claude-3-5-haiku-20241022".to_string()),
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
    let anthropic_req = build_request(&req);

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
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
                ContentBlock { text: Some("Hello ".to_string()) },
                ContentBlock { text: Some("world".to_string()) },
                ContentBlock { text: None },
            ],
            model: "test".to_string(),
            stop_reason: Some("end_turn".to_string()),
        };
        assert_eq!(extract_response_text(&resp), "Hello world");
    }
}
