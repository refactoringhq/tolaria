use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use super::parse::{parse_md_file, VaultEntry};

/// Read the content of a single note file.
pub fn get_note_content(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let path = Path::new(vault_path);
    if !path.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }
    if !path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", vault_path));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file()
            && entry_path
                .extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        {
            match parse_md_file(entry_path) {
                Ok(vault_entry) => entries.push(vault_entry),
                Err(e) => {
                    log::warn!("Skipping file: {}", e);
                }
            }
        }
    }

    // Sort by modified date descending (newest first)
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(entries)
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
    fn test_scan_vault_recursive() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "root.md", "# Root Note\n");
        create_test_file(dir.path(), "sub/nested.md", "---\nIs A: Task\n---\n# Nested\n");
        create_test_file(dir.path(), "not-markdown.txt", "This should be ignored");

        let entries = scan_vault(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 2);

        let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
        assert!(filenames.contains(&"root.md"));
        assert!(filenames.contains(&"nested.md"));
    }

    #[test]
    fn test_scan_vault_nonexistent_path() {
        let result = scan_vault("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_note_content() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
        create_test_file(dir.path(), "test.md", content);

        let path = dir.path().join("test.md");
        let result = get_note_content(path.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_get_note_content_nonexistent() {
        let result = get_note_content("/nonexistent/path/file.md");
        assert!(result.is_err());
    }
}
