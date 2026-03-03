use serde::Serialize;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;

static QMD_PATH_CACHE: Mutex<Option<String>> = Mutex::new(None);

/// Locate the qmd binary, checking known locations and PATH.
/// Caches the result for subsequent calls.
pub fn find_qmd_binary() -> Option<String> {
    if let Ok(guard) = QMD_PATH_CACHE.lock() {
        if let Some(ref cached) = *guard {
            return Some(cached.clone());
        }
    }

    let result = find_qmd_binary_uncached();

    if let Some(ref path) = result {
        if let Ok(mut guard) = QMD_PATH_CACHE.lock() {
            *guard = Some(path.clone());
        }
    }

    result
}

fn find_qmd_binary_uncached() -> Option<String> {
    let candidates = [
        dirs::home_dir().map(|h| h.join(".bun/bin/qmd").to_string_lossy().to_string()),
        Some("/usr/local/bin/qmd".to_string()),
        Some("/opt/homebrew/bin/qmd".to_string()),
    ];
    for candidate in candidates.into_iter().flatten() {
        if Path::new(&candidate).exists() {
            return Some(candidate);
        }
    }
    // Fallback: try PATH
    Command::new("which")
        .arg("qmd")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
}

/// Clear the cached qmd path (e.g. after auto-install).
pub fn clear_qmd_cache() {
    if let Ok(mut guard) = QMD_PATH_CACHE.lock() {
        *guard = None;
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct IndexStatus {
    pub available: bool,
    pub qmd_installed: bool,
    pub collection_exists: bool,
    pub indexed_count: usize,
    pub embedded_count: usize,
    pub pending_embed: usize,
}

/// Check whether the vault has a qmd index and its status.
pub fn check_index_status(vault_path: &str) -> IndexStatus {
    let qmd_bin = match find_qmd_binary() {
        Some(b) => b,
        None => {
            return IndexStatus {
                available: false,
                qmd_installed: false,
                collection_exists: false,
                indexed_count: 0,
                embedded_count: 0,
                pending_embed: 0,
            }
        }
    };

    let vault_name = vault_dir_name(vault_path);
    let output = Command::new(&qmd_bin).args(["status"]).output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            parse_status_for_vault(&stdout, &vault_name)
        }
        _ => IndexStatus {
            available: false,
            qmd_installed: true,
            collection_exists: false,
            indexed_count: 0,
            embedded_count: 0,
            pending_embed: 0,
        },
    }
}

fn vault_dir_name(vault_path: &str) -> String {
    Path::new(vault_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("laputa")
        .to_lowercase()
}

fn parse_status_for_vault(status_output: &str, vault_name: &str) -> IndexStatus {
    let mut collection_exists = false;
    let mut indexed_count = 0;
    let mut embedded_count = 0;
    let mut pending_embed = 0;

    // Look for collection section matching vault name
    let mut in_vault_section = false;
    for line in status_output.lines() {
        let trimmed = line.trim();
        // Collection headers look like: "  laputa (qmd://laputa/)"
        if trimmed.contains(&format!("qmd://{vault_name}/")) {
            collection_exists = true;
            in_vault_section = true;
            continue;
        }
        // New collection section starts
        if trimmed.contains("qmd://") && !trimmed.contains(vault_name) {
            in_vault_section = false;
            continue;
        }
        if in_vault_section {
            if let Some(count_str) = extract_count_from_line(trimmed, "Files:") {
                indexed_count = count_str;
            }
        }
    }

    // Global counts from the Documents section
    for line in status_output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Total:") {
            if let Some(n) = extract_first_number(trimmed) {
                if embedded_count == 0 && indexed_count == 0 {
                    indexed_count = n;
                }
            }
        } else if trimmed.starts_with("Vectors:") {
            if let Some(n) = extract_first_number(trimmed) {
                embedded_count = n;
            }
        } else if trimmed.starts_with("Pending:") {
            if let Some(n) = extract_first_number(trimmed) {
                pending_embed = n;
            }
        }
    }

    IndexStatus {
        available: true,
        qmd_installed: true,
        collection_exists,
        indexed_count,
        embedded_count,
        pending_embed,
    }
}

