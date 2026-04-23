use crate::commands::expand_tilde;
use crate::vault::{self, DetectedRename, RenameResult};
use std::path::Path;

use super::boundary::{
    with_existing_path_in_requested_vault, with_validated_path, ValidatedPathMode,
};

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note(
                requested_root,
                validated_path,
                &new_title,
                old_title.as_deref(),
            )
        },
    )
}

#[tauri::command]
pub fn rename_note_filename(
    vault_path: String,
    old_path: String,
    new_filename_stem: String,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            vault::rename_note_filename(requested_root, validated_path, &new_filename_stem)
        },
    )
}

#[tauri::command]
pub fn move_note_to_folder(
    vault_path: String,
    old_path: String,
    folder_path: String,
) -> Result<RenameResult, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &old_path,
        |requested_root, validated_path| {
            let trimmed_folder_path = folder_path.trim();
            if trimmed_folder_path.is_empty() {
                return Err("Folder path cannot be empty".to_string());
            }

            let folder_absolute_path = Path::new(requested_root).join(trimmed_folder_path);
            with_validated_path(
                folder_absolute_path.to_string_lossy().as_ref(),
                Some(&vault_path),
                ValidatedPathMode::Existing,
                |validated_folder_path| {
                    let validated_folder = Path::new(validated_folder_path);
                    if !validated_folder.is_dir() {
                        return Err(format!("Folder does not exist: {}", trimmed_folder_path));
                    }
                    vault::move_note_to_folder(
                        requested_root,
                        validated_path,
                        validated_folder_path,
                    )
                },
            )
        },
    )
}

#[tauri::command]
pub fn auto_rename_untitled(
    vault_path: String,
    note_path: String,
) -> Result<Option<RenameResult>, String> {
    with_existing_path_in_requested_vault(
        &vault_path,
        &note_path,
        |requested_root, validated_path| {
            vault::auto_rename_untitled(requested_root, validated_path)
        },
    )
}

#[tauri::command]
pub fn detect_renames(vault_path: String) -> Result<Vec<DetectedRename>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::detect_renames(&vault_path)
}

#[tauri::command]
pub fn update_wikilinks_for_renames(
    vault_path: String,
    renames: Vec<DetectedRename>,
) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::update_wikilinks_for_renames(&vault_path, &renames)
}
