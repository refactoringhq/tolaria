use super::*;
use std::collections::HashMap;
use std::ffi::OsString;
use std::fs;
use tempfile::TempDir;

/// Redirect global and system git config to files under a TempDir so
/// identity tests are hermetic with respect to the developer's own
/// gitconfig.
pub(crate) struct GitConfigEnvGuard {
    previous: Option<TestGitConfigEnv>,
    _dir: TempDir,
}

impl GitConfigEnvGuard {
    /// No identity resolvable outside the repo's local config.
    pub(crate) fn isolated() -> Self {
        Self::with_global_identity(None)
    }

    /// Optionally expose a global identity to spawned git commands.
    pub(crate) fn with_global_identity(identity: Option<(&str, &str)>) -> Self {
        let dir = TempDir::new().unwrap();
        let global = dir.path().join("gitconfig-global");
        if let Some((name, email)) = identity {
            fs::write(
                &global,
                format!("[user]\n\tname = {name}\n\temail = {email}\n"),
            )
            .unwrap();
        }
        let system = dir.path().join("gitconfig-system");

        let config = TestGitConfigEnv { global, system };
        let previous = TEST_GIT_CONFIG_ENV.with(|env| env.replace(Some(config)));

        Self {
            previous,
            _dir: dir,
        }
    }
}

impl Drop for GitConfigEnvGuard {
    fn drop(&mut self) {
        let previous = self.previous.take();
        TEST_GIT_CONFIG_ENV.with(|env| {
            env.replace(previous);
        });
    }
}

fn assert_repo_path(url: &str, expected: Option<&str>) {
    assert_eq!(
        parse_github_repo_path(url),
        expected.map(ToString::to_string)
    );
}

pub(crate) fn setup_git_repo() -> TempDir {
    let dir = TempDir::new().unwrap();
    let path = dir.path();

    git_command()
        .args(["init", "--initial-branch=main"])
        .current_dir(path)
        .output()
        .unwrap();

    git_command()
        .args(["config", "user.email", "test@test.com"])
        .current_dir(path)
        .output()
        .unwrap();

    git_command()
        .args(["config", "user.name", "Test User"])
        .current_dir(path)
        .output()
        .unwrap();

    dir
}

/// Set up a bare "remote" and a clone that acts as the working vault.
pub(crate) fn setup_remote_pair() -> (TempDir, TempDir, TempDir) {
    let bare_dir = TempDir::new().unwrap();
    let bare = bare_dir.path();

    git_command()
        .args(["init", "--bare", "--initial-branch=main"])
        .current_dir(bare)
        .output()
        .unwrap();

    let clone_a_dir = TempDir::new().unwrap();
    git_command()
        .args(["clone", bare.to_str().unwrap(), "."])
        .current_dir(clone_a_dir.path())
        .output()
        .unwrap();
    for cmd in &[
        &["config", "user.email", "a@test.com"][..],
        &["config", "user.name", "User A"][..],
    ] {
        git_command()
            .args(*cmd)
            .current_dir(clone_a_dir.path())
            .output()
            .unwrap();
    }

    let clone_b_dir = TempDir::new().unwrap();
    git_command()
        .args(["clone", bare.to_str().unwrap(), "."])
        .current_dir(clone_b_dir.path())
        .output()
        .unwrap();
    for cmd in &[
        &["config", "user.email", "b@test.com"][..],
        &["config", "user.name", "User B"][..],
    ] {
        git_command()
            .args(*cmd)
            .current_dir(clone_b_dir.path())
            .output()
            .unwrap();
    }

    (bare_dir, clone_a_dir, clone_b_dir)
}

fn init_plain_repo() -> TempDir {
    let dir = TempDir::new().unwrap();
    git_command()
        .args(["init", "--initial-branch=main"])
        .current_dir(dir.path())
        .output()
        .unwrap();
    dir
}

fn set_local_identity(dir: &Path, name: &str, email: &str) {
    for (key, value) in [("user.name", name), ("user.email", email)] {
        git_command()
            .args(["config", "--local", key, value])
            .current_dir(dir)
            .output()
            .unwrap();
    }
}

fn assert_local_identity(dir: &Path, name: Option<&str>, email: Option<&str>) {
    assert_eq!(
        local_config_value(dir, AuthorConfigKey::Name)
            .unwrap()
            .as_deref(),
        name
    );
    assert_eq!(
        local_config_value(dir, AuthorConfigKey::Email)
            .unwrap()
            .as_deref(),
        email
    );
}

