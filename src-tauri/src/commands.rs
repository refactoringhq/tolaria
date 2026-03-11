use std::borrow::Cow;

use crate::ai_chat::{AiChatRequest, AiChatResponse};
use crate::claude_cli::{
    AgentStreamRequest, ChatStreamRequest, ClaudeCliStatus, ClaudeStreamEvent,
};
use crate::frontmatter::FrontmatterValue;
use crate::git::{
    GitCommit, GitPullResult, GitPushResult, LastCommitInfo, ModifiedFile, PulseCommit,
};
use crate::github::{DeviceFlowPollResult, DeviceFlowStart, GitHubUser, GithubRepo};
use crate::indexing::{IndexStatus, IndexingProgress};
use crate::search::SearchResponse;
use crate::settings::Settings;
use crate::theme::{ThemeFile, VaultSettings};
use crate::vault::{MoveResult, RenameResult, VaultEntry};
use crate::vault_config::VaultConfig;
use crate::vault_list::VaultList;
use crate::{
    frontmatter, git, github, indexing, menu, search, theme, vault, vault_config, vault_list,
};

/// Expand a leading `~` or `~/` in a path string to the user's home directory.
/// Returns the original string unchanged if it doesn't start with `~` or if the
/// home directory cannot be determined.
pub fn expand_tilde(path: &str) -> Cow<'_, str> {
    if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return Cow::Owned(home.to_string_lossy().into_owned());
        }
    } else if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return Cow::Owned(format!("{}/{}", home.to_string_lossy(), rest));
        }
    }
    Cow::Borrowed(path)
}

pub fn parse_build_label(version: &str) -> String {
    let parts: Vec<&str> = version.split('.').collect();
    match parts.as_slice() {
        [_, minor, patch] if minor.len() >= 6 => format!("b{}", patch),
        [_, _, _] => "dev".to_string(),
        _ => "b?".to_string(),
    }
}

pub fn emit_unavailable(app_handle: &tauri::AppHandle) {
    use tauri::Emitter;
    let _ = app_handle.emit(
        "indexing-progress",
        IndexingProgress {
            phase: "unavailable".to_string(),
            current: 0,
            total: 0,
            done: true,
            error: Some("qmd not available".to_string()),
        },
    );
}

// ── Vault commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path);
    vault::scan_vault_cached(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn get_note_content(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::get_note_content(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn save_note_content(path: String, content: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    vault::save_note_content(&path, &content)
}

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    let old_path = expand_tilde(&old_path);
    vault::rename_note(&vault_path, &old_path, &new_title, old_title.as_deref())
}

#[tauri::command]
pub fn move_note_to_type_folder(
    vault_path: String,
    note_path: String,
    new_type: String,
) -> Result<MoveResult, String> {
    let vault_path = expand_tilde(&vault_path);
    let note_path = expand_tilde(&note_path);
    vault::move_note_to_type_folder(&vault_path, &note_path, &new_type)
}

#[tauri::command]
pub fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::purge_trash(&vault_path)
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::delete_note(&path)
}

#[tauri::command]
pub fn migrate_is_a_to_type(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)
}

#[tauri::command]
pub fn create_getting_started_vault(target_path: Option<String>) -> Result<String, String> {
    let path = match target_path {
        Some(p) if !p.is_empty() => expand_tilde(&p).into_owned(),
        _ => vault::default_vault_path()?.to_string_lossy().to_string(),
    };
    vault::create_getting_started_vault(&path)
}

#[tauri::command]
pub fn check_vault_exists(path: String) -> bool {
    let path = expand_tilde(&path);
    vault::vault_exists(&path)
}

#[tauri::command]
pub fn get_default_vault_path() -> Result<String, String> {
    vault::default_vault_path().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reload_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path);
    vault::invalidate_cache(std::path::Path::new(path.as_ref()));
    vault::scan_vault_cached(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn reload_vault_entry(path: String) -> Result<VaultEntry, String> {
    let path = expand_tilde(&path);
    vault::reload_entry(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn save_image(vault_path: String, filename: String, data: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::save_image(&vault_path, &filename, &data)
}

#[tauri::command]
pub fn copy_image_to_vault(vault_path: String, source_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::copy_image_to_vault(&vault_path, &source_path)
}

// ── Frontmatter commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::update_frontmatter(&path, &key, value)
}

#[tauri::command]
pub fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::delete_frontmatter_property(&path, &key)
}

#[tauri::command]
pub fn batch_archive_notes(paths: Vec<String>) -> Result<usize, String> {
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Archived", FrontmatterValue::Bool(true))?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn batch_trash_notes(paths: Vec<String>) -> Result<usize, String> {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Trashed", FrontmatterValue::Bool(true))?;
        frontmatter::update_frontmatter(
            &path,
            "Trashed at",
            FrontmatterValue::String(now.clone()),
        )?;
        count += 1;
    }
    Ok(count)
}

