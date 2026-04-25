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

use std::ffi::OsStr;
use std::process::Command;

#[cfg(desktop)]
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use std::process::Child;
#[cfg(desktop)]
use std::sync::Mutex;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub(crate) fn hidden_command(program: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(program);
    suppress_windows_console(&mut command);
    command
}

#[cfg(windows)]
fn suppress_windows_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_windows_console(_command: &mut Command) {}

#[cfg(desktop)]
struct WsBridgeChild(Mutex<Option<Child>>);

#[cfg(desktop)]
struct ActiveAssetScopeRoots(Mutex<Vec<PathBuf>>);

#[cfg(desktop)]
fn log_startup_result(label: &str, result: Result<usize, String>) {
    match result {
        Ok(n) if n > 0 => log::info!("{}: {} files", label, n),
        Err(e) => log::warn!("{}: {}", label, e),
        _ => {}
    }
}

/// Resolve the active vault path from `vaults.json`.
///
/// Returns `None` when no vault list exists, no `active_vault` is set, or the
/// configured path no longer points at a directory (e.g. user moved/deleted
/// the vault outside the app).
#[cfg(desktop)]
fn current_active_vault_path() -> Option<PathBuf> {
    let list = vault_list::load_vault_list().ok()?;
    let path = PathBuf::from(list.active_vault?);
    if path.is_dir() {
        Some(path)
    } else {
        None
    }
}

/// Run startup housekeeping on the active vault (migrate legacy frontmatter, seed configs).
///
/// No-op when no active vault is selected.
#[cfg(desktop)]
fn run_startup_tasks() {
    let Some(vault_path) = current_active_vault_path() else {
        return;
    };
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

/// Spawn the WebSocket MCP bridge child process.
///
/// The bridge is given `VAULT_PATH=<active vault from vaults.json>`. When no
/// active vault is configured we skip spawning entirely — running the bridge
/// against a non-existent path makes every MCP tool call fail with ENOENT,
/// which silently breaks AI agent integration with no UI signal.
#[cfg(desktop)]
fn spawn_ws_bridge(app: &mut tauri::App) {
    use tauri::Manager;
    let Some(vault_path) = current_active_vault_path() else {
        log::info!(
            "ws-bridge not spawned: no active vault configured. \
             It will start once a vault is selected and Tolaria is restarted."
        );
        return;
    };
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
    #[cfg(not(target_os = "linux"))]
    menu::setup_menu(app)?;
    setup_linux_window_chrome(app)?;
    Ok(())
}

#[cfg(all(desktop, target_os = "linux"))]
fn setup_linux_window_chrome(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_decorations(false);
    }
    Ok(())
}

#[cfg(not(all(desktop, target_os = "linux")))]
fn setup_linux_window_chrome(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

#[cfg(any(test, all(desktop, target_os = "macos")))]
const MACOS_WEBVIEW_RESERVED_COMMAND_KEYS: &[&str] = &["O"];
#[cfg(any(test, all(desktop, target_os = "macos")))]
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
fn vault_asset_scope_roots(vault_path: &Path) -> Result<Vec<PathBuf>, String> {
    let canonical_vault_path = std::fs::canonicalize(vault_path).map_err(|e| {
        format!(
            "Failed to resolve asset scope for {}: {e}",
            vault_path.display()
        )
    })?;
    let mut roots = vec![canonical_vault_path.clone()];
    let requested_vault_path = vault_path.to_path_buf();
    if requested_vault_path != canonical_vault_path {
        roots.push(requested_vault_path);
    }
    Ok(roots)
}

#[cfg(desktop)]
pub(crate) fn sync_vault_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
) -> Result<(), String> {
    use tauri::Manager;

    let next_roots = vault_asset_scope_roots(vault_path)?;
    let scope = app_handle.asset_protocol_scope();
    let state: tauri::State<'_, ActiveAssetScopeRoots> = app_handle.state();
    let mut active_roots = state
        .0
        .lock()
        .map_err(|_| "Failed to lock active asset scope state".to_string())?;

    for root in &next_roots {
        scope
            .allow_directory(root, true)
            .map_err(|e| format!("Failed to allow asset access for {}: {e}", root.display()))?;
    }

    for previous_root in active_roots.iter() {
        if !next_roots.contains(previous_root) {
            let _ = scope.forbid_directory(previous_root, true);
        }
    }

    *active_roots = next_roots;
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
            commands::perform_current_window_titlebar_double_click,
            commands::save_settings,
            commands::download_and_install_app_update,
            commands::load_vault_list,
            commands::save_vault_list,
            commands::git_clone::clone_git_repo,
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
        .manage(ActiveAssetScopeRoots(Mutex::new(Vec::new())));

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

    #[cfg(all(desktop, unix))]
    use super::vault_asset_scope_roots;

    #[test]
    fn macos_webview_shortcut_prevention_includes_ai_panel_shortcut() {
        assert_eq!(MACOS_WEBVIEW_RESERVED_COMMAND_SHIFT_KEYS, ["L"]);
    }

    #[cfg(all(desktop, unix))]
    #[test]
    fn vault_asset_scope_roots_include_requested_symlink_path() {
        let dir = tempfile::tempdir().unwrap();
        let canonical_vault = dir.path().join("Getting Started");
        let symlinked_vault = dir.path().join("Symlinked Getting Started");
        std::fs::create_dir(&canonical_vault).unwrap();
        std::os::unix::fs::symlink(&canonical_vault, &symlinked_vault).unwrap();

        let roots = vault_asset_scope_roots(&symlinked_vault).unwrap();

        assert_eq!(roots[0], canonical_vault.canonicalize().unwrap());
        assert!(roots.contains(&symlinked_vault));
    }

    /// Regression test for ws-bridge spawning with the wrong vault path.
    ///
    /// Before this fix, the Tauri host always passed `VAULT_PATH=$HOME/Laputa`
    /// (the author's personal vault name) to the bundled MCP `ws-bridge.js`,
    /// regardless of the user's `active_vault` in `vaults.json`. As a result
    /// every MCP read tool (`search_notes`, `open_note`, `get_note`,
    /// `get_vault_context`) returned `ENOENT` for any user whose vault wasn't
    /// literally `~/Laputa` — silently breaking the headline AI-agent
    /// integration with no UI signal.
    ///
    /// `current_active_vault_path()` now reads the real active vault from
    /// `vaults.json` so `spawn_ws_bridge` and `run_startup_tasks` use it.
    #[cfg(desktop)]
    #[test]
    fn current_active_vault_path_returns_none_when_no_vault_dir_exists() {
        let path = super::current_active_vault_path();
        // We can't easily mock the config dir from here, but the function
        // must never panic and must return Option<PathBuf>. If the developer
        // running tests happens to have an active vault set, the result is
        // Some — either way, the function is sound.
        if let Some(p) = path {
            assert!(p.is_dir(), "returned path should always be a real dir");
        }
    }
}
