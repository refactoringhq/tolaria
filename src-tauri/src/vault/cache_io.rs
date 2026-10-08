#[cfg(test)]
use super::CACHE_WRITE_COUNT;
use super::{cache_path, VaultCache, CACHE_WRITE_LOCK_STALE_SECS};
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
#[cfg(test)]
use std::sync::atomic::Ordering;
use std::time::Duration;
use uuid::Uuid;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct CacheFileFingerprint {
    byte_len: usize,
    content_hash: u64,
}

#[derive(Debug)]
pub(super) struct LoadedCache {
    pub(super) cache: VaultCache,
    pub(super) fingerprint: CacheFileFingerprint,
}

#[derive(Debug)]
pub(super) enum CacheLoadState {
    Missing,
    Loaded(LoadedCache),
    Invalid(String),
    Unreadable(String),
}

#[derive(Debug, Eq, PartialEq)]
pub(super) enum CacheWriteOutcome {
    Replaced,
    SkippedConcurrentUpdate,
    SkippedActiveWriter,
}

struct CacheWriteLock {
    path: PathBuf,
}

impl Drop for CacheWriteLock {
    fn drop(&mut self) {
        if let Err(error) = fs::remove_file(&self.path) {
            if error.kind() != ErrorKind::NotFound {
                log::warn!(
                    "Failed to release cache write lock {}: {}",
                    self.path.display(),
                    error
                );
            }
        }
    }
}

pub(super) fn cache_lock_path(vault: &Path) -> PathBuf {
    cache_path(vault).with_extension("lock")
}

fn cache_temp_path(final_path: &Path) -> PathBuf {
    let file_name = final_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("cache.json");
    final_path.with_file_name(format!("{file_name}.{}.tmp", Uuid::new_v4()))
}

/// Legacy cache path inside the vault directory (pre-migration).
fn cache_fingerprint(bytes: &[u8]) -> CacheFileFingerprint {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    CacheFileFingerprint {
        byte_len: bytes.len(),
        content_hash: hasher.finish(),
    }
}

fn read_cache_bytes(path: &Path) -> Result<Option<Vec<u8>>, String> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to read cache {}: {}",
            path.display(),
            error
        )),
    }
}

pub(super) fn read_cache_fingerprint(path: &Path) -> Result<Option<CacheFileFingerprint>, String> {
    Ok(read_cache_bytes(path)?.map(|bytes| cache_fingerprint(&bytes)))
}

pub(super) fn load_cache(vault: &Path) -> CacheLoadState {
    let path = cache_path(vault);
    let Some(bytes) = (match read_cache_bytes(&path) {
        Ok(bytes) => bytes,
        Err(error) => return CacheLoadState::Unreadable(error),
    }) else {
        return CacheLoadState::Missing;
    };

    let fingerprint = cache_fingerprint(&bytes);
    match serde_json::from_slice(&bytes) {
        Ok(cache) => CacheLoadState::Loaded(LoadedCache { cache, fingerprint }),
        Err(error) => CacheLoadState::Invalid(format!(
            "Failed to parse cache {}: {}",
            path.display(),
            error
        )),
    }
}

fn lock_is_stale(lock_path: &Path) -> bool {
    fs::metadata(lock_path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.elapsed().ok())
        .map(|elapsed| elapsed > Duration::from_secs(CACHE_WRITE_LOCK_STALE_SECS))
        .unwrap_or(false)
}

fn ensure_cache_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create cache directory {}: {}",
                parent.display(),
                error
            )
        })?;
    }
    Ok(())
}

fn initialize_cache_write_lock(
    mut file: fs::File,
    lock_path: &Path,
) -> Result<CacheWriteLock, String> {
    let pid = std::process::id().to_string();
    if let Err(error) = file.write_all(pid.as_bytes()).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(lock_path);
        return Err(format!(
            "Failed to initialize cache write lock {}: {}",
            lock_path.display(),
            error
        ));
    }
    Ok(CacheWriteLock {
        path: lock_path.to_path_buf(),
    })
}

fn try_create_cache_write_lock(lock_path: &Path) -> Result<Option<CacheWriteLock>, String> {
    match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(lock_path)
    {
        Ok(file) => initialize_cache_write_lock(file, lock_path).map(Some),
        Err(error) if error.kind() == ErrorKind::AlreadyExists => Ok(None),
        Err(error) => Err(format!(
            "Failed to acquire cache write lock {}: {}",
            lock_path.display(),
            error
        )),
    }
}