#[test]
fn test_ensure_author_config_respects_existing_global_identity() {
    let _env = GitConfigEnvGuard::with_global_identity(Some(("Global User", "global@test.com")));

    let dir = init_plain_repo();

    ensure_author_config(dir.path()).unwrap();

    // The globally configured identity resolves, so no local override
    // should be written.
    assert_local_identity(dir.path(), None, None);
}

#[test]
fn test_ensure_author_config_sets_fallback_without_any_identity() {
    let _env = GitConfigEnvGuard::isolated();

    let dir = init_plain_repo();

    ensure_author_config(dir.path()).unwrap();

    assert_local_identity(
        dir.path(),
        Some(FALLBACK_AUTHOR_NAME),
        Some(FALLBACK_AUTHOR_EMAIL),
    );
}

#[test]
fn test_ensure_author_config_heals_legacy_identity_when_global_exists() {
    let _env = GitConfigEnvGuard::with_global_identity(Some(("Global User", "global@test.com")));

    let dir = init_plain_repo();
    set_local_identity(dir.path(), FALLBACK_AUTHOR_NAME, LEGACY_FALLBACK_EMAIL);

    ensure_author_config(dir.path()).unwrap();

    // The legacy pair is removed so the global identity resolves again.
    assert_local_identity(dir.path(), None, None);
}

#[test]
fn test_ensure_author_config_replaces_legacy_identity_without_global() {
    let _env = GitConfigEnvGuard::isolated();

    let dir = init_plain_repo();
    set_local_identity(dir.path(), FALLBACK_AUTHOR_NAME, LEGACY_FALLBACK_EMAIL);

    ensure_author_config(dir.path()).unwrap();

    // No user identity anywhere: the legacy email is replaced with the
    // fallback so commits keep working.
    assert_local_identity(
        dir.path(),
        Some(FALLBACK_AUTHOR_NAME),
        Some(FALLBACK_AUTHOR_EMAIL),
    );
}

#[test]
fn test_ensure_author_config_keeps_user_set_local_identity() {
    let _env = GitConfigEnvGuard::isolated();

    let dir = init_plain_repo();
    set_local_identity(dir.path(), "Vault Owner", "owner@example.com");

    ensure_author_config(dir.path()).unwrap();

    // A local identity the user set themselves is never touched.
    assert_local_identity(dir.path(), Some("Vault Owner"), Some("owner@example.com"));
}

#[test]
fn test_git_author_identity_warns_when_local_identity_shadows_global_identity() {
    let _env = GitConfigEnvGuard::with_global_identity(Some(("Vault Owner", "owner@example.com")));

    let dir = init_plain_repo();
    set_local_identity(dir.path(), "Unexpected User", "unexpected@example.com");

    let identity = git_author_identity(dir.path().to_str().unwrap()).unwrap();

    assert_eq!(identity.name, "Unexpected User");
    assert_eq!(identity.email, "unexpected@example.com");
    assert_eq!(identity.source, "repository");
    assert_eq!(identity.warning.as_deref(), Some("local_overrides_global"));
}

#[test]
fn test_ensure_author_config_preserves_user_name_when_healing_legacy_email() {
    let _env = GitConfigEnvGuard::isolated();

    let dir = init_plain_repo();
    set_local_identity(dir.path(), "Vault Owner", LEGACY_FALLBACK_EMAIL);

    ensure_author_config(dir.path()).unwrap();

    assert_local_identity(dir.path(), Some("Vault Owner"), Some(FALLBACK_AUTHOR_EMAIL));
}

#[test]
fn test_ensure_author_config_skips_legacy_email_resolved_from_global() {
    let _env = GitConfigEnvGuard::with_global_identity(Some(("Someone", LEGACY_FALLBACK_EMAIL)));

    let dir = init_plain_repo();

    ensure_author_config(dir.path()).unwrap();

    // The name resolves globally; the legacy email is skipped and the
    // fallback is written locally instead.
    assert_local_identity(dir.path(), None, Some(FALLBACK_AUTHOR_EMAIL));
}

#[test]
fn test_init_repo_respects_global_author_identity_for_initial_commit() {
    let _env = GitConfigEnvGuard::with_global_identity(Some(("Global User", "global@test.com")));

    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join("note.md"), "# Note\n").unwrap();

    init_repo(dir.path()).unwrap();

    assert_local_identity(dir.path(), None, None);

    let author = git_command()
        .args(["log", "-1", "--format=%an <%ae>"])
        .current_dir(dir.path())
        .output()
        .unwrap();
    assert_eq!(
        String::from_utf8_lossy(&author.stdout).trim(),
        "Global User <global@test.com>"
    );
}

