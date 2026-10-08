use super::super::*;
use super::support::*;

#[test]
fn test_invalidate_cache_deletes_cache_file() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nContent.");
    git_add_commit(vault, "init");

    // Build cache
    let _ = scan_vault_cached(vault).unwrap();
    assert!(cache_path(vault).exists(), "cache file must exist");

    // Invalidate
    invalidate_cache(vault);
    assert!(
        !cache_path(vault).exists(),
        "cache file must be deleted after invalidation"
    );
}

#[test]
fn test_invalidate_then_scan_forces_full_rescan() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "---\n_archived: false\n---\n# Note\n");
    git_add_commit(vault, "init");

    // Build cache — note is not archived
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert!(!entries[0].archived, "note must not be archived initially");

    // Simulate archiving the note on disk (update frontmatter directly)
    create_test_file(vault, "note.md", "---\n_archived: true\n---\n# Note\n");
    // Stage the change so git sees it
    git_add_commit(vault, "archive");

    // Without invalidation, scan_vault_cached uses incremental update.
    // With invalidation, it must do a full rescan from disk.
    invalidate_cache(vault);
    let entries2 = scan_vault_cached(vault).unwrap();
    assert_eq!(entries2.len(), 1);
    assert!(
        entries2[0].archived,
        "note must be archived after invalidate + rescan"
    );
}

#[test]
fn test_refresh_replaces_snapshot_without_invalidating_first() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "---\n_archived: false\n---\n# Note\n");
    git_add_commit(vault, "init");
    let initial = scan_vault_cached(vault).unwrap();
    assert!(!initial[0].archived);
    assert!(read_vault_snapshot(vault).unwrap().is_some());

    create_test_file(vault, "note.md", "---\n_archived: true\n---\n# Note\n");
    let refreshed = refresh_vault_cache(vault).unwrap();

    assert!(refreshed[0].archived);
    let snapshot = read_vault_snapshot(vault).unwrap().unwrap();
    assert!(snapshot[0].archived);
}

#[test]
fn test_refresh_replaces_invalid_snapshot() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n");
    git_add_commit(vault, "init");
    fs::write(cache_path(vault), b"not valid json").unwrap();

    let refreshed = refresh_vault_cache(vault).unwrap();

    assert_eq!(refreshed.len(), 1);
    assert_eq!(read_vault_snapshot(vault).unwrap().unwrap().len(), 1);
}

/// Integration test: a note with `Archived: Yes` (string, not boolean)
/// must be recognized as archived through the full cached vault load path.
/// This catches the scenario where a stale cache stores `archived: false`
/// and the cache version bump forces a correct re-parse.
#[test]
fn test_cached_vault_archived_yes_string() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(
        vault,
        "archived-note.md",
        "---\nArchived: Yes\n---\n# Old Note\n",
    );
    git_add_commit(vault, "init");

    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert!(
        entries[0].archived,
        "'Archived: Yes' must be parsed as true through the cached vault path"
    );
}

/// Integration test: stale cache with old version is invalidated and
/// re-parses `Archived: Yes` correctly after cache version bump.
#[test]
fn test_stale_cache_version_forces_rescan_of_archived_yes() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "---\nArchived: Yes\n---\n# Note\n");
    git_add_commit(vault, "init");

    let workspace = resolve_git_workspace(vault).unwrap();
    let hash = git_head_hash(&workspace).unwrap();

    // Simulate a stale cache written by old code that parsed Archived: Yes as false
    let stale_entry = {
        let mut e = parse_md_file(&vault.join("note.md"), None).unwrap();
        e.archived = false; // simulate old parser behavior
        e
    };
    let stale_cache = VaultCache {
        version: CACHE_VERSION - 1, // old version
        vault_path: vault.to_string_lossy().to_string(),
        commit_hash: hash,
        entries: vec![stale_entry],
    };
    write_cache(vault, &stale_cache, None).unwrap();

    // Load via cached path — stale version must trigger full rescan
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);
    assert!(
        entries[0].archived,
        "stale cache with old version must be invalidated, re-parsing 'Archived: Yes' as true"
    );
}