fn remove_stale_cache_write_lock(lock_path: &Path) -> Result<bool, String> {
    if !lock_is_stale(lock_path) {
        return Ok(false);
    }

    log::warn!("Removing stale cache write lock {}", lock_path.display());
    match fs::remove_file(lock_path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(true),
        Err(error) => Err(format!(
            "Failed to remove stale cache write lock {}: {}",
            lock_path.display(),
            error
        )),
    }
}

fn acquire_cache_write_lock(lock_path: &Path) -> Result<Option<CacheWriteLock>, String> {
    ensure_cache_parent_dir(lock_path)?;
    if let Some(lock) = try_create_cache_write_lock(lock_path)? {
        return Ok(Some(lock));
    }
    if !remove_stale_cache_write_lock(lock_path)? {
        return Ok(None);
    }
    try_create_cache_write_lock(lock_path)
}

pub(super) fn remove_cache_file(path: &Path, reason: &str) {
    if let Err(error) = fs::remove_file(path) {
        if error.kind() != ErrorKind::NotFound {
            log::warn!("Failed to remove {reason} {}: {}", path.display(), error);
        }
    }
}

#[cfg(unix)]
fn sync_parent_directory(path: &Path) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    fs::File::open(parent)
        .and_then(|dir| dir.sync_all())
        .map_err(|error| {
            format!(
                "Failed to sync cache directory {}: {}",
                parent.display(),
                error
            )
        })
}

#[cfg(not(unix))]
fn sync_parent_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn cache_state_matches(
    path: &Path,
    expected_previous: Option<&CacheFileFingerprint>,
) -> Result<bool, String> {
    let current = read_cache_fingerprint(path)?;
    Ok(match expected_previous {
        Some(expected) => current.as_ref() == Some(expected),
        None => current.is_none(),
    })
}

fn serialize_cache(cache: &VaultCache, path: &Path) -> Result<Vec<u8>, String> {
    serde_json::to_vec(cache)
        .map_err(|error| format!("Failed to serialize cache {}: {}", path.display(), error))
}

fn write_temp_cache_file(path: &Path, data: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            format!(
                "Failed to create temp cache file {}: {}",
                path.display(),
                error
            )
        })?;

    if let Err(error) = file.write_all(data).and_then(|_| file.sync_all()) {
        remove_cache_file(path, "temp cache file");
        return Err(format!(
            "Failed to flush temp cache file {}: {}",
            path.display(),
            error
        ));
    }
    Ok(())
}

fn replace_cache_file(temp_path: &Path, final_path: &Path) -> Result<(), String> {
    fs::rename(temp_path, final_path).map_err(|error| {
        remove_cache_file(temp_path, "temp cache file");
        format!(
            "Failed to replace cache {}: {}",
            final_path.display(),
            error
        )
    })
}

fn sync_cache_parent(path: &Path) {
    if let Err(error) = sync_parent_directory(path) {
        log::warn!("{error}");
    }
}

/// Replace the cache file using a temp file + rename, but only if the on-disk
/// cache still matches the version we loaded earlier.
pub(super) fn write_cache(
    vault: &Path,
    cache: &VaultCache,
    expected_previous: Option<CacheFileFingerprint>,
) -> Result<CacheWriteOutcome, String> {
    #[cfg(test)]
    CACHE_WRITE_COUNT.fetch_add(1, Ordering::SeqCst);

    let final_path = cache_path(vault);
    let lock_path = cache_lock_path(vault);
    let Some(_lock) = acquire_cache_write_lock(&lock_path)? else {
        return Ok(CacheWriteOutcome::SkippedActiveWriter);
    };

    if !cache_state_matches(&final_path, expected_previous.as_ref())? {
        return Ok(CacheWriteOutcome::SkippedConcurrentUpdate);
    }

    ensure_cache_parent_dir(&final_path)?;
    let data = serialize_cache(cache, &final_path)?;
    let tmp_path = cache_temp_path(&final_path);
    write_temp_cache_file(&tmp_path, &data)?;
    replace_cache_file(&tmp_path, &final_path)?;

    sync_cache_parent(&final_path);

    Ok(CacheWriteOutcome::Replaced)
}
