mod author;
mod clone;
mod command;
mod commit;
mod conflict;
mod connect;
mod credentials;
mod dates;
mod file_url;
mod history;
mod provider;
mod pulse;
mod remote;
#[cfg(test)]
mod remote_branch_tests;
mod remote_config;
mod remote_status;
mod remote_url;
mod status;
mod upstream;
mod workspace;

use std::ffi::{OsStr, OsString};
use std::io;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

#[cfg(test)]
use std::cell::RefCell;

use crate::cli_agent_runtime::{env_bindings_from_process_or_user_shell, EnvName};

pub(crate) use author::ensure_author_config;
pub use author::{git_author_identity, GitAuthorIdentity};
#[cfg(test)]
pub(crate) use author::{
    local_config_value, AuthorConfigKey, FALLBACK_AUTHOR_EMAIL, FALLBACK_AUTHOR_NAME,
    LEGACY_FALLBACK_EMAIL,
};
pub use clone::clone_repo;
pub use commit::git_commit;
pub use conflict::{
    get_conflict_files, get_conflict_mode, git_commit_conflict_resolution, git_resolve_conflict,
    is_merge_in_progress, is_rebase_in_progress,
};
pub use connect::{disconnect_all_remotes, git_add_remote, GitAddRemoteResult};
pub(crate) use dates::get_all_file_dates_for_workspace;
pub use dates::{get_all_file_dates, GitDates};
pub use file_url::git_file_url;
pub use history::{get_file_diff, get_file_diff_at_commit, get_file_history};
pub use provider::{git_provider_status, test_git_provider, GitProviderProbe, GitProviderStatus};
pub use pulse::{get_last_commit_info, get_vault_pulse, LastCommitInfo, PulseCommit, PulseFile};
pub use remote::{git_pull, git_push, has_remote, GitPullResult, GitPushResult};
pub use remote_status::{git_remote_status, GitRemoteStatus};
pub(crate) use remote_url::validate_user_remote_url;
pub use status::{
    discard_file_changes, get_modified_files, get_modified_files_with_stats, ModifiedFile,
};
pub(crate) use workspace::GitWorkspace;
pub use workspace::{git_workspace_info, GitWorkspaceInfo};

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    #[serde(rename = "shortHash")]
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: i64,
}

const DEFAULT_GITIGNORE: &str = "# Tolaria app files (machine-specific, never commit)\n\
.laputa/settings.json\n\
\n\
# macOS\n\
.DS_Store\n\
.AppleDouble\n\
.LSOverride\n\
\n\
# Thumbnails\n\
._*\n\
\n\
# Editors\n\
.vscode/\n\
.idea/\n\
*.swp\n\
*.swo\n";

const GIT_SHELL_ENV_NAMES: [EnvName<'static>; 8] = [
    EnvName::trusted("GIT_AUTHOR_NAME"),
    EnvName::trusted("GIT_AUTHOR_EMAIL"),
    EnvName::trusted("GIT_COMMITTER_NAME"),
    EnvName::trusted("GIT_COMMITTER_EMAIL"),
    EnvName::trusted("GIT_CONFIG_GLOBAL"),
    EnvName::trusted("GIT_CONFIG_SYSTEM"),
    EnvName::trusted("XDG_CONFIG_HOME"),
    EnvName::trusted("EMAIL"),
];

#[derive(Clone)]
struct GitLaunchConfig {
    program: OsString,
    prefix_args: Vec<OsString>,
    path: Option<OsString>,
}

#[derive(Default)]
struct ShellGitConfig {
    git_path: Option<PathBuf>,
    path: Option<OsString>,
}

struct GitShellEnvBinding {
    name: &'static str,
    value: String,
}

pub(crate) fn git_command() -> Command {
    let config = git_launch_config();
    let mut command = crate::hidden_command(&config.program);
    command.args(config.prefix_args);
    if let Some(path) = &config.path {
        command.env("PATH", path);
    }
    sanitize_linux_appimage_git_env(&mut command);
    apply_git_shell_env(&mut command);
    #[cfg(test)]
    apply_test_git_config_env(&mut command);
    command.args([
        "-c",
        "core.quotePath=false",
        "-c",
        "protocol.ext.allow=never",
        "-c",
        "protocol.file.allow=user",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.sshCommand=ssh",
    ]);
    command
}

pub(crate) fn git_command_at(path: &Path) -> io::Result<Command> {
    let path = path.to_str().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("Git path '{}' is not valid UTF-8", path.display()),
        )
    })?;
    let path = git_path_argument(path)
        .map_err(|message| io::Error::new(io::ErrorKind::InvalidInput, message))?;
    let mut command = git_command();
    command.args(["-C", &path]);
    Ok(command)
}

pub fn has_direct_git_metadata(path: impl AsRef<Path>) -> bool {
    path.as_ref().join(".git").exists()
}

