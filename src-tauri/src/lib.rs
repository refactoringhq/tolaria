pub mod ai_chat;
pub mod frontmatter;
pub mod git;
pub mod vault;

use ai_chat::{AiChatRequest, AiChatResponse};
use git::{GitCommit, ModifiedFile};
use vault::VaultEntry;
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_vault,
            get_note_content,
            update_frontmatter,
            delete_frontmatter_property,
            get_file_history,
            get_modified_files,
            get_file_diff,
            git_commit,
            git_push,
            ai_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
