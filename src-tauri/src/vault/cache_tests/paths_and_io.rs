use super::super::*;
use super::support::*;

#[test]
fn test_cache_path_is_outside_vault() {
    let _lock = ENV_LOCK.lock().unwrap();
    let cache_dir = TempDir::new().unwrap();
    set_test_cache_dir(cache_dir.path());

    let vault = Path::new("/Users/test/MyVault");
    let path = cache_path(vault);

    // Cache must NOT be inside the vault
    assert!(
        !path.starts_with(vault),
        "cache path must be outside the vault, got: {}",
        path.display()
    );
    // Cache must be under the cache directory
    assert!(
        path.starts_with(cache_dir.path()),
        "cache path must be under cache dir, got: {}",
        path.display()
    );
    // Must end with .json
    assert_eq!(path.extension().unwrap(), "json");
}

#[test]
fn test_vault_path_hash_is_deterministic() {
    let hash1 = vault_path_hash(Path::new("/Users/test/MyVault"));
    let hash2 = vault_path_hash(Path::new("/Users/test/MyVault"));
    assert_eq!(hash1, hash2);
}

#[test]
fn test_to_relative_path_normalizes_aliases_and_separators() {
    assert_eq!(
        to_relative_path(
            "/tmp/tolaria-vault/projects\\active.md",
            Path::new("/private/tmp/tolaria-vault")
        ),
        "projects/active.md"
    );
}

#[test]
fn test_different_vaults_get_different_hashes() {
    let hash1 = vault_path_hash(Path::new("/Users/test/Vault1"));
    let hash2 = vault_path_hash(Path::new("/Users/test/Vault2"));
    assert_ne!(hash1, hash2);
}

#[test]
fn test_cache_write_no_tmp_file_left() {
    let _lock = ENV_LOCK.lock().unwrap();
    let cache_dir = TempDir::new().unwrap();
    set_test_cache_dir(cache_dir.path());

    let vault_dir = TempDir::new().unwrap();
    let vault = vault_dir.path();

    let cache = VaultCache {
        version: CACHE_VERSION,
        vault_path: vault.to_string_lossy().to_string(),
        commit_hash: "abc123".to_string(),
        entries: vec![],
    };

    write_cache(vault, &cache, None).unwrap();

    // Final file should exist
    let final_path = cache_path(vault);
    assert!(final_path.exists(), "cache file must exist after write");

    // Tmp files should NOT remain beside the cache file
    let tmp_count = fs::read_dir(cache_dir.path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp"))
        .count();
    assert_eq!(tmp_count, 0, "cache write must not leave tmp files behind");

    // Content must be valid JSON
    let data = fs::read_to_string(&final_path).unwrap();
    let loaded: VaultCache = serde_json::from_str(&data).unwrap();
    assert_eq!(loaded.commit_hash, "abc123");
}

#[test]
fn test_legacy_cache_migration() {
    let (_lock, _cache_tmp, vault_dir) = setup_git_vault();
    let vault = vault_dir.path();

    // Create a legacy cache file inside the vault
    let legacy = legacy_cache_path(vault);
    let cache = VaultCache {
        version: CACHE_VERSION,
        vault_path: vault.to_string_lossy().to_string(),
        commit_hash: "old123".to_string(),
        entries: vec![],
    };
    fs::write(&legacy, serde_json::to_string(&cache).unwrap()).unwrap();

    // Run migration
    migrate_legacy_cache(vault);

    // New cache file should exist with migrated data
    let new_path = cache_path(vault);
    assert!(new_path.exists(), "migrated cache must exist");
    let data = fs::read_to_string(&new_path).unwrap();
    let loaded: VaultCache = serde_json::from_str(&data).unwrap();
    assert_eq!(loaded.commit_hash, "old123");

    // Legacy file should be deleted
    assert!(!legacy.exists(), "legacy cache file must be removed");
}
