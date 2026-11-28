#[cfg(desktop)]
use std::process::Command;

#[cfg(desktop)]
use crate::menu;
use crate::settings::Settings;
use crate::vault_list;
use crate::vault_list::VaultList;
use serde::Deserialize;
#[cfg(desktop)]
use tauri::ipc::Channel;
#[cfg(desktop)]
use tauri::LogicalSize;
#[cfg(desktop)]
use tauri::Window;

use super::parse_build_label;

#[cfg(desktop)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TitleBarDoubleClickAction {
    Fill,
    Minimize,
    None,
}

#[cfg(desktop)]
fn parse_title_bar_double_click_action(value: &str) -> Option<TitleBarDoubleClickAction> {
    match value.trim().to_ascii_lowercase().as_str() {
        "fill" | "zoom" | "maximize" => Some(TitleBarDoubleClickAction::Fill),
        "minimize" => Some(TitleBarDoubleClickAction::Minimize),
        "none" | "no action" | "do nothing" => Some(TitleBarDoubleClickAction::None),
        _ => None,
    }
}

#[cfg(desktop)]
fn parse_legacy_title_bar_double_click_action(value: &str) -> Option<TitleBarDoubleClickAction> {
    match value.trim().to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" => Some(TitleBarDoubleClickAction::Minimize),
        "0" | "false" | "no" => Some(TitleBarDoubleClickAction::Fill),
        _ => None,
    }
}

#[cfg(desktop)]
fn read_global_defaults_value(key: &str) -> Option<String> {
    let output = Command::new("defaults")
        .args(["read", "-g", key])
        .output()
        .ok()?;
    parse_defaults_read_output(output)
}

#[cfg(desktop)]
fn resolve_title_bar_double_click_action(
    read_value: impl Fn(&str) -> Option<String>,
) -> TitleBarDoubleClickAction {
    read_value("AppleActionOnDoubleClick")
        .as_deref()
        .and_then(parse_title_bar_double_click_action)
        .or_else(|| {
            read_value("AppleMiniaturizeOnDoubleClick")
                .as_deref()
                .and_then(parse_legacy_title_bar_double_click_action)
        })
        .unwrap_or(TitleBarDoubleClickAction::Fill)
}

#[cfg(desktop)]
fn parse_defaults_read_output(output: std::process::Output) -> Option<String> {
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed.to_string())
}

#[cfg(desktop)]
fn apply_title_bar_double_click_action(
    action: TitleBarDoubleClickAction,
    is_maximized: impl FnOnce() -> Result<bool, String>,
    maximize: impl FnOnce() -> Result<(), String>,
    unmaximize: impl FnOnce() -> Result<(), String>,
    minimize: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    match action {
        TitleBarDoubleClickAction::Fill => {
            if is_maximized()? {
                unmaximize()
            } else {
                maximize()
            }
        }
        TitleBarDoubleClickAction::Minimize => minimize(),
        TitleBarDoubleClickAction::None => Ok(()),
    }
}

// ── MCP commands (desktop) ──────────────────────────────────────────────────

