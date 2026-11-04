use crate::ai_agents::{AiAgentAvailability, AiAgentStreamEvent};
pub use crate::cli_agent_runtime::AgentStreamRequest;
use serde::Deserialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Stdio;

mod error;

use error::{format_codex_error, CodexProcessError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodexModelOption {
    pub id: String,
    pub label: String,
}

#[derive(Deserialize)]
struct CodexModelCatalog {
    models: Vec<CodexModelEntry>,
}

#[derive(Deserialize)]
struct CodexModelEntry {
    slug: String,
    display_name: String,
    visibility: String,
}

pub fn check_cli() -> AiAgentAvailability {
    codex_availability_from_binary_result(find_codex_binary())
}

pub fn run_agent_stream<F>(request: AgentStreamRequest, emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let binary = find_codex_binary()?;
    run_agent_stream_with_binary(&binary, request, emit)
}

pub fn discover_models() -> Result<Vec<CodexModelOption>, String> {
    let binary = find_codex_binary()?;
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(&binary)?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, &binary);
    let output = command
        .args(&target.prefix_args)
        .args(["debug", "models"])
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("Failed to discover Codex models: {error}"))?;
    if !output.status.success() {
        return Err("Codex did not return an available model catalog.".into());
    }
    let stdout = String::from_utf8(output.stdout)
        .map_err(|_| "Codex returned a non-UTF-8 model catalog.".to_string())?;
    parse_codex_model_catalog(&stdout)
}

fn parse_codex_model_catalog(catalog: &str) -> Result<Vec<CodexModelOption>, String> {
    let parsed: CodexModelCatalog = serde_json::from_str(catalog)
        .map_err(|error| format!("Codex returned an invalid model catalog: {error}"))?;
    let mut seen = HashSet::new();
    Ok(parsed
        .models
        .into_iter()
        .filter_map(|model| {
            if model.visibility != "list" {
                return None;
            }
            let id = model.slug.trim().to_string();
            if id.is_empty() {
                return None;
            }
            let label = model.display_name.trim().to_string();
            if label.is_empty() {
                return None;
            }
            if !seen.insert(id.clone()) {
                return None;
            }
            Some(CodexModelOption { id, label })
        })
        .collect())
}

fn find_codex_binary() -> Result<PathBuf, String> {
    if let Some(binary) = find_codex_binary_on_path() {
        return Ok(binary);
    }

    // Known install locations are stat calls; the login shell evaluates the user's
    // startup files and can take seconds, so it stays the last resort. A candidate
    // that exists but is not executable must not hide a binary only the shell finds.
    let unusable_candidate = match crate::cli_agent_runtime::find_executable_binary_candidate(
        codex_binary_candidates(),
        "Codex CLI",
    ) {
        Ok(Some(binary)) => return Ok(binary),
        Ok(None) => None,
        Err(error) => Some(error),
    };

    if let Some(binary) = find_codex_binary_in_user_shell() {
        return Ok(binary);
    }

    match unusable_candidate {
        Some(error) => Err(error),
        None => {
            Err("Codex CLI not found. Install it: https://developers.openai.com/codex/cli".into())
        }
    }
}

fn codex_availability_from_binary_result(
    binary_result: Result<PathBuf, String>,
) -> AiAgentAvailability {
    match binary_result {
        Ok(binary) => AiAgentAvailability {
            installed: true,
            version: crate::cli_agent_runtime::version_for_binary(&binary),
        },
        Err(_) => AiAgentAvailability {
            installed: false,
            version: None,
        },
    }
}

fn find_codex_binary_on_path() -> Option<PathBuf> {
    crate::hidden_command(codex_path_lookup_command())
        .arg("codex")
        .output()
        .ok()
        .and_then(|output| path_from_successful_output(&output))
}

fn codex_path_lookup_command() -> &'static str {
    if cfg!(windows) {
        "where"
    } else {
        "which"
    }
}

fn find_codex_binary_in_user_shell() -> Option<PathBuf> {
    user_shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| codex_path_from_shell(&shell))
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

fn codex_path_from_shell(shell: &Path) -> Option<PathBuf> {
    crate::hidden_command(shell)
        .arg("-lc")
        .arg("command -v codex")
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
    first_existing_path_for_platform(stdout, cfg!(windows))
}

fn first_existing_path_for_platform(stdout: &str, windows: bool) -> Option<PathBuf> {
    let mut paths = stdout.lines().filter_map(existing_path);
    if windows {
        return paths.find(|path| crate::cli_agent_runtime::has_windows_cli_extension(path));
    }

    paths.next()
}

fn existing_path(line: &str) -> Option<PathBuf> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    let candidate = PathBuf::from(trimmed);
    candidate.exists().then_some(candidate)
}