// ── Git commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_file_history(vault_path: String, path: String) -> Result<Vec<GitCommit>, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_history(&vault_path, &path)
}

#[tauri::command]
pub fn get_modified_files(vault_path: String) -> Result<Vec<ModifiedFile>, String> {
    let vault_path = expand_tilde(&vault_path);
    git::get_modified_files(&vault_path)
}

#[tauri::command]
pub fn get_file_diff(vault_path: String, path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_diff(&vault_path, &path)
}

#[tauri::command]
pub fn get_file_diff_at_commit(
    vault_path: String,
    path: String,
    commit_hash: String,
) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_diff_at_commit(&vault_path, &path, &commit_hash)
}

#[tauri::command]
pub fn get_vault_pulse(
    vault_path: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<Vec<PulseCommit>, String> {
    let vault_path = expand_tilde(&vault_path);
    let limit = limit.unwrap_or(20);
    let skip = skip.unwrap_or(0);
    git::get_vault_pulse(&vault_path, limit, skip)
}

#[tauri::command]
pub fn git_commit(vault_path: String, message: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_commit(&vault_path, &message)
}

#[tauri::command]
pub fn get_last_commit_info(vault_path: String) -> Result<Option<LastCommitInfo>, String> {
    let vault_path = expand_tilde(&vault_path);
    git::get_last_commit_info(&vault_path)
}

#[tauri::command]
pub fn git_pull(vault_path: String) -> Result<GitPullResult, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_pull(&vault_path)
}

#[tauri::command]
pub fn get_conflict_files(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    git::get_conflict_files(&vault_path)
}

#[tauri::command]
pub fn get_conflict_mode(vault_path: String) -> String {
    let vault_path = expand_tilde(&vault_path);
    git::get_conflict_mode(&vault_path)
}

#[tauri::command]
pub fn git_resolve_conflict(
    vault_path: String,
    file: String,
    strategy: String,
) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_resolve_conflict(&vault_path, &file, &strategy)
}

#[tauri::command]
pub fn git_commit_conflict_resolution(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_commit_conflict_resolution(&vault_path)
}

#[tauri::command]
pub fn git_push(vault_path: String) -> Result<GitPushResult, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_push(&vault_path)
}

// ── GitHub commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn github_list_repos(token: String) -> Result<Vec<GithubRepo>, String> {
    github::github_list_repos(&token).await
}

#[tauri::command]
pub async fn github_create_repo(
    token: String,
    name: String,
    private: bool,
) -> Result<GithubRepo, String> {
    github::github_create_repo(&token, &name, private).await
}

#[tauri::command]
pub fn clone_repo(url: String, token: String, local_path: String) -> Result<String, String> {
    let local_path = expand_tilde(&local_path);
    github::clone_repo(&url, &token, &local_path)
}

#[tauri::command]
pub async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    github::github_device_flow_start().await
}

#[tauri::command]
pub async fn github_device_flow_poll(device_code: String) -> Result<DeviceFlowPollResult, String> {
    github::github_device_flow_poll(&device_code).await
}

#[tauri::command]
pub async fn github_get_user(token: String) -> Result<GitHubUser, String> {
    github::github_get_user(&token).await
}

// ── AI / Claude commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn ai_chat(request: AiChatRequest) -> Result<AiChatResponse, String> {
    crate::ai_chat::send_chat(request).await
}

#[tauri::command]
pub fn check_claude_cli() -> ClaudeCliStatus {
    crate::claude_cli::check_cli()
}

