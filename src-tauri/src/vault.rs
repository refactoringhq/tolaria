use gray_matter::engine::YAML;
use gray_matter::Matter;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

use crate::frontmatter::{with_frontmatter, update_frontmatter_content};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VaultEntry {
    pub path: String,
    pub filename: String,
    pub title: String,
    #[serde(rename = "isA")]
    pub is_a: Option<String>,
    pub aliases: Vec<String>,
    #[serde(rename = "belongsTo")]
    pub belongs_to: Vec<String>,
    #[serde(rename = "relatedTo")]
    pub related_to: Vec<String>,
    pub status: Option<String>,
    pub owner: Option<String>,
    pub cadence: Option<String>,
    pub archived: bool,
    pub trashed: bool,
    #[serde(rename = "trashedAt")]
    pub trashed_at: Option<u64>,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    pub snippet: String,
    /// Generic relationship fields: any frontmatter key whose value contains wikilinks.
    /// Key is the original frontmatter field name (e.g. "Has", "Topics", "Events").
    pub relationships: HashMap<String, Vec<String>>,
    /// Phosphor icon name (kebab-case) for Type entries, e.g. "cooking-pot".
    pub icon: Option<String>,
    /// Accent color key for Type entries: "red", "purple", "blue", "green", "yellow", "orange".
    pub color: Option<String>,
    /// Display order for Type entries in sidebar (lower = higher). None = use default order.
    pub order: Option<i64>,
}

/// Intermediate struct to capture YAML frontmatter fields.
#[derive(Debug, Deserialize, Default)]
struct Frontmatter {
    #[serde(rename = "Is A")]
    is_a: Option<StringOrList>,
    #[serde(default)]
    aliases: Option<StringOrList>,
    #[serde(rename = "Belongs to")]
    belongs_to: Option<StringOrList>,
    #[serde(rename = "Related to")]
    related_to: Option<StringOrList>,
    #[serde(rename = "Status")]
    status: Option<String>,
    #[serde(rename = "Owner")]
    owner: Option<String>,
    #[serde(rename = "Cadence")]
    cadence: Option<String>,
    #[serde(rename = "Archived")]
    archived: Option<bool>,
    #[serde(rename = "Trashed")]
    trashed: Option<bool>,
    #[serde(rename = "Trashed at")]
    trashed_at: Option<String>,
    #[serde(rename = "Created at")]
    created_at: Option<String>,
    #[serde(rename = "Created time")]
    created_time: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    color: Option<String>,
    #[serde(default)]
    order: Option<i64>,
}

/// Handles YAML fields that can be either a single string or a list of strings.
#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
enum StringOrList {
    Single(String),
    List(Vec<String>),
}

impl StringOrList {
    fn into_vec(self) -> Vec<String> {
        match self {
            StringOrList::Single(s) => vec![s],
            StringOrList::List(v) => v,
        }
    }
}

/// Extract the title from a markdown file's content.
/// Tries the first H1 heading (`# Title`), falls back to filename without extension.
fn extract_title(content: &str, filename: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("# ") {
            let title = heading.trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    // Fallback: filename without .md extension
    filename.strip_suffix(".md").unwrap_or(filename).to_string()
}

/// Extract a snippet: first ~160 chars of content after frontmatter/title, stripped of markdown.
fn extract_snippet(content: &str) -> String {
    // Remove frontmatter
    let without_fm = if let Some(rest) = content.strip_prefix("---") {
        if let Some(end) = rest.find("---") {
            rest[end + 3..].trim_start()
        } else {
            content
        }
    } else {
        content
    };

    // Skip the first H1 heading line
    let without_h1 = if let Some(rest) = without_h1_line(without_fm) {
        rest
    } else {
        without_fm
    };

    // Strip markdown formatting and collapse whitespace
    let clean: String = without_h1
        .lines()
        .filter(|line| {
            let t = line.trim();
            // Skip blank lines, headings, code fences, horizontal rules
            !t.is_empty() && !t.starts_with('#') && !t.starts_with("```") && !t.starts_with("---")
        })
        .collect::<Vec<&str>>()
        .join(" ");

    let stripped = strip_markdown_chars(&clean);
    if stripped.len() > 160 {
        // Find last valid char boundary at or before 160 (floor_char_boundary requires Rust 1.91)
        let mut idx = 160;
        while idx > 0 && !stripped.is_char_boundary(idx) {
            idx -= 1;
        }
        format!("{}...", &stripped[..idx])
    } else {
        stripped
    }
}

fn without_h1_line(s: &str) -> Option<&str> {
    for (i, line) in s.lines().enumerate() {
        if line.trim().starts_with("# ") {
            // Return everything after this line
            let offset: usize = s.lines().take(i + 1).map(|l| l.len() + 1).sum();
            return Some(&s[offset.min(s.len())..]);
        }
        // If we hit non-empty non-heading content first, there's no H1 to skip
        if !line.trim().is_empty() {
            return None;
        }
    }
    None
}

/// Collect chars until a delimiter, returning the collected string.
fn collect_until(chars: &mut impl Iterator<Item = char>, delimiter: char) -> String {
    let mut buf = String::new();
    for c in chars.by_ref() {
        if c == delimiter { break; }
        buf.push(c);
    }
    buf
}

/// Skip all chars until a delimiter (consuming the delimiter).
fn skip_until(chars: &mut impl Iterator<Item = char>, delimiter: char) {
    for c in chars.by_ref() {
        if c == delimiter { break; }
    }
}

/// Check if a char is markdown formatting that should be stripped.
fn is_markdown_formatting(ch: char) -> bool {
    matches!(ch, '*' | '_' | '`' | '~')
}

fn strip_markdown_chars(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '[' => {
                let inner = collect_until(&mut chars, ']');
                if chars.peek() == Some(&'(') {
                    chars.next();
                    skip_until(&mut chars, ')');
                }
                result.push_str(&inner);
            }
            c if is_markdown_formatting(c) => {}
            _ => result.push(ch),
        }
    }
    result
}

/// Parse frontmatter from raw YAML data extracted by gray_matter.
fn parse_frontmatter(data: &HashMap<String, serde_json::Value>) -> Frontmatter {
    // Convert HashMap to serde_json::Value for deserialization
    let value = serde_json::Value::Object(
        data.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
    );
    serde_json::from_value(value).unwrap_or_default()
}

/// Known non-relationship frontmatter keys to skip (case-insensitive comparison).
/// Only skip keys that can never contain wikilinks.
const SKIP_KEYS: &[&str] = &[
    "is a", "aliases", "status", "cadence", "archived", "trashed", "trashed at",
    "created at", "created time", "icon", "color", "order",
];

/// Check if a string contains a wikilink pattern `[[...]]`.
fn contains_wikilink(s: &str) -> bool {
    s.contains("[[") && s.contains("]]")
}

/// Extract all wikilink-containing fields from raw YAML frontmatter.
/// Returns a HashMap where each key is the original frontmatter field name
/// and the value is a Vec of wikilink strings found in that field.
/// Handles both single string values and arrays of strings.
fn extract_relationships(data: &HashMap<String, serde_json::Value>) -> HashMap<String, Vec<String>> {
    let mut relationships = HashMap::new();

    for (key, value) in data {
        // Skip known non-relationship keys
        if SKIP_KEYS.iter().any(|k| k.eq_ignore_ascii_case(key)) {
            continue;
        }

        match value {
            serde_json::Value::String(s) => {
                if contains_wikilink(s) {
                    relationships.insert(key.clone(), vec![s.clone()]);
                }
            }
            serde_json::Value::Array(arr) => {
                let wikilinks: Vec<String> = arr
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter(|s| contains_wikilink(s))
                    .map(|s| s.to_string())
                    .collect();
                if !wikilinks.is_empty() {
                    relationships.insert(key.clone(), wikilinks);
                }
            }
            _ => {}
        }
    }

    relationships
}

