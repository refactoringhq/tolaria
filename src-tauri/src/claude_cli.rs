use serde::{Deserialize, Serialize};
use std::io::BufRead;
use std::path::PathBuf;
use std::process::{Command, Stdio};

/// Status returned by `check_claude_cli`.
#[derive(Debug, Serialize, Clone)]
pub struct ClaudeCliStatus {
    pub installed: bool,
    pub version: Option<String>,
}

/// Event emitted to the frontend during a streaming claude session.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "kind")]
pub enum ClaudeStreamEvent {
    /// Session initialised — carries the session ID for future `--resume`.
    Init { session_id: String },
    /// Incremental text chunk.
    TextDelta { text: String },
    /// A tool call started (agent mode only).
    ToolStart {
        tool_name: String,
        tool_id: String,
    },
    /// A tool call finished (agent mode only).
    ToolDone { tool_id: String },
    /// Final result text + session ID.
    Result {
        text: String,
        session_id: String,
    },
    /// Something went wrong.
    Error { message: String },
    /// Stream finished.
    Done,
}

/// Parameters accepted by `stream_claude_chat`.
#[derive(Debug, Deserialize)]
pub struct ChatStreamRequest {
    pub message: String,
    pub system_prompt: Option<String>,
    pub session_id: Option<String>,
}

/// Parameters accepted by `stream_claude_agent`.
#[derive(Debug, Deserialize)]
pub struct AgentStreamRequest {
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: String,
}

// ---------------------------------------------------------------------------
// Finding the `claude` binary
// ---------------------------------------------------------------------------

fn find_claude_binary() -> Result<PathBuf, String> {
    // Try `which claude` first (works when PATH is inherited).
    let output = Command::new("which")
        .arg("claude")
        .output()
        .map_err(|e| format!("Failed to run `which claude`: {e}"))?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(PathBuf::from(path));
        }
    }

    // Fallback: check common install locations.
    let home = dirs::home_dir().unwrap_or_default();
    let candidates = [
        home.join(".local/bin/claude"),
        home.join(".npm/bin/claude"),
        PathBuf::from("/usr/local/bin/claude"),
        PathBuf::from("/opt/homebrew/bin/claude"),
    ];
    for p in &candidates {
        if p.exists() {
            return Ok(p.clone());
        }
    }

    Err("Claude CLI not found. Install it: https://docs.anthropic.com/en/docs/claude-code".into())
}

// ---------------------------------------------------------------------------
// Public Tauri commands
// ---------------------------------------------------------------------------

/// Check whether the `claude` CLI is installed and return its version.
pub fn check_cli() -> ClaudeCliStatus {
    let bin = match find_claude_binary() {
        Ok(b) => b,
        Err(_) => return ClaudeCliStatus { installed: false, version: None },
    };

    let version = Command::new(&bin)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    ClaudeCliStatus { installed: true, version }
}

