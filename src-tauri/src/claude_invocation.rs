use crate::ai_agents::AiAgentPermissionMode;
use crate::claude_cli::ChatStreamRequest;
use crate::cli_agent_runtime::AgentStreamRequest;

const CLAUDE_SAFE_AGENT_TOOLS: &str = "Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill";
const CLAUDE_POWER_USER_AGENT_TOOLS: &str = "Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill,Bash";
const CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT: &str =
    "Bash,Glob,Grep,Read,Edit,Write,NotebookEdit,WebFetch,WebSearch,TodoWrite,Task,MultiEdit,LS";
const CLAUDE_SAFE_DISALLOWED_TOOLS_COMPAT: &str =
    "Bash,NotebookEdit,WebFetch,WebSearch,TodoWrite,Task";
const CLAUDE_POWER_USER_DISALLOWED_TOOLS_COMPAT: &str =
    "NotebookEdit,WebFetch,WebSearch,TodoWrite,Task";
const WINDOWS_COMMAND_LINE_STDIN_THRESHOLD: usize = 24 * 1024;

#[derive(Debug)]
pub(crate) struct ClaudeInvocation {
    pub(crate) args: Vec<String>,
    pub(crate) fallback_args: Vec<Vec<String>>,
    pub(crate) stdin_text: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum PromptSource {
    Argument,
    Stdin,
}

pub(crate) fn chat(req: &ChatStreamRequest) -> ClaudeInvocation {
    chat_with_windows_limit(req, cfg!(windows))
}

pub(crate) fn agent(req: &AgentStreamRequest) -> Result<ClaudeInvocation, String> {
    agent_with_windows_limit(req, cfg!(windows))
}

fn chat_with_windows_limit(
    req: &ChatStreamRequest,
    enforce_windows_limit: bool,
) -> ClaudeInvocation {
    let args = chat_args(req);
    let fallback_args = vec![chat_args_compat(req)];
    if should_pipe_prompt_for_windows(enforce_windows_limit, &args, &fallback_args) {
        return ClaudeInvocation {
            args: chat_args_with_tool_policy(req, "--tools", String::new(), PromptSource::Stdin),
            fallback_args: vec![chat_args_with_tool_policy(
                req,
                "--disallowedTools",
                CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT.into(),
                PromptSource::Stdin,
            )],
            stdin_text: Some(stdin_prompt(&req.message, req.system_prompt.as_deref())),
        };
    }

    ClaudeInvocation {
        args,
        fallback_args,
        stdin_text: None,
    }
}

fn agent_with_windows_limit(
    req: &AgentStreamRequest,
    enforce_windows_limit: bool,
) -> Result<ClaudeInvocation, String> {
    let args = agent_args(req)?;
    let fallback_args = vec![
        agent_args_without_session_persistence(req)?,
        agent_args_compat(req)?,
    ];
    if should_pipe_prompt_for_windows(enforce_windows_limit, &args, &fallback_args) {
        return Ok(ClaudeInvocation {
            args: agent_args_with_tool_policy(
                req,
                AgentToolPolicy::strict(req.permission_mode),
                PromptSource::Stdin,
            )?,
            fallback_args: vec![
                agent_args_with_tool_policy(
                    req,
                    AgentToolPolicy::strict_without_session_persistence(req.permission_mode),
                    PromptSource::Stdin,
                )?,
                agent_args_with_tool_policy(
                    req,
                    AgentToolPolicy::compat(req.permission_mode),
                    PromptSource::Stdin,
                )?,
            ],
            stdin_text: Some(stdin_prompt(&req.message, req.system_prompt.as_deref())),
        });
    }

    Ok(ClaudeInvocation {
        args,
        fallback_args,
        stdin_text: None,
    })
}

fn chat_args(req: &ChatStreamRequest) -> Vec<String> {
    chat_args_with_tool_policy(req, "--tools", String::new(), PromptSource::Argument)
}

fn chat_args_compat(req: &ChatStreamRequest) -> Vec<String> {
    chat_args_with_tool_policy(
        req,
        "--disallowedTools",
        CLAUDE_CHAT_DISALLOWED_TOOLS_COMPAT.into(),
        PromptSource::Argument,
    )
}

fn chat_args_with_tool_policy(
    req: &ChatStreamRequest,
    tool_flag: &str,
    tool_value: String,
    prompt_source: PromptSource,
) -> Vec<String> {
    let mut args: Vec<String> = vec!["-p".into()];
    if prompt_source == PromptSource::Argument {
        args.push(req.message.clone());
    }
    args.extend([
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--include-partial-messages".into(),
        tool_flag.into(),
        tool_value,
    ]);

    if prompt_source == PromptSource::Argument {
        append_non_empty_arg_pair(&mut args, "--system-prompt", req.system_prompt.as_deref());
    }
    if let Some(ref session_id) = req.session_id {
        args.push("--resume".into());
        args.push(session_id.clone());
    }

    args
}

fn agent_args(req: &AgentStreamRequest) -> Result<Vec<String>, String> {
    agent_args_with_tool_policy(
        req,
        AgentToolPolicy::strict(req.permission_mode),
        PromptSource::Argument,
    )
}

fn agent_args_without_session_persistence(req: &AgentStreamRequest) -> Result<Vec<String>, String> {
    agent_args_with_tool_policy(
        req,
        AgentToolPolicy::strict_without_session_persistence(req.permission_mode),
        PromptSource::Argument,
    )
}

fn agent_args_compat(req: &AgentStreamRequest) -> Result<Vec<String>, String> {
    agent_args_with_tool_policy(
        req,
        AgentToolPolicy::compat(req.permission_mode),
        PromptSource::Argument,
    )
}

fn agent_args_with_tool_policy(
    req: &AgentStreamRequest,
    policy: AgentToolPolicy,
    prompt_source: PromptSource,
) -> Result<Vec<String>, String> {
    let mut args: Vec<String> = vec!["-p".into()];
    if prompt_source == PromptSource::Argument {
        args.push(req.message.clone());
    }
    args.extend([
        "--output-format".into(),
        "stream-json".into(),
        "--verbose".into(),
        "--include-partial-messages".into(),
    ]);
    args.extend(mcp_args(req, &policy)?);
    args.extend([
        "--permission-mode".into(),
        "acceptEdits".into(),
        policy.tool_flag.into(),
        policy.tool_value.into(),
    ]);

    if policy.include_session_persistence_flag {
        args.push("--no-session-persistence".into());
    }
    if let Some(allowed_tools) = policy.preapproved_tools {
        args.push("--allowedTools".into());
        args.push(allowed_tools.into());
    }
    if let Some(disallowed_tools) = policy.disallowed_tools {
        args.push("--disallowedTools".into());
        args.push(disallowed_tools.into());
    }
    append_non_empty_arg_pair(&mut args, "--model", req.model.as_deref());
    if prompt_source == PromptSource::Argument {
        append_non_empty_arg_pair(
            &mut args,
            "--append-system-prompt",
            req.system_prompt.as_deref(),
        );
    }

    Ok(args)
}

fn append_non_empty_arg_pair(args: &mut Vec<String>, flag: &str, value: Option<&str>) {
    if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
        args.push(flag.into());
        args.push(value.into());
    }
}

