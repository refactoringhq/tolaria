use crate::commands::expand_tilde;
use crate::vault::filename_rules::validate_folder_name;
use crate::vault::{self, FolderNode, VaultEntry};
use std::path::{Path, PathBuf};

use super::boundary::{
    with_boundary, with_existing_paths, with_requested_root, with_validated_path, ValidatedPathMode,
};

const LOCALIZED_ERROR_PREFIX: &str = "tolaria:i18n-error:";
const FILE_ACTION_INSPECT_PATH_ERROR_KEY: &str = "fileActions.error.inspectPath";
const FILE_ACTION_PATH_MISSING_ERROR_KEY: &str = "fileActions.error.pathMissing";

fn with_note_path<T>(
    path: &Path,
    vault_path: Option<&Path>,
    mode: ValidatedPathMode,
    action: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let raw_path = path.to_string_lossy();
    let raw_vault_path = vault_path.map(|value| value.to_string_lossy());
    with_validated_path(
        &raw_path,
        raw_vault_path.as_deref(),
        mode,
        |validated_path| action(Path::new(validated_path)),
    )
}

fn with_external_file_path<T>(
    path: &Path,
    vault_path: Option<&Path>,
    action: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    with_note_path(path, vault_path, ValidatedPathMode::Existing, action)
}

fn with_expanded_vault_root<T>(
    path: &Path,
    action: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let raw_path = path.to_string_lossy();
    let expanded = expand_tilde(raw_path.as_ref()).into_owned();
    action(Path::new(&expanded))
}

fn with_requested_root_path<T>(
    vault_path: &Path,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    let raw_vault_path = vault_path.to_string_lossy();
    with_requested_root(raw_vault_path.as_ref(), action)
}

fn sync_image_asset_scope(
    app_handle: &tauri::AppHandle,
    requested_root: &str,
) -> Result<(), String> {
    #[cfg(desktop)]
    crate::sync_vault_asset_scope(app_handle, Path::new(requested_root))?;
    #[cfg(not(desktop))]
    let _ = requested_root;
    #[cfg(not(desktop))]
    let _ = app_handle;
    Ok(())
}

fn with_image_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
    action: impl FnOnce(&str) -> Result<String, String>,
) -> Result<String, String> {
    with_requested_root_path(vault_path, |requested_root| {
        let saved_path = action(requested_root)?;
        sync_image_asset_scope(app_handle, requested_root)?;
        Ok(saved_path)
    })
}

#[tauri::command]
pub fn sync_vault_asset_scope_for_window(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
) -> Result<(), String> {
    with_requested_root_path(vault_path.as_path(), |requested_root| {
        sync_image_asset_scope(&app_handle, requested_root)
    })
}

#[tauri::command]
pub fn open_vault_file_external(
    app_handle: tauri::AppHandle,
    path: PathBuf,
    vault_path: Option<PathBuf>,
) -> Result<(), String> {
    with_external_file_path(path.as_path(), vault_path.as_deref(), |validated_path| {
        open_path_with_default_app(&app_handle, validated_path)
    })
}

