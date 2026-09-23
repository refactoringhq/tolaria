use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::Mutex;

pub(crate) struct WsBridgeChild(pub(crate) Mutex<Option<Child>>);

fn log_startup_result(label: &str, result: Result<usize, String>) {
    match result {
        Ok(count) if count > 0 => log::info!("{}: {} files", label, count),
        Err(error) => log::warn!("{}: {}", label, error),
        _ => {}
    }
}

pub(crate) fn selected_mcp_bridge_vault_paths(
    vault_list: &crate::vault_list::VaultList,
) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(active_vault) = vault_list
        .active_vault
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
    {
        push_unique_mcp_bridge_vault_path(&mut paths, active_vault);
    }

    for vault in &vault_list.vaults {
        if vault.mounted == Some(false) {
            continue;
        }
        push_unique_mcp_bridge_vault_path(&mut paths, &vault.path);
    }

    paths
}

fn push_unique_mcp_bridge_vault_path(paths: &mut Vec<PathBuf>, path: &str) {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return;
    }
    let path = PathBuf::from(trimmed);
    if paths.iter().any(|existing| existing == &path) {
        return;
    }
    paths.push(path);
}

pub(crate) fn validate_mcp_bridge_vault_path(vault_path: &Path) -> Result<PathBuf, String> {
    let resolved = std::fs::canonicalize(vault_path).map_err(|error| {
        format!(
            "MCP bridge vault is not available: {} ({error})",
            vault_path.display()
        )
    })?;

    if !resolved.is_dir() {
        return Err(format!(
            "MCP bridge vault is not available: {} is not a directory",
            vault_path.display()
        ));
    }

    Ok(resolved)
}

pub(crate) fn stop_ws_bridge_child(active_child: &mut Option<Child>) {
    if let Some(mut child) = active_child.take() {
        let _ = child.kill();
        let _ = child.wait();
        log::info!("ws-bridge child process stopped");
    }
}

pub(crate) fn stop_ws_bridge_on_exit(state: &WsBridgeChild) {
    let mut active_child = match state.0.lock() {
        Ok(active_child) => active_child,
        Err(poisoned) => {
            log::warn!("Recovered poisoned ws-bridge state during app exit");
            poisoned.into_inner()
        }
    };
    stop_ws_bridge_child(&mut active_child);
}

pub(crate) fn sync_ws_bridge_for_vault(
    app_handle: &tauri::AppHandle,
    vault_path: Option<&Path>,
    active_vault_paths: &[PathBuf],
) -> Result<&'static str, String> {
    use tauri::Manager;

    let state: tauri::State<'_, WsBridgeChild> = app_handle.state();
    let mut active_child = state
        .0
        .lock()
        .map_err(|_| "Failed to lock ws-bridge state".to_string())?;

    let Some(vault_path) = vault_path else {
        stop_ws_bridge_child(&mut active_child);
        return Ok("stopped");
    };

    let resolved_vault_path = match validate_mcp_bridge_vault_path(vault_path) {
        Ok(path) => path,
        Err(error) => {
            stop_ws_bridge_child(&mut active_child);
            return Err(error);
        }
    };

    stop_ws_bridge_child(&mut active_child);

    let resolved_active_vault_paths = active_vault_paths
        .iter()
        .filter_map(|path| validate_mcp_bridge_vault_path(path).ok())
        .collect::<Vec<_>>();
    let child =
        crate::mcp::spawn_ws_bridge_with_paths(&resolved_vault_path, &resolved_active_vault_paths)?;

    *active_child = Some(child);
    Ok("started")
}

fn spawn_background_task<F>(thread_name: &'static str, task: F)
where
    F: FnOnce() + Send + 'static,
{
    if let Err(error) = std::thread::Builder::new()
        .name(thread_name.into())
        .spawn(task)
    {
        log::warn!("Failed to start {thread_name}: {error}");
    }
}

fn run_startup_tasks_for_vault(vault_path: &Path) {
    let vault_path_string = vault_path.to_str().unwrap_or_default();
    log_startup_result(
        "Migrated is_a to type on startup",
        crate::vault::migrate_is_a_to_type(vault_path_string),
    );
    crate::vault::migrate_agents_md(vault_path_string);
    crate::vault::seed_config_files(vault_path_string);
}

pub(crate) fn spawn_startup_tasks_for_vault_with<F>(vault_path: PathBuf, task: F) -> bool
where
    F: FnOnce(PathBuf) + Send + 'static,
{
    if !vault_path.is_dir() {
        return false;
    }

    spawn_background_task("tolaria-startup-tasks", move || task(vault_path));
    true
}

pub(crate) fn spawn_startup_tasks() {
    let Some(vault_path) = dirs::home_dir().map(|home| home.join("Laputa")) else {
        return;
    };
    spawn_startup_tasks_for_vault_with(vault_path, |path| run_startup_tasks_for_vault(&path));
}

fn sync_ws_bridge_for_selected_vault(app_handle: &tauri::AppHandle) {
    let vault_paths = match crate::vault_list::load_vault_list() {
        Ok(vault_list) => selected_mcp_bridge_vault_paths(&vault_list),
        Err(error) => {
            log::warn!("Failed to load active vault for ws-bridge startup: {error}");
            Vec::new()
        }
    };

    let Some(vault_path) = vault_paths.first() else {
        log::info!("ws-bridge not started: no active vault selected");
        return;
    };

    if let Err(error) = sync_ws_bridge_for_vault(app_handle, Some(vault_path), &vault_paths) {
        log::warn!("Failed to start ws-bridge: {error}");
    }
}

pub(crate) fn spawn_initial_ws_bridge_sync(app: &tauri::App) {
    let app_handle = app.handle().clone();
    spawn_background_task("tolaria-ws-bridge-startup", move || {
        #[cfg(target_os = "linux")]
        if crate::linux_appimage::is_running() {
            let app_version = app_handle.package_info().version.to_string();
            if let Err(error) = crate::mcp::extract_mcp_server_to_stable_dir(&app_version) {
                log::warn!("Failed to extract MCP server to stable path: {error}");
            }
        }

        sync_ws_bridge_for_selected_vault(&app_handle);
    });
}

#[cfg(test)]
mod tests {
    use super::{stop_ws_bridge_on_exit, WsBridgeChild};
    use std::panic::{catch_unwind, AssertUnwindSafe};
    use std::sync::Mutex;

    #[test]
    fn exit_cleanup_recovers_a_poisoned_bridge_lock() {
        let state = WsBridgeChild(Mutex::new(None));
        let panic = catch_unwind(AssertUnwindSafe(|| {
            let _guard = state.0.lock().unwrap();
            panic!("poison bridge state");
        }));

        assert!(panic.is_err());
        assert!(state.0.is_poisoned());
        stop_ws_bridge_on_exit(&state);
    }
}