/// Infer entity type from a parent folder name.
fn infer_type_from_folder(folder: &str) -> String {
    match folder {
        "person" => "Person",
        "project" => "Project",
        "procedure" => "Procedure",
        "responsibility" => "Responsibility",
        "event" => "Event",
        "topic" => "Topic",
        "experiment" => "Experiment",
        "type" => "Type",
        "note" => "Note",
        "quarter" => "Quarter",
        "measure" => "Measure",
        "target" => "Target",
        "journal" => "Journal",
        "month" => "Month",
        "essay" => "Essay",
        "evergreen" => "Evergreen",
        _ => return capitalize_first(folder),
    }.to_string()
}

/// Resolve `is_a` from frontmatter, falling back to parent folder inference.
fn resolve_is_a(fm_is_a: Option<StringOrList>, path: &Path) -> Option<String> {
    fm_is_a
        .and_then(|a| a.into_vec().into_iter().next())
        .or_else(|| {
            path.parent()
                .and_then(|p| p.file_name())
                .map(|f| infer_type_from_folder(&f.to_string_lossy()))
        })
}

/// Parse created_at from frontmatter (prefer "Created at" over "Created time").
fn parse_created_at(fm: &Frontmatter) -> Option<u64> {
    fm.created_at.as_ref().and_then(|s| parse_iso_date(s))
        .or_else(|| fm.created_time.as_ref().and_then(|s| parse_iso_date(s)))
}

/// Extract frontmatter and relationships from parsed gray_matter data.
fn extract_fm_and_rels(data: Option<gray_matter::Pod>) -> (Frontmatter, HashMap<String, Vec<String>>) {
    let hash = match data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return (Frontmatter::default(), HashMap::new()),
    };
    let json_map: HashMap<String, serde_json::Value> = hash
        .into_iter()
        .map(|(k, v)| (k, pod_to_json(v)))
        .collect();
    (parse_frontmatter(&json_map), extract_relationships(&json_map))
}

/// Read file metadata (modified_at timestamp, file size).
fn read_file_metadata(path: &Path) -> Result<(Option<u64>, u64), String> {
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to stat {}: {}", path.display(), e))?;
    let modified_at = metadata.modified().ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok((modified_at, metadata.len()))
}

/// Parse a single markdown file into a VaultEntry.
pub fn parse_md_file(path: &Path) -> Result<VaultEntry, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let filename = path.file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let (frontmatter, mut relationships) = extract_fm_and_rels(parsed.data);

    let title = extract_title(&parsed.content, &filename);
    let snippet = extract_snippet(&content);
    let (modified_at, file_size) = read_file_metadata(path)?;
    let created_at = parse_created_at(&frontmatter);
    let is_a = resolve_is_a(frontmatter.is_a, path);

    // Add "Type" relationship: isA becomes a navigable link to the type document.
    // Skip for type documents themselves (isA == "Type") to avoid self-referential links.
    if let Some(ref type_name) = is_a {
        if type_name != "Type" {
            // If isA is already a wikilink (e.g. "[[type/project]]"), use it directly
            let type_link = if type_name.starts_with("[[") && type_name.ends_with("]]") {
                type_name.clone()
            } else {
                format!("[[type/{}]]", type_name.to_lowercase())
            };
            relationships.insert("Type".to_string(), vec![type_link]);
        }
    }

    Ok(VaultEntry {
        path: path.to_string_lossy().to_string(),
        filename, title, is_a, snippet, relationships,
        aliases: frontmatter.aliases.map(|a| a.into_vec()).unwrap_or_default(),
        belongs_to: frontmatter.belongs_to.map(|b| b.into_vec()).unwrap_or_default(),
        related_to: frontmatter.related_to.map(|r| r.into_vec()).unwrap_or_default(),
        status: frontmatter.status,
        owner: frontmatter.owner,
        cadence: frontmatter.cadence,
        archived: frontmatter.archived.unwrap_or(false),
        trashed: frontmatter.trashed.unwrap_or(false),
        trashed_at: frontmatter.trashed_at.as_deref().and_then(parse_iso_date),
        modified_at, created_at, file_size,
        icon: frontmatter.icon,
        color: frontmatter.color,
        order: frontmatter.order,
    })
}

fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

/// Parse an ISO 8601 date string to Unix timestamp (seconds since epoch).
/// Handles "2025-05-23T14:35:00.000Z" and "2025-05-23" formats.
fn parse_iso_date(date_str: &str) -> Option<u64> {
    use chrono::{NaiveDate, NaiveDateTime};

    let trimmed = date_str.trim().trim_matches('"');

    // Try full datetime with optional fractional seconds and Z suffix
    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S%.fZ") {
        return Some(dt.and_utc().timestamp() as u64);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%SZ") {
        return Some(dt.and_utc().timestamp() as u64);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S") {
        return Some(dt.and_utc().timestamp() as u64);
    }

    // Try date-only
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return Some(d.and_hms_opt(0, 0, 0)?.and_utc().timestamp() as u64);
    }

    None
}

/// Convert gray_matter::Pod to serde_json::Value
fn pod_to_json(pod: gray_matter::Pod) -> serde_json::Value {
    match pod {
        gray_matter::Pod::String(s) => serde_json::Value::String(s),
        gray_matter::Pod::Integer(i) => serde_json::json!(i),
        gray_matter::Pod::Float(f) => serde_json::json!(f),
        gray_matter::Pod::Boolean(b) => serde_json::Value::Bool(b),
        gray_matter::Pod::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(pod_to_json).collect())
        }
        gray_matter::Pod::Hash(map) => {
            let obj: serde_json::Map<String, serde_json::Value> = map
                .into_iter()
                .map(|(k, v)| (k, pod_to_json(v)))
                .collect();
            serde_json::Value::Object(obj)
        }
        gray_matter::Pod::Null => serde_json::Value::Null,
    }
}

/// Scan all markdown files in the vault and delete those where
/// `Trashed at` frontmatter is more than 30 days ago.
/// Returns the list of deleted file paths.
pub fn purge_trash(vault_path: &str) -> Result<Vec<String>, String> {
    use chrono::{NaiveDate, Utc};

    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let today = Utc::now().date_naive();
    let matter = Matter::<YAML>::new();
    let mut deleted = Vec::new();

    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file()
            || path
                .extension()
                .map(|ext| ext != "md")
                .unwrap_or(true)
        {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let parsed = matter.parse(&content);
        let trashed_at_str = match parsed.data {
            Some(gray_matter::Pod::Hash(ref map)) => map
                .get("Trashed at")
                .or_else(|| map.get("trashed_at"))
                .and_then(|v| match v {
                    gray_matter::Pod::String(s) => Some(s.clone()),
                    _ => None,
                }),
            _ => None,
        };

        if let Some(date_str) = trashed_at_str {
            let trimmed = date_str.trim().trim_matches('"');
            // Support both "2026-01-01" and "2026-01-01T..." formats
            let date_part = trimmed.split('T').next().unwrap_or(trimmed);
            if let Ok(trashed_date) = NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                let age = today.signed_duration_since(trashed_date);
                if age.num_days() > 30 {
                    match fs::remove_file(path) {
                        Ok(()) => {
                            log::info!("Purged trashed file: {}", path.display());
                            deleted.push(path.to_string_lossy().to_string());
                        }
                        Err(e) => {
                            log::warn!("Failed to delete {}: {}", path.display(), e);
                        }
                    }
                }
            }
        }
    }

    Ok(deleted)
}

/// Read the content of a single note file.
pub fn get_note_content(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let path = Path::new(vault_path);
    if !path.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }
    if !path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", vault_path));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file()
            && entry_path
                .extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        {
            match parse_md_file(entry_path) {
                Ok(vault_entry) => entries.push(vault_entry),
                Err(e) => {
                    log::warn!("Skipping file: {}", e);
                }
            }
        }
    }

    // Sort by modified date descending (newest first)
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(entries)
}

// --- Vault Cache ---

#[derive(Debug, Serialize, Deserialize)]
struct VaultCache {
    commit_hash: String,
    entries: Vec<VaultEntry>,
}

fn cache_path(vault: &Path) -> std::path::PathBuf {
    vault.join(".laputa-cache.json")
}