#[cfg(desktop)]
#[tauri::command]
pub async fn register_mcp_tools(vault_path: String) -> Result<String, String> {
    let vault_path = super::expand_tilde(&vault_path).into_owned();
    crate::commands::blocking::run_blocking_labeled("Registration task failed", move || {
        crate::mcp::register_mcp(&vault_path)
    })
    .await?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn remove_mcp_tools() -> Result<String, String> {
    crate::commands::blocking::run_blocking_labeled("Removal task failed", crate::mcp::remove_mcp)
        .await
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_mcp_status(vault_path: String) -> Result<crate::mcp::McpStatus, String> {
    let vault_path = super::expand_tilde(&vault_path).into_owned();
    crate::commands::blocking::run_blocking_labeled("MCP status check failed", move || {
        crate::mcp::check_mcp_status(&vault_path)
    })
    .await
}

#[cfg(desktop)]
#[tauri::command]
pub async fn get_mcp_config_snippet(vault_path: String) -> Result<String, String> {
    let vault_path = super::expand_tilde(&vault_path).into_owned();
    crate::commands::blocking::run_blocking_labeled("MCP config task failed", move || {
        crate::mcp::mcp_config_snippet(&vault_path)
    })
    .await?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn get_opencode_mcp_config_snippet(vault_path: String) -> Result<String, String> {
    let vault_path = super::expand_tilde(&vault_path).into_owned();
    crate::commands::blocking::run_blocking_labeled("OpenCode MCP config task failed", move || {
        crate::mcp::opencode_mcp_config_snippet(&vault_path)
    })
    .await?
}

#[cfg(desktop)]
#[tauri::command]
pub async fn sync_mcp_bridge_vault(
    app: tauri::AppHandle,
    vault_path: Option<String>,
    vault_paths: Option<Vec<String>>,
) -> Result<String, String> {
    let expanded_vault_path = vault_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(|path| super::expand_tilde(path).into_owned());
    let vault_path = expanded_vault_path.as_deref().map(std::path::Path::new);
    let expanded_vault_paths = vault_paths
        .unwrap_or_default()
        .into_iter()
        .map(|path| super::expand_tilde(path.trim()).into_owned())
        .filter(|path| !path.is_empty())
        .map(std::path::PathBuf::from)
        .collect::<Vec<_>>();

    crate::sync_ws_bridge_for_vault(&app, vault_path, &expanded_vault_paths).map(str::to_string)
}

// ── MCP commands (mobile stubs) ─────────────────────────────────────────────

#[cfg(mobile)]
#[tauri::command]
pub async fn register_mcp_tools(_vault_path: String) -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn remove_mcp_tools() -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn check_mcp_status(_vault_path: String) -> Result<crate::mcp::McpStatus, String> {
    Ok(crate::mcp::McpStatus::NotInstalled)
}

#[cfg(mobile)]
#[tauri::command]
pub async fn get_mcp_config_snippet(_vault_path: String) -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn get_opencode_mcp_config_snippet(_vault_path: String) -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn sync_mcp_bridge_vault(
    _vault_path: Option<String>,
    _vault_paths: Option<Vec<String>>,
) -> Result<String, String> {
    Err("MCP is not available on mobile".into())
}

// ── Menu commands ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuStateUpdate {
    has_active_note: bool,
    has_modified_files: Option<bool>,
    has_conflicts: Option<bool>,
    has_restorable_deleted_note: Option<bool>,
    has_no_remote: Option<bool>,
    note_list_search_enabled: Option<bool>,
    editor_find_enabled: Option<bool>,
}

#[cfg(desktop)]
#[tauri::command]
pub fn update_menu_state(
    app_handle: tauri::AppHandle,
    state: MenuStateUpdate,
) -> Result<(), String> {
    menu::set_note_items_enabled(&app_handle, state.has_active_note);
    if let Some(v) = state.has_modified_files {
        menu::set_git_commit_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_conflicts {
        menu::set_git_conflict_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_restorable_deleted_note {
        menu::set_restore_deleted_item_enabled(&app_handle, v);
    }
    if let Some(v) = state.has_no_remote {
        menu::set_git_no_remote_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.note_list_search_enabled {
        menu::set_note_list_search_items_enabled(&app_handle, v);
    }
    if let Some(v) = state.editor_find_enabled {
        menu::set_editor_find_items_enabled(&app_handle, v);
    }
    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
pub fn update_menu_state(
    _app_handle: tauri::AppHandle,
    _state: MenuStateUpdate,
) -> Result<(), String> {
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
pub fn trigger_menu_command(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    menu::emit_custom_menu_event(&app_handle, &id)
}

#[cfg(mobile)]
#[tauri::command]
pub fn trigger_menu_command(_app_handle: tauri::AppHandle, _id: String) -> Result<(), String> {
    Err("Native menu commands are not available on mobile".into())
}

#[cfg(desktop)]
fn should_apply_window_min_size_constraints(
    is_windows: bool,
    is_fullscreen: bool,
    is_maximized: bool,
) -> bool {
    !(is_windows && (is_fullscreen || is_maximized))
}

#[cfg(desktop)]
fn should_skip_window_min_size_update(window: &Window) -> Result<bool, String> {
    if !cfg!(target_os = "windows") {
        return Ok(false);
    }

    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;

    Ok(!should_apply_window_min_size_constraints(
        true,
        is_fullscreen,
        is_maximized,
    ))
}

#[cfg(desktop)]
fn apply_window_min_size_update(
    window: &Window,
    min_width: f64,
    min_height: f64,
    grow_to_fit: bool,
) -> Result<(), String> {
    window
        .set_min_size(Some(LogicalSize::new(min_width, min_height)))
        .map_err(|e| e.to_string())?;

    if !grow_to_fit {
        return Ok(());
    }

    let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
    let current_size = window
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale_factor);

    let next_width = current_size.width.max(min_width);
    let next_height = current_size.height.max(min_height);
    if next_width == current_size.width && next_height == current_size.height {
        return Ok(());
    }

    window
        .set_size(LogicalSize::new(next_width, next_height))
        .map_err(|e| e.to_string())
}

#[cfg(desktop)]
#[tauri::command]
pub fn update_current_window_min_size(
    window: Window,
    min_width: f64,
    min_height: f64,
    grow_to_fit: bool,
) -> Result<(), String> {
    if should_skip_window_min_size_update(&window)? {
        return Ok(());
    }

    apply_window_min_size_update(&window, min_width, min_height, grow_to_fit)
}

#[cfg(desktop)]
#[tauri::command]
pub fn perform_current_window_titlebar_double_click(window: Window) -> Result<(), String> {
    let action = resolve_title_bar_double_click_action(read_global_defaults_value);

    apply_title_bar_double_click_action(
        action,
        || window.is_maximized().map_err(|e| e.to_string()),
        || window.maximize().map_err(|e| e.to_string()),
        || window.unmaximize().map_err(|e| e.to_string()),
        || window.minimize().map_err(|e| e.to_string()),
    )
}

#[cfg(mobile)]
#[tauri::command]
pub fn update_current_window_min_size(
    _window: tauri::Window,
    _min_width: f64,
    _min_height: f64,
    _grow_to_fit: bool,
) -> Result<(), String> {
    Ok(())
}

#[cfg(mobile)]
#[tauri::command]
pub fn perform_current_window_titlebar_double_click(_window: tauri::Window) -> Result<(), String> {
    Ok(())
}

// ── Settings & config commands ──────────────────────────────────────────────

#[tauri::command]
pub fn get_build_number(app_handle: tauri::AppHandle) -> String {
    let version = app_handle.package_info().version.to_string();
    parse_build_label(&version)
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
pub fn get_ai_workspace_sessions() -> Result<serde_json::Value, String> {
    crate::settings::get_ai_workspace_sessions()
}

#[tauri::command]
pub fn save_ai_workspace_sessions(sessions: serde_json::Value) -> Result<(), String> {
    crate::settings::save_ai_workspace_sessions(sessions)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn check_for_app_update(
    app_handle: tauri::AppHandle,
    release_channel: Option<String>,
) -> Result<Option<crate::app_updater::AppUpdateMetadata>, String> {
    crate::app_updater::check_for_app_update(app_handle, release_channel).await
}

#[cfg(mobile)]
#[tauri::command]
pub async fn check_for_app_update(
    _app_handle: tauri::AppHandle,
    _release_channel: Option<String>,
) -> Result<Option<crate::app_updater::AppUpdateMetadata>, String> {
    Ok(None)
}

#[cfg(desktop)]
#[tauri::command]
pub async fn download_and_install_app_update(
    app_handle: tauri::AppHandle,
    release_channel: Option<String>,
    expected_version: String,
    on_event: Channel<crate::app_updater::AppUpdateDownloadEvent>,
) -> Result<(), String> {
    crate::app_updater::download_and_install_app_update(
        app_handle,
        release_channel,
        expected_version,
        on_event,
    )
    .await
}

#[cfg(mobile)]
#[tauri::command]
pub async fn download_and_install_app_update(
    _app_handle: tauri::AppHandle,
    _release_channel: Option<String>,
    _expected_version: String,
    _on_event: tauri::ipc::Channel<crate::app_updater::AppUpdateDownloadEvent>,
) -> Result<(), String> {
    Err("App updates are not available on mobile".into())
}

#[tauri::command]
pub fn reinit_telemetry() {
    crate::telemetry::reinit_sentry();
}

#[tauri::command]
pub fn load_vault_list() -> Result<VaultList, String> {
    vault_list::load_vault_list()
}

#[tauri::command]
pub fn save_vault_list(list: VaultList) -> Result<(), String> {
    vault_list::save_vault_list(&list)
}

#[cfg(test)]
#[path = "system_tests.rs"]
mod tests;