fn command_envs(command: &Command) -> HashMap<String, Option<String>> {
    command
        .get_envs()
        .map(|(key, value)| {
            (
                key.to_string_lossy().to_string(),
                value.map(|entry| entry.to_string_lossy().to_string()),
            )
        })
        .collect()
}

struct GitLaunchConfigCase<'a> {
    parent_path: Option<&'a str>,
    configured_git_path: Option<&'a str>,
    shell: Option<(&'a str, &'a str)>,
    standard_candidates: &'a [&'a str],
    expected_program: &'a str,
    expected_path: Option<&'a str>,
}

fn assert_git_launch_config(case: GitLaunchConfigCase<'_>) {
    let shell = case.shell.map(|(git_path, path)| ShellGitConfig {
        git_path: Some(PathBuf::from(git_path)),
        path: Some(OsString::from(path)),
    });
    let config = git_launch_config_from_sources(
        case.parent_path.map(OsString::from),
        case.configured_git_path.map(PathBuf::from),
        shell,
        case.standard_candidates
            .iter()
            .map(|candidate| PathBuf::from(*candidate))
            .collect(),
    );

    assert_eq!(config.program, OsString::from(case.expected_program));
    assert_eq!(config.path, case.expected_path.map(OsString::from));
}

#[test]
fn test_git_launch_config_source_precedence() {
    for case in [
        GitLaunchConfigCase {
            parent_path: Some("/usr/bin:/bin"),
            configured_git_path: Some("/custom/bin/git"),
            shell: Some(("/opt/homebrew/bin/git", "/opt/homebrew/bin:/usr/bin:/bin")),
            standard_candidates: &["/usr/local/bin/git"],
            expected_program: "/custom/bin/git",
            expected_path: Some("/opt/homebrew/bin:/usr/bin:/bin:/custom/bin"),
        },
        GitLaunchConfigCase {
            parent_path: Some("/usr/bin:/bin"),
            configured_git_path: None,
            shell: Some(("/opt/homebrew/bin/git", "/opt/homebrew/bin:/usr/bin:/bin")),
            standard_candidates: &[],
            expected_program: "/opt/homebrew/bin/git",
            expected_path: Some("/opt/homebrew/bin:/usr/bin:/bin"),
        },
        GitLaunchConfigCase {
            parent_path: Some("/usr/bin:/bin"),
            configured_git_path: None,
            shell: None,
            standard_candidates: &["/opt/homebrew/bin/git"],
            expected_program: "/opt/homebrew/bin/git",
            expected_path: Some("/usr/bin:/bin:/opt/homebrew/bin"),
        },
        GitLaunchConfigCase {
            parent_path: Some("/usr/bin:/bin"),
            configured_git_path: None,
            shell: None,
            standard_candidates: &[],
            expected_program: "git",
            expected_path: Some("/usr/bin:/bin"),
        },
    ] {
        assert_git_launch_config(case);
    }
}

#[test]
fn test_ensure_gitignore_creates_file() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().to_str().unwrap();

    ensure_gitignore(path).unwrap();

    let content = fs::read_to_string(dir.path().join(".gitignore")).unwrap();
    assert!(content.contains(".DS_Store"));
    assert!(content.contains(".laputa/settings.json"));
}

#[test]
fn test_ensure_gitignore_preserves_existing() {
    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join(".gitignore"), "my-rule\n").unwrap();

    ensure_gitignore(dir.path().to_str().unwrap()).unwrap();

    let content = fs::read_to_string(dir.path().join(".gitignore")).unwrap();
    assert_eq!(content, "my-rule\n");
}

#[test]
fn test_linux_appimage_git_commands_remove_appimage_loader_env() {
    let mut command = crate::hidden_command("git");

    sanitize_linux_appimage_git_env_for_launch(&mut command, true);

    let envs = command_envs(&command);

    for key in LINUX_APPIMAGE_GIT_ENV_REMOVALS {
        assert_eq!(envs.get(key), Some(&None));
    }
}

#[test]
fn test_non_appimage_git_commands_keep_parent_env_unmodified() {
    let mut command = crate::hidden_command("git");

    sanitize_linux_appimage_git_env_for_launch(&mut command, false);

    let envs = command_envs(&command);

    for key in LINUX_APPIMAGE_GIT_ENV_REMOVALS {
        assert!(!envs.contains_key(key));
    }
}

