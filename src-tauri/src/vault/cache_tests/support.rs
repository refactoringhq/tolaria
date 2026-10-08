use super::super::*;
use std::io::Write;
use std::sync::Mutex;
pub(super) use tempfile::TempDir;

/// Serialize all cache tests that mutate the LAPUTA_CACHE_DIR env var.
/// `std::env::set_var` is process-global, so parallel tests would race.
pub(super) static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Set up a temporary cache directory for test isolation.
/// Caller MUST hold `ENV_LOCK` for the duration of the test.
pub(super) fn set_test_cache_dir(dir: &Path) {
    std::env::set_var("LAPUTA_CACHE_DIR", dir.to_string_lossy().as_ref());
}

pub(super) fn create_test_file(dir: &Path, name: &str, content: &str) {
    let file_path = dir.join(name);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(file_path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

pub(super) fn init_git_repo(vault: &Path) {
    crate::hidden_command("git")
        .args(["init"])
        .current_dir(vault)
        .output()
        .unwrap();
    crate::hidden_command("git")
        .args(["config", "user.email", "test@test.com"])
        .current_dir(vault)
        .output()
        .unwrap();
    crate::hidden_command("git")
        .args(["config", "user.name", "Test"])
        .current_dir(vault)
        .output()
        .unwrap();
}

/// Common setup: acquire env lock, create temp cache dir + git-initialised vault.
/// Returns (lock_guard, cache_tmpdir, vault_tmpdir) — keep all alive for the test.
pub(super) fn setup_git_vault() -> (std::sync::MutexGuard<'static, ()>, TempDir, TempDir) {
    let lock = ENV_LOCK.lock().unwrap();
    let cache_tmp = TempDir::new().unwrap();
    set_test_cache_dir(cache_tmp.path());
    let vault_tmp = TempDir::new().unwrap();
    init_git_repo(vault_tmp.path());
    (lock, cache_tmp, vault_tmp)
}

pub(super) fn git_add_commit(vault: &Path, msg: &str) {
    crate::hidden_command("git")
        .args(["add", "."])
        .current_dir(vault)
        .output()
        .unwrap();
    crate::hidden_command("git")
        .args(["commit", "-m", msg])
        .current_dir(vault)
        .output()
        .unwrap();
}

pub(super) fn force_quoted_git_paths(vault: &Path) {
    crate::hidden_command("git")
        .args(["config", "core.quotePath", "true"])
        .current_dir(vault)
        .output()
        .unwrap();
}