fn stdin_prompt(message: &str, system_prompt: Option<&str>) -> String {
    crate::cli_agent_runtime::build_prompt(message, system_prompt)
}

fn mcp_args(req: &AgentStreamRequest, policy: &AgentToolPolicy) -> Result<Vec<String>, String> {
    let mut args = vec![
        "--mcp-config".into(),
        mcp_config(&req.vault_path, &req.vault_paths)?,
    ];
    if !policy.inherit_user_mcp_servers {
        args.push("--strict-mcp-config".into());
    }
    Ok(args)
}

fn mcp_config(vault_path: &str, vault_paths: &[String]) -> Result<String, String> {
    let mcp_server_path = crate::cli_agent_runtime::mcp_server_path_string()?;
    let config = serde_json::json!({
        "mcpServers": {
            "tolaria": crate::cli_agent_runtime::tolaria_node_mcp_server(
                &mcp_server_path,
                vault_path,
                vault_paths,
                false,
            )
        }
    });
    serde_json::to_string(&config).map_err(|e| format!("Failed to serialise MCP config: {e}"))
}

fn should_pipe_prompt_for_windows(
    enforce_windows_limit: bool,
    args: &[String],
    fallback_args: &[Vec<String>],
) -> bool {
    enforce_windows_limit
        && std::iter::once(args)
            .chain(fallback_args.iter().map(Vec::as_slice))
            .any(args_exceed_windows_stdin_threshold)
}