fn extract_count_from_line(line: &str, prefix: &str) -> Option<usize> {
    if !line.starts_with(prefix) {
        return None;
    }
    extract_first_number(line)
}

fn extract_first_number(s: &str) -> Option<usize> {
    s.split_whitespace()
        .find_map(|word| word.parse::<usize>().ok())
}

/// Ensure a qmd collection exists for this vault. Creates one if missing.
pub fn ensure_collection(vault_path: &str) -> Result<(), String> {
    let qmd_bin = find_qmd_binary().ok_or("qmd not installed")?;
    let vault_name = vault_dir_name(vault_path);

    // Check if collection already exists
    let output = Command::new(&qmd_bin)
        .args(["collection", "list"])
        .output()
        .map_err(|e| format!("Failed to list collections: {e}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains(&format!("qmd://{vault_name}/")) {
            return Ok(());
        }
    }

    // Create collection
    Command::new(&qmd_bin)
        .args([
            "collection",
            "add",
            vault_path,
            "--name",
            &vault_name,
            "--mask",
            "**/*.md",
        ])
        .output()
        .map_err(|e| format!("Failed to create collection: {e}"))?;

    Ok(())
}

#[derive(Debug, Serialize, Clone)]
pub struct IndexingProgress {
    pub phase: String,
    pub current: usize,
    pub total: usize,
    pub done: bool,
    pub error: Option<String>,
}

/// Run full indexing: update + embed. Returns progress updates via callback.
pub fn run_full_index<F>(vault_path: &str, on_progress: F) -> Result<(), String>
where
    F: Fn(IndexingProgress),
{
    let qmd_bin = find_qmd_binary().ok_or("qmd not installed")?;

    ensure_collection(vault_path)?;

    // Phase 1: update (scan files)
    on_progress(IndexingProgress {
        phase: "scanning".to_string(),
        current: 0,
        total: 0,
        done: false,
        error: None,
    });

    let update_output = Command::new(&qmd_bin)
        .args(["update"])
        .output()
        .map_err(|e| format!("qmd update failed: {e}"))?;

    if !update_output.status.success() {
        let stderr = String::from_utf8_lossy(&update_output.stderr);
        let err = format!("qmd update failed: {stderr}");
        on_progress(IndexingProgress {
            phase: "error".to_string(),
            current: 0,
            total: 0,
            done: true,
            error: Some(err.clone()),
        });
        return Err(err);
    }

    // Parse update output for counts
    let update_stdout = String::from_utf8_lossy(&update_output.stdout);
    let total = parse_indexed_count(&update_stdout);

    on_progress(IndexingProgress {
        phase: "scanning".to_string(),
        current: total,
        total,
        done: false,
        error: None,
    });

    // Phase 2: embed (generate vectors)
    on_progress(IndexingProgress {
        phase: "embedding".to_string(),
        current: 0,
        total,
        done: false,
        error: None,
    });

    let embed_output = Command::new(&qmd_bin)
        .args(["embed"])
        .output()
        .map_err(|e| format!("qmd embed failed: {e}"))?;

    if !embed_output.status.success() {
        let stderr = String::from_utf8_lossy(&embed_output.stderr);
        // Embedding failure is non-fatal — keyword search still works
        log::warn!("qmd embed failed (keyword search still works): {stderr}");
        on_progress(IndexingProgress {
            phase: "complete".to_string(),
            current: total,
            total,
            done: true,
            error: Some("Embedding failed — keyword search only".to_string()),
        });
        return Ok(());
    }

    on_progress(IndexingProgress {
        phase: "complete".to_string(),
        current: total,
        total,
        done: true,
        error: None,
    });

    Ok(())
}

fn parse_indexed_count(update_output: &str) -> usize {
    // qmd update output typically contains lines like "Indexed 9078 files"
    for line in update_output.lines() {
        if let Some(n) = extract_first_number(line) {
            return n;
        }
    }
    0
}