#[tauri::command]
pub async fn stream_claude_chat(
    app_handle: tauri::AppHandle,
    request: ChatStreamRequest,
) -> Result<String, String> {
    use tauri::Emitter;
    tokio::task::spawn_blocking(move || {
        crate::claude_cli::run_chat_stream(request, |event: ClaudeStreamEvent| {
            let _ = app_handle.emit("claude-stream", &event);
        })
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
pub async fn stream_claude_agent(
    app_handle: tauri::AppHandle,
    request: AgentStreamRequest,
) -> Result<String, String> {
    use tauri::Emitter;
    tokio::task::spawn_blocking(move || {
        crate::claude_cli::run_agent_stream(request, |event: ClaudeStreamEvent| {
            let _ = app_handle.emit("claude-agent-stream", &event);
        })
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

// ── Search & indexing commands ──────────────────────────────────────────────

#[tauri::command]
pub async fn search_vault(
    vault_path: String,
    query: String,
    mode: String,
    limit: Option<usize>,
) -> Result<SearchResponse, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    let limit = limit.unwrap_or(20);
    tokio::task::spawn_blocking(move || search::search_vault(&vault_path, &query, &mode, limit))
        .await
        .map_err(|e| format!("Search task failed: {}", e))?
}

#[tauri::command]
pub fn get_index_status(vault_path: String) -> IndexStatus {
    let vault_path = expand_tilde(&vault_path);
    indexing::check_index_status(&vault_path)
}

#[tauri::command]
pub async fn start_indexing(
    app_handle: tauri::AppHandle,
    vault_path: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || {
        if indexing::find_qmd_binary().is_none() {
            log::info!("qmd binary not found — attempting auto-install via bun");
            let _ = app_handle.emit(
                "indexing-progress",
                IndexingProgress {
                    phase: "installing".to_string(),
                    current: 0,
                    total: 0,
                    done: false,
                    error: None,
                },
            );

            match indexing::try_auto_install_qmd() {
                Ok(()) if indexing::find_qmd_binary().is_some() => {
                    log::info!("qmd auto-installed successfully, proceeding with indexing");
                }
                Ok(()) => {
                    log::warn!("qmd auto-install reported success but binary still not found");
                    emit_unavailable(&app_handle);
                    return Err("qmd not available after install".to_string());
                }
                Err(e) => {
                    log::info!("qmd auto-install failed: {e}");
                    emit_unavailable(&app_handle);
                    return Err(format!("qmd not available: {e}"));
                }
            }
        }

        indexing::run_full_index(&vault_path, |progress| {
            let _ = app_handle.emit("indexing-progress", &progress);
        })
    })
    .await
    .map_err(|e| format!("Indexing task failed: {e}"))?
}

#[tauri::command]
pub async fn trigger_incremental_index(vault_path: String) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || indexing::run_incremental_update(&vault_path))
        .await
        .map_err(|e| format!("Incremental index failed: {e}"))?
}

// ── MCP commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn register_mcp_tools(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || crate::mcp::register_mcp(&vault_path))
        .await
        .map_err(|e| format!("Registration task failed: {e}"))?
}

#[tauri::command]
pub async fn check_mcp_status() -> Result<crate::mcp::McpStatus, String> {
    tokio::task::spawn_blocking(crate::mcp::check_mcp_status)
        .await
        .map_err(|e| format!("MCP status check failed: {e}"))
}

// ── Theme commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_themes(vault_path: String) -> Result<Vec<ThemeFile>, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::list_themes(&vault_path)
}

#[tauri::command]
pub fn get_theme(vault_path: String, theme_id: String) -> Result<ThemeFile, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::get_theme(&vault_path, &theme_id)
}

#[tauri::command]
pub fn get_vault_settings(vault_path: String) -> Result<VaultSettings, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::get_vault_settings(&vault_path)
}

#[tauri::command]
pub fn save_vault_settings(vault_path: String, settings: VaultSettings) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    theme::save_vault_settings(&vault_path, settings)
}

#[tauri::command]
pub fn set_active_theme(vault_path: String, theme_id: Option<String>) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    theme::set_active_theme(&vault_path, theme_id.as_deref())
}

#[tauri::command]
pub fn create_theme(vault_path: String, source_id: Option<String>) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::create_theme(&vault_path, source_id.as_deref())
}

#[tauri::command]
pub fn create_vault_theme(vault_path: String, name: Option<String>) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::create_vault_theme(&vault_path, name.as_deref())
}

#[tauri::command]
pub fn ensure_vault_themes(vault_path: String) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    theme::ensure_vault_themes(&vault_path)
}

#[tauri::command]
pub fn restore_default_themes(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    theme::restore_default_themes(&vault_path)
}

#[tauri::command]
pub fn repair_vault(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    // Repair themes
    theme::restore_default_themes(&vault_path)?;
    // Repair config files (config/agents.md, type/config.md, AGENTS.md stub)
    vault::repair_config_files(&vault_path)?;
    Ok("Vault repaired".to_string())
}

// ── Settings & config commands ──────────────────────────────────────────────

#[tauri::command]
pub fn get_build_number(app_handle: tauri::AppHandle) -> String {
    let version = app_handle.package_info().version.to_string();
    parse_build_label(&version)
}

