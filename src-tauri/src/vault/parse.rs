use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

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
pub(crate) fn extract_title(content: &str, filename: &str) -> String {
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
        // Find last valid char boundary at or before 160
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
    let value = serde_json::Value::Object(
        data.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
    );
    serde_json::from_value(value).unwrap_or_default()
}

/// Known non-relationship frontmatter keys to skip (case-insensitive comparison).
const SKIP_KEYS: &[&str] = &[
    "is a", "aliases", "status", "cadence", "archived", "trashed", "trashed at",
    "created at", "created time", "icon", "color", "order",
];

/// Check if a string contains a wikilink pattern `[[...]]`.
fn contains_wikilink(s: &str) -> bool {
    s.contains("[[") && s.contains("]]")
}

/// Extract all wikilink-containing fields from raw YAML frontmatter.
fn extract_relationships(data: &HashMap<String, serde_json::Value>) -> HashMap<String, Vec<String>> {
    let mut relationships = HashMap::new();

    for (key, value) in data {
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
pub(crate) fn parse_iso_date(date_str: &str) -> Option<u64> {
    use chrono::{NaiveDate, NaiveDateTime};

    let trimmed = date_str.trim().trim_matches('"');

    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S%.fZ") {
        return Some(dt.and_utc().timestamp() as u64);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%SZ") {
        return Some(dt.and_utc().timestamp() as u64);
    }
    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S") {
        return Some(dt.and_utc().timestamp() as u64);
    }

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
    fn test_parse_malformed_yaml() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: [unclosed bracket\n---\n# Malformed\n";
        create_test_file(dir.path(), "malformed.md", content);
        let entry = parse_md_file(&dir.path().join("malformed.md"));
        assert!(entry.is_ok());
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
        assert_eq!(entry.relationships.len(), 3);
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
        assert_eq!(
            entry.relationships.get("Owner").unwrap(),
            &vec!["[[person/luca-rossi|Luca Rossi]]".to_string()]
        );
        assert_eq!(
            entry.relationships.get("Belongs to").unwrap(),
            &vec!["[[responsibility/grow-newsletter]]".to_string()]
        );
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
        assert_eq!(
            entry.relationships.get("Mentor").unwrap(),
            &vec!["[[person/bob|Bob Smith]]".to_string()]
        );
        assert_eq!(
            entry.relationships.get("Reviewers").unwrap(),
            &vec!["[[person/carol]]".to_string(), "[[person/dave]]".to_string()]
        );
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
        assert_eq!(len, 2);
        assert_eq!(
            rels.get("Type").unwrap(),
            &vec!["[[type/project]]".to_string()]
        );
    }

    #[test]
    fn test_parse_relationships_mixed_wikilinks_and_plain_in_array() {
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
        assert_eq!(
            entry.relationships.get("References").unwrap(),
            &vec!["[[source/paper-a]]".to_string(), "[[source/paper-b]]".to_string()]
        );
    }

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
        assert_eq!(ts.unwrap(), 1747958400);
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

    #[test]
    fn test_extract_snippet_code_fence_delimiters_skipped() {
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
        assert!(snippet.contains("Body text"));
    }

    #[test]
    fn test_extract_snippet_horizontal_rules_skipped() {
        let content = "# Title\n\n---\n\nContent after rule.";
        let snippet = extract_snippet(content);
        assert_eq!(snippet, "Content after rule.");
    }

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
}