fn git_head_hash(vault: &Path) -> Option<String> {
    run_git(vault, &["rev-parse", "HEAD"]).map(|s| s.trim().to_string())
}

/// Run a git command in the given directory and return stdout if successful.
fn run_git(vault: &Path, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(vault)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Parse a git status porcelain line into (status_code, file_path).
fn parse_porcelain_line(line: &str) -> Option<(&str, String)> {
    if line.len() < 3 { return None; }
    Some((&line[..2], line[3..].trim().to_string()))
}

/// Check if a porcelain status indicates a new/untracked file.
fn is_new_file_status(status: &str) -> bool {
    status == "??" || status.starts_with('A')
}

/// Extract .md file paths from git diff --name-only output.
fn collect_md_paths_from_diff(stdout: &str) -> Vec<String> {
    stdout.lines()
        .filter(|line| !line.is_empty() && line.ends_with(".md"))
        .map(|line| line.to_string())
        .collect()
}

/// Extract .md file paths from git status --porcelain output.
fn collect_md_paths_from_porcelain(stdout: &str) -> Vec<String> {
    stdout.lines()
        .filter_map(parse_porcelain_line)
        .filter(|(_, path)| path.ends_with(".md"))
        .map(|(_, path)| path)
        .collect()
}

fn git_changed_files(vault: &Path, from_hash: &str, to_hash: &str) -> Vec<String> {
    let diff_arg = format!("{}..{}", from_hash, to_hash);
    let mut files = run_git(vault, &["diff", &diff_arg, "--name-only"])
        .map(|s| collect_md_paths_from_diff(&s))
        .unwrap_or_default();

    let uncommitted = run_git(vault, &["status", "--porcelain"])
        .map(|s| collect_md_paths_from_porcelain(&s))
        .unwrap_or_default();

    for path in uncommitted {
        if !files.contains(&path) {
            files.push(path);
        }
    }

    files
}

fn git_uncommitted_new_files(vault: &Path) -> Vec<String> {
    let stdout = match run_git(vault, &["status", "--porcelain"]) {
        Some(s) => s,
        None => return Vec::new(),
    };
    stdout.lines()
        .filter_map(parse_porcelain_line)
        .filter(|(status, path)| path.ends_with(".md") && is_new_file_status(status))
        .map(|(_, path)| path)
        .collect()
}

fn load_cache(vault: &Path) -> Option<VaultCache> {
    let data = fs::read_to_string(cache_path(vault)).ok()?;
    serde_json::from_str(&data).ok()
}

fn write_cache(vault: &Path, cache: &VaultCache) {
    if let Ok(data) = serde_json::to_string(cache) {
        let _ = fs::write(cache_path(vault), data);
    }
}

/// Normalize an absolute path to a relative path for comparison with git output.
fn to_relative_path(abs_path: &str, vault: &Path) -> String {
    let vault_str = vault.to_string_lossy();
    let with_slash = format!("{}/", vault_str);
    abs_path.strip_prefix(&with_slash)
        .or_else(|| abs_path.strip_prefix(vault_str.as_ref()))
        .unwrap_or(abs_path)
        .to_string()
}

/// Parse .md files from a list of relative paths, skipping any that don't exist.
fn parse_files_at(vault: &Path, rel_paths: &[String]) -> Vec<VaultEntry> {
    rel_paths.iter()
        .filter_map(|rel| {
            let abs = vault.join(rel);
            if abs.is_file() { parse_md_file(&abs).ok() } else { None }
        })
        .collect()
}

/// Sort entries by modified_at descending and write the cache.
fn finalize_and_cache(vault: &Path, mut entries: Vec<VaultEntry>, hash: String) -> Vec<VaultEntry> {
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    write_cache(vault, &VaultCache { commit_hash: hash, entries: entries.clone() });
    entries
}

/// Handle same-commit cache hit: add any uncommitted new files.
fn update_same_commit(vault: &Path, cache: VaultCache) -> Vec<VaultEntry> {
    let new_files = git_uncommitted_new_files(vault);
    let mut entries = cache.entries;
    let existing: std::collections::HashSet<String> = entries.iter()
        .map(|e| to_relative_path(&e.path, vault))
        .collect();

    let new_entries = parse_files_at(vault, &new_files);
    for entry in new_entries {
        let rel = to_relative_path(&entry.path, vault);
        if !existing.contains(&rel) {
            entries.push(entry);
        }
    }

    finalize_and_cache(vault, entries, cache.commit_hash)
}

/// Handle different-commit cache: incremental update via git diff.
fn update_different_commit(vault: &Path, cache: VaultCache, current_hash: String) -> Vec<VaultEntry> {
    let changed_files = git_changed_files(vault, &cache.commit_hash, &current_hash);
    let changed_set: std::collections::HashSet<String> = changed_files.iter().cloned().collect();

    let mut entries: Vec<VaultEntry> = cache.entries.into_iter()
        .filter(|e| !changed_set.contains(&to_relative_path(&e.path, vault)))
        .collect();
    entries.extend(parse_files_at(vault, &changed_files));

    finalize_and_cache(vault, entries, current_hash)
}

/// Scan vault with incremental caching via git.
/// Falls back to full scan if cache is missing/corrupt or git is unavailable.
pub fn scan_vault_cached(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!("Vault path does not exist or is not a directory: {}", vault_path));
    }

    let current_hash = match git_head_hash(vault) {
        Some(h) => h,
        None => return scan_vault(vault_path),
    };

    if let Some(cache) = load_cache(vault) {
        return if cache.commit_hash == current_hash {
            Ok(update_same_commit(vault, cache))
        } else {
            Ok(update_different_commit(vault, cache, current_hash))
        };
    }

    // No cache — full scan and write cache
    let entries = scan_vault(vault_path)?;
    Ok(finalize_and_cache(vault, entries, current_hash))
}

// Re-export for external consumers
pub use crate::frontmatter::FrontmatterValue;

/// Update a single frontmatter property in a markdown file
pub fn update_frontmatter(path: &str, key: &str, value: FrontmatterValue) -> Result<String, String> {
    with_frontmatter(path, |content| update_frontmatter_content(content, key, Some(value.clone())))
}

/// Delete a frontmatter property from a markdown file
pub fn delete_frontmatter_property(path: &str, key: &str) -> Result<String, String> {
    with_frontmatter(path, |content| update_frontmatter_content(content, key, None))
}

/// Check if a character is safe for use in filenames (alphanumeric, dot, dash, underscore).
fn is_safe_filename_char(c: char) -> bool {
    c.is_alphanumeric() || matches!(c, '.' | '-' | '_')
}

/// Sanitize a filename by replacing unsafe characters with underscores.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if is_safe_filename_char(c) { c } else { '_' })
        .collect()
}

