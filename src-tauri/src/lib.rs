pub mod ai_chat;
pub mod frontmatter;
pub mod git;
pub mod github;
pub mod settings;
pub mod vault;

use ai_chat::{AiChatRequest, AiChatResponse};
use git::{GitCommit, ModifiedFile};
use github::GithubRepo;
use settings::Settings;
use vault::{VaultEntry, RenameResult};
use frontmatter::FrontmatterValue;

#[tauri::command]
fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    vault::scan_vault_cached(&path)
}

#[tauri::command]
fn get_note_content(path: String) -> Result<String, String> {
    vault::get_note_content(&path)
}

#[tauri::command]
fn update_frontmatter(path: String, key: String, value: FrontmatterValue) -> Result<String, String> {
    vault::update_frontmatter(&path, &key, value)
}

#[tauri::command]
fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    vault::delete_frontmatter_property(&path, &key)
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
fn get_file_diff_at_commit(vault_path: String, path: String, commit_hash: String) -> Result<String, String> {
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
fn rename_note(vault_path: String, old_path: String, new_title: String) -> Result<RenameResult, String> {
    vault::rename_note(&vault_path, &old_path, &new_title)
}

#[tauri::command]
fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    vault::purge_trash(&vault_path)
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
async fn github_create_repo(token: String, name: String, private: bool) -> Result<GithubRepo, String> {
    github::github_create_repo(&token, &name, private).await
}

#[tauri::command]
fn clone_repo(url: String, token: String, local_path: String) -> Result<String, String> {
    github::clone_repo(&url, &token, &local_path)
}

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

            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }

            // Purge trashed files older than 30 days on startup
            let vault_path = dirs::home_dir()
                .map(|h| h.join("Laputa"))
                .unwrap_or_default();
            if vault_path.is_dir() {
                match vault::purge_trash(vault_path.to_str().unwrap_or_default()) {
                    Ok(deleted) if !deleted.is_empty() => {
                        log::info!("Purged {} trashed files on startup", deleted.len());
                    }
                    Err(e) => {
                        log::warn!("Failed to purge trash on startup: {}", e);
                    }
                    _ => {}
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_vault,
            get_note_content,
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
            get_settings,
            save_settings,
            github_list_repos,
            github_create_repo,
            clone_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