pub fn is_inside_work_tree(path: impl AsRef<Path>) -> bool {
    let path = path.as_ref();
    if !path.is_dir() {
        return false;
    }

    let Ok(output) = git_command_at(path).and_then(|mut command| {
        command
            .args(["rev-parse", "--is-inside-work-tree"])
            .output()
    }) else {
        return false;
    };

    output.status.success() && String::from_utf8_lossy(&output.stdout).trim() == "true"
}

fn apply_git_shell_env(command: &mut Command) {
    for binding in git_shell_env_bindings() {
        command.env(binding.name, &binding.value);
    }
}

fn git_shell_env_bindings() -> &'static Vec<GitShellEnvBinding> {
    static BINDINGS: OnceLock<Vec<GitShellEnvBinding>> = OnceLock::new();
    BINDINGS.get_or_init(|| {
        env_bindings_from_process_or_user_shell(&GIT_SHELL_ENV_NAMES)
            .into_iter()
            .filter_map(|(name, value)| {
                GIT_SHELL_ENV_NAMES
                    .iter()
                    .find(|candidate| candidate.as_str() == name)
                    .map(|candidate| GitShellEnvBinding {
                        name: candidate.as_str(),
                        value,
                    })
            })
            .collect()
    })
}

#[cfg(test)]
#[derive(Clone)]
struct TestGitConfigEnv {
    global: PathBuf,
    system: PathBuf,
}

#[cfg(test)]
thread_local! {
    static TEST_GIT_CONFIG_ENV: RefCell<Option<TestGitConfigEnv>> = const { RefCell::new(None) };
}

#[cfg(test)]
fn apply_test_git_config_env(command: &mut Command) {
    TEST_GIT_CONFIG_ENV.with(|env| {
        if let Some(config) = env.borrow().as_ref() {
            command.env("GIT_CONFIG_GLOBAL", &config.global);
            command.env("GIT_CONFIG_SYSTEM", &config.system);
        }
    });
}

pub(crate) fn git_path_argument(path: &str) -> Result<String, String> {
    let settings = crate::settings::get_settings().ok();
    provider::selected_git_path_argument(path, settings.as_ref())
}

fn git_launch_config() -> GitLaunchConfig {
    detect_git_launch_config()
}

fn detect_git_launch_config() -> GitLaunchConfig {
    let parent_path = std::env::var_os("PATH");
    let settings = crate::settings::get_settings().ok();
    if let provider::GitProviderSelection::Wsl { distro } =
        provider::GitProviderSelection::from_settings(settings.as_ref())
    {
        return GitLaunchConfig {
            program: OsString::from("wsl.exe"),
            prefix_args: provider::wsl_git_prefix_args(distro.as_deref()),
            path: parent_path,
        };
    }

    git_launch_config_from_sources(
        parent_path,
        configured_git_path(),
        shell_git_config(),
        standard_git_candidates(),
    )
}

fn git_launch_config_from_sources(
    parent_path: Option<OsString>,
    configured_git_path: Option<PathBuf>,
    shell: Option<ShellGitConfig>,
    standard_candidates: Vec<PathBuf>,
) -> GitLaunchConfig {
    let shell = shell.unwrap_or_default();
    let program = configured_git_path
        .or(shell.git_path)
        .or_else(|| standard_candidates.into_iter().next())
        .map(PathBuf::into_os_string)
        .unwrap_or_else(|| OsString::from("git"));
    let path = path_with_git_parent(shell.path.or(parent_path), &program);

    GitLaunchConfig {
        program,
        prefix_args: Vec::new(),
        path,
    }
}

fn configured_git_path() -> Option<PathBuf> {
    crate::settings::get_settings()
        .ok()
        .and_then(|settings| settings.git_path)
        .map(PathBuf::from)
        .filter(|path| is_executable_file(path))
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };

    metadata.is_file() && has_executable_bit(&metadata)
}

#[cfg(unix)]
fn has_executable_bit(metadata: &std::fs::Metadata) -> bool {
    metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn has_executable_bit(metadata: &std::fs::Metadata) -> bool {
    metadata.is_file()
}

#[cfg(target_os = "macos")]
fn standard_git_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![
        PathBuf::from("/opt/homebrew/bin/git"),
        PathBuf::from("/usr/local/bin/git"),
        PathBuf::from("/usr/bin/git"),
    ];
    candidates.extend(cellar_git_candidates("/opt/homebrew/Cellar/git"));
    candidates.extend(cellar_git_candidates("/usr/local/Cellar/git"));
    candidates
        .into_iter()
        .filter(|path| is_executable_file(path))
        .collect()
}

#[cfg(not(target_os = "macos"))]
fn standard_git_candidates() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(target_os = "macos")]
fn cellar_git_candidates(root: &str) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut candidates = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("bin").join("git"))
        .filter(|path| is_executable_file(path))
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.reverse();
    candidates
}

fn path_with_git_parent(base: Option<OsString>, program: &OsStr) -> Option<OsString> {
    let mut paths = base
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default();

    let program_path = Path::new(program);
    if let Some(parent) = program_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        push_unique_path(&mut paths, parent.to_path_buf());
    }

    if paths.is_empty() {
        return None;
    }

    std::env::join_paths(paths).ok()
}