fn codex_binary_candidates() -> Vec<PathBuf> {
    dirs::home_dir()
        .map(|home| codex_binary_candidates_for_home(&home))
        .unwrap_or_default()
}

fn codex_binary_candidates_for_home(home: &Path) -> Vec<PathBuf> {
    let mut candidates = vec![
        home.join(".local/bin/codex"),
        home.join(".local/bin/codex.exe"),
        home.join(".local/bin/codex.cmd"),
        home.join(".codex/bin/codex"),
        home.join(".codex/bin/codex.exe"),
        home.join(".codex/bin/codex.cmd"),
        home.join(".local/share/mise/shims/codex"),
        home.join(".local/share/mise/shims/codex.exe"),
        home.join(".local/share/mise/shims/codex.cmd"),
        home.join(".asdf/shims/codex"),
        home.join(".asdf/shims/codex.exe"),
        home.join(".asdf/shims/codex.cmd"),
        home.join(".npm-global/bin/codex"),
        home.join(".npm-global/bin/codex.cmd"),
        home.join(".npm-global/bin/codex.exe"),
        home.join(".npm/bin/codex"),
        home.join(".npm/bin/codex.cmd"),
        home.join(".npm/bin/codex.exe"),
        home.join(".bun/bin/codex"),
        home.join(".bun/bin/codex.exe"),
        home.join(".bun/bin/codex.cmd"),
        home.join(".linuxbrew/bin/codex"),
        home.join("AppData/Roaming/npm/codex.cmd"),
        home.join("AppData/Roaming/npm/codex.exe"),
        home.join("AppData/Local/pnpm/codex.cmd"),
        home.join("AppData/Local/pnpm/codex.exe"),
        home.join("scoop/shims/codex.cmd"),
        home.join("scoop/shims/codex.exe"),
        PathBuf::from("/home/linuxbrew/.linuxbrew/bin/codex"),
        PathBuf::from("/usr/local/bin/codex"),
        PathBuf::from("/opt/homebrew/bin/codex"),
        PathBuf::from("/Applications/Codex.app/Contents/Resources/codex"),
        PathBuf::from("/Applications/ChatGPT.app/Contents/Resources/codex"),
    ];
    candidates.extend(nvm_codex_binary_candidates_for_home(home));
    candidates
}

fn nvm_codex_binary_candidates_for_home(home: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(home.join(".nvm/versions/node")) else {
        return Vec::new();
    };

    let mut candidates = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .map(|path| path.join("bin").join("codex"))
        .collect::<Vec<_>>();
    candidates.sort();
    candidates
}

fn run_agent_stream_with_binary<F>(
    binary: &Path,
    request: AgentStreamRequest,
    emit: F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let last_message_dir = tempfile::Builder::new()
        .prefix("tolaria-codex-last-message-")
        .tempdir()
        .map_err(|error| format!("Failed to create Codex output directory: {error}"))?;
    let last_message_path = last_message_dir.path().join("last-message.txt");
    let args = build_codex_args(&request, Some(&last_message_path))?;
    let prompt = build_codex_prompt(&request);
    let command = build_codex_command(binary, args, &request.vault_path)?;
    let emit = with_codex_last_message_fallback(emit, last_message_path);

    crate::cli_agent_runtime::run_ai_agent_json_stream_with_success_check(
        crate::cli_agent_runtime::JsonLineProcess::new(command, "codex").with_stdin(Some(&prompt)),
        emit,
        codex_session_id,
        dispatch_codex_event,
        |stderr_output, status| {
            format_codex_error(CodexProcessError {
                stderr_output,
                status,
            })
        },
        |_| None,
    )
}

fn with_codex_last_message_fallback<F>(
    mut emit: F,
    last_message_path: PathBuf,
) -> impl FnMut(AiAgentStreamEvent)
where
    F: FnMut(AiAgentStreamEvent),
{
    let mut text_emitted = false;

    move |event| {
        match &event {
            AiAgentStreamEvent::TextDelta { text } if !text.trim().is_empty() => {
                text_emitted = true;
            }
            AiAgentStreamEvent::Done if !text_emitted => {
                if let Some(text) = read_codex_last_message(&last_message_path) {
                    text_emitted = true;
                    emit(AiAgentStreamEvent::TextDelta { text });
                }
            }
            _ => {}
        }

        emit(event);
    }
}