#[derive(Debug, Eq, PartialEq)]
enum FileManagerRevealAction {
    OpenPath(PathBuf),
    RevealItemInDir(PathBuf),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum RevealPlatform {
    Windows,
    Other,
}

fn current_reveal_platform() -> RevealPlatform {
    if cfg!(windows) {
        RevealPlatform::Windows
    } else {
        RevealPlatform::Other
    }
}

fn open_path_with_default_app(app_handle: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    app_handle
        .opener()
        .open_path(path.to_string_lossy().into_owned(), None::<String>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn reveal_path_in_file_manager(
    app_handle: tauri::AppHandle,
    path: PathBuf,
) -> Result<(), String> {
    let action = file_manager_reveal_action(path.as_path(), current_reveal_platform())?;
    perform_file_manager_reveal(&app_handle, action)
}

fn file_manager_reveal_action(
    path: &Path,
    platform: RevealPlatform,
) -> Result<FileManagerRevealAction, String> {
    if !path.try_exists().map_err(|error| {
        localized_reveal_error(
            FILE_ACTION_INSPECT_PATH_ERROR_KEY,
            serde_json::json!({ "error": error.to_string() }),
        )
    })? {
        return Err(localized_reveal_error(
            FILE_ACTION_PATH_MISSING_ERROR_KEY,
            serde_json::json!({ "path": path.display().to_string() }),
        ));
    }

    if platform == RevealPlatform::Windows && path.is_dir() {
        return Ok(FileManagerRevealAction::OpenPath(path.to_path_buf()));
    }

    Ok(FileManagerRevealAction::RevealItemInDir(path.to_path_buf()))
}

fn localized_reveal_error(key: &str, values: serde_json::Value) -> String {
    let payload = serde_json::json!({
        "key": key,
        "values": values,
    });
    format!("{LOCALIZED_ERROR_PREFIX}{payload}")
}

fn perform_file_manager_reveal(
    app_handle: &tauri::AppHandle,
    action: FileManagerRevealAction,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    match action {
        FileManagerRevealAction::OpenPath(path) => app_handle
            .opener()
            .open_path(path.to_string_lossy().into_owned(), None::<String>),
        FileManagerRevealAction::RevealItemInDir(path) => {
            app_handle.opener().reveal_item_in_dir(path)
        }
    }
    .map_err(|error| error.to_string())
}

fn with_writable_note_path<T>(
    path: PathBuf,
    vault_path: Option<PathBuf>,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    with_validated_path(
        path.to_string_lossy().as_ref(),
        vault_path
            .as_ref()
            .map(|value| value.to_string_lossy())
            .as_deref(),
        ValidatedPathMode::Writable,
        action,
    )
}

#[tauri::command]
pub fn get_note_content(path: PathBuf, vault_path: Option<PathBuf>) -> Result<String, String> {
    with_note_path(
        path.as_path(),
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        vault::get_note_content,
    )
}

#[tauri::command]
pub fn validate_note_content(
    path: PathBuf,
    content: String,
    vault_path: Option<PathBuf>,
) -> Result<bool, String> {
    with_note_path(
        path.as_path(),
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| vault::note_content_matches(validated_path, &content),
    )
}

#[tauri::command]
pub async fn save_note_content(
    path: PathBuf,
    content: String,
    vault_path: Option<PathBuf>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        with_writable_note_path(path, vault_path, |validated_path| {
            vault::save_note_content(validated_path, &content)
        })
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[tauri::command]
pub fn create_note_content(
    path: PathBuf,
    content: String,
    vault_path: Option<PathBuf>,
) -> Result<(), String> {
    with_writable_note_path(path, vault_path, |validated_path| {
        vault::create_note_content(validated_path, &content)
    })
}

#[tauri::command]
pub fn delete_note(path: PathBuf) -> Result<String, String> {
    with_validated_path(
        path.to_string_lossy().as_ref(),
        None,
        ValidatedPathMode::Existing,
        vault::delete_note,
    )
}

#[tauri::command]
pub fn batch_delete_notes(paths: Vec<PathBuf>) -> Result<Vec<String>, String> {
    let raw_paths = paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    with_existing_paths(&raw_paths, None, |validated_paths| {
        vault::batch_delete_notes(&validated_paths)
    })
}

#[tauri::command]
pub fn create_vault_folder(
    vault_path: PathBuf,
    folder_name: PathBuf,
    parent_path: Option<PathBuf>,
) -> Result<String, String> {
    let raw_vault_path = vault_path.to_string_lossy();
    with_boundary(Some(raw_vault_path.as_ref()), |boundary| {
        let folder_name = folder_name.to_string_lossy();
        let relative_path = match parent_path.as_deref() {
            Some(parent) if !parent.as_os_str().is_empty() => parent.join(folder_name.as_ref()),
            _ => PathBuf::from(folder_name.as_ref()),
        };
        let folder_path = boundary.child_path(&relative_path.to_string_lossy())?;
        validate_folder_name(folder_name.as_ref())?;
        ensure_missing_folder(&folder_path, folder_name.as_ref())?;
        std::fs::create_dir_all(&folder_path)
            .map_err(|e| format!("Failed to create folder: {}", e))?;
        Ok(folder_name.into_owned())
    })
}

fn ensure_missing_folder(folder_path: &Path, folder_name: &str) -> Result<(), String> {
    if folder_path.exists() {
        return Err(format!("Folder '{}' already exists", folder_name));
    }
    Ok(())
}

fn scan_visible_vault_entries(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    let entries = vault::scan_vault_cached(vault_path)?;
    Ok(filter_visible_vault_entries(
        vault_path,
        entries,
        crate::settings::hide_gitignored_files_enabled(),
    ))
}

fn filter_visible_vault_entries(
    vault_path: &Path,
    entries: Vec<VaultEntry>,
    hide_gitignored: bool,
) -> Vec<VaultEntry> {
    vault::filter_gitignored_entries(vault_path, entries, hide_gitignored)
}

fn scan_visible_vault_folders(vault_path: &Path) -> Result<Vec<FolderNode>, String> {
    let folders = vault::scan_vault_folders(vault_path)?;
    Ok(vault::filter_gitignored_folders(
        vault_path,
        folders,
        crate::settings::hide_gitignored_files_enabled(),
    ))
}

/// Sync the `title` frontmatter field with the filename on note open.
/// Returns `true` if the file was modified (title was absent or desynced).
#[tauri::command]
pub fn sync_note_title(path: PathBuf, vault_path: Option<PathBuf>) -> Result<bool, String> {
    use vault::SyncAction;

    with_note_path(
        path.as_path(),
        vault_path.as_deref(),
        ValidatedPathMode::Existing,
        |validated_path| {
            let action = vault::sync_title_on_open(validated_path)?;
            Ok(matches!(action, SyncAction::Updated { .. }))
        },
    )
}

#[tauri::command]
pub fn save_image(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
    filename: String,
    data: String,
) -> Result<String, String> {
    with_image_asset_scope(&app_handle, vault_path.as_path(), |requested_root| {
        vault::save_image(requested_root, &filename, &data)
    })
}

#[tauri::command]
pub fn copy_image_to_vault(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
    source_path: PathBuf,
) -> Result<String, String> {
    with_image_asset_scope(&app_handle, vault_path.as_path(), |requested_root| {
        vault::copy_image_to_vault(requested_root, source_path.to_string_lossy().as_ref())
    })
}

#[tauri::command]
pub async fn download_remote_image_to_vault(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
    url: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        with_image_asset_scope(&app_handle, vault_path.as_path(), |requested_root| {
            vault::download_remote_image(requested_root, &url)
        })
    })
    .await
    .map_err(|error| format!("Remote image task failed: {error}"))?
}

#[tauri::command]
pub async fn list_vault(path: PathBuf) -> Result<Vec<VaultEntry>, String> {
    tokio::task::spawn_blocking(move || {
        with_expanded_vault_root(path.as_path(), scan_visible_vault_entries)
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[tauri::command]
pub async fn read_vault_snapshot(path: PathBuf) -> Result<Option<Vec<VaultEntry>>, String> {
    let hide_gitignored = crate::settings::hide_gitignored_files_enabled();
    tokio::task::spawn_blocking(move || {
        with_expanded_vault_root(path.as_path(), |vault_path| {
            let snapshot = vault::read_vault_snapshot(vault_path)?;
            Ok(snapshot
                .map(|entries| filter_visible_vault_entries(vault_path, entries, hide_gitignored)))
        })
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[tauri::command]
pub async fn list_vault_folders(path: PathBuf) -> Result<Vec<FolderNode>, String> {
    tokio::task::spawn_blocking(move || {
        with_expanded_vault_root(path.as_path(), scan_visible_vault_folders)
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[cfg(test)]
#[path = "file_cmds_tests.rs"]
mod tests;