#[tauri::command]
pub fn update_menu_state(
    app_handle: tauri::AppHandle,
    has_active_note: bool,
    has_modified_files: Option<bool>,
    has_conflicts: Option<bool>,
) -> Result<(), String> {
    menu::set_note_items_enabled(&app_handle, has_active_note);
    if let Some(v) = has_modified_files {
        menu::set_git_commit_items_enabled(&app_handle, v);
    }
    if let Some(v) = has_conflicts {
        menu::set_git_conflict_items_enabled(&app_handle, v);
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    crate::settings::get_settings()
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    crate::settings::save_settings(settings)
}

#[tauri::command]
pub fn load_vault_list() -> Result<VaultList, String> {
    vault_list::load_vault_list()
}

#[tauri::command]
pub fn save_vault_list(list: VaultList) -> Result<(), String> {
    vault_list::save_vault_list(&list)
}

#[tauri::command]
pub fn get_vault_config(vault_path: String) -> Result<VaultConfig, String> {
    let vault_path = expand_tilde(&vault_path);
    vault_config::get_vault_config(&vault_path)
}

#[tauri::command]
pub fn save_vault_config(vault_path: String, config: VaultConfig) -> Result<(), String> {
    let vault_path = expand_tilde(&vault_path);
    vault_config::save_vault_config(&vault_path, config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_tilde_with_subpath() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~/Documents/vault");
        assert_eq!(result, format!("{}/Documents/vault", home.display()));
    }

    #[test]
    fn expand_tilde_alone() {
        let home = dirs::home_dir().unwrap();
        let result = expand_tilde("~");
        assert_eq!(result, home.to_string_lossy());
    }

    #[test]
    fn expand_tilde_noop_for_absolute_path() {
        let result = expand_tilde("/usr/local/bin");
        assert_eq!(result, "/usr/local/bin");
    }

    #[test]
    fn expand_tilde_noop_for_relative_path() {
        let result = expand_tilde("some/relative/path");
        assert_eq!(result, "some/relative/path");
    }

    #[test]
    fn expand_tilde_noop_for_tilde_in_middle() {
        let result = expand_tilde("/home/~user/path");
        assert_eq!(result, "/home/~user/path");
    }

    #[test]
    fn parse_build_label_release_version() {
        assert_eq!(parse_build_label("0.20260303.281"), "b281");
        assert_eq!(parse_build_label("0.20251215.42"), "b42");
    }

    #[test]
    fn parse_build_label_dev_version() {
        assert_eq!(parse_build_label("0.1.0"), "dev");
        assert_eq!(parse_build_label("0.0.0"), "dev");
    }

    #[test]
    fn parse_build_label_malformed() {
        assert_eq!(parse_build_label("invalid"), "b?");
        assert_eq!(parse_build_label(""), "b?");
    }

    #[test]
    fn test_batch_archive_notes() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "---\nStatus: Active\n---\n# Note\n").unwrap();

        let result = batch_archive_notes(vec![note.to_str().unwrap().to_string()]);
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Archived: true"));
        assert!(content.contains("Status: Active"));
    }

    #[test]
    fn test_batch_trash_notes() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "---\nStatus: Active\n---\n# Note\n").unwrap();

        let result = batch_trash_notes(vec![note.to_str().unwrap().to_string()]);
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Trashed: true"));
        assert!(content.contains("Trashed at"));
    }

    #[test]
    fn test_reload_vault_entry_reads_from_disk() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, "---\nStatus: Active\n---\n# Test\n").unwrap();

        let entry = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(entry.title, "Test");
        assert_eq!(entry.status, Some("Active".to_string()));

        // Modify file on disk
        std::fs::write(&note, "---\nStatus: Done\n---\n# Test\n").unwrap();
        let fresh = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(fresh.status, Some("Done".to_string()));
    }

    #[test]
    fn test_reload_vault_entry_nonexistent() {
        let result = reload_vault_entry("/nonexistent/path.md".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_reload_vault_invalidates_cache_and_rescans() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault = dir.path();
        // Init git repo for caching to work
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "t@t.com"])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "T"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Set test cache dir to avoid polluting real cache
        let cache_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var(
            "LAPUTA_CACHE_DIR",
            cache_dir.path().to_string_lossy().as_ref(),
        );

        std::fs::write(vault.join("note.md"), "---\nTrashed: false\n---\n# Note\n").unwrap();
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Prime cache via list_vault
        let entries = list_vault(vault.to_str().unwrap().to_string()).unwrap();
        assert!(!entries[0].trashed);

        // Trash the note on disk
        std::fs::write(vault.join("note.md"), "---\nTrashed: true\n---\n# Note\n").unwrap();

        // reload_vault must return the updated trashed state
        let fresh = reload_vault(vault.to_str().unwrap().to_string()).unwrap();
        assert!(
            fresh[0].trashed,
            "reload_vault must reflect disk state after trashing"
        );
    }

    #[test]
    fn test_check_vault_exists_false() {
        assert!(!check_vault_exists("/nonexistent/path/abc123".to_string()));
    }

    #[test]
    fn test_get_default_vault_path_returns_ok() {
        let result = get_default_vault_path();
        assert!(result.is_ok());
    }
}
