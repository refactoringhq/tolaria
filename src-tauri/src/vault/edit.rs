use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

use crate::frontmatter::{with_frontmatter, update_frontmatter_content, FrontmatterValue};

/// Update a single frontmatter property in a markdown file
pub fn update_frontmatter(path: &str, key: &str, value: FrontmatterValue) -> Result<String, String> {
    with_frontmatter(path, |content| update_frontmatter_content(content, key, Some(value.clone())))
}

/// Delete a frontmatter property from a markdown file
pub fn delete_frontmatter_property(path: &str, key: &str) -> Result<String, String> {
    with_frontmatter(path, |content| update_frontmatter_content(content, key, None))
}

/// Check if a character is safe for use in filenames (alphanumeric, dot, dash, underscore).
fn is_safe_filename_char(c: char) -> bool {
    c.is_alphanumeric() || matches!(c, '.' | '-' | '_')
}

/// Sanitize a filename by replacing unsafe characters with underscores.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if is_safe_filename_char(c) { c } else { '_' })
        .collect()
}

/// Save an uploaded image to the vault's attachments directory.
/// Returns the absolute path to the saved file.
pub fn save_image(vault_path: &str, filename: &str, data: &str) -> Result<String, String> {
    use base64::Engine;

    let vault = Path::new(vault_path);
    let attachments_dir = vault.join("attachments");

    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments directory: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let unique_name = format!("{}-{}", timestamp, sanitize_filename(filename));
    let target_path = attachments_dir.join(&unique_name);

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Invalid base64 data: {}", e))?;

    fs::write(&target_path, bytes)
        .map_err(|e| format!("Failed to write image: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// Scan all markdown files in the vault and delete those where
/// `Trashed at` frontmatter is more than 30 days ago.
/// Returns the list of deleted file paths.
pub fn purge_trash(vault_path: &str) -> Result<Vec<String>, String> {
    use chrono::{NaiveDate, Utc};

    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let today = Utc::now().date_naive();
    let matter = Matter::<YAML>::new();
    let mut deleted = Vec::new();

    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file()
            || path
                .extension()
                .map(|ext| ext != "md")
                .unwrap_or(true)
        {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let parsed = matter.parse(&content);
        let trashed_at_str = match parsed.data {
            Some(gray_matter::Pod::Hash(ref map)) => map
                .get("Trashed at")
                .or_else(|| map.get("trashed_at"))
                .and_then(|v| match v {
                    gray_matter::Pod::String(s) => Some(s.clone()),
                    _ => None,
                }),
            _ => None,
        };

        if let Some(date_str) = trashed_at_str {
            let trimmed = date_str.trim().trim_matches('"');
            let date_part = trimmed.split('T').next().unwrap_or(trimmed);
            if let Ok(trashed_date) = NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                let age = today.signed_duration_since(trashed_date);
                if age.num_days() > 30 {
                    match fs::remove_file(path) {
                        Ok(()) => {
                            log::info!("Purged trashed file: {}", path.display());
                            deleted.push(path.to_string_lossy().to_string());
                        }
                        Err(e) => {
                            log::warn!("Failed to delete {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }
    }

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
    fn test_sanitize_filename_safe_chars() {
        assert_eq!(sanitize_filename("photo.png"), "photo.png");
        assert_eq!(sanitize_filename("my-image_01.jpg"), "my-image_01.jpg");
    }

    #[test]
    fn test_sanitize_filename_unsafe_chars() {
        assert_eq!(sanitize_filename("my file (1).png"), "my_file__1_.png");
        assert_eq!(sanitize_filename("path/to/img.png"), "path_to_img.png");
    }

    #[test]
    fn test_save_image_creates_file() {
        use base64::Engine;

        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let data = base64::engine::general_purpose::STANDARD.encode(b"fake image data");

        let result = save_image(vault_path, "test.png", &data);
        assert!(result.is_ok());

        let saved_path = result.unwrap();
        assert!(std::path::Path::new(&saved_path).exists());
        assert!(saved_path.contains("attachments"));
        assert!(saved_path.contains("test.png"));

        let content = fs::read(&saved_path).unwrap();
        assert_eq!(content, b"fake image data");
    }

    #[test]
    fn test_save_image_creates_attachments_dir() {
        use base64::Engine;

        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let attachments = dir.path().join("attachments");
        assert!(!attachments.exists());

        let data = base64::engine::general_purpose::STANDARD.encode(b"test");
        save_image(vault_path, "img.png", &data).unwrap();
        assert!(attachments.exists());
    }

    #[test]
    fn test_save_image_invalid_base64() {
        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        let result = save_image(vault_path, "test.png", "not-valid-base64!!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid base64"));
    }

    #[test]
    fn test_purge_trash_deletes_old_trashed_files() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "old-trash.md",
            "---\nTrashed at: \"2025-01-01\"\n---\n# Old Trash\n",
        );
        let recent = chrono::Utc::now().date_naive().format("%Y-%m-%d").to_string();
        create_test_file(
            dir.path(),
            "recent-trash.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Recent Trash\n", recent),
        );
        create_test_file(
            dir.path(),
            "normal.md",
            "---\nIs A: Note\n---\n# Normal Note\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old-trash.md"));
        assert!(!dir.path().join("old-trash.md").exists());
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
        let thirty_days_ago = (chrono::Utc::now().date_naive()
            - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "borderline.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Borderline\n", thirty_days_ago),
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
        assert!(dir.path().join("borderline.md").exists());
    }

    #[test]
    fn test_purge_trash_31_days_deleted() {
        let dir = TempDir::new().unwrap();
        let thirty_one_days_ago = (chrono::Utc::now().date_naive()
            - chrono::Duration::days(31))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "expired.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Expired\n", thirty_one_days_ago),
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