fn args_exceed_windows_stdin_threshold(args: &[String]) -> bool {
    windows_command_line_utf16_units(args) >= WINDOWS_COMMAND_LINE_STDIN_THRESHOLD
}

fn windows_command_line_utf16_units(args: &[String]) -> usize {
    args.iter().map(|arg| arg.encode_utf16().count() + 3).sum()
}

struct AgentToolPolicy {
    tool_flag: &'static str,
    tool_value: &'static str,
    include_session_persistence_flag: bool,
    preapproved_tools: Option<&'static str>,
    disallowed_tools: Option<&'static str>,
    inherit_user_mcp_servers: bool,
}

impl AgentToolPolicy {
    fn strict(permission_mode: AiAgentPermissionMode) -> Self {
        Self {
            tool_flag: "--tools",
            tool_value: agent_tools(permission_mode),
            include_session_persistence_flag: true,
            preapproved_tools: preapproved_agent_tools(permission_mode),
            disallowed_tools: None,
            inherit_user_mcp_servers: inherits_user_mcp_servers(permission_mode),
        }
    }

    fn strict_without_session_persistence(permission_mode: AiAgentPermissionMode) -> Self {
        Self {
            include_session_persistence_flag: false,
            ..Self::strict(permission_mode)
        }
    }

    fn compat(permission_mode: AiAgentPermissionMode) -> Self {
        Self {
            tool_flag: "--allowedTools",
            tool_value: agent_tools(permission_mode),
            include_session_persistence_flag: false,
            preapproved_tools: None,
            disallowed_tools: Some(disallowed_agent_tools_compat(permission_mode)),
            inherit_user_mcp_servers: inherits_user_mcp_servers(permission_mode),
        }
    }
}

fn inherits_user_mcp_servers(permission_mode: AiAgentPermissionMode) -> bool {
    permission_mode == AiAgentPermissionMode::PowerUser
}

fn agent_tools(permission_mode: AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        AiAgentPermissionMode::Safe => CLAUDE_SAFE_AGENT_TOOLS,
        AiAgentPermissionMode::PowerUser => CLAUDE_POWER_USER_AGENT_TOOLS,
    }
}

fn preapproved_agent_tools(permission_mode: AiAgentPermissionMode) -> Option<&'static str> {
    match permission_mode {
        AiAgentPermissionMode::Safe => None,
        AiAgentPermissionMode::PowerUser => Some("Bash"),
    }
}

fn disallowed_agent_tools_compat(permission_mode: AiAgentPermissionMode) -> &'static str {
    match permission_mode {
        AiAgentPermissionMode::Safe => CLAUDE_SAFE_DISALLOWED_TOOLS_COMPAT,
        AiAgentPermissionMode::PowerUser => CLAUDE_POWER_USER_DISALLOWED_TOOLS_COMPAT,
    }
}

#[cfg(test)]
#[path = "claude_invocation_tests.rs"]
mod tests;
