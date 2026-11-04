use super::*;

#[test]
fn build_prompt_keeps_system_prompt_first() {
    let prompt = build_prompt("Rename the note", Some("Be concise"));

    assert!(prompt.starts_with("System instructions:\nBe concise"));
    assert!(prompt.contains("User request:\nRename the note"));
}

#[test]
fn build_prompt_skips_blank_system_prompt() {
    assert_eq!(
        build_prompt("Rename the note", Some("  ")),
        "Rename the note"
    );
}

#[test]
fn parse_json_line_reports_read_errors_and_skips_blank_or_invalid_lines() {
    assert!(parse_json_line(Ok("   ".into())).unwrap().is_none());
    assert!(parse_json_line(Ok("not json".into())).unwrap().is_none());

    let error = parse_json_line(Err(std::io::Error::other("broken pipe"))).unwrap_err();
    assert!(error.contains("broken pipe"));
}

#[test]
fn agent_command_environment_keeps_homebrew_shims_available() {
    let mut command = Command::new("/opt/homebrew/bin/codex");
    configure_agent_command_environment(&mut command, Path::new("/opt/homebrew/bin/codex"));
    let path = command
        .get_envs()
        .find(|(key, _)| *key == std::ffi::OsStr::new("PATH"))
        .and_then(|(_, value)| value)
        .expect("PATH should be set");
    let paths = std::env::split_paths(path).collect::<Vec<_>>();

    assert!(paths.contains(&PathBuf::from("/opt/homebrew/bin")));
    assert!(paths.contains(&PathBuf::from("/usr/local/bin")));
}

#[test]
fn first_existing_windows_path_skips_extensionless_npm_wrapper() {
    let dir = tempfile::tempdir().unwrap();
    let wrapper = dir.path().join("kiro-cli");
    let shim = dir.path().join("kiro-cli.cmd");
    std::fs::write(&wrapper, "#!/bin/sh\n").unwrap();
    std::fs::write(&shim, "@ECHO off\n").unwrap();
    let stdout = format!("{}\n{}\n", wrapper.display(), shim.display());

    assert_eq!(first_existing_path_for_platform(&stdout, true), Some(shim));
}

#[test]
fn first_existing_non_windows_path_keeps_extensionless_binary() {
    let dir = tempfile::tempdir().unwrap();
    let binary = dir.path().join("kiro-cli");
    std::fs::write(&binary, "#!/bin/sh\n").unwrap();

    assert_eq!(
        first_existing_path_for_platform(&binary.display().to_string(), false),
        Some(binary)
    );
}

#[test]
fn spawn_not_found_errors_explain_gui_path_runtime_dependencies() {
    let error = std::io::Error::new(std::io::ErrorKind::NotFound, "No such file or directory");
    let message = format_spawn_error("codex", &error);

    assert!(message.contains("Failed to start codex"));
    assert!(message.contains("/opt/homebrew/bin"));
    assert!(message.contains("Node.js"));
}

#[cfg(unix)]
#[test]
fn executable_binary_candidate_skips_unusable_file_when_later_candidate_works() {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempfile::tempdir().unwrap();
    let unusable = dir.path().join("codex-unusable");
    let executable = dir.path().join("codex");
    std::fs::write(&unusable, "#!/bin/sh\n").unwrap();
    std::fs::write(&executable, "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(&unusable, std::fs::Permissions::from_mode(0o644)).unwrap();
    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();

    let found =
        find_executable_binary_candidate(vec![unusable, executable.clone()], "Codex CLI").unwrap();

    assert_eq!(found, Some(executable));
}

#[cfg(unix)]
#[test]
fn executable_binary_candidate_reports_unusable_file_when_no_candidate_works() {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempfile::tempdir().unwrap();
    let unusable = dir.path().join("opencode");
    std::fs::write(&unusable, "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(&unusable, std::fs::Permissions::from_mode(0o644)).unwrap();

    let error =
        find_executable_binary_candidate(vec![unusable.clone()], "OpenCode CLI").unwrap_err();

    assert!(error.contains("OpenCode CLI binary found"));
    assert!(error.contains(&unusable.display().to_string()));
    assert!(error.contains("not executable"));
}

#[test]
fn cli_binary_resolution_stops_at_known_locations_before_spawning_the_login_shell() {
    let lookups = std::cell::RefCell::new(Vec::new());
    let candidate = PathBuf::from("/Users/alex/.local/bin/agy");

    let resolved = resolve_cli_binary(
        || {
            lookups.borrow_mut().push("path");
            None
        },
        || {
            lookups.borrow_mut().push("candidates");
            Ok(Some(candidate.clone()))
        },
        || {
            lookups.borrow_mut().push("shell");
            None
        },
        "Antigravity CLI",
        "https://antigravity.google/docs/cli/install",
    )
    .unwrap();

    assert_eq!(resolved, candidate);
    assert_eq!(lookups.into_inner(), ["path", "candidates"]);
}

#[test]
fn cli_binary_resolution_falls_back_to_the_login_shell_last() {
    let lookups = std::cell::RefCell::new(Vec::new());
    let from_shell = PathBuf::from("/Users/alex/bin/agy");

    let resolved = resolve_cli_binary(
        || {
            lookups.borrow_mut().push("path");
            None
        },
        || {
            lookups.borrow_mut().push("candidates");
            Ok(None)
        },
        || {
            lookups.borrow_mut().push("shell");
            Some(from_shell.clone())
        },
        "Antigravity CLI",
        "https://antigravity.google/docs/cli/install",
    )
    .unwrap();

    assert_eq!(resolved, from_shell);
    assert_eq!(lookups.into_inner(), ["path", "candidates", "shell"]);
}

#[test]
fn cli_binary_resolution_reports_an_unusable_candidate_only_when_nothing_else_matches() {
    let from_shell = PathBuf::from("/opt/homebrew/bin/agy");
    let not_executable =
        "Antigravity CLI binary found at /Users/alex/.local/bin/agy but it is not executable.";

    let resolved = resolve_cli_binary(
        || None,
        || Err(not_executable.into()),
        || Some(from_shell.clone()),
        "Antigravity CLI",
        "https://antigravity.google/docs/cli/install",
    )
    .unwrap();
    assert_eq!(resolved, from_shell);

    let error = resolve_cli_binary(
        || None,
        || Err(not_executable.into()),
        || None,
        "Antigravity CLI",
        "https://antigravity.google/docs/cli/install",
    )
    .unwrap_err();
    assert!(error.contains("not executable"));
}