/// Save an uploaded image to the vault's attachments directory.
/// Returns the absolute path to the saved file.
pub fn save_image(vault_path: &str, filename: &str, data: &str) -> Result<String, String> {
    use base64::Engine;

    let vault = Path::new(vault_path);
    let attachments_dir = vault.join("attachments");

    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments directory: {}", e))?;

    // Generate unique filename to avoid collisions
    let timestamp = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let unique_name = format!("{}-{}", timestamp, sanitize_filename(filename));
    let target_path = attachments_dir.join(&unique_name);

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("Invalid base64 data: {}", e))?;

    fs::write(&target_path, bytes)
        .map_err(|e| format!("Failed to write image: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// Write (or overwrite) a note file to disk, creating parent directories as needed.
pub fn write_note(path: &str, content: &str) -> Result<(), String> {
    let file_path = Path::new(path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories for {}: {}", path, e))?;
    }
    fs::write(file_path, content)
        .map_err(|e| format!("Failed to write note {}: {}", path, e))
}

/// Result of a rename operation
#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    /// New absolute file path after rename
    pub new_path: String,
    /// Number of other files updated (wiki link replacements)
    pub updated_files: usize,
}

/// Convert a title to a filename slug (lowercase, hyphens, no special chars).
fn title_to_slug(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}

/// Update the first H1 heading in markdown content to a new title.
fn update_h1_title(content: &str, new_title: &str) -> String {
    let has_h1 = content.lines().any(|l| l.trim().starts_with("# "));
    if !has_h1 {
        return content.to_string();
    }

    let result: Vec<String> = content.lines().map(|l| {
        if l.trim().starts_with("# ") { format!("# {}", new_title) } else { l.to_string() }
    }).collect();

    let joined = result.join("\n");
    if content.ends_with('\n') && !joined.ends_with('\n') {
        format!("{}\n", joined)
    } else {
        joined
    }
}

/// Build a regex that matches wiki links referencing old title or path stem.
fn build_wikilink_pattern(old_title: &str, old_path_stem: &str) -> Option<Regex> {
    let pattern_str = format!(
        r"\[\[(?:{}|{})(\|[^\]]*?)?\]\]",
        regex::escape(old_title),
        regex::escape(old_path_stem),
    );
    Regex::new(&pattern_str).ok()
}

/// Check if a path is a vault markdown file eligible for wikilink replacement.
fn is_replaceable_md_file(path: &Path, exclude: &Path) -> bool {
    path.is_file()
        && path != exclude
        && path.extension().is_some_and(|ext| ext == "md")
}

/// Replace wikilink references in a single file's content. Returns updated content if changed.
fn replace_wikilinks_in_content(content: &str, re: &Regex, new_title: &str) -> Option<String> {
    if !re.is_match(content) {
        return None;
    }
    let replaced = re.replace_all(content, |caps: &regex::Captures| {
        match caps.get(1) {
            Some(pipe) => format!("[[{}{}]]", new_title, pipe.as_str()),
            None => format!("[[{}]]", new_title),
        }
    });
    if replaced != content { Some(replaced.into_owned()) } else { None }
}

/// Parameters for a vault-wide wikilink replacement.
struct WikilinkReplacement<'a> {
    vault_path: &'a Path,
    old_title: &'a str,
    new_title: &'a str,
    old_path_stem: &'a str,
    exclude_path: &'a Path,
}

/// Collect all .md file paths in vault eligible for wikilink replacement.
fn collect_md_files(vault_path: &Path, exclude: &Path) -> Vec<std::path::PathBuf> {
    WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.into_path())
        .filter(|p| is_replaceable_md_file(p, exclude))
        .collect()
}

/// Replace wiki link references across all vault markdown files.
fn update_wikilinks_in_vault(params: &WikilinkReplacement) -> usize {
    let re = match build_wikilink_pattern(params.old_title, params.old_path_stem) {
        Some(r) => r,
        None => return 0,
    };

    let files = collect_md_files(params.vault_path, params.exclude_path);
    files.iter().filter(|path| {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return false,
        };
        match replace_wikilinks_in_content(&content, &re, params.new_title) {
            Some(new_content) => fs::write(path, &new_content).is_ok(),
            None => false,
        }
    }).count()
}

/// Check if frontmatter contains a `title:` key.
fn frontmatter_has_title_key(content: &str) -> bool {
    if !content.starts_with("---\n") {
        return false;
    }
    content[4..].split("\n---").next()
        .map(|fm| fm.lines().any(|l| {
            let t = l.trim_start();
            t.starts_with("title:") || t.starts_with("\"title\":")
        }))
        .unwrap_or(false)
}

/// Update H1 and optionally the `title:` frontmatter field in content.
fn update_note_title_in_content(content: &str, new_title: &str) -> String {
    let mut updated = update_h1_title(content, new_title);
    if frontmatter_has_title_key(content) {
        let value = crate::frontmatter::FrontmatterValue::String(new_title.to_string());
        if let Ok(c) = update_frontmatter_content(&updated, "title", Some(value)) {
            updated = c;
        }
    }
    updated
}

/// Strip vault prefix and .md suffix to get the relative path stem (e.g., "project/weekly-review").
fn to_path_stem<'a>(abs_path: &'a str, vault_prefix: &str) -> &'a str {
    abs_path
        .strip_prefix(vault_prefix)
        .unwrap_or(abs_path)
        .strip_suffix(".md")
        .unwrap_or(abs_path)
}

