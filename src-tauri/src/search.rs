use crate::indexing;
use crate::vault;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub title: String,
    pub path: String,
    pub snippet: String,
    pub score: f64,
    pub note_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub elapsed_ms: u64,
    pub query: String,
    pub mode: String,
}

#[derive(Debug, Deserialize)]
struct QmdResult {
    pub file: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
}

fn qmd_uri_to_vault_path(uri: &str, vault_path: &str) -> String {
    // qmd://laputa/essay/foo.md → essay/foo.md
    let relative = uri
        .strip_prefix("qmd://")
        .and_then(|s| s.find('/').map(|i| &s[i + 1..]))
        .unwrap_or(uri);
    format!("{}/{}", vault_path, relative)
}

fn extract_clean_snippet(raw_snippet: &str) -> String {
    // qmd snippets start with "@@ -N,N @@ (N before, N after)\n"
    // We want just the content lines
    let lines: Vec<&str> = raw_snippet.lines().collect();
    let content_start = lines.iter().position(|l| !l.starts_with("@@")).unwrap_or(0);
    let content: String = lines[content_start..]
        .iter()
        .filter(|l| !l.starts_with("---"))
        .take(3)
        .copied()
        .collect::<Vec<&str>>()
        .join(" ");
    // Trim to reasonable length
    if content.len() > 200 {
        format!("{}...", &content[..200])
    } else {
        content
    }
}

static COLLECTION_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn detect_collection_name(vault_path: &str) -> String {
    // Check cache first
    if let Ok(guard) = COLLECTION_CACHE.lock() {
        if let Some(ref cache) = *guard {
            if let Some(name) = cache.get(vault_path) {
                return name.clone();
            }
        }
    }

    let result = detect_collection_name_uncached(vault_path);

    // Store in cache
    if let Ok(mut guard) = COLLECTION_CACHE.lock() {
        let cache = guard.get_or_insert_with(HashMap::new);
        cache.insert(vault_path.to_string(), result.clone());
    }

    result
}

fn detect_collection_name_uncached(vault_path: &str) -> String {
    let qmd = match indexing::find_qmd_binary() {
        Some(b) => b,
        None => return "laputa".to_string(),
    };

    let output = qmd.command().args(["collection", "list"]).output();

    match output {
        Ok(o) if o.status.success() => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let vault_name = Path::new(vault_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("laputa")
                .to_lowercase();
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.contains(&vault_name) && trimmed.contains("qmd://") {
                    if let Some(name) = trimmed.split_whitespace().next() {
                        return name.to_string();
                    }
                }
            }
            vault_name
        }
        _ => Path::new(vault_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("laputa")
            .to_lowercase(),
    }
}

pub fn search_vault(
    vault_path: &str,
    query: &str,
    mode: &str,
    limit: usize,
) -> Result<SearchResponse, String> {
    let start = Instant::now();

    let qmd = indexing::find_qmd_binary().ok_or_else(|| "qmd binary not found".to_string())?;

    let collection = detect_collection_name(vault_path);

    let search_cmd = match mode {
        "semantic" => "vsearch",
        "hybrid" => "query",
        _ => "search", // "keyword" default
    };

    let limit_str = limit.to_string();
    let output = qmd
        .command()
        .args([
            search_cmd,
            query,
            "--collection",
            &collection,
            "--json",
            "-n",
            &limit_str,
        ])
        .output()
        .map_err(|e| format!("Failed to run qmd: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("qmd search failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let qmd_results: Vec<QmdResult> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse qmd output: {}", e))?;

    let results: Vec<SearchResult> = qmd_results
        .into_iter()
        .filter_map(|r| {
            let path = qmd_uri_to_vault_path(&r.file, vault_path);
            if vault::is_file_trashed(Path::new(&path)) {
                return None;
            }
            let snippet = extract_clean_snippet(&r.snippet);
            Some(SearchResult {
                title: r.title,
                path,
                snippet,
                score: r.score,
                note_type: None,
            })
        })
        .collect();

    let elapsed_ms = start.elapsed().as_millis() as u64;

    Ok(SearchResponse {
        results,
        elapsed_ms,
        query: query.to_string(),
        mode: mode.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_qmd_uri_to_vault_path() {
        assert_eq!(
            qmd_uri_to_vault_path("qmd://laputa/essay/foo.md", "/Users/luca/Laputa"),
            "/Users/luca/Laputa/essay/foo.md"
        );
        assert_eq!(
            qmd_uri_to_vault_path(
                "qmd://laputa/event/2025-10-15-retreat.md",
                "/Users/luca/Laputa"
            ),
            "/Users/luca/Laputa/event/2025-10-15-retreat.md"
        );
    }

    #[test]
    fn test_extract_clean_snippet() {
        let raw = "@@ -2,4 @@ (1 before, 9 after)\naliases:\n  - \"Refactoring Retreat\"\n\"Is A\":\n  - Event";
        let clean = extract_clean_snippet(raw);
        assert!(clean.starts_with("aliases:"));
        assert!(clean.contains("Refactoring Retreat"));
    }

    #[test]
    fn test_extract_clean_snippet_long() {
        let raw = format!("@@ -1,1 @@\n{}", "a".repeat(300));
        let clean = extract_clean_snippet(&raw);
        assert!(clean.len() <= 203); // 200 + "..."
        assert!(clean.ends_with("..."));
    }

    #[test]
    fn test_detect_collection_fallback() {
        // With a non-existent vault path, should return either the lowercase dir name
        // (if qmd is available and collection list succeeds) or "laputa" (if qmd is not installed).
        // Both are valid fallbacks — this test verifies the function doesn't panic.
        let name = detect_collection_name("/tmp/test-vault");
        assert!(
            name == "test-vault" || name == "laputa",
            "Expected 'test-vault' or 'laputa', got '{}'",
            name
        );
    }
    #[test]
    fn test_qmd_uri_fallback() {
        // Covers fallback branch when URI doesn't start with "qmd://"
        let result = qmd_uri_to_vault_path("invalid-uri", "/vault");
        assert!(result.contains("invalid-uri"));
    }

    #[test]
    fn test_extract_clean_snippet_no_header() {
        // No @@ header — content_start = 0
        let snippet = extract_clean_snippet("plain content line");
        assert_eq!(snippet, "plain content line");
    }
}