#[test]
fn test_git_command_applies_security_config() {
    let args = git_command()
        .get_args()
        .map(|arg| arg.to_string_lossy().to_string())
        .collect::<Vec<_>>();

    assert_has_config_arg(&args, "core.quotePath=false");
    assert_has_config_arg(&args, "protocol.ext.allow=never");
    assert_has_config_arg(&args, "protocol.file.allow=user");
    assert_has_config_arg(&args, "core.fsmonitor=false");
    assert_has_config_arg(&args, "core.sshCommand=ssh");
}

fn assert_has_config_arg(args: &[String], value: &str) {
    assert!(args
        .windows(2)
        .any(|pair| pair[0] == "-c" && pair[1] == value));
}

#[test]
fn test_init_repo_creates_git_directory() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(&vault).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    assert!(vault.join(".git").exists());
}

#[test]
fn test_init_repo_creates_initial_commit() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(&vault).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    let log = git_command()
        .args(["log", "--oneline"])
        .current_dir(&vault)
        .output()
        .unwrap();
    let log_str = String::from_utf8_lossy(&log.stdout);
    assert!(log_str.contains("Initial vault setup"));
}

#[test]
fn test_init_repo_creates_initial_commit_when_signing_is_misconfigured() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(&vault).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();

    git_command()
        .args(["init"])
        .current_dir(&vault)
        .output()
        .unwrap();
    git_command()
        .args(["config", "commit.gpgsign", "true"])
        .current_dir(&vault)
        .output()
        .unwrap();
    git_command()
        .args(["config", "gpg.program", "/missing/tolaria-test-gpg"])
        .current_dir(&vault)
        .output()
        .unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    let log = git_command()
        .args(["log", "--oneline"])
        .current_dir(&vault)
        .output()
        .unwrap();
    assert!(String::from_utf8_lossy(&log.stdout).contains("Initial vault setup"));
}

#[test]
fn test_init_repo_stages_all_files() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(vault.join("sub")).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();
    fs::write(vault.join("sub/nested.md"), "# Nested\n").unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    let status = git_command()
        .args(["status", "--porcelain"])
        .current_dir(&vault)
        .output()
        .unwrap();
    assert!(
        String::from_utf8_lossy(&status.stdout).trim().is_empty(),
        "All files should be committed"
    );
}

#[test]
fn test_init_repo_creates_gitignore() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(&vault).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    let gitignore = vault.join(".gitignore");
    assert!(
        gitignore.exists(),
        ".gitignore should be created by init_repo"
    );
    let content = fs::read_to_string(&gitignore).unwrap();
    assert!(
        content.contains(".DS_Store"),
        ".gitignore should exclude .DS_Store"
    );
    assert!(
        content.contains(".laputa/settings.json"),
        ".gitignore should exclude settings.json"
    );
    // Cache is now stored outside the vault — no need for .gitignore entry
    assert!(
        !content.contains(".laputa-cache.json"),
        ".gitignore should NOT contain .laputa-cache.json (cache is external)"
    );
}

#[test]
fn test_init_repo_does_not_overwrite_existing_gitignore() {
    let dir = TempDir::new().unwrap();
    let vault = dir.path().join("new-vault");
    fs::create_dir_all(&vault).unwrap();
    fs::write(vault.join("note.md"), "# Test\n").unwrap();
    fs::write(vault.join(".gitignore"), "custom-rule\n").unwrap();

    init_repo(vault.to_str().unwrap()).unwrap();

    let content = fs::read_to_string(vault.join(".gitignore")).unwrap();
    assert_eq!(
        content, "custom-rule\n",
        "existing .gitignore should not be overwritten"
    );
}

#[test]
fn test_parse_github_repo_path_variants() {
    let tokenized_url = format!(
        "https://{}@github.com/owner/repo.git",
        ["gho", "abc123"].join("_")
    );
    for url in [
        "https://github.com/owner/repo.git",
        "https://github.com/owner/repo",
        "http://github.com/owner/repo.git",
        "git@github.com:owner/repo.git",
        "git@github.com:owner/repo",
        "ssh://git@github.com/owner/repo.git",
        tokenized_url.as_str(),
    ] {
        assert_repo_path(url, Some("owner/repo"));
    }
}

#[test]
fn test_parse_github_repo_path_non_github() {
    assert_repo_path("https://gitlab.com/owner/repo.git", None);
    assert_repo_path("owner/repo", None);
}
