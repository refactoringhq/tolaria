use super::super::*;
use super::support::*;

#[test]
fn test_update_same_commit_picks_up_new_yml_file() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nContent.");
    git_add_commit(vault, "init");

    // Prime cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Create a new .yml view file (untracked, like save_view does)
    create_test_file(vault, "views/my-view.yml", "name: My View\nfilters: []\n");

    // Same commit — new .yml file must appear in entries
    let entries2 = scan_vault_cached(vault).unwrap();
    assert!(
        entries2.len() >= 2,
        "new .yml file must be picked up by cache update, got {} entries",
        entries2.len()
    );
    assert!(
        entries2.iter().any(|e| e.path.contains("my-view.yml")),
        "entries must include the new .yml file"
    );
}

#[test]
fn test_incremental_different_commit_picks_up_yml_file() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    create_test_file(vault, "note.md", "# Note\n\nContent.");
    git_add_commit(vault, "init");

    // Prime cache
    let entries = scan_vault_cached(vault).unwrap();
    assert_eq!(entries.len(), 1);

    // Add a .yml file and commit
    create_test_file(vault, "views/my-view.yml", "name: My View\nfilters: []\n");
    git_add_commit(vault, "add view");

    // Different commit — .yml file must appear in entries
    let entries2 = scan_vault_cached(vault).unwrap();
    assert!(
        entries2.iter().any(|e| e.path.contains("my-view.yml")),
        "committed .yml file must be picked up by incremental cache update"
    );
}

#[test]
fn test_load_cache_marks_invalid_json() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    fs::write(cache_path(vault), "{ not-json").unwrap();

    let load = load_cache(vault);
    assert!(
        matches!(load, CacheLoadState::Invalid(_)),
        "invalid cache JSON must be distinguished from a cache miss"
    );
}

#[test]
fn test_write_cache_skips_overwriting_newer_cache() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    let original = VaultCache {
        version: CACHE_VERSION,
        vault_path: vault.to_string_lossy().to_string(),
        commit_hash: "original".to_string(),
        entries: vec![],
    };
    write_cache(vault, &original, None).unwrap();

    let CacheLoadState::Loaded(loaded) = load_cache(vault) else {
        panic!("expected original cache to load");
    };

    let newer = VaultCache {
        commit_hash: "newer".to_string(),
        ..original
    };
    write_cache(vault, &newer, Some(loaded.fingerprint.clone())).unwrap();

    let stale = VaultCache {
        commit_hash: "stale".to_string(),
        ..newer
    };
    let outcome = write_cache(vault, &stale, Some(loaded.fingerprint)).unwrap();
    assert_eq!(outcome, CacheWriteOutcome::SkippedConcurrentUpdate);

    let CacheLoadState::Loaded(final_cache) = load_cache(vault) else {
        panic!("expected final cache to load");
    };
    assert_eq!(final_cache.cache.commit_hash, "newer");
}

#[test]
fn test_write_cache_skips_when_writer_lock_is_held() {
    let (_lock, _cache_tmp, dir) = setup_git_vault();
    let vault = dir.path();

    let lock_path = cache_lock_path(vault);
    if let Some(parent) = lock_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(&lock_path, "busy").unwrap();

    let cache = VaultCache {
        version: CACHE_VERSION,
        vault_path: vault.to_string_lossy().to_string(),
        commit_hash: "busy".to_string(),
        entries: vec![],
    };
    let outcome = write_cache(vault, &cache, None).unwrap();
    assert_eq!(outcome, CacheWriteOutcome::SkippedActiveWriter);
    assert!(
        !cache_path(vault).exists(),
        "active writer lock must prevent a competing cache write"
    );
}
