use super::*;

macro_rules! assert_args_contain {
    ($args:expr, [$($value:expr),+ $(,)?] $(,)?) => {
        $(
            assert!($args.contains(&$value.to_string()), "missing {}", $value);
        )+
    };
}

macro_rules! assert_args_lack {
    ($args:expr, [$($value:expr),+ $(,)?] $(,)?) => {
        $(
            assert!(!$args.iter().any(|arg| arg == &$value.to_string()), "unexpected {}", $value);
        )+
    };
}

macro_rules! assert_no_arg_contains {
    ($args:expr, $fragment:expr $(,)?) => {
        assert!(!$args.iter().any(|arg| arg.contains($fragment)));
    };
}

macro_rules! chat_request {
    ($message:expr, None, None $(,)?) => {
        ChatStreamRequest {
            message: $message.into(),
            system_prompt: None,
            session_id: None,
        }
    };
    ($message:expr, Some($system_prompt:expr), None $(,)?) => {
        ChatStreamRequest {
            message: $message.into(),
            system_prompt: Some($system_prompt.to_string()),
            session_id: None,
        }
    };
    ($message:expr, None, Some($session_id:expr) $(,)?) => {
        ChatStreamRequest {
            message: $message.into(),
            system_prompt: None,
            session_id: Some($session_id.to_string()),
        }
    };
    ($message:expr, Some($system_prompt:expr), Some($session_id:expr) $(,)?) => {
        ChatStreamRequest {
            message: $message.into(),
            system_prompt: Some($system_prompt.to_string()),
            session_id: Some($session_id.to_string()),
        }
    };
}

fn agent_request(
    message: &str,
    system_prompt: Option<&str>,
    permission_mode: AiAgentPermissionMode,
) -> AgentStreamRequest {
    AgentStreamRequest {
        message: message.into(),
        model: None,
        system_prompt: system_prompt.map(str::to_string),
        vault_path: "/tmp/vault".into(),
        vault_paths: Vec::new(),
        permission_mode,
    }
}

fn arg_value_after<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    let index = args.iter().position(|arg| arg == name)?;
    args.get(index + 1).map(String::as_str)
}

fn invocation_arg_lists(invocation: &ClaudeInvocation) -> impl Iterator<Item = &[String]> + '_ {
    std::iter::once(invocation.args.as_slice())
        .chain(invocation.fallback_args.iter().map(Vec::as_slice))
}

fn arg_lists_with_strict_mcp_config(invocation: &ClaudeInvocation) -> usize {
    invocation_arg_lists(invocation)
        .filter(|args| args.iter().any(|arg| arg == "--strict-mcp-config"))
        .count()
}

fn arg_lists_with_tolaria_mcp_config(invocation: &ClaudeInvocation) -> usize {
    invocation_arg_lists(invocation)
        .filter(|args| {
            arg_value_after(args, "--mcp-config")
                .is_some_and(|config| config.contains("\"tolaria\""))
        })
        .count()
}

#[test]
fn chat_args_basic() {
    let args = chat_args(&chat_request!("hello", None, None));

    assert_args_contain!(args, ["-p", "hello", "stream-json"]);
    assert_args_lack!(args, ["--system-prompt", "--resume"]);
}

#[test]
fn chat_args_with_system_prompt() {
    let args = chat_args(&chat_request!("hi", Some("You are helpful."), None));

    assert_args_contain!(args, ["--system-prompt", "You are helpful."]);
}

#[test]
fn chat_args_empty_system_prompt_is_skipped() {
    let args = chat_args(&chat_request!("hi", Some(""), None));

    assert!(!args.contains(&"--system-prompt".to_string()));
}

#[test]
fn chat_args_with_session_id() {
    let args = chat_args(&chat_request!("continue", None, Some("sess-abc")));

    assert_args_contain!(args, ["--resume", "sess-abc"]);
}

#[test]
fn chat_args_compat_disallows_builtin_tools_when_tools_flag_is_unavailable() {
    let args = chat_args_compat(&chat_request!("hello", None, None));

    assert_args_contain!(args, ["--disallowedTools"]);
    assert_args_lack!(args, ["--tools"]);
    assert!(arg_value_after(&args, "--disallowedTools")
        .is_some_and(|tools| tools.contains("NotebookEdit")));
}

