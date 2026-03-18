pub mod ai_chat;
pub mod claude_cli;
mod commands;
pub mod frontmatter;
pub mod git;
pub mod github;
pub mod indexing;
pub mod mcp;
pub mod menu;
pub mod search;
pub mod settings;
pub mod theme;
pub mod vault;
pub mod vault_config;
pub mod vault_list;

use std::process::Child;
use std::sync::Mutex;

struct WsBridgeChild(Mutex<Option<Child>>);

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
    log_startup_result(
        "Migrated hidden_sections to visible property",
        vault_config::migrate_hidden_sections_to_visible(vp_str),
    );

    // Remove legacy _themes/ directory (JSON theme store) if only defaults remain
    theme::migrate_legacy_themes_dir(vp_str);
    // Migrate legacy theme/ directory notes to root (flat structure)
    theme::migrate_theme_dir_to_root(vp_str);
    // Seed vault theme notes at root (flat structure) if missing
    theme::seed_vault_themes(vp_str);
    // Seed theme.md type definition so the Theme type has an icon in the sidebar
    let _ = theme::ensure_theme_type_definition(vp_str);

    // Migrate legacy config/agents.md → root AGENTS.md (one-time, idempotent)
    vault::migrate_agents_md(vp_str);
    // Seed AGENTS.md and config.md at vault root if missing
    vault::seed_config_files(vp_str);

    // Register Laputa MCP server in Claude Code and Cursor configs
    match mcp::register_mcp(vp_str) {
        Ok(status) => log::info!("MCP registration: {status}"),
        Err(e) => log::warn!("MCP registration failed: {e}"),
    }
}

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
            spawn_ws_bridge(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_vault,
            commands::get_note_content,
            commands::save_note_content,
            commands::update_frontmatter,
            commands::delete_frontmatter_property,
            commands::rename_note,
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
            commands::get_conflict_files,
            commands::get_conflict_mode,
            commands::git_resolve_conflict,
            commands::git_commit_conflict_resolution,
            commands::ai_chat,
            commands::check_claude_cli,
            commands::stream_claude_chat,
            commands::stream_claude_agent,
            commands::reload_vault,
            commands::reload_vault_entry,
            commands::sync_note_title,
            commands::save_image,
            commands::copy_image_to_vault,
            commands::purge_trash,
            commands::delete_note,
            commands::batch_delete_notes,
            commands::empty_trash,
            commands::migrate_is_a_to_type,
            commands::flatten_vault,
            commands::vault_health_check,
            commands::batch_archive_notes,
            commands::batch_trash_notes,
            commands::get_settings,
            commands::update_menu_state,
            commands::save_settings,
            commands::load_vault_list,
            commands::save_vault_list,
            commands::github_list_repos,
            commands::github_create_repo,
            commands::clone_repo,
            commands::github_device_flow_start,
            commands::github_device_flow_poll,
            commands::github_get_user,
            commands::search_vault,
            commands::get_index_status,
            commands::start_indexing,
            commands::trigger_incremental_index,
            commands::create_getting_started_vault,
            commands::check_vault_exists,
            commands::get_default_vault_path,
            commands::register_mcp_tools,
            commands::check_mcp_status,
            commands::list_themes,
            commands::get_theme,
            commands::get_vault_settings,
            commands::save_vault_settings,
            commands::set_active_theme,
            commands::create_theme,
            commands::create_vault_theme,
            commands::ensure_vault_themes,
            commands::restore_default_themes,
            commands::repair_vault,
            commands::get_vault_config,
            commands::save_vault_config
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
