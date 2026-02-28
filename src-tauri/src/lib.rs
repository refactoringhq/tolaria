pub mod ai_chat;
pub mod frontmatter;
pub mod git;
pub mod github;
pub mod mcp;
pub mod menu;
pub mod search;
pub mod settings;
pub mod vault;

use std::borrow::Cow;
use std::path::Path;
use std::process::Child;
use std::sync::Mutex;

use ai_chat::{AiChatRequest, AiChatResponse};
use frontmatter::FrontmatterValue;
use git::{GitCommit, GitPullResult, LastCommitInfo, ModifiedFile};
use github::{DeviceFlowPollResult, DeviceFlowStart, GitHubUser, GithubRepo};
use search::SearchResponse;
use settings::Settings;
use vault::{RenameResult, VaultEntry};

/// Expand a leading `~` or `~/` in a path string to the user's home directory.
/// Returns the original string unchanged if it doesn't start with `~` or if the
/// home directory cannot be determined.
fn expand_tilde(path: &str) -> Cow<'_, str> {
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

#[tauri::command]
fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path);
    vault::scan_vault_cached(Path::new(path.as_ref()))
}

#[tauri::command]
fn get_note_content(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::get_note_content(Path::new(path.as_ref()))
}

#[tauri::command]
fn save_note_content(path: String, content: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    vault::save_note_content(&path, &content)
}

#[tauri::command]
fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::update_frontmatter(&path, &key, value)
}

#[tauri::command]
fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::delete_frontmatter_property(&path, &key)
}

#[tauri::command]
fn get_file_history(vault_path: String, path: String) -> Result<Vec<GitCommit>, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_history(&vault_path, &path)
}

#[tauri::command]
fn get_modified_files(vault_path: String) -> Result<Vec<ModifiedFile>, String> {
    let vault_path = expand_tilde(&vault_path);
    git::get_modified_files(&vault_path)
}

#[tauri::command]
fn get_file_diff(vault_path: String, path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_diff(&vault_path, &path)
}

#[tauri::command]
fn get_file_diff_at_commit(
    vault_path: String,
    path: String,
    commit_hash: String,
) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    let path = expand_tilde(&path);
    git::get_file_diff_at_commit(&vault_path, &path, &commit_hash)
}

#[tauri::command]
fn git_commit(vault_path: String, message: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_commit(&vault_path, &message)
}

#[tauri::command]
fn get_last_commit_info(vault_path: String) -> Result<Option<LastCommitInfo>, String> {
    let vault_path = expand_tilde(&vault_path);
    git::get_last_commit_info(&vault_path)
}

#[tauri::command]
fn git_pull(vault_path: String) -> Result<GitPullResult, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_pull(&vault_path)
}

#[tauri::command]
fn git_push(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    git::git_push(&vault_path)
}

#[tauri::command]
async fn ai_chat(request: AiChatRequest) -> Result<AiChatResponse, String> {
    ai_chat::send_chat(request).await
}

#[tauri::command]
fn save_image(vault_path: String, filename: String, data: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::save_image(&vault_path, &filename, &data)
}

#[tauri::command]
fn copy_image_to_vault(vault_path: String, source_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::copy_image_to_vault(&vault_path, &source_path)
}

#[tauri::command]
fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
) -> Result<RenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    let old_path = expand_tilde(&old_path);
    vault::rename_note(&vault_path, &old_path, &new_title)
}

#[tauri::command]
fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::purge_trash(&vault_path)
}

#[tauri::command]
fn migrate_is_a_to_type(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)
}

#[tauri::command]
fn create_getting_started_vault(target_path: Option<String>) -> Result<String, String> {
    let path = match target_path {
        Some(p) if !p.is_empty() => expand_tilde(&p).into_owned(),
        _ => vault::default_vault_path()?.to_string_lossy().to_string(),
    };
    vault::create_getting_started_vault(&path)
}

#[tauri::command]
fn check_vault_exists(path: String) -> bool {
    let path = expand_tilde(&path);
    vault::vault_exists(&path)
}