#[test]
fn oversized_windows_invocations_pipe_prompt_to_stdin() {
    let long_message = "x".repeat(WINDOWS_COMMAND_LINE_STDIN_THRESHOLD);
    let chat_req = chat_request!(&long_message, Some("Use context."), Some("sess-abc"));
    let chat_invocation = chat_with_windows_limit(&chat_req, true);

    assert_eq!(chat_invocation.args.first().map(String::as_str), Some("-p"));
    assert_args_lack!(
        chat_invocation.args,
        [long_message.as_str(), "--system-prompt", "Use context."]
    );
    assert_args_contain!(chat_invocation.args, ["--resume", "sess-abc"]);
    assert!(chat_invocation
        .fallback_args
        .iter()
        .flatten()
        .all(|arg| arg != &long_message));
    let chat_stdin = chat_invocation.stdin_text.as_deref().unwrap();
    assert!(chat_stdin.contains("System instructions:\nUse context."));
    assert!(chat_stdin.contains("User request:\n"));
    assert!(chat_stdin.contains(&long_message));
}

#[test]
fn oversized_windows_agent_invocations_pipe_prompt_to_stdin() {
    let long_message = "x".repeat(WINDOWS_COMMAND_LINE_STDIN_THRESHOLD);
    let agent_req = agent_request(
        &long_message,
        Some("Read the active vault first."),
        AiAgentPermissionMode::Safe,
    );
    let agent_invocation = agent_with_windows_limit(&agent_req, true).unwrap();

    assert_eq!(
        agent_invocation.args.first().map(String::as_str),
        Some("-p")
    );
    assert_args_lack!(
        agent_invocation.args,
        [
            long_message.as_str(),
            "--append-system-prompt",
            "Read the active vault first."
        ]
    );
    assert_args_contain!(
        agent_invocation.args,
        ["--mcp-config", "--strict-mcp-config"]
    );
    assert!(agent_invocation
        .fallback_args
        .iter()
        .flatten()
        .all(|arg| arg != &long_message));
    let agent_stdin = agent_invocation.stdin_text.as_deref().unwrap();
    assert!(agent_stdin.contains("System instructions:\nRead the active vault first."));
    assert!(agent_stdin.contains("User request:\n"));
    assert!(agent_stdin.contains(&long_message));
}

#[test]
fn agent_args_with_system_prompt() {
    if let Ok(args) = agent_args(&agent_request(
        "do it",
        Some("Act as expert."),
        AiAgentPermissionMode::Safe,
    )) {
        assert_args_contain!(args, ["--append-system-prompt", "Act as expert."]);
    }
}

#[test]
fn agent_args_passes_an_explicit_model_once() {
    let mut request = agent_request("do it", None, AiAgentPermissionMode::Safe);
    request.model = Some("sonnet".into());

    let args = agent_args(&request).unwrap();

    assert_eq!(arg_value_after(&args, "--model"), Some("sonnet"));
    assert_eq!(
        args.iter().filter(|arg| arg.as_str() == "--model").count(),
        1
    );
}

#[test]
fn agent_args_empty_system_prompt_is_skipped() {
    if let Ok(args) = agent_args(&agent_request("x", Some(""), AiAgentPermissionMode::Safe)) {
        assert!(!args.contains(&"--append-system-prompt".to_string()));
    }
}

#[test]
fn agent_args_without_session_persistence_keeps_tools_allowlist() {
    let args = agent_args_without_session_persistence(&agent_request(
        "Rename the note",
        None,
        AiAgentPermissionMode::Safe,
    ))
    .unwrap();

    assert_args_contain!(
        args,
        ["--tools", "Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill"]
    );
    assert_args_lack!(args, ["--no-session-persistence"]);
}

#[test]
fn agent_args_compat_uses_allowed_and_disallowed_tools_without_removed_flags() {
    let args = agent_args_compat(&agent_request(
        "Rename the note",
        None,
        AiAgentPermissionMode::Safe,
    ))
    .unwrap();

    assert_eq!(
        arg_value_after(&args, "--allowedTools"),
        Some("Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill")
    );
    assert_args_contain!(args, ["--disallowedTools"]);
    assert_args_lack!(args, ["--tools"]);
    assert_args_lack!(args, ["--no-session-persistence"]);
}