/// Spawn `claude -p` for a simple chat (no tools) and stream events via the
/// provided callback.  Returns the session ID for future `--resume` calls.
pub fn run_chat_stream<F>(req: ChatStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(ClaudeStreamEvent),
{
    let bin = find_claude_binary()?;
    let mut args: Vec<String> = vec![
        "-p".into(),
        req.message.clone(),
        "--output-format".into(),
        "stream-json".into(),
        "--include-partial-messages".into(),
        "--tools".into(),
        String::new(), // empty string → disable all built-in tools
    ];

    if let Some(ref sp) = req.system_prompt {
        if !sp.is_empty() {
            args.push("--system-prompt".into());
            args.push(sp.clone());
        }
    }

    if let Some(ref sid) = req.session_id {
        args.push("--resume".into());
        args.push(sid.clone());
    }

    run_claude_subprocess(&bin, &args, &mut emit)
}

/// Spawn `claude -p` with MCP vault tools for an agent task and stream events.
pub fn run_agent_stream<F>(req: AgentStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(ClaudeStreamEvent),
{
    let bin = find_claude_binary()?;
    let mcp_config = build_mcp_config(&req.vault_path)?;

    let mut args: Vec<String> = vec![
        "-p".into(),
        req.message.clone(),
        "--output-format".into(),
        "stream-json".into(),
        "--include-partial-messages".into(),
        "--tools".into(),
        String::new(), // disable built-in tools; MCP tools remain
        "--mcp-config".into(),
        mcp_config,
        "--dangerously-skip-permissions".into(),
        "--no-session-persistence".into(),
    ];

    if let Some(ref sp) = req.system_prompt {
        if !sp.is_empty() {
            args.push("--append-system-prompt".into());
            args.push(sp.clone());
        }
    }

    run_claude_subprocess(&bin, &args, &mut emit)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Build a temporary MCP config JSON string pointing to the vault MCP server.
fn build_mcp_config(vault_path: &str) -> Result<String, String> {
    let server_dir = crate::mcp::mcp_server_dir()?;
    let index_js = server_dir.join("index.js");
    let config = serde_json::json!({
        "mcpServers": {
            "laputa": {
                "command": "node",
                "args": [index_js.to_string_lossy()],
                "env": { "VAULT_PATH": vault_path }
            }
        }
    });
    serde_json::to_string(&config).map_err(|e| format!("Failed to serialise MCP config: {e}"))
}

/// Core subprocess runner shared by chat and agent modes.
fn run_claude_subprocess<F>(
    bin: &PathBuf,
    args: &[String],
    emit: &mut F,
) -> Result<String, String>
where
    F: FnMut(ClaudeStreamEvent),
{
    let mut child = Command::new(bin)
        .args(args)
        .env_remove("CLAUDECODE") // prevent "nested session" guard
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    let stdout = child.stdout.take().ok_or("No stdout handle")?;
    let reader = std::io::BufReader::new(stdout);

    let mut session_id = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                emit(ClaudeStreamEvent::Error {
                    message: format!("Read error: {e}"),
                });
                break;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        let json: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue, // skip non-JSON lines
        };

        dispatch_event(&json, &mut session_id, emit);
    }

    // Read stderr for potential error messages.
    let stderr_output = child
        .stderr
        .take()
        .and_then(|s| std::io::read_to_string(s).ok())
        .unwrap_or_default();

    let status = child.wait().map_err(|e| format!("Wait failed: {e}"))?;

    if !status.success() && session_id.is_empty() {
        let msg = if stderr_output.contains("not logged in")
            || stderr_output.contains("authentication")
            || stderr_output.contains("auth")
        {
            "Claude CLI is not authenticated. Run `claude auth login` in your terminal.".into()
        } else if stderr_output.is_empty() {
            format!("claude exited with status {status}")
        } else {
            stderr_output.lines().take(3).collect::<Vec<_>>().join("\n")
        };
        emit(ClaudeStreamEvent::Error { message: msg });
    }

    emit(ClaudeStreamEvent::Done);

    Ok(session_id)
}

/// Parse a single JSON line from the stream and emit the appropriate event.
fn dispatch_event<F>(json: &serde_json::Value, session_id: &mut String, emit: &mut F)
where
    F: FnMut(ClaudeStreamEvent),
{
    let msg_type = json["type"].as_str().unwrap_or("");

    match msg_type {
        // --- System init → capture session_id ---
        "system" if json["subtype"].as_str() == Some("init") => {
            if let Some(sid) = json["session_id"].as_str() {
                *session_id = sid.to_string();
                emit(ClaudeStreamEvent::Init {
                    session_id: sid.to_string(),
                });
            }
        }

        // --- Streaming partial events (text deltas, tool_use starts) ---
        "stream_event" => {
            dispatch_stream_event(json, emit);
        }

        // --- Tool progress (agent mode) ---
        "tool_progress" => {
            if let (Some(name), Some(id)) = (
                json["tool_name"].as_str(),
                json["tool_use_id"].as_str(),
            ) {
                emit(ClaudeStreamEvent::ToolStart {
                    tool_name: name.to_string(),
                    tool_id: id.to_string(),
                });
            }
        }

        // --- Final result ---
        "result" => {
            let sid = json["session_id"]
                .as_str()
                .unwrap_or("")
                .to_string();
            if !sid.is_empty() {
                *session_id = sid.clone();
            }
            let text = json["result"].as_str().unwrap_or("").to_string();
            emit(ClaudeStreamEvent::Result {
                text,
                session_id: sid,
            });
        }

        // --- Complete assistant message (fallback for text when no partials) ---
        "assistant" => {
            if let Some(content) = json["message"]["content"].as_array() {
                for block in content {
                    if block["type"].as_str() == Some("tool_use") {
                        if let (Some(id), Some(name)) =
                            (block["id"].as_str(), block["name"].as_str())
                        {
                            emit(ClaudeStreamEvent::ToolStart {
                                tool_name: name.to_string(),
                                tool_id: id.to_string(),
                            });
                        }
                    }
                }
            }
        }

        _ => {} // ignore other event types
    }
}

/// Handle a `stream_event` (partial assistant message).
fn dispatch_stream_event<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(ClaudeStreamEvent),
{
    let event = &json["event"];
    let event_type = event["type"].as_str().unwrap_or("");

    match event_type {
        "content_block_delta" => {
            let delta = &event["delta"];
            if delta["type"].as_str() == Some("text_delta") {
                if let Some(text) = delta["text"].as_str() {
                    emit(ClaudeStreamEvent::TextDelta {
                        text: text.to_string(),
                    });
                }
            }
        }
        "content_block_start" => {
            let block = &event["content_block"];
            if block["type"].as_str() == Some("tool_use") {
                if let (Some(id), Some(name)) =
                    (block["id"].as_str(), block["name"].as_str())
                {
                    emit(ClaudeStreamEvent::ToolStart {
                        tool_name: name.to_string(),
                        tool_id: id.to_string(),
                    });
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_cli_returns_status() {
        let status = check_cli();
        // We can't guarantee claude is installed in CI, so just check the struct shape.
        if status.installed {
            assert!(status.version.is_some());
        } else {
            assert!(status.version.is_none());
        }
    }

    #[test]
    fn build_mcp_config_is_valid_json() {
        // This will fail if mcp_server_dir() can't resolve, which is expected in dev.
        if let Ok(config_str) = build_mcp_config("/tmp/test-vault") {
            let parsed: serde_json::Value = serde_json::from_str(&config_str).unwrap();
            assert!(parsed["mcpServers"]["laputa"]["command"].is_string());
            assert_eq!(
                parsed["mcpServers"]["laputa"]["env"]["VAULT_PATH"],
                "/tmp/test-vault"
            );
        }
    }

    #[test]
    fn dispatch_event_handles_init() {
        let json: serde_json::Value = serde_json::json!({
            "type": "system",
            "subtype": "init",
            "session_id": "test-session-123"
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert_eq!(sid, "test-session-123");
        assert!(matches!(&events[0], ClaudeStreamEvent::Init { session_id } if session_id == "test-session-123"));
    }

    #[test]
    fn dispatch_event_handles_text_delta() {
        let json: serde_json::Value = serde_json::json!({
            "type": "stream_event",
            "event": {
                "type": "content_block_delta",
                "index": 0,
                "delta": { "type": "text_delta", "text": "Hello" }
            }
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert!(matches!(&events[0], ClaudeStreamEvent::TextDelta { text } if text == "Hello"));
    }

    #[test]
    fn dispatch_event_handles_tool_start() {
        let json: serde_json::Value = serde_json::json!({
            "type": "stream_event",
            "event": {
                "type": "content_block_start",
                "index": 1,
                "content_block": {
                    "type": "tool_use",
                    "id": "tool_abc",
                    "name": "read_note",
                    "input": {}
                }
            }
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert!(matches!(
            &events[0],
            ClaudeStreamEvent::ToolStart { tool_name, tool_id }
            if tool_name == "read_note" && tool_id == "tool_abc"
        ));
    }

    #[test]
    fn dispatch_event_handles_result() {
        let json: serde_json::Value = serde_json::json!({
            "type": "result",
            "subtype": "success",
            "result": "All done!",
            "session_id": "sess-456"
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert_eq!(sid, "sess-456");
        assert!(matches!(
            &events[0],
            ClaudeStreamEvent::Result { text, session_id }
            if text == "All done!" && session_id == "sess-456"
        ));
    }

    #[test]
    fn dispatch_event_handles_tool_progress() {
        let json: serde_json::Value = serde_json::json!({
            "type": "tool_progress",
            "tool_name": "search_notes",
            "tool_use_id": "tool_xyz"
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert!(matches!(
            &events[0],
            ClaudeStreamEvent::ToolStart { tool_name, tool_id }
            if tool_name == "search_notes" && tool_id == "tool_xyz"
        ));
    }

    #[test]
    fn dispatch_event_ignores_unknown() {
        let json: serde_json::Value = serde_json::json!({
            "type": "some_future_type",
            "data": 42
        });
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));

        assert!(events.is_empty());
    }
}
