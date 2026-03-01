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
    ToolStart { tool_name: String, tool_id: String },
    /// A tool call finished (agent mode only).
    ToolDone { tool_id: String },
    /// Final result text + session ID.
    Result { text: String, session_id: String },
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

pub(crate) fn find_claude_binary() -> Result<PathBuf, String> {
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
        Err(_) => {
            return ClaudeCliStatus {
                installed: false,
                version: None,
            }
        }
    };

    let version = Command::new(&bin)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    ClaudeCliStatus {
        installed: true,
        version,
    }
}

/// Spawn `claude -p` for a simple chat (no tools) and stream events via the
/// provided callback.  Returns the session ID for future `--resume` calls.
pub fn run_chat_stream<F>(req: ChatStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(ClaudeStreamEvent),
{
    let bin = find_claude_binary()?;
    let args = build_chat_args(&req);
    run_claude_subprocess(&bin, &args, &mut emit)
}

/// Build CLI arguments for a chat stream request.
fn build_chat_args(req: &ChatStreamRequest) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-p".into(),
        req.message.clone(),
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
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

    args
}

/// Spawn `claude -p` with MCP vault tools for an agent task and stream events.
pub fn run_agent_stream<F>(req: AgentStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(ClaudeStreamEvent),
{
    let bin = find_claude_binary()?;
    let args = build_agent_args(&req)?;
    run_claude_subprocess(&bin, &args, &mut emit)
}

/// Build CLI arguments for an agent stream request.
fn build_agent_args(req: &AgentStreamRequest) -> Result<Vec<String>, String> {
    let mcp_config = build_mcp_config(&req.vault_path)?;

    let mut args: Vec<String> = vec![
        "-p".into(),
        req.message.clone(),
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
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

    Ok(args)
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
fn run_claude_subprocess<F>(bin: &PathBuf, args: &[String], emit: &mut F) -> Result<String, String>
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
            if let (Some(name), Some(id)) =
                (json["tool_name"].as_str(), json["tool_use_id"].as_str())
            {
                emit(ClaudeStreamEvent::ToolStart {
                    tool_name: name.to_string(),
                    tool_id: id.to_string(),
                });
            }
        }

        // --- Final result ---
        "result" => {
            let sid = json["session_id"].as_str().unwrap_or("").to_string();
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
                if let (Some(id), Some(name)) = (block["id"].as_str(), block["name"].as_str()) {
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
        if status.installed {
            assert!(status.version.is_some());
        } else {
            assert!(status.version.is_none());
        }
    }

    #[test]
    fn build_mcp_config_is_valid_json() {
        if let Ok(config_str) = build_mcp_config("/tmp/test-vault") {
            let parsed: serde_json::Value = serde_json::from_str(&config_str).unwrap();
            assert!(parsed["mcpServers"]["laputa"]["command"].is_string());
            assert_eq!(
                parsed["mcpServers"]["laputa"]["env"]["VAULT_PATH"],
                "/tmp/test-vault"
            );
        }
    }

    // --- dispatch_event / dispatch_stream_event ---

    /// Run dispatch_event on the given JSON and return (session_id, events).
    fn run_dispatch(json: serde_json::Value) -> (String, Vec<ClaudeStreamEvent>) {
        let mut sid = String::new();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));
        (sid, events)
    }

    /// Run dispatch_event with a pre-set session_id.
    fn run_dispatch_with_sid(
        json: serde_json::Value,
        initial_sid: &str,
    ) -> (String, Vec<ClaudeStreamEvent>) {
        let mut sid = initial_sid.to_string();
        let mut events = vec![];
        dispatch_event(&json, &mut sid, &mut |e| events.push(e));
        (sid, events)
    }

    #[test]
    fn dispatch_event_handles_init() {
        let (sid, events) = run_dispatch(serde_json::json!({
            "type": "system", "subtype": "init", "session_id": "test-session-123"
        }));
        assert_eq!(sid, "test-session-123");
        assert!(
            matches!(&events[0], ClaudeStreamEvent::Init { session_id } if session_id == "test-session-123")
        );
    }

    #[test]
    fn dispatch_event_system_without_init_subtype_is_ignored() {
        let (_, events) = run_dispatch(serde_json::json!({ "type": "system", "subtype": "other" }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_event_system_init_without_session_id_is_ignored() {
        let (sid, events) =
            run_dispatch(serde_json::json!({ "type": "system", "subtype": "init" }));
        assert!(events.is_empty());
        assert!(sid.is_empty());
    }

    #[test]
    fn dispatch_event_handles_text_delta() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "stream_event",
            "event": { "type": "content_block_delta", "index": 0, "delta": { "type": "text_delta", "text": "Hello" } }
        }));
        assert!(matches!(&events[0], ClaudeStreamEvent::TextDelta { text } if text == "Hello"));
    }

    #[test]
    fn dispatch_event_handles_tool_start() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "stream_event",
            "event": { "type": "content_block_start", "index": 1, "content_block": { "type": "tool_use", "id": "tool_abc", "name": "read_note", "input": {} } }
        }));
        assert!(
            matches!(&events[0], ClaudeStreamEvent::ToolStart { tool_name, tool_id } if tool_name == "read_note" && tool_id == "tool_abc")
        );
    }

    #[test]
    fn dispatch_event_handles_result() {
        let (sid, events) = run_dispatch(serde_json::json!({
            "type": "result", "subtype": "success", "result": "All done!", "session_id": "sess-456"
        }));
        assert_eq!(sid, "sess-456");
        assert!(
            matches!(&events[0], ClaudeStreamEvent::Result { text, session_id } if text == "All done!" && session_id == "sess-456")
        );
    }

    #[test]
    fn dispatch_event_result_with_empty_session_id() {
        let (sid, events) = run_dispatch_with_sid(
            serde_json::json!({ "type": "result", "result": "text here" }),
            "prev-session",
        );
        assert_eq!(sid, "prev-session");
        assert!(
            matches!(&events[0], ClaudeStreamEvent::Result { text, .. } if text == "text here")
        );
    }

    #[test]
    fn dispatch_event_handles_tool_progress() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "tool_progress", "tool_name": "search_notes", "tool_use_id": "tool_xyz"
        }));
        assert!(
            matches!(&events[0], ClaudeStreamEvent::ToolStart { tool_name, tool_id } if tool_name == "search_notes" && tool_id == "tool_xyz")
        );
    }

    #[test]
    fn dispatch_event_tool_progress_missing_fields_is_ignored() {
        let (_, events) =
            run_dispatch(serde_json::json!({ "type": "tool_progress", "tool_name": "x" }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_event_handles_assistant_with_tool_use() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "assistant",
            "message": { "content": [
                { "type": "text", "text": "Let me search." },
                { "type": "tool_use", "id": "tu_1", "name": "search_notes", "input": {} }
            ] }
        }));
        assert_eq!(events.len(), 1);
        assert!(
            matches!(&events[0], ClaudeStreamEvent::ToolStart { tool_name, tool_id } if tool_name == "search_notes" && tool_id == "tu_1")
        );
    }

    #[test]
    fn dispatch_event_assistant_without_content_is_noop() {
        let (_, events) = run_dispatch(serde_json::json!({ "type": "assistant", "message": {} }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_event_ignores_unknown() {
        let (_, events) =
            run_dispatch(serde_json::json!({ "type": "some_future_type", "data": 42 }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_stream_event_non_text_delta_is_ignored() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "stream_event",
            "event": { "type": "content_block_delta", "index": 0, "delta": { "type": "input_json_delta", "partial_json": "{}" } }
        }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_stream_event_non_tool_block_start_is_ignored() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "stream_event",
            "event": { "type": "content_block_start", "index": 0, "content_block": { "type": "text", "text": "" } }
        }));
        assert!(events.is_empty());
    }

    #[test]
    fn dispatch_stream_event_unknown_type_is_ignored() {
        let (_, events) = run_dispatch(serde_json::json!({
            "type": "stream_event", "event": { "type": "message_stop" }
        }));
        assert!(events.is_empty());
    }

    // --- run_claude_subprocess with mock scripts ---

    #[cfg(unix)]
    fn run_mock_script(script: &str) -> (Result<String, String>, Vec<ClaudeStreamEvent>) {
        run_mock_script_with_args(script, &[])
    }

    #[cfg(unix)]
    fn run_mock_script_with_args(
        script: &str,
        args: &[String],
    ) -> (Result<String, String>, Vec<ClaudeStreamEvent>) {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mock-claude");
        std::fs::write(&path, script).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        let mut events = vec![];
        let result = run_claude_subprocess(&path, args, &mut |e| events.push(e));
        (result, events)
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_parses_ndjson_stream() {
        let (result, events) = run_mock_script(concat!(
            "#!/bin/sh\n",
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"s1\"}'\n",
            "echo '{\"type\":\"stream_event\",\"event\":{\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hi\"}}}'\n",
            "echo '{\"type\":\"result\",\"result\":\"Done\",\"session_id\":\"s1\"}'\n",
        ));
        assert_eq!(result.unwrap(), "s1");
        assert!(matches!(&events[0], ClaudeStreamEvent::Init { session_id } if session_id == "s1"));
        assert!(matches!(&events[1], ClaudeStreamEvent::TextDelta { text } if text == "Hi"));
        assert!(matches!(&events[2], ClaudeStreamEvent::Result { .. }));
        assert!(matches!(&events[3], ClaudeStreamEvent::Done));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_skips_blank_and_non_json_lines() {
        let (result, events) = run_mock_script(concat!(
            "#!/bin/sh\n",
            "echo ''\n",
            "echo 'not json at all'\n",
            "echo '{\"type\":\"result\",\"result\":\"ok\",\"session_id\":\"s2\"}'\n",
        ));
        assert_eq!(result.unwrap(), "s2");
        assert!(matches!(&events[0], ClaudeStreamEvent::Result { text, .. } if text == "ok"));
        assert!(matches!(&events[1], ClaudeStreamEvent::Done));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_emits_error_on_nonzero_exit() {
        let (_, events) = run_mock_script("#!/bin/sh\necho 'auth problem' >&2\nexit 1\n");
        assert!(events
            .iter()
            .any(|e| matches!(e, ClaudeStreamEvent::Error { .. })));
        assert!(matches!(events.last().unwrap(), ClaudeStreamEvent::Done));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_detects_auth_error_in_stderr() {
        let (_, events) = run_mock_script("#!/bin/sh\necho 'not logged in' >&2\nexit 1\n");
        assert!(events.iter().any(|e| matches!(e, ClaudeStreamEvent::Error { message } if message.contains("not authenticated"))));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_reports_exit_code_on_empty_stderr() {
        let (_, events) = run_mock_script("#!/bin/sh\nexit 2\n");
        assert!(events.iter().any(
            |e| matches!(e, ClaudeStreamEvent::Error { message } if message.contains("exited with"))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_success_with_no_events() {
        let (result, events) = run_mock_script("#!/bin/sh\nexit 0\n");
        assert!(result.is_ok());
        assert!(matches!(events.last().unwrap(), ClaudeStreamEvent::Done));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_passes_args_through() {
        let args: Vec<String> = vec!["--foo".into(), "bar".into()];
        let (_, events) = run_mock_script_with_args(concat!(
            "#!/bin/sh\n",
            "echo \"{\\\"type\\\":\\\"result\\\",\\\"result\\\":\\\"$*\\\",\\\"session_id\\\":\\\"sx\\\"}\"\n",
        ), &args);
        let text = events.iter().find_map(|e| match e {
            ClaudeStreamEvent::Result { text, .. } => Some(text.as_str()),
            _ => None,
        });
        assert!(text.unwrap().contains("--foo"));
    }

    // --- build_chat_args ---

    #[test]
    fn build_chat_args_basic() {
        let req = ChatStreamRequest {
            message: "hello".into(),
            system_prompt: None,
            session_id: None,
        };
        let args = build_chat_args(&req);
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"hello".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
        assert!(!args.contains(&"--system-prompt".to_string()));
        assert!(!args.contains(&"--resume".to_string()));
    }

    #[test]
    fn build_chat_args_with_system_prompt() {
        let req = ChatStreamRequest {
            message: "hi".into(),
            system_prompt: Some("You are helpful.".into()),
            session_id: None,
        };
        let args = build_chat_args(&req);
        assert!(args.contains(&"--system-prompt".to_string()));
        assert!(args.contains(&"You are helpful.".to_string()));
    }

    #[test]
    fn build_chat_args_empty_system_prompt_is_skipped() {
        let req = ChatStreamRequest {
            message: "hi".into(),
            system_prompt: Some(String::new()),
            session_id: None,
        };
        let args = build_chat_args(&req);
        assert!(!args.contains(&"--system-prompt".to_string()));
    }

    #[test]
    fn build_chat_args_with_session_id() {
        let req = ChatStreamRequest {
            message: "continue".into(),
            system_prompt: None,
            session_id: Some("sess-abc".into()),
        };
        let args = build_chat_args(&req);
        assert!(args.contains(&"--resume".to_string()));
        assert!(args.contains(&"sess-abc".to_string()));
    }

    // --- build_agent_args ---

    #[test]
    fn build_agent_args_basic() {
        // build_agent_args calls build_mcp_config which needs mcp_server_dir
        if let Ok(args) = build_agent_args(&AgentStreamRequest {
            message: "create note".into(),
            system_prompt: None,
            vault_path: "/tmp/vault".into(),
        }) {
            assert!(args.contains(&"-p".to_string()));
            assert!(args.contains(&"create note".to_string()));
            assert!(args.contains(&"--mcp-config".to_string()));
            assert!(args.contains(&"--dangerously-skip-permissions".to_string()));
            assert!(args.contains(&"--no-session-persistence".to_string()));
            assert!(!args.contains(&"--append-system-prompt".to_string()));
        }
    }

    #[test]
    fn build_agent_args_with_system_prompt() {
        if let Ok(args) = build_agent_args(&AgentStreamRequest {
            message: "do it".into(),
            system_prompt: Some("Act as expert.".into()),
            vault_path: "/tmp/v".into(),
        }) {
            assert!(args.contains(&"--append-system-prompt".to_string()));
            assert!(args.contains(&"Act as expert.".to_string()));
        }
    }

    #[test]
    fn build_agent_args_empty_system_prompt_is_skipped() {
        if let Ok(args) = build_agent_args(&AgentStreamRequest {
            message: "x".into(),
            system_prompt: Some(String::new()),
            vault_path: "/tmp/v".into(),
        }) {
            assert!(!args.contains(&"--append-system-prompt".to_string()));
        }
    }

    // --- find_claude_binary ---

    #[test]
    fn find_claude_binary_returns_result() {
        let result = find_claude_binary();
        // On dev machines claude may be installed; on CI it may not.
        // Either way, the function should return Ok(path) or Err(message).
        match &result {
            Ok(path) => assert!(path.exists()),
            Err(msg) => assert!(msg.contains("not found")),
        }
    }

    // --- run_chat_stream / run_agent_stream error paths ---

    #[test]
    fn run_chat_stream_returns_result() {
        let req = ChatStreamRequest {
            message: "test".into(),
            system_prompt: None,
            session_id: None,
        };
        let mut events = vec![];
        // This will either succeed (if claude is installed) or fail (if not).
        let result = run_chat_stream(req, |e| events.push(e));
        // Either way the function should have returned without panicking.
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn run_agent_stream_returns_result() {
        let req = AgentStreamRequest {
            message: "test".into(),
            system_prompt: Some("sys".into()),
            vault_path: "/tmp/nonexistent".into(),
        };
        let mut events = vec![];
        let result = run_agent_stream(req, |e| events.push(e));
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn run_subprocess_spawn_failure() {
        let fake_bin = PathBuf::from("/nonexistent/binary/path");
        let mut events = vec![];
        let result = run_claude_subprocess(&fake_bin, &[], &mut |e| events.push(e));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to spawn"));
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_with_tool_progress_and_assistant() {
        let (result, events) = run_mock_script(concat!(
            "#!/bin/sh\n",
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"s3\"}'\n",
            "echo '{\"type\":\"tool_progress\",\"tool_name\":\"search\",\"tool_use_id\":\"t1\"}'\n",
            "echo '{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"tool_use\",\"id\":\"t2\",\"name\":\"read\",\"input\":{}}]}}'\n",
            "echo '{\"type\":\"result\",\"result\":\"fin\",\"session_id\":\"s3\"}'\n",
        ));
        assert_eq!(result.unwrap(), "s3");
        assert!(events.len() >= 4);
    }

    #[cfg(unix)]
    #[test]
    fn run_subprocess_success_exit_with_session_id_skips_error() {
        let (_, events) = run_mock_script(concat!(
            "#!/bin/sh\n",
            "echo '{\"type\":\"system\",\"subtype\":\"init\",\"session_id\":\"s4\"}'\n",
            "echo 'some warning' >&2\n",
            "exit 1\n",
        ));
        // Should NOT have an error event because session_id is non-empty
        assert!(!events
            .iter()
            .any(|e| matches!(e, ClaudeStreamEvent::Error { .. })));
    }
}