#[test]
fn agent_args_use_safe_mode_without_bash_by_default() {
    let args = agent_args(&agent_request(
        "Rename the note",
        None,
        AiAgentPermissionMode::Safe,
    ))
    .unwrap();

    assert_args_contain!(
        args,
        ["--strict-mcp-config", "--permission-mode", "acceptEdits"]
    );
    assert_args_contain!(args, ["Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill"]);
    assert_no_arg_contains!(args, "Bash");
    assert_args_lack!(args, ["--allowedTools"]);
    assert_args_lack!(args, ["--dangerously-skip-permissions"]);
}

#[test]
fn agent_args_allow_bash_in_power_user_mode_without_dangerous_bypass() {
    let args = agent_args(&agent_request(
        "Rename the note",
        None,
        AiAgentPermissionMode::PowerUser,
    ))
    .unwrap();

    assert_args_contain!(args, ["Read,Edit,MultiEdit,Write,Glob,Grep,LS,Skill,Bash"]);
    assert_args_lack!(args, ["--dangerously-skip-permissions"]);
}

#[test]
fn agent_args_preapprove_bash_for_power_user_runs() {
    let args = agent_args(&agent_request(
        "Run a local script",
        None,
        AiAgentPermissionMode::PowerUser,
    ))
    .unwrap();

    assert_eq!(arg_value_after(&args, "--allowedTools"), Some("Bash"));
}

#[test]
fn agent_args_inherit_user_mcp_servers_in_power_user_mode() {
    let args = agent_args(&agent_request(
        "Check my tickets",
        None,
        AiAgentPermissionMode::PowerUser,
    ))
    .unwrap();

    assert_args_lack!(args, ["--strict-mcp-config"]);
    let config: serde_json::Value =
        serde_json::from_str(arg_value_after(&args, "--mcp-config").unwrap()).unwrap();
    assert!(config["mcpServers"]["tolaria"].is_object());
}

#[test]
fn agent_fallbacks_inherit_user_mcp_servers_in_power_user_mode() {
    let req = agent_request("Check my tickets", None, AiAgentPermissionMode::PowerUser);
    let invocation = agent_with_windows_limit(&req, false).unwrap();

    assert_eq!(arg_lists_with_strict_mcp_config(&invocation), 0);
    assert_eq!(arg_lists_with_tolaria_mcp_config(&invocation), 3);
}

#[test]
fn oversized_windows_power_user_invocations_inherit_user_mcp_servers() {
    let long_message = "x".repeat(WINDOWS_COMMAND_LINE_STDIN_THRESHOLD);
    let req = agent_request(&long_message, None, AiAgentPermissionMode::PowerUser);
    let invocation = agent_with_windows_limit(&req, true).unwrap();

    assert!(invocation.stdin_text.is_some());
    assert_eq!(arg_lists_with_strict_mcp_config(&invocation), 0);
    assert_eq!(arg_lists_with_tolaria_mcp_config(&invocation), 3);
}

#[test]
fn agent_fallbacks_keep_strict_mcp_config_in_safe_mode() {
    let req = agent_request("Rename the note", None, AiAgentPermissionMode::Safe);
    let invocation = agent_with_windows_limit(&req, false).unwrap();

    assert_eq!(arg_lists_with_strict_mcp_config(&invocation), 3);
    assert_eq!(arg_lists_with_tolaria_mcp_config(&invocation), 3);
}

#[test]
fn agent_invocation_keeps_short_windows_prompt_on_args() {
    let req = agent_request(
        "summarize the inbox",
        Some("Read the active vault first."),
        AiAgentPermissionMode::Safe,
    );
    let invocation = agent_with_windows_limit(&req, true).unwrap();

    assert_args_contain!(
        invocation.args,
        ["-p", "summarize the inbox", "--append-system-prompt"]
    );
    assert!(invocation.stdin_text.is_none());
}

#[test]
fn mcp_config_is_valid_json() {
    let extra_vaults = vec!["/tmp/secondary-vault".to_string()];
    if let Ok(config_str) = mcp_config("/tmp/test-vault", &extra_vaults) {
        let parsed: serde_json::Value = serde_json::from_str(&config_str).unwrap();
        assert!(parsed["mcpServers"]["tolaria"]["command"].is_string());
        assert_eq!(
            parsed["mcpServers"]["tolaria"]["env"]["VAULT_PATH"],
            "/tmp/test-vault"
        );
        assert_eq!(
            parsed["mcpServers"]["tolaria"]["env"]["VAULT_PATHS"],
            "[\"/tmp/test-vault\",\"/tmp/secondary-vault\"]"
        );
    }
}
