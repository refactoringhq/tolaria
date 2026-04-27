use serde::{Deserialize, Serialize};
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiAgentId {
    ClaudeCode,
    Codex,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiAgentAvailability {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiAgentsStatus {
    pub claude_code: AiAgentAvailability,
    pub codex: AiAgentAvailability,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum AiAgentStreamEvent {
    Init {
        session_id: String,
    },
    TextDelta {
        text: String,
    },
    ThinkingDelta {
        text: String,
    },
    ToolStart {
        tool_name: String,
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<String>,
    },
    ToolDone {
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output: Option<String>,
    },
    Error {
        message: String,
    },
    Done,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiAgentStreamRequest {
    pub agent: AiAgentId,
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: String,
}

pub fn get_ai_agents_status() -> AiAgentsStatus {
    AiAgentsStatus {
        claude_code: availability_from_claude(),
        codex: availability_from_codex(),
    }
}

fn normalize_ai_agent_request(request: &mut AiAgentStreamRequest) {
    request.vault_path = crate::commands::expand_tilde(&request.vault_path).into_owned();
}

pub fn run_ai_agent_stream<F>(
    mut request: AiAgentStreamRequest,
    mut emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    normalize_ai_agent_request(&mut request);
    match request.agent {
        AiAgentId::ClaudeCode => {
            let mapped = crate::claude_cli::AgentStreamRequest {
                message: request.message,
                system_prompt: request.system_prompt,
                vault_path: request.vault_path,
            };
            crate::claude_cli::run_agent_stream(mapped, |event| {
                if let Some(mapped_event) = map_claude_event(event) {
                    emit(mapped_event);
                }
            })
        }
        AiAgentId::Codex => run_codex_agent_stream(request, emit),
    }
}

fn availability_from_claude() -> AiAgentAvailability {
    let status = crate::claude_cli::check_cli();
    AiAgentAvailability {
        installed: status.installed,
        version: status.version,
    }
}

fn availability_from_codex() -> AiAgentAvailability {
    let binary = match find_codex_binary() {
        Ok(binary) => binary,
        Err(_) => {
            return AiAgentAvailability {
                installed: false,
                version: None,
            }
        }
    };

    AiAgentAvailability {
        installed: true,
        version: version_for_binary(&binary),
    }
}

fn version_for_binary(binary: &PathBuf) -> Option<String> {
    Command::new(binary)
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn find_codex_binary() -> Result<PathBuf, String> {
    if let Some(binary) = find_codex_binary_on_path() {
        return Ok(binary);
    }

    if let Some(binary) = find_codex_binary_in_user_shell() {
        return Ok(binary);
    }

    if let Some(binary) = find_existing_binary(codex_binary_candidates()) {
        return Ok(binary);
    }

    Err("Codex CLI not found. Install it: https://developers.openai.com/codex/cli".into())
}

fn find_codex_binary_on_path() -> Option<PathBuf> {
    Command::new("which")
        .arg("codex")
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn find_codex_binary_in_user_shell() -> Option<PathBuf> {
    user_shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| command_path_from_shell(&shell, "codex"))
}

fn user_shell_candidates() -> Vec<PathBuf> {
    let mut shells = Vec::new();
    if let Some(shell) = std::env::var_os("SHELL") {
        if !shell.is_empty() {
            shells.push(PathBuf::from(shell));
        }
    }
    shells.push(PathBuf::from("/bin/zsh"));
    shells.push(PathBuf::from("/bin/bash"));
    shells
}

fn command_path_from_shell(shell: &Path, command: &str) -> Option<PathBuf> {
    Command::new(shell)
        .arg("-lc")
        .arg(format!("command -v {command}"))
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn path_from_successful_output(output: &std::process::Output) -> Option<PathBuf> {
    if output.status.success() {
        first_existing_path(&String::from_utf8_lossy(&output.stdout))
    } else {
        None
    }
}

fn first_existing_path(stdout: &str) -> Option<PathBuf> {
    stdout.lines().find_map(|line| {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }
        let candidate = PathBuf::from(trimmed);
        candidate.exists().then_some(candidate)
    })
}

fn codex_binary_candidates() -> Vec<PathBuf> {
    dirs::home_dir()
        .map(|home| codex_binary_candidates_for_home(&home))
        .unwrap_or_default()
}

fn codex_binary_candidates_for_home(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin/codex"),
        home.join(".codex/bin/codex"),
        home.join(".local/share/mise/shims/codex"),
        home.join(".asdf/shims/codex"),
        home.join(".npm-global/bin/codex"),
        home.join(".npm/bin/codex"),
        home.join(".bun/bin/codex"),
        PathBuf::from("/usr/local/bin/codex"),
        PathBuf::from("/opt/homebrew/bin/codex"),
        PathBuf::from("/Applications/Codex.app/Contents/Resources/codex"),
    ]
}

fn find_existing_binary(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|candidate| candidate.exists())
}

fn run_codex_agent_stream<F>(request: AiAgentStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let binary = find_codex_binary()?;
    let args = build_codex_args(&request)?;
    let prompt = build_codex_prompt(&request);

    let mut command = Command::new(binary);
    command
        .args(args)
        .arg(prompt)
        .current_dir(&request.vault_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| format!("Failed to spawn codex: {error}"))?;

    let stdout = child.stdout.take().ok_or("No stdout handle")?;
    let reader = std::io::BufReader::new(stdout);

    let mut thread_id = String::new();

    for line in reader.lines() {
        let line = match line {
            Ok(line) => line,
            Err(error) => {
                emit(AiAgentStreamEvent::Error {
                    message: format!("Read error: {error}"),
                });
                break;
            }
        };

        if line.trim().is_empty() {
            continue;
        }

        let json = match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(json) => json,
            Err(_) => continue,
        };

        if let Some(id) = json["thread_id"].as_str() {
            thread_id = id.to_string();
        }

        dispatch_codex_event(&json, &mut emit);
    }

    let stderr_output = child
        .stderr
        .take()
        .and_then(|stderr| std::io::read_to_string(stderr).ok())
        .unwrap_or_default();

    let status = child
        .wait()
        .map_err(|error| format!("Wait failed: {error}"))?;
    if !status.success() {
        emit(AiAgentStreamEvent::Error {
            message: format_codex_error(stderr_output, status.to_string()),
        });
    }

    emit(AiAgentStreamEvent::Done);

    Ok(thread_id)
}

fn build_codex_args(request: &AiAgentStreamRequest) -> Result<Vec<String>, String> {
    let mcp_server = crate::mcp::mcp_server_dir()?.join("index.js");
    let mcp_server_path = mcp_server
        .to_str()
        .ok_or("Invalid MCP server path")?
        .to_string();

    Ok(vec![
        "exec".into(),
        "--json".into(),
        "-C".into(),
        request.vault_path.clone(),
        "-c".into(),
        r#"mcp_servers.tolaria.command="node""#.into(),
        "-c".into(),
        format!(r#"mcp_servers.tolaria.args=["{}"]"#, mcp_server_path),
        "-c".into(),
        format!(
            r#"mcp_servers.tolaria.env={{VAULT_PATH="{}"}}"#,
            request.vault_path
        ),
    ])
}

fn build_codex_prompt(request: &AiAgentStreamRequest) -> String {
    match request
        .system_prompt
        .as_ref()
        .map(|prompt| prompt.trim())
        .filter(|prompt| !prompt.is_empty())
    {
        Some(system_prompt) => format!(
            "System instructions:\n{system_prompt}\n\nUser request:\n{}",
            request.message
        ),
        None => request.message.clone(),
    }
}

fn dispatch_codex_event<F>(json: &serde_json::Value, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    match json["type"].as_str().unwrap_or_default() {
        "thread.started" => {
            if let Some(thread_id) = json["thread_id"].as_str() {
                emit(AiAgentStreamEvent::Init {
                    session_id: thread_id.to_string(),
                });
            }
        }
        "error" => {
            if let Some(message) = json["message"].as_str() {
                emit(AiAgentStreamEvent::Error {
                    message: message.to_string(),
                });
            }
        }
        "turn.failed" => {
            if let Some(message) = json["error"]["message"].as_str() {
                emit(AiAgentStreamEvent::Error {
                    message: message.to_string(),
                });
            }
        }
        "item.started" => emit_codex_item_event(json, false, emit),
        "item.completed" => emit_codex_item_event(json, true, emit),
        _ => {}
    }
}

fn emit_codex_item_event<F>(json: &serde_json::Value, completed: bool, emit: &mut F)
where
    F: FnMut(AiAgentStreamEvent),
{
    let item = &json["item"];
    let item_type = item["type"].as_str().unwrap_or_default();
    let item_id = item["id"].as_str().unwrap_or_default();

    match item_type {
        "command_execution" => {
            if completed {
                emit(AiAgentStreamEvent::ToolDone {
                    tool_id: item_id.to_string(),
                    output: item["aggregated_output"]
                        .as_str()
                        .map(|output| output.to_string()),
                });
            } else {
                emit(AiAgentStreamEvent::ToolStart {
                    tool_name: "Bash".into(),
                    tool_id: item_id.to_string(),
                    input: item["command"]
                        .as_str()
                        .map(|command| serde_json::json!({ "command": command }).to_string()),
                });
            }
        }
        "agent_message" if completed => {
            if let Some(text) = item["text"].as_str() {
                emit(AiAgentStreamEvent::TextDelta {
                    text: text.to_string(),
                });
            }
        }
        _ => {}
    }
}

fn format_codex_error(stderr_output: String, status: String) -> String {
    let lower = stderr_output.to_ascii_lowercase();
    if is_codex_auth_error(&lower) {
        return "Codex CLI is not authenticated. Run `codex login` or launch `codex` in your terminal.".into();
    }

    if stderr_output.trim().is_empty() {
        format!("codex exited with status {status}")
    } else {
        stderr_output.lines().take(3).collect::<Vec<_>>().join("\n")
    }
}

fn is_codex_auth_error(lower: &str) -> bool {
    ["auth", "login", "sign in"]
        .iter()
        .any(|pattern| lower.contains(pattern))
}

fn map_claude_event(event: crate::claude_cli::ClaudeStreamEvent) -> Option<AiAgentStreamEvent> {
    match event {
        crate::claude_cli::ClaudeStreamEvent::Init { session_id } => {
            Some(AiAgentStreamEvent::Init { session_id })
        }
        crate::claude_cli::ClaudeStreamEvent::TextDelta { text } => {
            Some(AiAgentStreamEvent::TextDelta { text })
        }
        crate::claude_cli::ClaudeStreamEvent::ThinkingDelta { text } => {
            Some(AiAgentStreamEvent::ThinkingDelta { text })
        }
        crate::claude_cli::ClaudeStreamEvent::ToolStart {
            tool_name,
            tool_id,
            input,
        } => Some(AiAgentStreamEvent::ToolStart {
            tool_name,
            tool_id,
            input,
        }),
        crate::claude_cli::ClaudeStreamEvent::ToolDone { tool_id, output } => {
            Some(AiAgentStreamEvent::ToolDone { tool_id, output })
        }
        crate::claude_cli::ClaudeStreamEvent::Error { message } => {
            Some(AiAgentStreamEvent::Error { message })
        }
        crate::claude_cli::ClaudeStreamEvent::Done => Some(AiAgentStreamEvent::Done),
        crate::claude_cli::ClaudeStreamEvent::Result { .. } => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_status_contains_both_agents() {
        let status = get_ai_agents_status();
        assert!(matches!(status.claude_code.installed, true | false));
        assert!(matches!(status.codex.installed, true | false));
    }

    #[test]
    fn normalize_ai_agent_request_expands_tilde_vault_path() {
        let home = dirs::home_dir().expect("home dir available in test env");
        let mut request = AiAgentStreamRequest {
            agent: AiAgentId::ClaudeCode,
            message: "ignored".into(),
            system_prompt: None,
            vault_path: "~/Vaults/work".into(),
        };
        normalize_ai_agent_request(&mut request);
        assert_eq!(
            request.vault_path,
            home.join("Vaults").join("work").to_string_lossy(),
        );
    }

    #[test]
    fn normalize_ai_agent_request_leaves_absolute_paths_intact() {
        let mut request = AiAgentStreamRequest {
            agent: AiAgentId::Codex,
            message: "ignored".into(),
            system_prompt: None,
            vault_path: "/var/data/vault".into(),
        };
        normalize_ai_agent_request(&mut request);
        assert_eq!(request.vault_path, "/var/data/vault");
    }

    #[test]
    fn build_codex_prompt_keeps_system_prompt_first() {
        let prompt = build_codex_prompt(&AiAgentStreamRequest {
            agent: AiAgentId::Codex,
            message: "Rename the note".into(),
            system_prompt: Some("Be concise".into()),
            vault_path: "/tmp/vault".into(),
        });

        assert!(prompt.starts_with("System instructions:\nBe concise"));
        assert!(prompt.contains("User request:\nRename the note"));
    }

    #[test]
    fn build_codex_args_uses_safe_default_permissions() {
        if let Ok(args) = build_codex_args(&AiAgentStreamRequest {
            agent: AiAgentId::Codex,
            message: "Rename the note".into(),
            system_prompt: None,
            vault_path: "/tmp/vault".into(),
        }) {
            assert!(!args.contains(&"--dangerously-bypass-approvals-and-sandbox".to_string()));
            assert!(args.contains(&"--json".to_string()));
            assert!(args.contains(&"-C".to_string()));
        }
    }

    #[test]
    fn codex_binary_candidates_include_supported_macos_installs() {
        let home = PathBuf::from("/Users/alex");
        let candidates = codex_binary_candidates_for_home(&home);
        let expected = [
            home.join(".local/bin/codex"),
            home.join(".codex/bin/codex"),
            home.join(".local/share/mise/shims/codex"),
            home.join(".asdf/shims/codex"),
            home.join(".npm-global/bin/codex"),
            home.join(".bun/bin/codex"),
            PathBuf::from("/Applications/Codex.app/Contents/Resources/codex"),
        ];

        for candidate in expected {
            assert!(
                candidates.contains(&candidate),
                "missing {}",
                candidate.display()
            );
        }
    }

    #[test]
    fn first_existing_path_skips_empty_and_missing_lines() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("missing-codex");
        let codex = dir.path().join("codex");
        std::fs::write(&codex, "#!/bin/sh\n").unwrap();

        let stdout = format!("\n{}\n{}\n", missing.display(), codex.display());

        assert_eq!(first_existing_path(&stdout), Some(codex));
    }

    #[cfg(unix)]
    #[test]
    fn command_path_from_shell_finds_codex_from_login_shell() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let codex = dir.path().join("codex");
        std::fs::write(&codex, "#!/bin/sh\n").unwrap();
        std::fs::set_permissions(&codex, std::fs::Permissions::from_mode(0o755)).unwrap();

        let shell = dir.path().join("shell");
        std::fs::write(
            &shell,
            format!(
                "#!/bin/sh\nif [ \"$1\" = \"-lc\" ]; then echo '{}'; fi\n",
                codex.display()
            ),
        )
        .unwrap();
        std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o755)).unwrap();

        assert_eq!(command_path_from_shell(&shell, "codex"), Some(codex));
    }

    #[test]
    fn dispatch_codex_command_events_maps_to_bash_events() {
        let mut events = Vec::new();
        let started = serde_json::json!({
            "type": "item.started",
            "item": {
                "id": "item_1",
                "type": "command_execution",
                "command": "/bin/zsh -lc pwd"
            }
        });
        let completed = serde_json::json!({
            "type": "item.completed",
            "item": {
                "id": "item_1",
                "type": "command_execution",
                "aggregated_output": "/private/tmp\n"
            }
        });

        dispatch_codex_event(&started, &mut |event| events.push(event));
        dispatch_codex_event(&completed, &mut |event| events.push(event));

        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::ToolStart { tool_name, tool_id, .. }
                if tool_name == "Bash" && tool_id == "item_1"
        ));
        assert!(matches!(
            &events[1],
            AiAgentStreamEvent::ToolDone { tool_id, output }
                if tool_id == "item_1" && output.as_deref() == Some("/private/tmp\n")
        ));
    }

    #[test]
    fn dispatch_codex_agent_message_maps_to_text_delta() {
        let mut events = Vec::new();
        let completed = serde_json::json!({
            "type": "item.completed",
            "item": {
                "id": "item_2",
                "type": "agent_message",
                "text": "All set"
            }
        });

        dispatch_codex_event(&completed, &mut |event| events.push(event));

        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::TextDelta { text } if text == "All set"
        ));
    }

    #[test]
    fn dispatch_codex_error_event_maps_to_error() {
        let mut events = Vec::new();
        let error = serde_json::json!({
            "type": "error",
            "message": "The configured model requires a newer Codex CLI."
        });

        dispatch_codex_event(&error, &mut |event| events.push(event));

        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::Error { message }
                if message == "The configured model requires a newer Codex CLI."
        ));
    }

    #[test]
    fn dispatch_codex_turn_failed_event_maps_to_error() {
        let mut events = Vec::new();
        let failed = serde_json::json!({
            "type": "turn.failed",
            "error": { "message": "unexpected status 400 Bad Request" }
        });

        dispatch_codex_event(&failed, &mut |event| events.push(event));

        assert!(matches!(
            &events[0],
            AiAgentStreamEvent::Error { message } if message == "unexpected status 400 Bad Request"
        ));
    }

    #[test]
    fn map_claude_done_event_preserves_completion_signal() {
        let mapped = map_claude_event(crate::claude_cli::ClaudeStreamEvent::Done);

        assert!(matches!(mapped, Some(AiAgentStreamEvent::Done)));
    }
}