/// Run incremental update for a single file change.
pub fn run_incremental_update(vault_path: &str) -> Result<(), String> {
    let qmd_bin = find_qmd_binary().ok_or("qmd not installed")?;

    // Verify collection exists
    let vault_name = vault_dir_name(vault_path);
    let list_output = Command::new(&qmd_bin)
        .args(["collection", "list"])
        .output()
        .map_err(|e| format!("Failed to list collections: {e}"))?;

    if list_output.status.success() {
        let stdout = String::from_utf8_lossy(&list_output.stdout);
        if !stdout.contains(&format!("qmd://{vault_name}/")) {
            // Collection doesn't exist yet — skip incremental, full index needed
            return Ok(());
        }
    }

    let output = Command::new(&qmd_bin)
        .args(["update"])
        .output()
        .map_err(|e| format!("qmd incremental update failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("qmd update failed: {stderr}"));
    }

    Ok(())
}

/// Attempt to auto-install qmd via bun. Returns Ok if successful.
pub fn auto_install_qmd() -> Result<String, String> {
    // Find bun
    let bun = find_bun().ok_or("bun not installed — cannot auto-install qmd")?;

    let output = Command::new(&bun)
        .args(["install", "-g", "qmd"])
        .output()
        .map_err(|e| format!("Failed to install qmd: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("qmd installation failed: {stderr}"));
    }

    // Clear cache so find_qmd_binary() re-discovers
    clear_qmd_cache();

    match find_qmd_binary() {
        Some(path) => Ok(path),
        None => Err("qmd installed but binary not found".to_string()),
    }
}

fn find_bun() -> Option<String> {
    let candidates = [
        dirs::home_dir().map(|h| h.join(".bun/bin/bun").to_string_lossy().to_string()),
        Some("/opt/homebrew/bin/bun".to_string()),
        Some("/usr/local/bin/bun".to_string()),
    ];
    for candidate in candidates.into_iter().flatten() {
        if Path::new(&candidate).exists() {
            return Some(candidate);
        }
    }
    Command::new("which")
        .arg("bun")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_dir_name_extracts_last_segment() {
        assert_eq!(vault_dir_name("/Users/luca/Laputa"), "laputa");
        assert_eq!(vault_dir_name("/home/user/MyVault"), "myvault");
    }

    #[test]
    fn vault_dir_name_fallback() {
        assert_eq!(vault_dir_name(""), "laputa");
    }

    #[test]
    fn extract_first_number_works() {
        assert_eq!(
            extract_first_number("Total: 9078 files indexed"),
            Some(9078)
        );
        assert_eq!(extract_first_number("Vectors: 14676 embedded"), Some(14676));
        assert_eq!(extract_first_number("no numbers here"), None);
    }

    #[test]
    fn parse_status_finds_collection() {
        let status = r#"
QMD Status

Index: /Users/luca/.cache/qmd/index.sqlite
Size:  100.9 MB

Documents
  Total:    9115 files indexed
  Vectors:  14676 embedded
  Pending:  26 need embedding

Collections
  laputa (qmd://laputa/)
    Pattern:  **/*.md
    Files:    9078 (updated 20d ago)
"#;
        let result = parse_status_for_vault(status, "laputa");
        assert!(result.collection_exists);
        assert_eq!(result.indexed_count, 9078);
        assert_eq!(result.embedded_count, 14676);
        assert_eq!(result.pending_embed, 26);
    }

    #[test]
    fn parse_status_missing_collection() {
        let status = r#"
QMD Status

Documents
  Total:    100 files indexed
  Vectors:  50 embedded
  Pending:  0

Collections
  other (qmd://other/)
    Files:    100
"#;
        let result = parse_status_for_vault(status, "laputa");
        assert!(!result.collection_exists);
    }

    #[test]
    fn extract_count_from_line_works() {
        assert_eq!(
            extract_count_from_line("Files:    9078 (updated 20d ago)", "Files:"),
            Some(9078)
        );
        assert_eq!(extract_count_from_line("Pattern:  **/*.md", "Files:"), None);
    }

    #[test]
    fn parse_indexed_count_from_output() {
        assert_eq!(parse_indexed_count("Indexed 342 files in 1.2s"), 342);
        assert_eq!(parse_indexed_count("No output"), 0);
    }
}
