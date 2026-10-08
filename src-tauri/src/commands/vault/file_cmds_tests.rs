use super::*;
use std::fs;
use tempfile::TempDir;

fn vault_root(dir: &TempDir) -> PathBuf {
    dir.path().to_path_buf()
}

fn note_path(dir: &TempDir, name: &str) -> PathBuf {
    dir.path().join(name)
}

#[tokio::test]
async fn note_content_commands_roundtrip_with_requested_vault() {
    let dir = TempDir::new().unwrap();
    let root = vault_root(&dir);
    let note = note_path(&dir, "notes/command-note.md");

    create_note_content(
        note.clone(),
        "# Command Note\n".to_string(),
        Some(root.clone()),
    )
    .unwrap();
    assert_eq!(
        get_note_content(note.clone(), Some(root.clone())).unwrap(),
        "# Command Note\n"
    );

    save_note_content(
        note.clone(),
        "---\ntitle: Command Note\n---\n# Command Note\nBody\n".to_string(),
        Some(root.clone()),
    )
    .await
    .unwrap();
    assert!(!sync_note_title(note.clone(), Some(root.clone())).unwrap());

    save_note_content(
        note.clone(),
        "# Updated Command Note\n".to_string(),
        Some(root.clone()),
    )
    .await
    .unwrap();
    assert!(sync_note_title(note.clone(), Some(root.clone())).unwrap());
    assert!(get_note_content(note, Some(root))
        .unwrap()
        .contains("title: Command Note"));
}

#[tokio::test]
async fn note_content_commands_accept_windows_sensitive_valid_segments() {
    let dir = TempDir::new().unwrap();
    let root = vault_root(&dir);
    let note = root
        .join("@raflymln")
        .join("notes with spaces")
        .join("résumé note.md");

    save_note_content(
        note.clone(),
        "# Windows-Sensitive Path\n\nBody\n".to_string(),
        Some(root.clone()),
    )
    .await
    .unwrap();

    assert_eq!(
        get_note_content(note, Some(root)).unwrap(),
        "# Windows-Sensitive Path\n\nBody\n"
    );
}

#[tokio::test]
async fn folder_and_listing_commands_use_expanded_vault_root() {
    let dir = TempDir::new().unwrap();
    let root = vault_root(&dir);
    fs::write(dir.path().join("root.md"), "# Root\n").unwrap();

    assert_eq!(
        create_vault_folder(root.clone(), PathBuf::from("Projects"), None).unwrap(),
        "Projects"
    );
    fs::write(dir.path().join("Projects/project.md"), "# Project\n").unwrap();

    let entries = list_vault(root.clone()).await.unwrap();
    assert!(entries.iter().any(|entry| entry.filename == "root.md"));
    assert!(entries.iter().any(|entry| entry.filename == "project.md"));

    let folders = list_vault_folders(root).await.unwrap();
    assert!(folders.iter().any(|folder| folder.name == "Projects"));
}

#[test]
fn startup_snapshot_visibility_keeps_snapshot_and_filters_ignored_entries() {
    let dir = TempDir::new().unwrap();
    fs::write(dir.path().join("visible.md"), "# Visible\n").unwrap();
    fs::write(dir.path().join("ignored.md"), "# Ignored\n").unwrap();
    fs::write(dir.path().join(".gitignore"), "ignored.md\n").unwrap();
    std::process::Command::new("git")
        .arg("init")
        .current_dir(dir.path())
        .output()
        .unwrap();
    let entries = vault::scan_vault_cached(dir.path()).unwrap();

    let visible = filter_visible_vault_entries(dir.path(), entries, true);

    assert!(visible.iter().any(|entry| entry.filename == "visible.md"));
    assert!(!visible.iter().any(|entry| entry.filename == "ignored.md"));
}

#[test]
fn commands_reject_paths_outside_requested_vault() {
    let vault = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    let outside_note = outside.path().join("outside.md");
    fs::write(&outside_note, "# Outside\n").unwrap();

    let error = get_note_content(outside_note, Some(vault.path().to_path_buf())).unwrap_err();
    assert!(error.contains("Path must stay inside the active vault"));

    let folder_error =
        create_vault_folder(vault.path().to_path_buf(), PathBuf::from("../escape"), None)
            .unwrap_err();
    assert!(folder_error.contains("Path must stay inside the active vault"));
}

#[test]
fn external_file_paths_accept_files_inside_requested_vault() {
    let dir = TempDir::new().unwrap();
    let root = vault_root(&dir);
    let attachment = note_path(&dir, "attachments/photo.png");
    fs::create_dir_all(attachment.parent().unwrap()).unwrap();
    fs::write(&attachment, "image-bytes").unwrap();

    let validated = with_external_file_path(
        attachment.as_path(),
        Some(root.as_path()),
        |validated_path| Ok(validated_path.to_path_buf()),
    )
    .unwrap();

    assert_eq!(validated, attachment);
}

#[test]
fn external_file_paths_reject_files_outside_requested_vault() {
    let vault = TempDir::new().unwrap();
    let outside = TempDir::new().unwrap();
    let outside_file = outside.path().join("photo.png");
    fs::write(&outside_file, "image-bytes").unwrap();

    let error = with_external_file_path(
        outside_file.as_path(),
        Some(vault.path()),
        |validated_path| Ok(validated_path.to_path_buf()),
    )
    .unwrap_err();

    assert!(error.contains("Path must stay inside the active vault"));
}

#[test]
fn windows_folder_reveal_opens_nested_directory() {
    let dir = TempDir::new().unwrap();
    let nested = dir.path().join("Folder With Spaces").join("Nested");
    fs::create_dir_all(&nested).unwrap();

    let action = file_manager_reveal_action(nested.as_path(), RevealPlatform::Windows).unwrap();

    assert_eq!(action, FileManagerRevealAction::OpenPath(nested));
}

#[test]
fn windows_file_reveal_still_selects_file_in_parent() {
    let dir = TempDir::new().unwrap();
    let file = note_path(&dir, "Folder With Spaces/project.md");
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(&file, "# Project\n").unwrap();

    let action = file_manager_reveal_action(file.as_path(), RevealPlatform::Windows).unwrap();

    assert_eq!(action, FileManagerRevealAction::RevealItemInDir(file));
}

#[test]
fn non_windows_folder_reveal_still_selects_folder_in_parent() {
    let dir = TempDir::new().unwrap();
    let nested = dir.path().join("Folder With Spaces").join("Nested");
    fs::create_dir_all(&nested).unwrap();

    let action = file_manager_reveal_action(nested.as_path(), RevealPlatform::Other).unwrap();

    assert_eq!(action, FileManagerRevealAction::RevealItemInDir(nested));
}

#[test]
fn file_manager_reveal_rejects_missing_paths() {
    let dir = TempDir::new().unwrap();
    let missing = dir.path().join("missing");

    let error = file_manager_reveal_action(missing.as_path(), RevealPlatform::Windows).unwrap_err();

    assert!(error.starts_with(LOCALIZED_ERROR_PREFIX));
    assert!(error.contains(FILE_ACTION_PATH_MISSING_ERROR_KEY));
    assert!(error.contains("missing"));
}

#[test]
fn validate_note_content_compares_against_disk() {
    let dir = TempDir::new().unwrap();
    let root = vault_root(&dir);
    let note = note_path(&dir, "note.md");
    fs::write(&note, "# Fresh\n").unwrap();

    assert!(
        validate_note_content(note.clone(), "# Fresh\n".to_string(), Some(root.clone()),).unwrap()
    );
    assert!(!validate_note_content(note, "# Stale\n".to_string(), Some(root)).unwrap());
}