fn push_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if paths.iter().any(|path| path == &candidate) {
        return;
    }
    paths.push(candidate);
}

#[cfg(target_os = "macos")]
fn shell_git_config() -> Option<ShellGitConfig> {
    user_shell_candidates()
        .into_iter()
        .filter(|shell| shell.exists())
        .find_map(|shell| shell_git_config_from_shell(&shell))
}

#[cfg(not(target_os = "macos"))]
fn shell_git_config() -> Option<ShellGitConfig> {
    None
}

#[cfg(target_os = "macos")]
fn shell_git_config_from_shell(shell: &Path) -> Option<ShellGitConfig> {
    let output = crate::hidden_command(shell)
        .arg("-lc")
        .arg("printf '%s\\n%s' \"$(command -v git 2>/dev/null || true)\" \"$PATH\"")
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines();
    let git_path = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.exists());
    let path = lines
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(OsString::from);

    if git_path.is_none() && path.is_none() {
        return None;
    }

    Some(ShellGitConfig { git_path, path })
}

#[cfg(target_os = "macos")]
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

#[cfg(any(test, all(desktop, target_os = "linux")))]
const LINUX_APPIMAGE_GIT_ENV_REMOVALS: [&str; 3] =
    ["LD_LIBRARY_PATH", "LD_PRELOAD", "GIT_EXEC_PATH"];

#[cfg(all(desktop, target_os = "linux"))]
fn sanitize_linux_appimage_git_env(command: &mut Command) {
    sanitize_linux_appimage_git_env_for_launch(command, linux_appimage_env_present());
}

#[cfg(not(all(desktop, target_os = "linux")))]
fn sanitize_linux_appimage_git_env(_command: &mut Command) {}

#[cfg(any(test, all(desktop, target_os = "linux")))]
fn sanitize_linux_appimage_git_env_for_launch(command: &mut Command, is_appimage: bool) {
    if !is_appimage {
        return;
    }

    for key in LINUX_APPIMAGE_GIT_ENV_REMOVALS {
        command.env_remove(key);
    }
}

#[cfg(all(desktop, target_os = "linux"))]
fn linux_appimage_env_present() -> bool {
    ["APPIMAGE", "APPDIR"]
        .into_iter()
        .any(|key| std::env::var(key).is_ok_and(|value| !value.trim().is_empty()))
}

/// Ensure a `.gitignore` with sensible defaults exists in the vault directory.
/// Creates the file if missing; leaves existing `.gitignore` files untouched.
pub fn ensure_gitignore(path: impl AsRef<Path>) -> Result<(), String> {
    let gitignore_path = path.as_ref().join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(&gitignore_path, DEFAULT_GITIGNORE)
            .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
    }
    Ok(())
}

/// Initialize a new git repository, stage all files, and create an initial commit.
pub fn init_repo(path: impl AsRef<Path>) -> Result<(), String> {
    let dir = path.as_ref();

    run_git(dir, &["init"])?;
    ensure_author_config(dir)?;

    // Write .gitignore before the first commit so machine-specific and
    // macOS metadata files are never tracked and don't cause conflicts.
    ensure_gitignore(dir)?;

    run_git(dir, &["add", "."])?;
    commit_initial_vault_setup(dir)?;

    Ok(())
}

fn commit_initial_vault_setup(dir: &Path) -> Result<(), String> {
    run_git(
        dir,
        &[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "Initial vault setup",
        ],
    )
}

/// Run a git command in the given directory, returning an error on failure.
fn run_git(dir: &Path, args: &[&str]) -> Result<(), String> {
    let output = command::git_output(dir, args).map_err(|e| {
        format!(
            "Failed to run git {}: {e}",
            command::git_command_label(args)
        )
    })?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "git {} failed: {}",
        command::git_command_label(args),
        String::from_utf8_lossy(&output.stderr)
    ))
}

/// Extract "owner/repo" from a GitHub remote URL.
/// Supports HTTPS (https://github.com/owner/repo.git) and
/// SSH (git@github.com:owner/repo.git) formats.
fn normalize_github_repo_path(repo_path: &str) -> Option<String> {
    let repo_path = repo_path.strip_suffix(".git").unwrap_or(repo_path);
    repo_path.contains('/').then(|| repo_path.to_string())
}

fn github_remote_suffix(url: &str) -> Option<&str> {
    const GITHUB_PREFIXES: [&str; 4] = [
        "git@github.com:",
        "https://github.com/",
        "http://github.com/",
        "ssh://git@github.com/",
    ];

    GITHUB_PREFIXES
        .iter()
        .find_map(|prefix| url.strip_prefix(prefix))
        .or_else(|| url.split_once("@github.com/").map(|(_, suffix)| suffix))
}

fn parse_github_repo_path(url: &str) -> Option<String> {
    github_remote_suffix(url.trim()).and_then(normalize_github_repo_path)
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
