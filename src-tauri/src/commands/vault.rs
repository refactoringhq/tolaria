use crate::frontmatter::FrontmatterValue;
use crate::search::SearchResponse;
use crate::vault::{DetectedRename, FolderNode, RenameResult, VaultEntry};
use crate::{frontmatter, git, search, vault};

use super::expand_tilde;

// ── Vault commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path);
    vault::scan_vault_cached(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn list_vault_folders(path: String) -> Result<Vec<FolderNode>, String> {
    let path = expand_tilde(&path);
    vault::scan_vault_folders(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn get_note_content(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::get_note_content(std::path::Path::new(path.as_ref()))
}

#[tauri::command]
pub fn save_note_content(path: String, content: String) -> Result<(), String> {
    let path = expand_tilde(&path);
    vault::save_note_content(&path, &content)
}

#[tauri::command]
pub fn rename_note(
    vault_path: String,
    old_path: String,
    new_title: String,
    old_title: Option<String>,
) -> Result<RenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    let old_path = expand_tilde(&old_path);
    vault::rename_note(&vault_path, &old_path, &new_title, old_title.as_deref())
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

#[tauri::command]
pub fn purge_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::purge_trash(&vault_path)
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    vault::delete_note(&path)
}

#[tauri::command]
pub fn batch_delete_notes(paths: Vec<String>) -> Result<Vec<String>, String> {
    let expanded: Vec<String> = paths.iter().map(|p| expand_tilde(p).into_owned()).collect();
    vault::batch_delete_notes(&expanded)
}

#[tauri::command]
pub fn empty_trash(vault_path: String) -> Result<Vec<String>, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::empty_trash(&vault_path)
}

#[tauri::command]
pub fn migrate_is_a_to_type(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)
}

#[tauri::command]
pub fn flatten_vault(vault_path: String) -> Result<usize, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::flatten_vault(&vault_path)
}

#[tauri::command]
pub fn vault_health_check(vault_path: String) -> Result<vault::VaultHealthReport, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::vault_health_check(&vault_path)
}

#[tauri::command]
pub fn create_getting_started_vault(target_path: Option<String>) -> Result<String, String> {
    let path = match target_path {
        Some(p) if !p.is_empty() => expand_tilde(&p).into_owned(),
        _ => vault::default_vault_path()?.to_string_lossy().to_string(),
    };
    vault::create_getting_started_vault(&path)
}

#[tauri::command]
pub fn check_vault_exists(path: String) -> bool {
    let path = expand_tilde(&path);
    vault::vault_exists(&path)
}

#[tauri::command]
pub fn get_default_vault_path() -> Result<String, String> {
    vault::default_vault_path().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn reload_vault(path: String) -> Result<Vec<VaultEntry>, String> {
    let path = expand_tilde(&path).into_owned();
    tokio::task::spawn_blocking(move || {
        vault::invalidate_cache(std::path::Path::new(&path));
        vault::scan_vault_cached(std::path::Path::new(&path))
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))?
}

#[tauri::command]
pub fn reload_vault_entry(path: String) -> Result<VaultEntry, String> {
    let path = expand_tilde(&path);
    vault::reload_entry(std::path::Path::new(path.as_ref()))
}

/// Sync the `title` frontmatter field with the filename on note open.
/// Returns `true` if the file was modified (title was absent or desynced).
#[tauri::command]
pub fn sync_note_title(path: String) -> Result<bool, String> {
    use vault::SyncAction;
    let path = expand_tilde(&path);
    let action = vault::sync_title_on_open(std::path::Path::new(path.as_ref()))?;
    Ok(matches!(action, SyncAction::Updated { .. }))
}

#[tauri::command]
pub fn save_image(vault_path: String, filename: String, data: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::save_image(&vault_path, &filename, &data)
}

#[tauri::command]
pub fn copy_image_to_vault(vault_path: String, source_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::copy_image_to_vault(&vault_path, &source_path)
}

// ── Frontmatter commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn update_frontmatter(
    path: String,
    key: String,
    value: FrontmatterValue,
) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::update_frontmatter(&path, &key, value)
}

#[tauri::command]
pub fn delete_frontmatter_property(path: String, key: String) -> Result<String, String> {
    let path = expand_tilde(&path);
    frontmatter::delete_frontmatter_property(&path, &key)
}

#[tauri::command]
pub fn batch_archive_notes(paths: Vec<String>) -> Result<usize, String> {
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Archived", FrontmatterValue::Bool(true))?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn batch_trash_notes(paths: Vec<String>) -> Result<usize, String> {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let mut count = 0;
    for path in &paths {
        let path = expand_tilde(path);
        frontmatter::update_frontmatter(&path, "Trashed", FrontmatterValue::Bool(true))?;
        frontmatter::update_frontmatter(
            &path,
            "Trashed at",
            FrontmatterValue::String(now.clone()),
        )?;
        count += 1;
    }
    Ok(count)
}

