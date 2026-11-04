use super::*;

#[test]
fn git_command_respects_global_and_repository_ssh_commands() {
    let env = GitConfigEnvGuard::isolated();
    fs::write(
        env._dir.path().join("gitconfig-global"),
        "[core]\n\tsshCommand = /custom/ssh-wrapper -F /custom/config\n",
    )
    .unwrap();
    let dir = init_plain_repo();

    assert_eq!(ssh_command(&dir), "/custom/ssh-wrapper -F /custom/config");

    git_command()
        .args([
            "config",
            "--local",
            "core.sshCommand",
            "/repo/ssh-wrapper --identity repo",
        ])
        .current_dir(dir.path())
        .output()
        .unwrap();

    assert_eq!(ssh_command(&dir), "/repo/ssh-wrapper --identity repo");
}

fn ssh_command(dir: &TempDir) -> String {
    let output = git_command()
        .args(["config", "--get", "core.sshCommand"])
        .current_dir(dir.path())
        .output()
        .unwrap();

    assert!(output.status.success());
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}
