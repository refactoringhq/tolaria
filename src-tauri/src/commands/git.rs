use crate::git::{
    GitCommit, GitPullResult, GitPushResult, GitRemoteStatus, LastCommitInfo, ModifiedFile,
    PulseCommit,
};

use super::expand_tilde;

// ── Git commands (desktop) ──────────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub fn get_file_history(vault_path: String, path: String) -> Result<Vec<GitCommit>, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    crate::git::get_file_history(&vault_path, &path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_modified_files(vault_path: String) -> Result<Vec<ModifiedFile>, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::get_modified_files(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_file_diff(vault_path: String, path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    crate::git::get_file_diff(&vault_path, &path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_file_diff_at_commit(
    vault_path: String,
    path: String,
    commit_hash: String,
) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    crate::git::get_file_diff_at_commit(&vault_path, &path, &commit_hash)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_vault_pulse(
    vault_path: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<Vec<PulseCommit>, String> {
    let vault_path = expand_tilde(&vault_path);
    let limit = limit.unwrap_or(20);
    let skip = skip.unwrap_or(0);
    crate::git::get_vault_pulse(&vault_path, limit, skip)
}

#[cfg(desktop)]
#[tauri::command]
pub fn git_commit(vault_path: String, message: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::git_commit(&vault_path, &message)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_last_commit_info(vault_path: String) -> Result<Option<LastCommitInfo>, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::get_last_commit_info(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn git_pull(vault_path: String) -> Result<GitPullResult, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || crate::git::git_pull(&vault_path))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_conflict_files(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::get_conflict_files(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn get_conflict_mode(vault_path: String) -> String {
    let vault_path = expand_tilde(&vault_path);
    crate::git::get_conflict_mode(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub fn git_resolve_conflict(
    vault_path: String,
    file: String,
    strategy: String,
) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::git_resolve_conflict(&vault_path, &file, &strategy)
}

#[cfg(desktop)]
#[tauri::command]
pub fn git_commit_conflict_resolution(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::git_commit_conflict_resolution(&vault_path)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn git_push(vault_path: String) -> Result<GitPushResult, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || crate::git::git_push(&vault_path))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn git_remote_status(vault_path: String) -> Result<GitRemoteStatus, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || crate::git::git_remote_status(&vault_path))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

#[cfg(desktop)]
#[tauri::command]
pub fn is_git_repo(vault_path: String) -> bool {
    let vault_path = expand_tilde(&vault_path);
    std::path::Path::new(vault_path.as_ref())
        .join(".git")
        .is_dir()
}

#[cfg(desktop)]
#[tauri::command]
pub fn init_git_repo(vault_path: String) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    crate::git::init_repo(&vault_path)
}

// ── Git commands (mobile stubs) ─────────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub fn get_file_history(_vault_path: String, _path: String) -> Result<Vec<GitCommit>, String> {
    Err("Git history is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_modified_files(_vault_path: String) -> Result<Vec<ModifiedFile>, String> {
    Ok(vec![])
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_file_diff(_vault_path: String, _path: String) -> Result<String, String> {
    Err("Git diff is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_file_diff_at_commit(
    _vault_path: String,
    _path: String,
    _commit_hash: String,
) -> Result<String, String> {
    Err("Git diff is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_vault_pulse(
    _vault_path: String,
    _limit: Option<usize>,
    _skip: Option<usize>,
) -> Result<Vec<PulseCommit>, String> {
    Ok(vec![])
}

#[cfg(mobile)]
#[tauri::command]
pub fn git_commit(_vault_path: String, _message: String) -> Result<String, String> {
    Err("Git commit is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_last_commit_info(_vault_path: String) -> Result<Option<LastCommitInfo>, String> {
    Ok(None)
}

#[cfg(mobile)]
#[tauri::command]
pub async fn git_pull(_vault_path: String) -> Result<GitPullResult, String> {
    Err("Git pull is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_conflict_files(_vault_path: String) -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[cfg(mobile)]
#[tauri::command]
pub fn get_conflict_mode(_vault_path: String) -> String {
    "none".to_string()
}

#[cfg(mobile)]
#[tauri::command]
pub fn git_resolve_conflict(
    _vault_path: String,
    _file: String,
    _strategy: String,
) -> Result<(), String> {
    Err("Git conflict resolution is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn git_commit_conflict_resolution(_vault_path: String) -> Result<String, String> {
    Err("Git conflict resolution is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn git_push(_vault_path: String) -> Result<GitPushResult, String> {
    Err("Git push is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn git_remote_status(_vault_path: String) -> Result<GitRemoteStatus, String> {
    Ok(GitRemoteStatus {
        branch: String::new(),
        has_remote: false,
        ahead: 0,
        behind: 0,
    })
}

#[cfg(mobile)]
#[tauri::command]
pub fn is_git_repo(_vault_path: String) -> bool {
    false
}

#[cfg(mobile)]
#[tauri::command]
pub fn init_git_repo(_vault_path: String) -> Result<(), String> {
    Err("Git init is not available on mobile".into())
}
