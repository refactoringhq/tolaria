use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEvent, Debouncer};
use serde::Serialize;
use tauri::Emitter;

const DEBOUNCE_MS: u64 = 500;
pub const VAULT_CHANGED_EVENT: &str = "vault-changed";

type WatcherDebouncer = Debouncer<notify::RecommendedWatcher>;

pub struct VaultWatcherState {
    inner: Mutex<Option<ActiveWatcher>>,
}

struct ActiveWatcher {
    path: PathBuf,
    _debouncer: WatcherDebouncer,
}

impl VaultWatcherState {
    pub fn new() -> Self {
        Self { inner: Mutex::new(None) }
    }
}

impl Default for VaultWatcherState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize, Clone)]
pub struct VaultChangedPayload {
    pub vault_path: String,
    pub paths: Vec<String>,
}

fn is_relevant_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();

    if path_str.contains("/.git/") || path_str.ends_with("/.git") {
        return false;
    }
    if path_str.contains("/node_modules/") {
        return false;
    }

    let Some(name_os) = path.file_name() else { return false; };
    let name = name_os.to_string_lossy();

    if name.starts_with('.') && (name.ends_with(".swp") || name.ends_with(".swo") || name == ".DS_Store") {
        return false;
    }
    if name.ends_with('~') || name.ends_with(".tmp") {
        return false;
    }
    if name.starts_with(".#") {
        return false;
    }

    true
}

fn filter_events(events: Vec<DebouncedEvent>) -> Vec<String> {
    events
        .into_iter()
        .filter(|event| is_relevant_path(&event.path))
        .map(|event| event.path.to_string_lossy().into_owned())
        .collect()
}

#[tauri::command]
pub fn start_vault_watcher(
    path: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, VaultWatcherState>,
) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if !target.is_dir() {
        return Err(format!("Vault path is not a directory: {path}"));
    }

    let mut guard = state.inner.lock().map_err(|err| format!("Watcher state poisoned: {err}"))?;
    if let Some(active) = guard.as_ref() {
        if active.path == target {
            return Ok(());
        }
    }
    *guard = None;

    let emit_path = path.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(DEBOUNCE_MS), move |result| {
        match result {
            Ok(events) => {
                let relevant = filter_events(events);
                if relevant.is_empty() {
                    return;
                }
                let payload = VaultChangedPayload { vault_path: emit_path.clone(), paths: relevant };
                if let Err(err) = app_handle.emit(VAULT_CHANGED_EVENT, &payload) {
                    log::warn!("Failed to emit {VAULT_CHANGED_EVENT}: {err}");
                }
            }
            Err(err) => log::warn!("Vault watcher error: {err}"),
        }
    })
    .map_err(|err| format!("Failed to create watcher: {err}"))?;

    debouncer
        .watcher()
        .watch(&target, RecursiveMode::Recursive)
        .map_err(|err| format!("Failed to watch vault: {err}"))?;

    *guard = Some(ActiveWatcher { path: target, _debouncer: debouncer });
    Ok(())
}

#[tauri::command]
pub fn stop_vault_watcher(state: tauri::State<'_, VaultWatcherState>) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|err| format!("Watcher state poisoned: {err}"))?;
    *guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignores_git_dirs() {
        assert!(!is_relevant_path(Path::new("/vault/.git/HEAD")));
        assert!(!is_relevant_path(Path::new("/vault/.git")));
    }

    #[test]
    fn ignores_node_modules() {
        assert!(!is_relevant_path(Path::new("/vault/node_modules/foo/index.js")));
    }

    #[test]
    fn ignores_temp_files() {
        assert!(!is_relevant_path(Path::new("/vault/.foo.swp")));
        assert!(!is_relevant_path(Path::new("/vault/.foo.swo")));
        assert!(!is_relevant_path(Path::new("/vault/.DS_Store")));
        assert!(!is_relevant_path(Path::new("/vault/foo.md~")));
        assert!(!is_relevant_path(Path::new("/vault/foo.tmp")));
        assert!(!is_relevant_path(Path::new("/vault/.#foo")));
    }

    #[test]
    fn keeps_markdown_notes() {
        assert!(is_relevant_path(Path::new("/vault/notes/foo.md")));
        assert!(is_relevant_path(Path::new("/vault/projects/bar.md")));
    }
}