#[tauri::command]
fn get_default_vault_path() -> Result<String, String> {
    vault::default_vault_path().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn batch_archive_notes(paths: Vec<String>) -> Result<usize, String> {
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Archived", FrontmatterValue::Bool(true))?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
fn batch_trash_notes(paths: Vec<String>) -> Result<usize, String> {
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

#[tauri::command]
fn update_menu_state(app_handle: tauri::AppHandle, has_active_note: bool) -> Result<(), String> {
    menu::set_note_items_enabled(&app_handle, has_active_note);
    Ok(())
}

#[tauri::command]
fn get_settings() -> Result<Settings, String> {
    settings::get_settings()
}

#[tauri::command]
fn save_settings(settings: Settings) -> Result<(), String> {
    settings::save_settings(settings)
}

#[tauri::command]
async fn github_list_repos(token: String) -> Result<Vec<GithubRepo>, String> {
    github::github_list_repos(&token).await
}

#[tauri::command]
async fn github_create_repo(
    token: String,
    name: String,
    private: bool,
) -> Result<GithubRepo, String> {
    github::github_create_repo(&token, &name, private).await
}

#[tauri::command]
fn clone_repo(url: String, token: String, local_path: String) -> Result<String, String> {
    let local_path = expand_tilde(&local_path);
    github::clone_repo(&url, &token, &local_path)
}

#[tauri::command]
async fn github_device_flow_start() -> Result<DeviceFlowStart, String> {
    github::github_device_flow_start().await
}

#[tauri::command]
async fn github_device_flow_poll(device_code: String) -> Result<DeviceFlowPollResult, String> {
    github::github_device_flow_poll(&device_code).await
}

#[tauri::command]
async fn github_get_user(token: String) -> Result<GitHubUser, String> {
    github::github_get_user(&token).await
}

#[tauri::command]
async fn search_vault(
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

struct WsBridgeChild(Mutex<Option<Child>>);

#[tauri::command]
async fn register_mcp_tools(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    tokio::task::spawn_blocking(move || mcp::register_mcp(&vault_path))
        .await
        .map_err(|e| format!("Registration task failed: {e}"))?
}

fn log_startup_result(label: &str, result: Result<usize, String>) {
    match result {
        Ok(n) if n > 0 => log::info!("{}: {} files", label, n),
        Err(e) => log::warn!("{}: {}", label, e),
        _ => {}
    }
}

/// Run startup housekeeping on the default vault (purge old trash, migrate legacy frontmatter).
fn run_startup_tasks() {
    let vault_path = dirs::home_dir()
        .map(|h| h.join("Laputa"))
        .unwrap_or_default();
    if !vault_path.is_dir() {
        return;
    }
    let vp_str = vault_path.to_str().unwrap_or_default();
    log_startup_result(
        "Purged trashed files on startup",
        vault::purge_trash(vp_str).map(|d| d.len()),
    );
    log_startup_result(
        "Migrated is_a to type on startup",
        vault::migrate_is_a_to_type(vp_str),
    );

    // Register Laputa MCP server in Claude Code and Cursor configs
    match mcp::register_mcp(vp_str) {
        Ok(status) => log::info!("MCP registration: {status}"),
        Err(e) => log::warn!("MCP registration failed: {e}"),
    }
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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WsBridgeChild(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                // Open devtools automatically in debug builds
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            app.handle().plugin(tauri_plugin_dialog::init())?;

            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle().plugin(tauri_plugin_opener::init())?;
                menu::setup_menu(app)?;
            }

            run_startup_tasks();

            // Spawn the MCP WebSocket bridge for the default vault
            {
                use tauri::Manager;
                let vault_path = dirs::home_dir()
                    .map(|h| h.join("Laputa"))
                    .unwrap_or_default();
                let vp_str = vault_path.to_string_lossy().to_string();
                match mcp::spawn_ws_bridge(&vp_str) {
                    Ok(child) => {
                        let state: tauri::State<'_, WsBridgeChild> = app.state();
                        *state.0.lock().unwrap() = Some(child);
                    }
                    Err(e) => log::warn!("Failed to start ws-bridge: {}", e),
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_vault,
            get_note_content,
            save_note_content,
            update_frontmatter,
            delete_frontmatter_property,
            rename_note,
            get_file_history,
            get_modified_files,
            get_file_diff,
            get_file_diff_at_commit,
            git_commit,
            get_last_commit_info,
            git_pull,
            git_push,
            ai_chat,
            save_image,
            copy_image_to_vault,
            purge_trash,
            migrate_is_a_to_type,
            batch_archive_notes,
            batch_trash_notes,
            get_settings,
            update_menu_state,
            save_settings,
            github_list_repos,
            github_create_repo,
            clone_repo,
            github_device_flow_start,
            github_device_flow_poll,
            github_get_user,
            search_vault,
            create_getting_started_vault,
            check_vault_exists,
            get_default_vault_path,
            register_mcp_tools
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            use tauri::Manager;
            if let tauri::RunEvent::Exit = event {
                let state: tauri::State<'_, WsBridgeChild> = app_handle.state();
                let mut guard = state.0.lock().unwrap();
                if let Some(ref mut child) = *guard {
                    let _ = child.kill();
                    log::info!("ws-bridge child process killed on exit");
                }
            }
        });
}
