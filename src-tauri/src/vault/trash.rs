use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Check if a file path points to a markdown file.
fn is_markdown_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|ext| ext == "md")
}

/// Extract the "Trashed at" date string from parsed gray_matter data.
fn extract_trashed_at_string(data: &Option<gray_matter::Pod>) -> Option<String> {
    let gray_matter::Pod::Hash(ref map) = data.as_ref()? else {
        return None;
    };
    let pod = map.get("Trashed at").or_else(|| map.get("trashed_at"))?;
    match pod {
        gray_matter::Pod::String(s) => Some(s.clone()),
        _ => None,
    }
}

/// Parse a "Trashed at" date string into a NaiveDate. Supports "2026-01-01" and "2026-01-01T..." formats.
fn parse_trashed_date(date_str: &str) -> Option<chrono::NaiveDate> {
    let trimmed = date_str.trim().trim_matches('"');
    let date_part = trimmed.split('T').next().unwrap_or(trimmed);
    chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d").ok()
}

/// Delete a file and log the result. Returns the path string if successful.
fn try_purge_file(path: &Path) -> Option<String> {
    match fs::remove_file(path) {
        Ok(()) => {
            log::info!("Purged trashed file: {}", path.display());
            Some(path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::warn!("Failed to delete {}: {}", path.display(), e);
            None
        }
    }
}

/// Permanently delete a single note file.
/// Returns the deleted path on success, or an error if the file doesn't exist.
pub fn delete_note(path: &str) -> Result<String, String> {
    let file = Path::new(path);
    if !file.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    fs::remove_file(file).map_err(|e| format!("Failed to delete {}: {}", path, e))?;
    log::info!("Permanently deleted note: {}", path);
    Ok(path.to_string())
}

/// Scan all markdown files in the vault and delete those where
/// `Trashed at` frontmatter is more than 30 days ago.
/// Returns the list of deleted file paths.
pub fn purge_trash(vault_path: &str) -> Result<Vec<String>, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let today = chrono::Utc::now().date_naive();
    let matter = Matter::<YAML>::new();
    let max_age_days = 30;

    let deleted: Vec<String> = WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| is_markdown_file(e.path()))
        .filter_map(|entry| {
            let content = fs::read_to_string(entry.path()).ok()?;
            let parsed = matter.parse(&content);
            let date_str = extract_trashed_at_string(&parsed.data)?;
            let trashed_date = parse_trashed_date(&date_str)?;
            let age = today.signed_duration_since(trashed_date);
            if age.num_days() > max_age_days {
                try_purge_file(entry.path())
            } else {
                None
            }
        })
        .collect();

    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_delete_note_removes_file() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "doomed.md",
            "---\ntitle: Doomed\n---\n# Doomed\n",
        );
        let path = dir.path().join("doomed.md");
        assert!(path.exists());
        let result = delete_note(path.to_str().unwrap());
        assert!(result.is_ok());
        assert!(!path.exists());
    }

    #[test]
    fn test_delete_note_nonexistent_file() {
        let result = delete_note("/nonexistent/path/that/does/not/exist.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_purge_trash_deletes_old_trashed_files() {
        let dir = TempDir::new().unwrap();
        // File trashed 60 days ago — should be deleted
        create_test_file(
            dir.path(),
            "old-trash.md",
            "---\nTrashed at: \"2025-01-01\"\n---\n# Old Trash\n",
        );
        // File trashed recently — should be kept
        let recent = chrono::Utc::now()
            .date_naive()
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "recent-trash.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Recent Trash\n", recent),
        );
        // File without trashed_at — should be kept
        create_test_file(
            dir.path(),
            "normal.md",
            "---\nIs A: Note\n---\n# Normal Note\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old-trash.md"));
        // Verify old file is actually gone
        assert!(!dir.path().join("old-trash.md").exists());
        // Verify other files still exist
        assert!(dir.path().join("recent-trash.md").exists());
        assert!(dir.path().join("normal.md").exists());
    }

    #[test]
    fn test_purge_trash_supports_datetime_format() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "datetime-trash.md",
            "---\nTrashed at: \"2025-01-01T10:30:00Z\"\n---\n# Datetime Trash\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("datetime-trash.md"));
    }

    #[test]
    fn test_purge_trash_empty_vault() {
        let dir = TempDir::new().unwrap();
        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
    }

    #[test]
    fn test_purge_trash_nonexistent_path() {
        let result = purge_trash("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn test_purge_trash_exactly_30_days_not_deleted() {
        let dir = TempDir::new().unwrap();
        let thirty_days_ago = (chrono::Utc::now().date_naive() - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "borderline.md",
            &format!(
                "---\nTrashed at: \"{}\"\n---\n# Borderline\n",
                thirty_days_ago
            ),
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
        assert!(dir.path().join("borderline.md").exists());
    }

    #[test]
    fn test_purge_trash_31_days_deleted() {
        let dir = TempDir::new().unwrap();
        let thirty_one_days_ago = (chrono::Utc::now().date_naive() - chrono::Duration::days(31))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "expired.md",
            &format!(
                "---\nTrashed at: \"{}\"\n---\n# Expired\n",
                thirty_one_days_ago
            ),
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(!dir.path().join("expired.md").exists());
    }

    #[test]
    fn test_purge_trash_nested_directories() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "sub/deep/old.md",
            "---\nTrashed at: \"2025-01-01\"\n---\n# Deep Old\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old.md"));
    }
}
