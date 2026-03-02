mod cache;
mod getting_started;
mod image;
mod migration;
mod parsing;
mod rename;
mod trash;

pub use cache::scan_vault_cached;
pub use getting_started::{create_getting_started_vault, default_vault_path, vault_exists};
pub use image::{copy_image_to_vault, save_image};
pub use migration::migrate_is_a_to_type;
pub use rename::{rename_note, RenameResult};
pub use trash::purge_trash;

use parsing::{
    capitalize_first, contains_wikilink, count_body_words, extract_outgoing_links, extract_snippet,
    extract_title, parse_iso_date,
};

use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

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
    /// Custom sidebar section label for Type entries, overriding auto-pluralization.
    #[serde(rename = "sidebarLabel")]
    pub sidebar_label: Option<String>,
    /// Word count of the note body (excludes frontmatter and H1 title).
    #[serde(rename = "wordCount")]
    pub word_count: u32,
    /// All wikilink targets found in the note body (excludes frontmatter).
    /// Extracted from `[[target]]` and `[[target|display]]` patterns.
    #[serde(rename = "outgoingLinks", default)]
    pub outgoing_links: Vec<String>,
}

/// Intermediate struct to capture YAML frontmatter fields.
#[derive(Debug, Deserialize, Default)]
struct Frontmatter {
    #[serde(rename = "Is A", alias = "type")]
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
    #[serde(rename = "sidebar label", default)]
    sidebar_label: Option<String>,
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

/// Parse frontmatter from raw YAML data extracted by gray_matter.
fn parse_frontmatter(data: &HashMap<String, serde_json::Value>) -> Frontmatter {
    // Convert HashMap to serde_json::Value for deserialization
    let value =
        serde_json::Value::Object(data.iter().map(|(k, v)| (k.clone(), v.clone())).collect());
    serde_json::from_value(value).unwrap_or_default()
}

/// Known non-relationship frontmatter keys to skip (case-insensitive comparison).
/// Only skip keys that can never contain wikilinks.
const SKIP_KEYS: &[&str] = &[
    "is a",
    "type",
    "aliases",
    "status",
    "cadence",
    "archived",
    "trashed",
    "trashed at",
    "created at",
    "created time",
    "icon",
    "color",
    "order",
    "sidebar label",
];

/// Extract all wikilink-containing fields from raw YAML frontmatter.
/// Returns a HashMap where each key is the original frontmatter field name
/// and the value is a Vec of wikilink strings found in that field.
/// Handles both single string values and arrays of strings.
fn extract_relationships(
    data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, Vec<String>> {
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
    }
    .to_string()
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
    fm.created_at
        .as_ref()
        .and_then(|s| parse_iso_date(s))
        .or_else(|| fm.created_time.as_ref().and_then(|s| parse_iso_date(s)))
}

/// Extract frontmatter and relationships from parsed gray_matter data.
fn extract_fm_and_rels(
    data: Option<gray_matter::Pod>,
) -> (Frontmatter, HashMap<String, Vec<String>>) {
    let hash = match data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return (Frontmatter::default(), HashMap::new()),
    };
    let json_map: HashMap<String, serde_json::Value> =
        hash.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
    (
        parse_frontmatter(&json_map),
        extract_relationships(&json_map),
    )
}

/// Read file metadata (modified_at timestamp, file size).
fn read_file_metadata(path: &Path) -> Result<(Option<u64>, u64), String> {
    let metadata =
        fs::metadata(path).map_err(|e| format!("Failed to stat {}: {}", path.display(), e))?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok((modified_at, metadata.len()))
}

/// Parse a single markdown file into a VaultEntry.
pub fn parse_md_file(path: &Path) -> Result<VaultEntry, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let (frontmatter, mut relationships) = extract_fm_and_rels(parsed.data);

    let title = extract_title(&parsed.content, &filename);
    let snippet = extract_snippet(&content);
    let word_count = count_body_words(&content);
    let outgoing_links = extract_outgoing_links(&parsed.content);
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
        filename,
        title,
        is_a,
        snippet,
        relationships,
        aliases: frontmatter
            .aliases
            .map(|a| a.into_vec())
            .unwrap_or_default(),
        belongs_to: frontmatter
            .belongs_to
            .map(|b| b.into_vec())
            .unwrap_or_default(),
        related_to: frontmatter
            .related_to
            .map(|r| r.into_vec())
            .unwrap_or_default(),
        status: frontmatter.status,
        owner: frontmatter.owner,
        cadence: frontmatter.cadence,
        archived: frontmatter.archived.unwrap_or(false),
        trashed: frontmatter.trashed.unwrap_or(false),
        trashed_at: frontmatter.trashed_at.as_deref().and_then(parse_iso_date),
        modified_at,
        created_at,
        file_size,
        icon: frontmatter.icon,
        color: frontmatter.color,
        order: frontmatter.order,
        sidebar_label: frontmatter.sidebar_label,
        word_count,
        outgoing_links,
    })
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
            let obj: serde_json::Map<String, serde_json::Value> =
                map.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
            serde_json::Value::Object(obj)
        }
        gray_matter::Pod::Null => serde_json::Value::Null,
    }
}

