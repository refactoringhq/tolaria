pub mod ai_chat;
pub mod frontmatter;
pub mod git;
pub mod github;
pub mod menu;
pub mod settings;
pub mod vault;

use std::path::Path;

use ai_chat::{AiChatRequest, AiChatResponse};
use frontmatter::FrontmatterValue;
use git::{GitCommit, ModifiedFile};
use github::{DeviceFlowPollResult, DeviceFlowStart, GitHubUser, GithubRepo};
use settings::Settings;
use vault::{RenameResult, VaultEntry};

#[tauri::command]
fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    vault::scan_vault_cached(Path::new(&path))
}

#[tauri::command]
fn get_note_content(path: String) -> Result<String, String> {
    vault::get_note_content(Path::new(&path))
}

#[tauri::command]
fn save_note_content(path: String, content: String) -> Result<(), String> {
    vault::save_note_content(&path, &content)
}

#[tauri::command]
fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
) -> Result<String, String> {
    frontmatter::update_frontmatter(&path, &key, value)
}

#[tauri::command]
fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    frontmatter::delete_frontmatter_property(&path, &key)
}

#[tauri::command]
fn get_file_history(vault_path: String, path: String) -> Result<Vec<GitCommit>, String> {
    git::get_file_history(&vault_path, &path)
}

#[tauri::command]
fn get_modified_files(vault_path: String) -> Result<Vec<ModifiedFile>, String> {
    git::get_modified_files(&vault_path)
}

#[tauri::command]
fn get_file_diff(vault_path: String, path: String) -> Result<String, String> {
    git::get_file_diff(&vault_path, &path)
}

#[tauri::command]
fn get_file_diff_at_commit(
    vault_path: String,
    path: String,
    commit_hash: String,
) -> Result<String, String> {
    git::get_file_diff_at_commit(&vault_path, &path, &commit_hash)
}

#[tauri::command]
fn git_commit(vault_path: String, message: String) -> Result<String, String> {
    git::git_commit(&vault_path, &message)
}

#[tauri::command]
fn git_push(vault_path: String) -> Result<String, String> {
    git::git_push(&vault_path)
}

#[tauri::command]
async fn ai_chat(request: AiChatRequest) -> Result<AiChatResponse, String> {
    ai_chat::send_chat(request).await
}

#[tauri::command]
fn save_image(vault_path: String, filename: String, data: String) -> Result<String, String> {
    vault::save_image(&vault_path, &filename, &data)
}

#[tauri::command]
fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
) -> Result<RenameResult, String> {
    vault::rename_note(&vault_path, &old_path, &new_title)
}

#[tauri::command]
fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    vault::purge_trash(&vault_path)
}

#[tauri::command]
fn migrate_is_a_to_type(vault_path: String) -> Result<usize, String> {
    vault::migrate_is_a_to_type(&vault_path)
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
}

#[cfg(test)]
mod tests {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
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
            git_push,
            ai_chat,
            save_image,
            purge_trash,
            migrate_is_a_to_type,
            get_settings,
            save_settings,
            github_list_repos,
            github_create_repo,
            clone_repo,
            github_device_flow_start,
            github_device_flow_poll,
            github_get_user
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
