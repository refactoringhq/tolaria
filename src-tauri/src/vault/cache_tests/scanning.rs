use super::super::*;
use super::support::*;

#[test]
fn test_scan_vault_cached_no_git() {
    let _lock = ENV_LOCK.lock().unwrap();
    let cache_dir = TempDir::new().unwrap();
    set_test_cache_dir(cache_dir.path());

    // Without git, scan_vault_cached falls back to scan_vault
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "note.md", "# Note\n\nContent here.");

    let entries = scan_vault_cached(dir.path()).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].title, "Note");
    assert_eq!(entries[0].snippet, "Content here.");
}

#[test]
fn test_scan_vault_cached_with_git() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nFirst version.");
    git_add_commit(vault, "init");

    // First call: full scan, writes cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert!(cache_path(vault).exists());

    // Cache must NOT be inside the vault
    assert!(
        !cache_path(vault).starts_with(vault),
        "cache must be outside the vault"
    );

    // Second call: uses cache (same HEAD)
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1);
    assert_eq!(entries2[0].title, "Note");
}

#[test]
fn test_warm_same_commit_cache_skips_full_git_date_lookup_when_clean() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nFirst version.");
    git_add_commit(vault, "init");

    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    let _dates_guard = panic_on_git_date_lookup();
    CACHE_WRITE_COUNT.store(0, Ordering::SeqCst);
    let entries2 = scan_vault_cached(vault).unwrap();

    assert_eq!(entries2.len(), 1);
    assert_eq!(entries2[0].title, "Note");
    assert_eq!(CACHE_WRITE_COUNT.load(Ordering::SeqCst), 0);
}

#[test]
fn test_snapshot_returns_cached_entries_without_reconciling_deleted_files() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nCached content.");
    git_add_commit(vault, "init");
    scan_vault_cached(vault).unwrap();
    fs::remove_file(vault.join("note.md")).unwrap();

    let snapshot = read_vault_snapshot(vault).unwrap().unwrap();

    assert_eq!(snapshot.len(), 1);
    assert_eq!(snapshot[0].title, "Note");
    assert!(scan_vault_cached(vault).unwrap().is_empty());
}

#[test]
fn test_snapshot_returns_none_when_cache_is_missing_or_invalid() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    assert!(read_vault_snapshot(vault).unwrap().is_none());

    fs::write(cache_path(vault), "not-json").unwrap();
    assert!(read_vault_snapshot(vault).unwrap().is_none());
}

#[test]
fn test_nested_vault_cache_resolves_git_workspace_once_per_scan() {
    let (_lock, _cache_tmp, repository) = setup_git_vault();
    let vault = repository.path().join("docs");
    fs::create_dir(&vault).unwrap();
    create_test_file(&vault, "guide.md", "# Guide\n");
    git_add_commit(repository.path(), "initial");

    scan_vault_cached(&vault).unwrap();

    GIT_WORKSPACE_RESOLUTION_COUNT.store(0, Ordering::SeqCst);
    scan_vault_cached(&vault).unwrap();
    let same_commit_resolutions = GIT_WORKSPACE_RESOLUTION_COUNT.swap(0, Ordering::SeqCst);

    create_test_file(&vault, "guide.md", "# Guide\n\nUpdated.\n");
    git_add_commit(repository.path(), "update guide");
    scan_vault_cached(&vault).unwrap();
    let different_commit_resolutions = GIT_WORKSPACE_RESOLUTION_COUNT.swap(0, Ordering::SeqCst);

    assert_eq!(
        (same_commit_resolutions, different_commit_resolutions),
        (1, 1),
        "each cache scan should resolve the nested Git workspace exactly once"
    );
}

#[test]
fn test_scan_vault_cached_invalidates_stale_vault_path() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nContent.");
    git_add_commit(vault, "init");

    // Build cache normally
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert!(
        entries[0]
            .path
            .starts_with(vault.to_string_lossy().as_ref()),
        "Entry path should start with vault path"
    );

    // Tamper with cache to simulate a clone from a different machine
    let cache_file = cache_path(vault);
    let cache_data = fs::read_to_string(&cache_file).unwrap();
    let tampered = cache_data.replace(
        vault.to_string_lossy().as_ref(),
        "/Users/other-machine/OtherVault",
    );
    fs::write(&cache_file, tampered).unwrap();

    // Rescanning should invalidate the stale cache and produce correct paths
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1);
    assert!(
        entries2[0]
            .path
            .starts_with(vault.to_string_lossy().as_ref()),
        "After stale-cache invalidation, paths should use the current vault path, got: {}",
        entries2[0].path
    );
}

#[test]
fn test_scan_vault_cached_incremental_different_commit() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "first.md", "# First\n\nFirst note.");
    git_add_commit(vault, "first");

    // Build cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Add a second file and commit
    create_test_file(vault, "second.md", "# Second\n\nSecond note.");
    git_add_commit(vault, "second");

    // Incremental update: cache has old commit, new commit adds second.md
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 2);
    let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
    assert!(titles.contains(&"First"));
    assert!(titles.contains(&"Second"));
}

#[test]
fn test_update_same_commit_picks_up_modified_file() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    // Commit a type note without sidebar label
    create_test_file(vault, "news.md", "---\ntype: Type\n---\n# News\n");
    git_add_commit(vault, "init");

    // Prime the cache (same commit hash)
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].sidebar_label, None);

    // User edits the type note to add sidebar label (uncommitted)
    create_test_file(
        vault,
        "news.md",
        "---\ntype: Type\nsidebar label: News\n---\n# News\n",
    );

    // Reload with same git HEAD — must pick up the modification
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1);
    assert_eq!(
        entries2[0].sidebar_label,
        Some("News".to_string()),
        "sidebarLabel must reflect the uncommitted edit"
    );
}