/// Read the content of a single note file.
pub fn get_note_content(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", path.display()));
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

fn validate_save_path(file_path: &Path, display_path: &str) -> Result<(), String> {
    let parent_missing = file_path.parent().is_some_and(|p| !p.exists());
    if parent_missing {
        return Err(format!(
            "Parent directory does not exist: {}",
            file_path.parent().unwrap().display()
        ));
    }
    let is_readonly = file_path.exists()
        && file_path
            .metadata()
            .map(|m| m.permissions().readonly())
            .unwrap_or(false);
    if is_readonly {
        return Err(format!("File is read-only: {}", display_path));
    }
    Ok(())
}

/// Write content to a note file. Creates parent directory if needed, validates path,
/// then writes content to disk.
pub fn save_note_content(path: &str, content: &str) -> Result<(), String> {
    let file_path = Path::new(path);
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }
    }
    validate_save_path(file_path, path)?;
    fs::write(file_path, content).map_err(|e| format!("Failed to save {}: {}", path, e))
}

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    if !vault_path.exists() {
        return Err(format!(
            "Vault path does not exist: {}",
            vault_path.display()
        ));
    }
    if !vault_path.is_dir() {
        return Err(format!(
            "Vault path is not a directory: {}",
            vault_path.display()
        ));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(vault_path)
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
        let entry = parse_test_entry(
            &dir,
            "empty-fm.md",
            "---\n---\n# Just a Title\n\nNo frontmatter fields.",
        );
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
        create_test_file(
            dir.path(),
            "sub/nested.md",
            "---\nIs A: Task\n---\n# Nested\n",
        );
        create_test_file(dir.path(), "not-markdown.txt", "This should be ignored");

        let entries = scan_vault(dir.path()).unwrap();
        assert_eq!(entries.len(), 2);

        let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
        assert!(filenames.contains(&"root.md"));
        assert!(filenames.contains(&"nested.md"));
    }

    #[test]
    fn test_scan_vault_nonexistent_path() {
        let result = scan_vault(Path::new("/nonexistent/path/that/does/not/exist"));
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
        let result = get_note_content(&path);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_get_note_content_nonexistent() {
        let result = get_note_content(Path::new("/nonexistent/path/file.md"));
        assert!(result.is_err());
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
    fn test_parse_md_file_has_word_count() {
        let dir = TempDir::new().unwrap();
        let content =
            "---\nIs A: Note\n---\n# Test Note\n\nHello world. This is a test with seven words.";
        create_test_file(dir.path(), "test.md", content);

        let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
        assert_eq!(entry.word_count, 9);
    }

    #[test]
    fn test_parse_md_file_word_count_empty_body() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# Empty Note\n";
        create_test_file(dir.path(), "test.md", content);

        let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
        assert_eq!(entry.word_count, 0);
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
            &vec![
                "[[essay/foo|Foo Essay]]".to_string(),
                "[[essay/bar|Bar Essay]]".to_string()
            ]
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
        assert_eq!(
            rels.get("Owner").unwrap(),
            &vec!["[[person/alice]]".to_string()]
        );
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
            &vec![
                "[[person/carol]]".to_string(),
                "[[person/dave]]".to_string()
            ]
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
        assert_eq!(
            rels.get("Real Relation").unwrap(),
            &vec!["[[note/important]]".to_string()]
        );
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
            &vec![
                "[[source/paper-a]]".to_string(),
                "[[source/paper-b]]".to_string()
            ]
        );
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
            assert_eq!(
                entry.is_a,
                Some(expected_type.to_string()),
                "folder '{}' should infer type '{}'",
                folder,
                expected_type
            );
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
        create_test_file(
            dir.path(),
            "person/test.md",
            "---\nIs A: Custom\n---\n# Test\n",
        );
        let entry = parse_md_file(&dir.path().join("person/test.md")).unwrap();
        assert_eq!(entry.is_a, Some("Custom".to_string()));
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

    // --- type key (post-migration) tests ---

    #[test]
    fn test_parse_type_key_lowercase() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Project\n---\n# My Project\n";
        let entry = parse_test_entry(&dir, "project/my-project.md", content);
        assert_eq!(entry.is_a, Some("Project".to_string()));
    }

    #[test]
    fn test_type_key_generates_type_relationship() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Person\n---\n# Alice\n";
        let entry = parse_test_entry(&dir, "person/alice.md", content);
        assert_eq!(
            entry.relationships.get("Type").unwrap(),
            &vec!["[[type/person]]".to_string()]
        );
    }

    #[test]
    fn test_type_key_not_in_relationships_as_generic() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Note\nHas:\n  - \"[[task/foo]]\"\n---\n# Test\n";
        let entry = parse_test_entry(&dir, "note/test.md", content);
        // "type" key itself should not appear as a relationship (it's in SKIP_KEYS)
        // Only "Has" and the auto-generated "Type" should be relationships
        assert_eq!(entry.relationships.len(), 2);
        assert!(entry.relationships.get("Has").is_some());
        assert!(entry.relationships.get("Type").is_some());
    }

    // --- outgoing_links tests ---

    #[test]
    fn test_outgoing_links_extracted_from_content_body() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# My Note\n\nSee [[person/alice]] and [[topic/rust]].";
        let entry = parse_test_entry(&dir, "note/my-note.md", content);
        assert_eq!(entry.outgoing_links, vec!["person/alice", "topic/rust"]);
    }

    #[test]
    fn test_outgoing_links_excludes_frontmatter_wikilinks() {
        let dir = TempDir::new().unwrap();
        let content = "---\nHas:\n  - \"[[task/design]]\"\n---\n# Note\n\nSee [[person/bob]].";
        let entry = parse_test_entry(&dir, "note/test.md", content);
        assert!(!entry.outgoing_links.contains(&"task/design".to_string()));
        assert!(entry.outgoing_links.contains(&"person/bob".to_string()));
    }

    #[test]
    fn test_outgoing_links_handles_pipe_syntax() {
        let dir = TempDir::new().unwrap();
        let content = "# Note\n\nSee [[project/alpha|Alpha Project]] for details.";
        let entry = parse_test_entry(&dir, "test.md", content);
        assert!(entry.outgoing_links.contains(&"project/alpha".to_string()));
    }

    // --- save_note_content tests ---

    #[test]
    fn test_save_note_content_creates_parent_directory() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("new-type/untitled-note.md");
        let content = "---\ntitle: Untitled note\n---\n# Untitled note\n\n";

        assert!(!path.parent().unwrap().exists());
        save_note_content(path.to_str().unwrap(), content).unwrap();

        assert!(path.exists());
        assert_eq!(fs::read_to_string(&path).unwrap(), content);
    }

    #[test]
    fn test_save_note_content_existing_directory() {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("note")).unwrap();
        let path = dir.path().join("note/test.md");
        let content = "# Test\n";

        save_note_content(path.to_str().unwrap(), content).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), content);
    }

    // --- sidebar_label tests ---

    #[test]
    fn test_parse_sidebar_label_from_type_entry() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Type\nsidebar label: News\n---\n# News\n";
        let entry = parse_test_entry(&dir, "type/news.md", content);
        assert_eq!(entry.sidebar_label, Some("News".to_string()));
    }

    #[test]
    fn test_parse_sidebar_label_missing_defaults_to_none() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Type\n---\n# Project\n";
        let entry = parse_test_entry(&dir, "type/project.md", content);
        assert_eq!(entry.sidebar_label, None);
    }

    #[test]
    fn test_sidebar_label_not_in_relationships() {
        let dir = TempDir::new().unwrap();
        let content = "---\ntype: Type\nsidebar label: My Series\n---\n# Series\n";
        let entry = parse_test_entry(&dir, "type/series.md", content);
        assert!(entry.relationships.get("sidebar label").is_none());
    }

    // Frontmatter update/delete tests are in frontmatter.rs
    // save_image tests are in vault/image.rs
    // purge_trash tests are in vault/trash.rs
    // rename_note tests are in vault/rename.rs
}
