use super::super::*;
use super::support::*;

#[test]
fn test_git_uncommitted_files_preserves_chinese_markdown_path() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();
    let relative_path = "中文笔记.md";

    force_quoted_git_paths(vault);
    create_test_file(vault, relative_path, "# 初始\n");
    git_add_commit(vault, "init");
    create_test_file(vault, relative_path, "# 初始\n\n更新\n");

    let workspace = resolve_git_workspace(vault).unwrap();
    let changed = git_uncommitted_files(&workspace);

    assert_eq!(changed, vec![relative_path.to_string()]);
}

#[test]
fn test_nested_vault_incremental_changes_exclude_parent_files() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let repository = dir.path();
    let vault = repository.join("docs");
    fs::create_dir(&vault).unwrap();
    create_test_file(&vault, "guide.md", "# Guide\n");
    create_test_file(repository, "outside.md", "# Outside\n");
    git_add_commit(repository, "initial");

    create_test_file(&vault, "guide.md", "# Guide\n\nUpdated\n");
    create_test_file(&vault, "new.yml", "name: new\n");
    create_test_file(repository, "outside.md", "# Outside changed\n");

    let workspace = resolve_git_workspace(&vault).unwrap();
    let changed = git_uncommitted_files(&workspace);

    assert_eq!(changed, vec!["guide.md", "new.yml"]);
}

#[test]
fn test_update_same_commit_new_file_still_added() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "existing.md", "# Existing\n");
    git_add_commit(vault, "init");

    // Prime cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Create new untracked file
    create_test_file(vault, "new-note.md", "# New Note\n");

    // Cache still same commit — new untracked file must appear
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 2);
    let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
    assert!(titles.contains(&"Existing"));
    assert!(titles.contains(&"New Note"));
}

#[test]
fn test_update_same_commit_new_files_in_new_subdirectory() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(
        vault,
        "existing.md",
        "---\ntitle: Existing\n---\n# Existing\n",
    );
    git_add_commit(vault, "init");

    // Prime cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Create files in a new protected subdirectory (simulates asset creation)
    create_test_file(
        vault,
        "assets/default-theme.md",
        "---\ntitle: Default Theme\nIs A: Theme\n---\n# Default Theme\n",
    );
    create_test_file(
        vault,
        "assets/dark-theme.md",
        "---\ntitle: Dark Theme\nIs A: Theme\n---\n# Dark Theme\n",
    );

    // Cache same commit — files in new subdirectory must appear
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(
        entries2.len(),
        3,
        "must pick up files in new untracked subdirectory"
    );
    let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
    assert!(titles.contains(&"Existing"));
    assert!(titles.contains(&"Default Theme"));
    assert!(titles.contains(&"Dark Theme"));
}

#[test]
fn test_update_same_commit_visible_removed_from_type_note() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    // Commit a type note with visible: false
    create_test_file(
        vault,
        "topic.md",
        "---\ntype: Type\nvisible: false\n---\n# Topic\n",
    );
    git_add_commit(vault, "init");

    // Prime the cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(
        entries[0].visible,
        Some(false),
        "visible must be false initially"
    );

    // User removes visible field (uncommitted edit)
    create_test_file(vault, "topic.md", "---\ntype: Type\n---\n# Topic\n");

    // Reload — must reflect the removal (visible defaults to None)
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1);
    assert_eq!(
        entries2[0].visible, None,
        "visible must be None after removing the field"
    );
}

#[test]
fn test_deleted_file_removed_from_cache_on_rescan() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "keep.md", "# Keep\n\nStays.");
    create_test_file(vault, "remove.md", "# Remove\n\nGoes away.");
    git_add_commit(vault, "init");

    // Prime cache with both files
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 2);

    // Delete file via filesystem (simulates Finder delete)
    fs::remove_file(vault.join("remove.md")).unwrap();
    // Also stage the deletion so git status is clean for this file
    crate::hidden_command("git")
        .args(["add", "remove.md"])
        .current_dir(vault)
        .output()
        .unwrap();

    // Rescan — deleted file must be pruned
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1, "deleted file must be pruned on rescan");
    assert_eq!(entries2[0].title, "Keep");
}

#[test]
fn test_deleted_untracked_file_removed_from_cache() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "tracked.md", "# Tracked\n\nCommitted.");
    git_add_commit(vault, "init");

    // Create untracked file and prime cache
    create_test_file(vault, "temp.md", "# Temp\n\nUntracked.");
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 2);

    // Delete the untracked file via filesystem
    fs::remove_file(vault.join("temp.md")).unwrap();

    // Rescan — untracked deleted file must be pruned
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(
        entries2.len(),
        1,
        "deleted untracked file must be pruned on rescan"
    );
    assert_eq!(entries2[0].title, "Tracked");
}

#[test]
fn test_case_rename_no_duplicates() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "Note.md", "# Note\n\nOriginal case.");
    git_add_commit(vault, "init");

    // Prime cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Simulate case-only rename on case-insensitive FS: delete old, create new
    fs::remove_file(vault.join("Note.md")).unwrap();
    create_test_file(vault, "note.md", "# Note\n\nRenamed case.");
    git_add_commit(vault, "rename");

    // Rescan — must not have duplicates
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(
        entries2.len(),
        1,
        "case-only rename must not create duplicates"
    );
}
