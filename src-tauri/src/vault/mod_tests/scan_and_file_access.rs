use super::*;
use std::collections::HashMap;
use std::path::Path;

fn entry_filenames(entries: &[VaultEntry]) -> Vec<&str> {
    entries
        .iter()
        .map(|entry| entry.filename.as_str())
        .collect()
}

fn assert_filenames_include(entries: &[VaultEntry], expected: &[&str]) {
    let filenames = entry_filenames(entries);
    for filename in expected {
        assert!(filenames.contains(filename), "missing {filename}");
    }
}

#[test]
fn test_scan_vault_root_and_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "project.md",
        "---\ntype: Type\n---\n# Project\n",
    );
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(
        dir.path(),
        "not-markdown.txt",
        "This should be included as text",
    );

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 4);
    assert_filenames_include(
        &entries,
        &["root.md", "project.md", "notes.md", "not-markdown.txt"],
    );

    let txt_entry = entries
        .iter()
        .find(|entry| entry.filename == "not-markdown.txt")
        .unwrap();
    assert_eq!(txt_entry.file_kind, "text");
    assert_eq!(txt_entry.title, "not-markdown.txt");
}

#[test]
fn test_scan_vault_includes_subdirectory_notes() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "random-folder/nested.md",
        "---\ntype: Note\n---\n# Nested\n",
    );
    create_test_file(
        dir.path(),
        "project/old-project.md",
        "---\ntype: Project\n---\n# Old\n",
    );

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(
        entries.len(),
        3,
        "all .md files including subdirs should be scanned"
    );
    assert_filenames_include(&entries, &["root.md", "nested.md", "old-project.md"]);
}

#[test]
fn test_scan_vault_includes_all_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(dir.path(), "assets/image.md", "# Asset\n");

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 3);
}

#[test]
fn test_scan_vault_skips_hidden_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), ".laputa/cache.md", "# Cache\n");
    create_test_file(dir.path(), ".git/objects.md", "# Git\n");

    let entries = scan_vault(dir.path(), &HashMap::new()).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].filename, "root.md");
}

#[test]
fn test_scan_vault_nonexistent_path() {
    let result = scan_vault(
        Path::new("/nonexistent/path/that/does/not/exist"),
        &HashMap::new(),
    );
    assert!(result.is_err());
}

#[test]
fn test_get_note_content() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
    create_test_file(dir.path(), "test.md", content);

    let path = dir.path().join("test.md");
    let result = get_note_content(&path);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), content);
}

#[test]
fn test_get_note_content_nonexistent() {
    let result = get_note_content(Path::new("/nonexistent/path/file.md"));
    assert!(result.is_err());
}

#[test]
fn test_get_note_content_invalid_utf8() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("invalid.csv");
    std::fs::write(&path, [0x66, 0x6f, 0x80]).unwrap();

    let result = get_note_content(&path);

    assert_eq!(
        result.unwrap_err(),
        format!("File is not valid UTF-8 text: {}", path.display())
    );
}
