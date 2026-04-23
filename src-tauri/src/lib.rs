pub mod ai_agents;
pub mod app_updater;
pub mod claude_cli;
mod commands;
pub mod frontmatter;
pub mod git;
pub mod mcp;
#[cfg(desktop)]
pub mod menu;
pub mod search;
pub mod settings;
pub mod telemetry;
pub mod vault;
pub mod vault_list;

#[cfg(desktop)]
use std::path::Path;
#[cfg(desktop)]
use std::process::Child;
#[cfg(desktop)]
use std::sync::Mutex;

#[cfg(desktop)]
struct WsBridgeChild(Mutex<Option<Child>>);

#[cfg(desktop)]
struct ActiveAssetScopeRoot(Mutex<Option<std::path::PathBuf>>);

#[cfg(desktop)]
fn log_startup_result(label: &str, result: Result<usize, String>) {
    match result {
        Ok(n) if n > 0 => log::info!("{}: {} files", label, n),
        Err(e) => log::warn!("{}: {}", label, e),
        _ => {}
    }
}

/// Run startup housekeeping on the default vault (migrate legacy frontmatter, seed configs).
#[cfg(desktop)]
fn run_startup_tasks() {
    let vault_path = dirs::home_dir()
        .map(|h| h.join("Laputa"))
        .unwrap_or_default();
    if !vault_path.is_dir() {
        return;
    }
    let vp_str = vault_path.to_str().unwrap_or_default();
    log_startup_result(
        "Migrated is_a to type on startup",
        vault::migrate_is_a_to_type(vp_str),
    );
    // Migrate legacy config/agents.md → root AGENTS.md (one-time, idempotent)
    vault::migrate_agents_md(vp_str);
    // Seed AGENTS.md and starter type definitions at vault root if missing
    vault::seed_config_files(vp_str);
}

#[cfg(desktop)]
fn spawn_ws_bridge(app: &mut tauri::App) {
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

fn setup_common_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )?;
    }

    app.handle().plugin(tauri_plugin_dialog::init())?;
    Ok(())
}

#[cfg(desktop)]
fn setup_desktop_plugins(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_macos_webview_shortcut_prevention(app)?;
    app.handle()
        .plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
    app.handle().plugin(tauri_plugin_opener::init())?;
    menu::setup_menu(app)?;
    Ok(())
}

const MACOS_WEBVIEW_RESERVED_COMMAND_KEYS: &[&str] = &["O"];
const MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS: &[&str] = &["L"];

#[cfg(all(desktop, target_os = "macos"))]
fn setup_macos_webview_shortcut_prevention(
    app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_prevent_default::ModifierKey::{MetaKey, ShiftKey};
    use tauri_plugin_prevent_default::{Flags, KeyboardShortcut};

    let mut builder = tauri_plugin_prevent_default::Builder::new().with_flags(Flags::empty());

    // WKWebView can swallow some browser-reserved chords before our shared
    // renderer shortcut handler sees them. Keep this list narrow and verify
    // every addition with native QA.
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey]));
    }
    for key in MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS {
        builder = builder.shortcut(KeyboardShortcut::with_modifiers(key, &[MetaKey, ShiftKey]));
    }

    app.handle().plugin(builder.build())?;
    Ok(())
}

#[cfg(not(all(desktop, target_os = "macos")))]
fn setup_macos_webview_shortcut_prevention(
    _app: &mut tauri::App,
) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    setup_common_plugins(app)?;

    #[cfg(desktop)]
    setup_desktop_plugins(app)?;

    if telemetry::init_sentry_from_settings() {
        log::info!("Sentry initialized (crash reporting enabled)");
    }

    #[cfg(desktop)]
    {
        run_startup_tasks();
        spawn_ws_bridge(app);
    }

    Ok(())
}

