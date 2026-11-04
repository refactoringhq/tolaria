use super::*;
use crate::ai_agents::find_binary_with_fallbacks;

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
fn known_binary_candidate_is_checked_before_the_login_shell_fallback() {
    use std::os::unix::fs::PermissionsExt;

    let dir = tempfile::tempdir().unwrap();
    let executable = dir.path().join("agy");
    std::fs::write(&executable, "#!/bin/sh\n").unwrap();
    std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();

    let found = find_binary_with_fallbacks(
        vec![executable.clone()],
        "Antigravity CLI",
        || None,
        || panic!("known install paths must be checked before the login shell"),
        || "not found".into(),
    )
    .unwrap();

    assert_eq!(found, executable);
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