fn build_codex_command(
    binary: &Path,
    args: Vec<String>,
    vault_path: &str,
) -> Result<std::process::Command, String> {
    let target = crate::cli_agent_runtime::command_target_avoiding_windows_cmd_shim(binary)?;
    let mut command = crate::hidden_command(&target.program);
    crate::cli_agent_runtime::configure_agent_command_environment(&mut command, binary);
    command.args(&target.prefix_args);
    command
        .args(args)
        .arg("-")
        .current_dir(vault_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    Ok(command)
}

fn build_codex_args(
    request: &AgentStreamRequest,
    last_message_path: Option<&Path>,
) -> Result<Vec<String>, String> {
    let mcp_server_path = crate::cli_agent_runtime::mcp_server_path_string()?;
    let node_path = crate::mcp::find_node()?;

    let mut args = vec![
        "--sandbox".into(),
        codex_sandbox(request.permission_mode).into(),
        "--ask-for-approval".into(),
        codex_approval_policy(request.permission_mode).into(),
        "exec".into(),
        "--json".into(),
        "-C".into(),
        request.vault_path.clone(),
        "-c".into(),
        codex_config_string("mcp_servers.tolaria.command", &node_path.to_string_lossy()),
        "-c".into(),
        codex_config_string_list("mcp_servers.tolaria.args", &[mcp_server_path.as_str()]),
        "-c".into(),
        codex_mcp_env_config(request),
    ];

    if let Some(model) = request
        .model
        .as_deref()
        .map(str::trim)
        .filter(|model| !model.is_empty())
    {
        args.push("--model".into());
        args.push(model.into());
    }

    if let Some(path) = last_message_path {
        args.push("--output-last-message".into());
        args.push(path.to_string_lossy().into_owned());
    }

    Ok(args)
}

fn codex_config_string(key: &str, value: &str) -> String {
    format!(r#"{key}="{}""#, toml_escape(value))
}

fn codex_config_string_list(key: &str, values: &[&str]) -> String {
    let values = values
        .iter()
        .map(|value| format!(r#""{}""#, toml_escape(value)))
        .collect::<Vec<_>>()
        .join(",");
    format!("{key}=[{values}]")
}

fn codex_mcp_env_config(request: &AgentStreamRequest) -> String {
    let vault_paths = crate::cli_agent_runtime::active_vault_paths_json(
        &request.vault_path,
        &request.vault_paths,
    );
    format!(
        r#"mcp_servers.tolaria.env={{VAULT_PATH="{}",VAULT_PATHS="{}",WS_UI_PORT="9711"}}"#,
        toml_escape(&request.vault_path),
        toml_escape(&vault_paths)
    )
}

fn toml_escape(value: &str) -> String {
    value.replace('\\', r#"\\"#).replace('"', r#"\""#)
}

fn codex_sandbox(permission_mode: crate::ai_agents::AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        crate::ai_agents::AiAgentPermissionMode::Safe => "read-only",
        crate::ai_agents::AiAgentPermissionMode::PowerUser => "workspace-write",
    }
}

fn codex_approval_policy(permission_mode: crate::ai_agents::AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        crate::ai_agents::AiAgentPermissionMode::Safe => "on-request",
        crate::ai_agents::AiAgentPermissionMode::PowerUser => "never",
    }
}

fn build_codex_prompt(request: &AgentStreamRequest) -> String {
    crate::cli_agent_runtime::build_prompt(&request.message, request.system_prompt.as_deref())
}

fn codex_session_id(json: &serde_json::Value) -> Option<&str> {
    json["thread_id"].as_str()
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
        "mcp_tool_call" => emit_codex_mcp_tool_event(item, item_id, completed, emit),
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

fn emit_codex_mcp_tool_event<F>(
    item: &serde_json::Value,
    item_id: &str,
    completed: bool,
    emit: &mut F,
) where
    F: FnMut(AiAgentStreamEvent),
{
    if completed {
        emit(AiAgentStreamEvent::ToolDone {
            tool_id: item_id.to_string(),
            output: codex_tool_output(item),
        });
        return;
    }

    let tool_name = item["tool"].as_str().unwrap_or("MCP tool");
    let input = json_field_to_string(&item["arguments"]);
    emit(AiAgentStreamEvent::ToolStart {
        tool_name: tool_name.to_string(),
        tool_id: item_id.to_string(),
        input,
    });
}

fn codex_tool_output(item: &serde_json::Value) -> Option<String> {
    item["error"]["message"]
        .as_str()
        .map(|message| format!("Error: {message}"))
        .or_else(|| json_field_to_string(&item["result"]))
}

fn json_field_to_string(value: &serde_json::Value) -> Option<String> {
    if value.is_null() {
        None
    } else {
        value
            .as_str()
            .map(str::to_string)
            .or_else(|| Some(value.to_string()))
    }
}

fn read_codex_last_message(path: &Path) -> Option<String> {
    std::fs::read_to_string(path)
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

#[cfg(test)]
#[path = "codex_cli_tests/mod.rs"]
mod tests;