/// Rename a note: update its title, rename the file, and update wiki links across the vault.
pub fn rename_note(vault_path: &str, old_path: &str, new_title: &str) -> Result<RenameResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(old_path);

    if !old_file.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }
    let new_title = new_title.trim();
    if new_title.is_empty() {
        return Err("New title cannot be empty".to_string());
    }

    let content = fs::read_to_string(old_file)
        .map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let old_filename = old_file.file_name()
        .map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
    let old_title = extract_title(&content, &old_filename);

    if old_title == new_title {
        return Ok(RenameResult { new_path: old_path.to_string(), updated_files: 0 });
    }

    // Update content (H1 + frontmatter title)
    let updated_content = update_note_title_in_content(&content, new_title);

    // Compute new path and write file
    let parent_dir = old_file.parent().ok_or("Cannot determine parent directory")?;
    let new_file = parent_dir.join(format!("{}.md", title_to_slug(new_title)));
    let new_path_str = new_file.to_string_lossy().to_string();

    fs::write(&new_file, &updated_content)
        .map_err(|e| format!("Failed to write {}: {}", new_path_str, e))?;
    if old_file != new_file {
        fs::remove_file(old_file)
            .map_err(|e| format!("Failed to remove old file {}: {}", old_path, e))?;
    }

    // Update wikilinks across the vault
    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let updated_files = update_wikilinks_in_vault(&WikilinkReplacement {
        vault_path: vault, old_title: &old_title, new_title, old_path_stem, exclude_path: &new_file,
    });

    Ok(RenameResult { new_path: new_path_str, updated_files })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_extract_title_from_h1() {
        let content = "---\nIs A: Note\n---\n# My Great Note\n\nSome content here.";
        assert_eq!(extract_title(content, "my-great-note.md"), "My Great Note");
    }

    #[test]
    fn test_extract_title_fallback_to_filename() {
        let content = "Just some content without a heading.";
        assert_eq!(extract_title(content, "fallback-title.md"), "fallback-title");
    }

    #[test]
    fn test_extract_title_empty_h1_falls_back() {
        let content = "# \n\nSome content.";
        assert_eq!(extract_title(content, "empty-h1.md"), "empty-h1");
    }

    fn parse_test_entry(dir: &TempDir, name: &str, content: &str) -> VaultEntry {
        create_test_file(dir.path(), name, content);
        parse_md_file(&dir.path().join(name)).unwrap()
    }

    const FULL_FM_CONTENT: &str = "---\nIs A: Project\naliases:\n  - Laputa\n  - Castle in the Sky\nBelongs to:\n  - Studio Ghibli\nRelated to:\n  - Miyazaki\nStatus: Active\nOwner: Luca\nCadence: Weekly\n---\n# Laputa Project\n\nThis is a project note.\n";

    #[test]
    fn test_parse_full_frontmatter_identity() {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
        assert_eq!(entry.title, "Laputa Project");
        assert_eq!(entry.is_a, Some("Project".to_string()));
        assert_eq!(entry.filename, "laputa.md");
    }

    #[test]
    fn test_parse_full_frontmatter_lists() {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
        assert_eq!(entry.aliases, vec!["Laputa", "Castle in the Sky"]);
        assert_eq!(entry.belongs_to, vec!["Studio Ghibli"]);
        assert_eq!(entry.related_to, vec!["Miyazaki"]);
    }

    #[test]
    fn test_parse_full_frontmatter_scalars() {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
        assert_eq!(entry.status, Some("Active".to_string()));
        assert_eq!(entry.owner, Some("Luca".to_string()));
        assert_eq!(entry.cadence, Some("Weekly".to_string()));
    }

    #[test]
    fn test_parse_empty_frontmatter() {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "empty-fm.md", "---\n---\n# Just a Title\n\nNo frontmatter fields.");
        assert_eq!(entry.title, "Just a Title");
        assert!(entry.aliases.is_empty());

        assert!(entry.belongs_to.is_empty());
        assert_eq!(entry.status, None);
    }

    #[test]
    fn test_parse_no_frontmatter() {
        let dir = TempDir::new().unwrap();
        let content = "# A Note Without Frontmatter\n\nJust markdown.";
        create_test_file(dir.path(), "no-fm.md", content);

        let entry = parse_md_file(&dir.path().join("no-fm.md")).unwrap();
        assert_eq!(entry.title, "A Note Without Frontmatter");
        // is_a is inferred from parent folder name (temp dir), not None
    }

    #[test]
    fn test_parse_single_string_aliases() {
        let dir = TempDir::new().unwrap();
        let content = "---\naliases: SingleAlias\n---\n# Test\n";
        create_test_file(dir.path(), "single-alias.md", content);

        let entry = parse_md_file(&dir.path().join("single-alias.md")).unwrap();
        assert_eq!(entry.aliases, vec!["SingleAlias"]);
    }

    #[test]
    fn test_scan_vault_recursive() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "root.md", "# Root Note\n");
        create_test_file(dir.path(), "sub/nested.md", "---\nIs A: Task\n---\n# Nested\n");
        create_test_file(dir.path(), "not-markdown.txt", "This should be ignored");

        let entries = scan_vault(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 2);

        let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
        assert!(filenames.contains(&"root.md"));
        assert!(filenames.contains(&"nested.md"));
    }

    #[test]
    fn test_scan_vault_nonexistent_path() {
        let result = scan_vault("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_malformed_yaml() {
        let dir = TempDir::new().unwrap();
        // Malformed YAML — gray_matter should handle this gracefully
        let content = "---\nIs A: [unclosed bracket\n---\n# Malformed\n";
        create_test_file(dir.path(), "malformed.md", content);

        let entry = parse_md_file(&dir.path().join("malformed.md"));
        // Should still succeed — gray_matter may parse partially or skip
        assert!(entry.is_ok());
    }

    #[test]
    fn test_get_note_content() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
        create_test_file(dir.path(), "test.md", content);

        let path = dir.path().join("test.md");
        let result = get_note_content(path.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_get_note_content_nonexistent() {
        let result = get_note_content("/nonexistent/path/file.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_snippet_basic() {
        let content = "---\nIs A: Note\n---\n# My Note\n\nThis is the first paragraph of content.\n\n## Section Two\n\nMore content here.";
        let snippet = extract_snippet(content);
        assert!(snippet.starts_with("This is the first paragraph"));
        assert!(snippet.contains("More content here"));
    }

    #[test]
    fn test_extract_snippet_strips_markdown() {
        let content = "# Title\n\nSome **bold** and *italic* and `code` text.";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "Some bold and italic and code text.");
    }

    #[test]
    fn test_extract_snippet_strips_links() {
        let content = "# Title\n\nSee [this link](https://example.com) and [[wiki link]].";
        let snippet = extract_snippet(content);
        assert!(snippet.contains("this link"));
        assert!(!snippet.contains("https://example.com"));
    }

    #[test]
    fn test_extract_snippet_truncates() {
        let long_content = format!("# Title\n\n{}", "word ".repeat(100));
        let snippet = extract_snippet(&long_content);
        assert!(snippet.len() <= 165); // 160 + "..."
        assert!(snippet.ends_with("..."));
    }

    #[test]
    fn test_extract_snippet_no_content() {
        let content = "---\nIs A: Note\n---\n# Just a Title\n";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "");
    }

    #[test]
    fn test_parse_md_file_has_snippet() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world! This is a snippet.";
        create_test_file(dir.path(), "test.md", content);

        let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
        assert_eq!(entry.snippet, "Hello, world! This is a snippet.");
    }

    #[test]
    fn test_scan_vault_cached_no_git() {
        // Without git, scan_vault_cached falls back to scan_vault
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "note.md", "# Note\n\nContent here.");

        let entries = scan_vault_cached(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Note");
        assert_eq!(entries[0].snippet, "Content here.");
    }

    #[test]
    fn test_scan_vault_cached_with_git() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        // Init git repo
        std::process::Command::new("git").args(["init"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.name", "Test"]).current_dir(vault).output().unwrap();

        create_test_file(vault, "note.md", "# Note\n\nFirst version.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "init"]).current_dir(vault).output().unwrap();

        // First call: full scan, writes cache
        let entries = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(cache_path(vault).exists());

        // Second call: uses cache (same HEAD)
        let entries2 = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries2.len(), 1);
        assert_eq!(entries2[0].title, "Note");
    }

    #[test]
    fn test_parse_relationships_array() {
        let dir = TempDir::new().unwrap();
        let content = r#"---
Is A: Responsibility
Has:
  - "[[essay/foo|Foo Essay]]"
  - "[[essay/bar|Bar Essay]]"
Topics:
  - "[[topic/rust]]"
  - "[[topic/wasm]]"
Status: Active
---
# Publish Essays
"#;
        create_test_file(dir.path(), "publish-essays.md", content);

        let entry = parse_md_file(&dir.path().join("publish-essays.md")).unwrap();
        assert_eq!(entry.relationships.len(), 3); // Has, Topics, Type
        assert_eq!(
            entry.relationships.get("Has").unwrap(),
            &vec!["[[essay/foo|Foo Essay]]".to_string(), "[[essay/bar|Bar Essay]]".to_string()]
        );
        assert_eq!(
            entry.relationships.get("Topics").unwrap(),
            &vec!["[[topic/rust]]".to_string(), "[[topic/wasm]]".to_string()]
        );
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/responsibility]]".to_string()]
        );
    }

    #[test]
    fn test_parse_relationships_single_string() {
        let dir = TempDir::new().unwrap();
        let content = r#"---
Is A: Project
Owner: "[[person/luca-rossi|Luca Rossi]]"
Belongs to:
  - "[[responsibility/grow-newsletter]]"
---
# Some Project
"#;
        create_test_file(dir.path(), "some-project.md", content);

        let entry = parse_md_file(&dir.path().join("some-project.md")).unwrap();
        // Owner contains a wikilink, so it should appear in relationships
        assert_eq!(
            entry.relationships.get("Owner").unwrap(),
            &vec!["[[person/luca-rossi|Luca Rossi]]".to_string()]
        );
        // Belongs to is also a wikilink array, should appear in relationships
        assert_eq!(
            entry.relationships.get("Belongs to").unwrap(),
            &vec!["[[responsibility/grow-newsletter]]".to_string()]
        );
        // Still parsed in the dedicated field too
        assert_eq!(entry.belongs_to, vec!["[[responsibility/grow-newsletter]]"]);
    }

    #[test]
    fn test_parse_relationships_ignores_non_wikilinks() {
        let dir = TempDir::new().unwrap();
        let content = r#"---
Is A: Note
Status: Active
Tags:
  - productivity
  - writing
Custom Field: just a plain string
---
# A Note
"#;
        create_test_file(dir.path(), "plain-note.md", content);

        let entry = parse_md_file(&dir.path().join("plain-note.md")).unwrap();
        // Tags and Custom Field don't contain wikilinks — only the auto-generated "Type" relationship
        assert_eq!(entry.relationships.len(), 1);
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/note]]".to_string()]
        );
    }

    const BIG_PROJECT_CONTENT: &str = "---\nIs A: Project\nHas:\n  - \"[[deliverable/mvp]]\"\n  - \"[[deliverable/v2]]\"\nTopics:\n  - \"[[topic/ai]]\"\n  - \"[[topic/compilers]]\"\nEvents:\n  - \"[[event/launch-day]]\"\nNotes:\n  - \"[[note/design-rationale]]\"\n  - \"[[note/meeting-2024-01]]\"\n  - \"[[note/meeting-2024-02]]\"\nOwner: \"[[person/alice]]\"\nRelated to:\n  - \"[[project/sibling-project]]\"\nBelongs to:\n  - \"[[area/engineering]]\"\nStatus: Active\n---\n# Big Project\n";

    fn parse_big_project_rels() -> HashMap<String, Vec<String>> {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "big-project.md", BIG_PROJECT_CONTENT);
        entry.relationships
    }

    #[test]
    fn test_parse_relationships_custom_fields() {
        let rels = parse_big_project_rels();
        assert_eq!(rels.get("Has").unwrap().len(), 2);
        assert_eq!(rels.get("Topics").unwrap().len(), 2);
        assert_eq!(rels.get("Events").unwrap().len(), 1);
    }

    #[test]
    fn test_parse_relationships_owner_and_notes() {
        let rels = parse_big_project_rels();
        assert_eq!(rels.get("Notes").unwrap().len(), 3);
        assert_eq!(rels.get("Owner").unwrap(), &vec!["[[person/alice]]".to_string()]);
    }

    #[test]
    fn test_parse_relationships_builtin_wikilink_fields() {
        let rels = parse_big_project_rels();
        assert_eq!(rels.get("Related to").unwrap().len(), 1);
        assert_eq!(rels.get("Belongs to").unwrap().len(), 1);
    }

    #[test]
    fn test_parse_relationships_skip_keys_excluded_from_generic() {
        let rels = parse_big_project_rels();
        assert!(rels.get("Status").is_none());
        assert!(rels.get("Is A").is_none());
    }

    #[test]
    fn test_parse_relationships_single_vs_array_wikilinks() {
        // Verifies both single wikilink strings and arrays are parsed correctly.
        let dir = TempDir::new().unwrap();
        let content = r#"---
Mentor: "[[person/bob|Bob Smith]]"
Reviewers:
  - "[[person/carol]]"
  - "[[person/dave]]"
Context: "[[area/research]]"
---
# A Note
"#;
        create_test_file(dir.path(), "single-vs-array.md", content);

        let entry = parse_md_file(&dir.path().join("single-vs-array.md")).unwrap();

        // Single string → Vec with one element
        assert_eq!(
            entry.relationships.get("Mentor").unwrap(),
            &vec!["[[person/bob|Bob Smith]]".to_string()]
        );
        // Array → Vec with multiple elements
        assert_eq!(
            entry.relationships.get("Reviewers").unwrap(),
            &vec!["[[person/carol]]".to_string(), "[[person/dave]]".to_string()]
        );
        // Another single string
        assert_eq!(
            entry.relationships.get("Context").unwrap(),
            &vec!["[[area/research]]".to_string()]
        );
    }

    const SKIP_KEYS_CONTENT: &str = "---\nIs A: \"[[type/project]]\"\nAliases:\n  - \"[[alias/foo]]\"\nStatus: \"[[status/active]]\"\nCadence: \"[[cadence/weekly]]\"\nCreated at: \"[[time/2024-01-01]]\"\nCreated time: \"[[time/noon]]\"\nReal Relation: \"[[note/important]]\"\n---\n# Skip Keys Test\n";

    fn parse_skip_keys_rels() -> (HashMap<String, Vec<String>>, usize) {
        let dir = TempDir::new().unwrap();
        let entry = parse_test_entry(&dir, "skip-keys.md", SKIP_KEYS_CONTENT);
        let len = entry.relationships.len();
        (entry.relationships, len)
    }

    #[test]
    fn test_skip_keys_identity_fields_excluded() {
        let (rels, _) = parse_skip_keys_rels();
        assert!(rels.get("Is A").is_none());
        assert!(rels.get("Aliases").is_none());
        assert!(rels.get("Status").is_none());
    }

    #[test]
    fn test_skip_keys_temporal_fields_excluded() {
        let (rels, _) = parse_skip_keys_rels();
        assert!(rels.get("Cadence").is_none());
        assert!(rels.get("Created at").is_none());
        assert!(rels.get("Created time").is_none());
    }

    #[test]
    fn test_skip_keys_real_relation_included() {
        let (rels, len) = parse_skip_keys_rels();
        assert_eq!(rels.get("Real Relation").unwrap(), &vec!["[[note/important]]".to_string()]);
        // "Real Relation" + auto-generated "Type" (from is_a: "[[type/project]]")
        assert_eq!(len, 2);
        assert_eq!(
            rels.get("Type").unwrap(),
            &vec!["[[type/project]]".to_string()]
        );
    }

    #[test]
    fn test_parse_relationships_mixed_wikilinks_and_plain_in_array() {
        // Verifies that within an array, only wikilink entries are kept.
        let dir = TempDir::new().unwrap();
        let content = r#"---
References:
  - "[[source/paper-a]]"
  - "just a plain string"
  - "[[source/paper-b]]"
  - "no links here"
---
# Mixed Array
"#;
        create_test_file(dir.path(), "mixed-array.md", content);

        let entry = parse_md_file(&dir.path().join("mixed-array.md")).unwrap();

        // Only the wikilink entries should be captured
        assert_eq!(
            entry.relationships.get("References").unwrap(),
            &vec!["[[source/paper-a]]".to_string(), "[[source/paper-b]]".to_string()]
        );
    }

    // --- parse_iso_date tests ---

    #[test]
    fn test_parse_iso_date_full_datetime_with_z() {
        let ts = parse_iso_date("2025-05-23T14:35:00.000Z");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap(), 1748010900);
    }

    #[test]
    fn test_parse_iso_date_datetime_no_fractional() {
        let ts = parse_iso_date("2025-05-23T14:35:00Z");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap(), 1748010900);
    }

    #[test]
    fn test_parse_iso_date_datetime_no_z() {
        let ts = parse_iso_date("2025-05-23T14:35:00");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap(), 1748010900);
    }

    #[test]
    fn test_parse_iso_date_date_only() {
        let ts = parse_iso_date("2025-05-23");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap(), 1747958400); // midnight UTC
    }

    #[test]
    fn test_parse_iso_date_with_quotes_and_whitespace() {
        let ts = parse_iso_date("  \"2025-05-23\"  ");
        assert!(ts.is_some());
        assert_eq!(ts.unwrap(), 1747958400);
    }

    #[test]
    fn test_parse_iso_date_invalid() {
        assert!(parse_iso_date("not-a-date").is_none());
        assert!(parse_iso_date("").is_none());
        assert!(parse_iso_date("2025-13-45").is_none());
    }

    // --- strip_markdown_chars tests ---

    #[test]
    fn test_strip_markdown_chars_plain_text() {
        assert_eq!(strip_markdown_chars("hello world"), "hello world");
    }

    #[test]
    fn test_strip_markdown_chars_emphasis() {
        assert_eq!(strip_markdown_chars("**bold** and *italic*"), "bold and italic");
    }

    #[test]
    fn test_strip_markdown_chars_backticks() {
        assert_eq!(strip_markdown_chars("use `code` here"), "use code here");
    }

    #[test]
    fn test_strip_markdown_chars_strikethrough() {
        assert_eq!(strip_markdown_chars("~~deleted~~"), "deleted");
    }

    #[test]
    fn test_strip_markdown_chars_link_with_url() {
        assert_eq!(strip_markdown_chars("[click here](https://example.com)"), "click here");
    }

    #[test]
    fn test_strip_markdown_chars_wikilink() {
        // Note: strip_markdown_chars handles single brackets [text](url) well
        // but wikilinks [[text]] leave one layer of brackets. This is acceptable
        // because extract_snippet already handles the common case.
        assert_eq!(strip_markdown_chars("see [[my note]]"), "see [my note]");
    }

    #[test]
    fn test_strip_markdown_chars_bracket_without_url() {
        assert_eq!(strip_markdown_chars("[just brackets]"), "just brackets");
    }

    #[test]
    fn test_strip_markdown_chars_empty() {
        assert_eq!(strip_markdown_chars(""), "");
    }

    // --- capitalize_first tests ---

    #[test]
    fn test_capitalize_first_normal() {
        assert_eq!(capitalize_first("person"), "Person");
    }

    #[test]
    fn test_capitalize_first_already_capitalized() {
        assert_eq!(capitalize_first("Project"), "Project");
    }

    #[test]
    fn test_capitalize_first_empty() {
        assert_eq!(capitalize_first(""), "");
    }

    #[test]
    fn test_capitalize_first_single_char() {
        assert_eq!(capitalize_first("a"), "A");
    }

    // --- infer_type_from_folder tests ---

    #[test]
    fn test_infer_type_from_known_folders() {
        let dir = TempDir::new().unwrap();
        let known_folders = vec![
            ("person", "Person"),
            ("project", "Project"),
            ("procedure", "Procedure"),
            ("responsibility", "Responsibility"),
            ("event", "Event"),
            ("topic", "Topic"),
            ("experiment", "Experiment"),
            ("note", "Note"),
            ("quarter", "Quarter"),
            ("measure", "Measure"),
            ("target", "Target"),
            ("journal", "Journal"),
            ("month", "Month"),
            ("essay", "Essay"),
            ("evergreen", "Evergreen"),
        ];
        for (folder, expected_type) in known_folders {
            create_test_file(dir.path(), &format!("{}/test.md", folder), "# Test\n");
            let entry = parse_md_file(&dir.path().join(folder).join("test.md")).unwrap();
            assert_eq!(entry.is_a, Some(expected_type.to_string()), "folder '{}' should infer type '{}'", folder, expected_type);
        }
    }

    #[test]
    fn test_infer_type_from_unknown_folder_capitalizes() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "recipe/test.md", "# Test\n");
        let entry = parse_md_file(&dir.path().join("recipe/test.md")).unwrap();
        assert_eq!(entry.is_a, Some("Recipe".to_string()));
    }

    #[test]
    fn test_infer_type_frontmatter_overrides_folder() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "person/test.md", "---\nIs A: Custom\n---\n# Test\n");
        let entry = parse_md_file(&dir.path().join("person/test.md")).unwrap();
        assert_eq!(entry.is_a, Some("Custom".to_string()));
    }

    // --- without_h1_line tests ---

    #[test]
    fn test_without_h1_line_starts_with_h1() {
        let result = without_h1_line("# Title\nBody text");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "Body text");
    }

    #[test]
    fn test_without_h1_line_blank_lines_then_h1() {
        let result = without_h1_line("\n\n# Title\nBody");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "Body");
    }

    #[test]
    fn test_without_h1_line_non_heading_first() {
        let result = without_h1_line("Some text\n# Title\n");
        assert!(result.is_none());
    }

    #[test]
    fn test_without_h1_line_empty() {
        let result = without_h1_line("");
        assert!(result.is_none());
    }

    #[test]
    fn test_without_h1_line_only_blank_lines() {
        let result = without_h1_line("\n\n\n");
        assert!(result.is_none());
    }

    // --- extract_snippet edge cases ---

    #[test]
    fn test_extract_snippet_code_fence_delimiters_skipped() {
        // Note: the line-based filter skips ``` fence delimiters but not
        // content between fences. This is a known limitation.
        let content = "# Title\n\n```rust\nfn main() {}\n```\n\nReal content here.";
        let snippet = extract_snippet(content);
        assert!(!snippet.contains("```"));
        assert!(snippet.contains("Real content here"));
    }

    #[test]
    fn test_extract_snippet_only_headings() {
        let content = "# Title\n\n## Section One\n\n### Sub Section\n";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "");
    }

    #[test]
    fn test_extract_snippet_no_frontmatter_no_h1() {
        let content = "Just plain text content without any heading.";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "Just plain text content without any heading.");
    }

    #[test]
    fn test_extract_snippet_unclosed_frontmatter() {
        let content = "---\nIs A: Note\nThis has no closing fence\n# Title\n\nBody text.";
        let snippet = extract_snippet(content);
        // unclosed frontmatter means it treats "---" as not having a close
        // so the content is the full string
        assert!(snippet.contains("Body text"));
    }

    #[test]
    fn test_extract_snippet_horizontal_rules_skipped() {
        let content = "# Title\n\n---\n\nContent after rule.";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "Content after rule.");
    }

    // --- contains_wikilink tests ---

    #[test]
    fn test_contains_wikilink_true() {
        assert!(contains_wikilink("[[some note]]"));
        assert!(contains_wikilink("text before [[link]] text after"));
    }

    #[test]
    fn test_contains_wikilink_false_plain_text() {
        assert!(!contains_wikilink("no links here"));
        assert!(!contains_wikilink("[single bracket]"));
    }

    #[test]
    fn test_contains_wikilink_false_partial_markers() {
        assert!(!contains_wikilink("only [[ opening"));
        assert!(!contains_wikilink("only ]] closing"));
    }

    // --- scan_vault_cached incremental update ---

    #[test]
    fn test_scan_vault_cached_incremental_different_commit() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();

        // Init git repo
        std::process::Command::new("git").args(["init"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.email", "test@test.com"]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["config", "user.name", "Test"]).current_dir(vault).output().unwrap();

        create_test_file(vault, "first.md", "# First\n\nFirst note.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "first"]).current_dir(vault).output().unwrap();

        // Build cache
        let entries = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);

        // Add a second file and commit
        create_test_file(vault, "second.md", "# Second\n\nSecond note.");
        std::process::Command::new("git").args(["add", "."]).current_dir(vault).output().unwrap();
        std::process::Command::new("git").args(["commit", "-m", "second"]).current_dir(vault).output().unwrap();

        // Incremental update: cache has old commit, new commit adds second.md
        let entries2 = scan_vault_cached(vault.to_str().unwrap()).unwrap();
        assert_eq!(entries2.len(), 2);
        let titles: Vec<&str> = entries2.iter().map(|e| e.title.as_str()).collect();
        assert!(titles.contains(&"First"));
        assert!(titles.contains(&"Second"));
    }

    // --- created_at parsing from frontmatter ---

    #[test]
    fn test_parse_created_at_from_frontmatter() {
        let dir = TempDir::new().unwrap();
        let content = "---\nCreated at: 2025-05-23T14:35:00.000Z\n---\n# Test\n";
        create_test_file(dir.path(), "test.md", content);

        let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
        assert_eq!(entry.created_at, Some(1748010900));
    }

    #[test]
    fn test_parse_created_time_fallback() {
        let dir = TempDir::new().unwrap();
        let content = "---\nCreated time: 2025-05-23\n---\n# Test\n";
        create_test_file(dir.path(), "test.md", content);

        let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
        assert_eq!(entry.created_at, Some(1747958400));
    }

    // --- Type relationship tests ---

    #[test]
    fn test_type_relationship_added_for_regular_entries() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Project\n---\n# My Project\n";
        let entry = parse_test_entry(&dir, "project/my-project.md", content);
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/project]]".to_string()]
        );
    }

    #[test]
    fn test_type_relationship_skipped_for_type_documents() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Type\n---\n# Project\n";
        let entry = parse_test_entry(&dir, "type/project.md", content);
        assert!(entry.relationships.get("Type").is_none());
    }

    #[test]
    fn test_type_relationship_from_folder_inference() {
        let dir = TempDir::new().unwrap();
        let content = "# A Person\n\nSome content.";
        let entry = parse_test_entry(&dir, "person/someone.md", content);
        assert_eq!(entry.is_a, Some("Person".to_string()));
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/person]]".to_string()]
        );
    }

    #[test]
    fn test_type_relationship_handles_wikilink_is_a() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: \"[[type/experiment]]\"\n---\n# Test\n";
        let entry = parse_test_entry(&dir, "test.md", content);
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/experiment]]".to_string()]
        );
    }

    #[test]
    fn test_type_folder_inferred_as_type() {
        let dir = TempDir::new().unwrap();
        let content = "# Some Type\n";
        let entry = parse_test_entry(&dir, "type/some-type.md", content);
        assert_eq!(entry.is_a, Some("Type".to_string()));
    }

    // Frontmatter update/delete tests are in frontmatter.rs

    // --- save_image tests ---

    #[test]
    fn test_sanitize_filename_safe_chars() {
        assert_eq!(sanitize_filename("photo.png"), "photo.png");
        assert_eq!(sanitize_filename("my-image_01.jpg"), "my-image_01.jpg");
    }

    #[test]
    fn test_sanitize_filename_unsafe_chars() {
        assert_eq!(sanitize_filename("my file (1).png"), "my_file__1_.png");
        assert_eq!(sanitize_filename("path/to/img.png"), "path_to_img.png");
    }

    #[test]
    fn test_save_image_creates_file() {
        use base64::Engine;

        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let data = base64::engine::general_purpose::STANDARD.encode(b"fake image data");

        let result = save_image(vault_path, "test.png", &data);
        assert!(result.is_ok());

        let saved_path = result.unwrap();
        assert!(std::path::Path::new(&saved_path).exists());
        assert!(saved_path.contains("attachments"));
        assert!(saved_path.contains("test.png"));

        let content = fs::read(&saved_path).unwrap();
        assert_eq!(content, b"fake image data");
    }

    #[test]
    fn test_save_image_creates_attachments_dir() {
        use base64::Engine;

        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let attachments = dir.path().join("attachments");
        assert!(!attachments.exists());

        let data = base64::engine::general_purpose::STANDARD.encode(b"test");
        save_image(vault_path, "img.png", &data).unwrap();
        assert!(attachments.exists());
    }

    #[test]
    fn test_save_image_invalid_base64() {
        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        let result = save_image(vault_path, "test.png", "not-valid-base64!!!");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid base64"));
    }

    // --- purge_trash tests ---

    #[test]
    fn test_purge_trash_deletes_old_trashed_files() {
        let dir = TempDir::new().unwrap();
        // File trashed 60 days ago — should be deleted
        create_test_file(
            dir.path(),
            "old-trash.md",
            "---\nTrashed at: \"2025-01-01\"\n---\n# Old Trash\n",
        );
        // File trashed recently — should be kept
        let recent = chrono::Utc::now().date_naive().format("%Y-%m-%d").to_string();
        create_test_file(
            dir.path(),
            "recent-trash.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Recent Trash\n", recent),
        );
        // File without trashed_at — should be kept
        create_test_file(
            dir.path(),
            "normal.md",
            "---\nIs A: Note\n---\n# Normal Note\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old-trash.md"));
        // Verify old file is actually gone
        assert!(!dir.path().join("old-trash.md").exists());
        // Verify other files still exist
        assert!(dir.path().join("recent-trash.md").exists());
        assert!(dir.path().join("normal.md").exists());
    }

    #[test]
    fn test_purge_trash_supports_datetime_format() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "datetime-trash.md",
            "---\nTrashed at: \"2025-01-01T10:30:00Z\"\n---\n# Datetime Trash\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("datetime-trash.md"));
    }

    #[test]
    fn test_purge_trash_empty_vault() {
        let dir = TempDir::new().unwrap();
        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
    }

    #[test]
    fn test_purge_trash_nonexistent_path() {
        let result = purge_trash("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn test_purge_trash_exactly_30_days_not_deleted() {
        let dir = TempDir::new().unwrap();
        let thirty_days_ago = (chrono::Utc::now().date_naive()
            - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "borderline.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Borderline\n", thirty_days_ago),
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert!(deleted.is_empty());
        assert!(dir.path().join("borderline.md").exists());
    }

    #[test]
    fn test_purge_trash_31_days_deleted() {
        let dir = TempDir::new().unwrap();
        let thirty_one_days_ago = (chrono::Utc::now().date_naive()
            - chrono::Duration::days(31))
            .format("%Y-%m-%d")
            .to_string();
        create_test_file(
            dir.path(),
            "expired.md",
            &format!("---\nTrashed at: \"{}\"\n---\n# Expired\n", thirty_one_days_ago),
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(!dir.path().join("expired.md").exists());
    }

    #[test]
    fn test_purge_trash_nested_directories() {
        let dir = TempDir::new().unwrap();
        create_test_file(
            dir.path(),
            "sub/deep/old.md",
            "---\nTrashed at: \"2025-01-01\"\n---\n# Deep Old\n",
        );

        let deleted = purge_trash(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(deleted.len(), 1);
        assert!(deleted[0].contains("old.md"));
    }

    // --- rename_note tests ---

    #[test]
    fn test_title_to_slug() {
        assert_eq!(title_to_slug("Weekly Review"), "weekly-review");
        assert_eq!(title_to_slug("My  Note!  "), "my-note");
        assert_eq!(title_to_slug("Hello World"), "hello-world");
    }

    #[test]
    fn test_update_h1_title() {
        let content = "---\nIs A: Note\n---\n# Old Title\n\nContent here.\n";
        let updated = update_h1_title(content, "New Title");
        assert!(updated.contains("# New Title"));
        assert!(!updated.contains("# Old Title"));
        assert!(updated.contains("Content here."));
    }

    #[test]
    fn test_rename_note_basic() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/weekly-review.md", "---\nIs A: Note\n---\n# Weekly Review\n\nContent here.\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
        ).unwrap();

        assert!(result.new_path.ends_with("sprint-retrospective.md"));
        assert!(!old_path.exists());
        assert!(Path::new(&result.new_path).exists());

        let new_content = fs::read_to_string(&result.new_path).unwrap();
        assert!(new_content.contains("# Sprint Retrospective"));
    }

    #[test]
    fn test_rename_note_updates_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/weekly-review.md", "---\nIs A: Note\n---\n# Weekly Review\n\nContent.\n");
        create_test_file(vault, "note/other.md", "---\nIs A: Note\n---\n# Other\n\nSee [[Weekly Review]] for details.\n");
        create_test_file(vault, "project/my-project.md", "---\nIs A: Project\nRelated to:\n  - \"[[Weekly Review]]\"\n---\n# My Project\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
        ).unwrap();

        assert_eq!(result.updated_files, 2);

        let other_content = fs::read_to_string(vault.join("note/other.md")).unwrap();
        assert!(other_content.contains("[[Sprint Retrospective]]"));
        assert!(!other_content.contains("[[Weekly Review]]"));

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[Sprint Retrospective]]"));
    }

    #[test]
    fn test_rename_note_same_title_noop() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/my-note.md", "# My Note\n\nContent.\n");

        let old_path = vault.join("note/my-note.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "My Note",
        ).unwrap();

        assert_eq!(result.new_path, old_path.to_str().unwrap());
        assert_eq!(result.updated_files, 0);
    }

    #[test]
    fn test_rename_note_empty_title_error() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/test.md", "# Test\n");

        let old_path = vault.join("note/test.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "  ",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_rename_note_preserves_pipe_alias_in_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/weekly-review.md", "# Weekly Review\n");
        create_test_file(vault, "note/ref.md", "# Ref\n\nSee [[Weekly Review|my review]] for info.\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retro",
        ).unwrap();

        assert_eq!(result.updated_files, 1);
        let ref_content = fs::read_to_string(vault.join("note/ref.md")).unwrap();
        assert!(ref_content.contains("[[Sprint Retro|my review]]"));
    }

    #[test]
    fn test_rename_note_updates_title_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/old.md", "---\ntitle: Old Name\nIs A: Note\n---\n# Old Name\n");

        let old_path = vault.join("note/old.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "New Name",
        ).unwrap();

        let content = fs::read_to_string(&result.new_path).unwrap();
        assert!(content.contains("title: New Name"));
        assert!(content.contains("# New Name"));
    }

    // --- write_note tests ---

    #[test]
    fn test_write_note_creates_file() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("note/my-note.md");
        let content = "---\ntitle: My Note\nis_a: Note\n---\n\n# My Note\n\n";

        let result = write_note(file_path.to_str().unwrap(), content);
        assert!(result.is_ok());
        assert!(file_path.exists());
        assert_eq!(fs::read_to_string(&file_path).unwrap(), content);
    }

    #[test]
    fn test_write_note_creates_parent_directories() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("deep/nested/dir/note.md");
        let content = "# Nested Note\n";

        let result = write_note(file_path.to_str().unwrap(), content);
        assert!(result.is_ok());
        assert!(file_path.exists());
        assert_eq!(fs::read_to_string(&file_path).unwrap(), content);
    }

    #[test]
    fn test_write_note_overwrites_existing() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("note.md");
        create_test_file(dir.path(), "note.md", "old content");

        let new_content = "new content";
        let result = write_note(file_path.to_str().unwrap(), new_content);
        assert!(result.is_ok());
        assert_eq!(fs::read_to_string(&file_path).unwrap(), new_content);
    }
}