#[cfg(desktop)]
pub(crate) fn sync_vault_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
) -> Result<(), String> {
    use tauri::Manager;

    let canonical_vault_path = std::fs::canonicalize(vault_path).map_err(|e| {
        format!(
            "Failed to resolve asset scope for {}: {e}",
            vault_path.display()
        )
    })?;
    let scope = app_handle.asset_protocol_scope();
    let state: tauri::State<'_, ActiveAssetScopeRoot> = app_handle.state();
    let mut active_root = state
        .0
        .lock()
        .map_err(|_| "Failed to lock active asset scope state".to_string())?;

    if active_root.as_ref() == Some(&canonical_vault_path) {
        return Ok(());
    }

    scope
        .allow_directory(&canonical_vault_path, true)
        .map_err(|e| {
            format!(
                "Failed to allow asset access for {}: {e}",
                canonical_vault_path.display()
            )
        })?;

    if let Some(previous_root) = active_root.as_ref() {
        if previous_root != &canonical_vault_path {
            let _ = scope.forbid_directory(previous_root, true);
        }
    }

    *active_root = Some(canonical_vault_path);
    Ok(())
}

macro_rules! app_invoke_handler {
    () => {
        tauri::generate_handler![
            commands::list_vault,
            commands::list_vault_folders,
            commands::get_note_content,
            commands::create_note_content,
            commands::save_note_content,
            commands::update_frontmatter,
            commands::delete_frontmatter_property,
            commands::rename_note,
            commands::rename_note_filename,
            commands::move_note_to_folder,
            commands::auto_rename_untitled,
            commands::detect_renames,
            commands::update_wikilinks_for_renames,
            commands::get_file_history,
            commands::get_modified_files,
            commands::get_file_diff,
            commands::get_file_diff_at_commit,
            commands::get_vault_pulse,
            commands::git_commit,
            commands::get_build_number,
            commands::get_last_commit_info,
            commands::git_pull,
            commands::git_push,
            commands::git_remote_status,
            commands::git_add_remote,
            commands::get_conflict_files,
            commands::get_conflict_mode,
            commands::git_resolve_conflict,
            commands::git_commit_conflict_resolution,
            commands::git_discard_file,
            commands::is_git_repo,
            commands::init_git_repo,
            commands::check_claude_cli,
            commands::get_ai_agents_status,
            commands::get_vault_ai_guidance_status,
            commands::restore_vault_ai_guidance,
            commands::stream_claude_chat,
            commands::stream_claude_agent,
            commands::stream_ai_agent,
            commands::reload_vault,
            commands::reload_vault_entry,
            commands::sync_note_title,
            commands::save_image,
            commands::copy_image_to_vault,
            commands::delete_note,
            commands::batch_delete_notes,
            commands::batch_delete_notes_async,
            commands::migrate_is_a_to_type,
            commands::create_vault_folder,
            commands::rename_vault_folder,
            commands::delete_vault_folder,
            commands::batch_archive_notes,
            commands::get_settings,
            commands::check_for_app_update,
            commands::update_menu_state,
            commands::trigger_menu_command,
            commands::update_current_window_min_size,
            commands::save_settings,
            commands::download_and_install_app_update,
            commands::load_vault_list,
            commands::save_vault_list,
            commands::clone_repo,
            commands::search_vault,
            commands::create_empty_vault,
            commands::create_getting_started_vault,
            commands::check_vault_exists,
            commands::get_default_vault_path,
            commands::register_mcp_tools,
            commands::remove_mcp_tools,
            commands::check_mcp_status,
            commands::repair_vault,
            commands::reinit_telemetry,
            commands::list_views,
            commands::save_view_cmd,
            commands::delete_view_cmd
        ]
    };
}

fn with_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(app_invoke_handler!())
}

#[cfg(desktop)]
fn handle_run_event(app_handle: &tauri::AppHandle, event: &tauri::RunEvent) {
    use tauri::Manager;

    if let tauri::RunEvent::Exit = event {
        let state: tauri::State<'_, WsBridgeChild> = app_handle.state();
        let mut guard = state.0.lock().unwrap();
        if let Some(ref mut child) = *guard {
            let _ = child.kill();
            log::info!("ws-bridge child process killed on exit");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder
        .manage(WsBridgeChild(Mutex::new(None)))
        .manage(ActiveAssetScopeRoot(Mutex::new(None)));

    with_invoke_handler(builder)
        .setup(setup_app)
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(desktop)]
            handle_run_event(app_handle, &event);
        });
}

#[cfg(test)]
mod tests {
    use super::MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS;

    #[test]
    fn macos_webview_shortcut_prevention_includes_ai_panel_shortcut() {
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS, ["L"]);
    }
}