// ── Search commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_vault(
    vault_path: String,
    query: String,
    mode: String,
    limit: Option<usize>,
) -> Result<SearchResponse, String> {
    let vault_path = expand_tilde(&vault_path).into_owned();
    let limit = limit.unwrap_or(20);
    tokio::task::spawn_blocking(move || search::search_vault(&vault_path, &query, &mode, limit))
        .await
        .map_err(|e| format!("Search task failed: {}", e))?
}

// ── Repair command ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn repair_vault(vault_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::migrate_is_a_to_type(&vault_path)?;
    vault::flatten_vault(&vault_path)?;
    vault::repair_config_files(&vault_path)?;
    git::ensure_gitignore(&vault_path)?;
    Ok("Vault repaired".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_note(body: &str) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("note.md");
        std::fs::write(&note, body).unwrap();
        (dir, note)
    }

    #[test]
    fn test_batch_archive_notes() {
        let (_dir, note) = temp_note("---\nStatus: Active\n---\n# Note\n");
        assert_eq!(
            batch_archive_notes(vec![note.to_str().unwrap().to_string()]).unwrap(),
            1
        );
        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Archived: true"));
        assert!(content.contains("Status: Active"));
    }

    #[test]
    fn test_batch_trash_notes() {
        let (_dir, note) = temp_note("---\nStatus: Active\n---\n# Note\n");
        assert_eq!(
            batch_trash_notes(vec![note.to_str().unwrap().to_string()]).unwrap(),
            1
        );
        let content = std::fs::read_to_string(&note).unwrap();
        assert!(content.contains("Trashed: true"));
        assert!(content.contains("Trashed at"));
    }

    #[test]
    fn test_reload_vault_entry_reads_from_disk() {
        let dir = tempfile::TempDir::new().unwrap();
        let note = dir.path().join("test.md");
        std::fs::write(&note, "---\ntitle: Test\nStatus: Active\n---\n# Test\n").unwrap();

        let entry = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(entry.title, "Test");
        assert_eq!(entry.status, Some("Active".to_string()));

        // Modify file on disk
        std::fs::write(&note, "---\ntitle: Test\nStatus: Done\n---\n# Test\n").unwrap();
        let fresh = reload_vault_entry(note.to_str().unwrap().to_string()).unwrap();
        assert_eq!(fresh.status, Some("Done".to_string()));
    }

    #[test]
    fn test_reload_vault_entry_nonexistent() {
        let result = reload_vault_entry("/nonexistent/path.md".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_reload_vault_invalidates_cache_and_rescans() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        std::process::Command::new("git")
            .args(["init"])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "t@t.com"])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "T"])
            .current_dir(vault_path)
            .output()
            .unwrap();

        let cache_dir = tempfile::TempDir::new().unwrap();
        std::env::set_var(
            "LAPUTA_CACHE_DIR",
            cache_dir.path().to_string_lossy().as_ref(),
        );

        std::fs::write(
            vault_path.join("note.md"),
            "---\nTrashed: false\n---\n# Note\n",
        )
        .unwrap();
        std::process::Command::new("git")
            .args(["add", "."])
            .current_dir(vault_path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(vault_path)
            .output()
            .unwrap();

        let entries = list_vault(vault_path.to_str().unwrap().to_string()).unwrap();
        assert!(!entries[0].trashed);

        std::fs::write(
            vault_path.join("note.md"),
            "---\nTrashed: true\n---\n# Note\n",
        )
        .unwrap();

        let vp_str = vault_path.to_str().unwrap();
        crate::vault::invalidate_cache(std::path::Path::new(vp_str));
        let fresh = crate::vault::scan_vault_cached(std::path::Path::new(vp_str)).unwrap();
        assert!(
            fresh[0].trashed,
            "reload_vault must reflect disk state after trashing"
        );
    }

    #[test]
    fn test_check_vault_exists_false() {
        assert!(!check_vault_exists("/nonexistent/path/abc123".to_string()));
    }

    #[test]
    fn test_get_default_vault_path_returns_ok() {
        let result = get_default_vault_path();
        assert!(result.is_ok());
    }

    #[test]
    fn test_repair_vault_flattens_type_folders() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();
        let note_dir = vault_path.join("note");
        std::fs::create_dir_all(&note_dir).unwrap();
        std::fs::write(note_dir.join("hello.md"), "---\nis_a: Note\n---\n# Hello\n").unwrap();

        let result = repair_vault(vault_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        assert!(vault_path.join("hello.md").exists());
        assert!(!note_dir.join("hello.md").exists());
        let content = std::fs::read_to_string(vault_path.join("hello.md")).unwrap();
        assert!(content.contains("type: Note"));
        assert!(!content.contains("is_a:"));
    }

    #[test]
    fn test_repair_vault_creates_config_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path();

        let result = repair_vault(vault_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        assert!(vault_path.join("AGENTS.md").exists());
        assert!(vault_path.join("config.md").exists());
        assert!(vault_path.join(".gitignore").exists());
    }
}
