use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Vault-wide UI configuration stored in `config/ui.config.md`.
///
/// This file is a regular vault note with YAML frontmatter, visible in the
/// sidebar under the "Config" section and editable like any note.
#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct VaultConfig {
    pub zoom: Option<f64>,
    pub view_mode: Option<String>,
    #[serde(default)]
    pub tag_colors: Option<HashMap<String, String>>,
    #[serde(default)]
    pub status_colors: Option<HashMap<String, String>>,
    #[serde(default)]
    pub property_display_modes: Option<HashMap<String, String>>,
}

const CONFIG_DIR: &str = "config";
const CONFIG_FILENAME: &str = "ui.config.md";

fn config_path(vault_path: &str) -> std::path::PathBuf {
    Path::new(vault_path).join(CONFIG_DIR).join(CONFIG_FILENAME)
}

/// Read the vault-wide UI config from `config/ui.config.md`.
/// Returns default values if the file doesn't exist.
pub fn get_vault_config(vault_path: &str) -> Result<VaultConfig, String> {
    let path = config_path(vault_path);
    if !path.exists() {
        return Ok(VaultConfig::default());
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;

    parse_vault_config(&content)
}

/// Parse VaultConfig from markdown content with YAML frontmatter.
fn parse_vault_config(content: &str) -> Result<VaultConfig, String> {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(content);

    let hash = match parsed.data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return Ok(VaultConfig::default()),
    };

    let json_map: serde_json::Map<String, serde_json::Value> =
        hash.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
    let json = serde_json::Value::Object(json_map);

    serde_json::from_value(json.clone())
        .or_else(|_| {
            // If direct deserialization fails, strip the `type` field and retry
            let mut map = match json {
                serde_json::Value::Object(m) => m,
                _ => return Ok(VaultConfig::default()),
            };
            map.remove("type");
            serde_json::from_value(serde_json::Value::Object(map))
        })
        .map_err(|e| format!("Failed to parse config: {e}"))
}

/// Save the vault-wide UI config to `config/ui.config.md`.
/// Creates the directory and file if they don't exist.
pub fn save_vault_config(vault_path: &str, config: VaultConfig) -> Result<(), String> {
    let path = config_path(vault_path);
    let dir = Path::new(vault_path).join(CONFIG_DIR);
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let content = serialize_config(&config);
    std::fs::write(&path, content).map_err(|e| format!("Failed to write config: {e}"))
}

/// Serialize VaultConfig to a markdown file with YAML frontmatter.
fn serialize_config(config: &VaultConfig) -> String {
    let mut lines = vec!["---".to_string(), "type: config".to_string()];

    if let Some(zoom) = config.zoom {
        lines.push(format!("zoom: {zoom}"));
    }
    if let Some(ref mode) = config.view_mode {
        lines.push(format!("view_mode: {mode}"));
    }
    append_string_map(&mut lines, "tag_colors", config.tag_colors.as_ref());
    append_string_map(&mut lines, "status_colors", config.status_colors.as_ref());
    append_string_map(
        &mut lines,
        "property_display_modes",
        config.property_display_modes.as_ref(),
    );
    lines.push("---".to_string());
    lines.join("\n") + "\n"
}

/// Append a YAML map section with sorted keys for stable output.
fn append_string_map(lines: &mut Vec<String>, key: &str, map: Option<&HashMap<String, String>>) {
    if let Some(m) = map {
        if !m.is_empty() {
            lines.push(format!("{key}:"));
            let mut entries: Vec<_> = m.iter().collect();
            entries.sort_by_key(|(k, _)| k.to_owned());
            for (k, v) in entries {
                lines.push(format!("  {}: {}", yaml_safe_key(k), yaml_safe_value(v)));
            }
        }
    }
}

/// Quote a YAML key if it contains special characters.
fn yaml_safe_key(key: &str) -> String {
    if key.contains(':') || key.contains('#') || key.contains(' ') {
        format!("\"{}\"", key.replace('"', "\\\""))
    } else {
        key.to_string()
    }
}

/// Quote a YAML value if it contains special characters.
fn yaml_safe_value(value: &str) -> String {
    if value.contains(':')
        || value.contains('#')
        || value.starts_with('"')
        || value.starts_with('\'')
    {
        format!("\"{}\"", value.replace('"', "\\\""))
    } else {
        value.to_string()
    }
}

/// Migrate `hidden_sections` from `config/ui.config.md` to `visible: false`
/// on Type notes. Returns the number of Type notes updated.
///
/// For each type name in `hidden_sections`:
/// - If `type/<slug>.md` exists, adds `visible: false` to its frontmatter
/// - If it doesn't exist, creates it with `type: Type`, `title: <name>`, `visible: false`
/// - Re-saves the config without `hidden_sections`
pub fn migrate_hidden_sections_to_visible(vault_path: &str) -> Result<usize, String> {
    let path = config_path(vault_path);
    if !path.exists() {
        return Ok(0);
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;

    let hidden = extract_hidden_sections(&content);
    if hidden.is_empty() {
        return Ok(0);
    }

    let type_dir = Path::new(vault_path).join("type");
    if !type_dir.exists() {
        std::fs::create_dir_all(&type_dir)
            .map_err(|e| format!("Failed to create type dir: {e}"))?;
    }

    let mut migrated = 0;
    for type_name in &hidden {
        let slug = type_name_to_slug(type_name);
        let type_path = type_dir.join(format!("{slug}.md"));

        if type_path.exists() {
            let type_content = std::fs::read_to_string(&type_path)
                .map_err(|e| format!("Failed to read {}: {e}", type_path.display()))?;
            if !type_content.contains("visible:") {
                let updated = crate::frontmatter::update_frontmatter_content(
                    &type_content,
                    "visible",
                    Some(crate::frontmatter::FrontmatterValue::Bool(false)),
                )
                .map_err(|e| format!("Failed to update {}: {e}", type_path.display()))?;
                std::fs::write(&type_path, updated)
                    .map_err(|e| format!("Failed to write {}: {e}", type_path.display()))?;
            }
        } else {
            let new_content = format!(
                "---\ntype: Type\ntitle: {}\nvisible: false\n---\n\n# {}\n",
                type_name, type_name
            );
            std::fs::write(&type_path, new_content)
                .map_err(|e| format!("Failed to write {}: {e}", type_path.display()))?;
        }
        migrated += 1;
    }

    // Re-save config without hidden_sections
    let config = parse_vault_config(&content)?;
    save_vault_config(vault_path, config)?;

    Ok(migrated)
}

/// Extract `hidden_sections` from raw YAML frontmatter.
fn extract_hidden_sections(content: &str) -> Vec<String> {
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(content);

    let hash = match parsed.data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return vec![],
    };

    match hash.get("hidden_sections") {
        Some(gray_matter::Pod::Array(arr)) => arr
            .iter()
            .filter_map(|v| match v {
                gray_matter::Pod::String(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        _ => vec![],
    }
}

/// Convert a Type name to a filesystem slug.
fn type_name_to_slug(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Convert gray_matter::Pod to serde_json::Value.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_empty_returns_defaults() {
        let config = parse_vault_config("").unwrap();
        assert!(config.zoom.is_none());
        assert!(config.view_mode.is_none());
        assert!(config.tag_colors.is_none());
    }

    #[test]
    fn parse_full_config() {
        let content = r#"---
type: config
zoom: 1.1
view_mode: all
tag_colors:
  engineering: blue
  personal: green
status_colors:
  Active: green
  Done: blue
property_display_modes:
  deadline: date
---
"#;
        let config = parse_vault_config(content).unwrap();
        assert_eq!(config.zoom, Some(1.1));
        assert_eq!(config.view_mode.as_deref(), Some("all"));
        let tags = config.tag_colors.unwrap();
        assert_eq!(tags.get("engineering").unwrap(), "blue");
        assert_eq!(tags.get("personal").unwrap(), "green");
        let statuses = config.status_colors.unwrap();
        assert_eq!(statuses.get("Active").unwrap(), "green");
        let props = config.property_display_modes.unwrap();
        assert_eq!(props.get("deadline").unwrap(), "date");
    }

    #[test]
    fn roundtrip_serialization() {
        let mut tag_colors = HashMap::new();
        tag_colors.insert("work".to_string(), "blue".to_string());
        let config = VaultConfig {
            zoom: Some(1.2),
            view_mode: Some("editor-only".to_string()),
            tag_colors: Some(tag_colors),
            status_colors: None,
            property_display_modes: None,
        };
        let serialized = serialize_config(&config);
        let parsed = parse_vault_config(&serialized).unwrap();
        assert_eq!(parsed.zoom, Some(1.2));
        assert_eq!(parsed.view_mode.as_deref(), Some("editor-only"));
        assert_eq!(parsed.tag_colors.unwrap().get("work").unwrap(), "blue");
    }

    #[test]
    fn get_config_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let config = get_vault_config(dir.path().to_str().unwrap()).unwrap();
        assert!(config.zoom.is_none());
    }

    #[test]
    fn save_and_read_config() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();
        let mut status_colors = HashMap::new();
        status_colors.insert("Active".to_string(), "green".to_string());
        let config = VaultConfig {
            zoom: Some(0.9),
            view_mode: None,
            tag_colors: None,
            status_colors: Some(status_colors),
            property_display_modes: None,
        };
        save_vault_config(vault_path, config).unwrap();

        let loaded = get_vault_config(vault_path).unwrap();
        assert_eq!(loaded.zoom, Some(0.9));
        assert_eq!(
            loaded.status_colors.unwrap().get("Active").unwrap(),
            "green"
        );
    }

    #[test]
    fn migrate_hidden_sections_creates_type_notes_with_visible_false() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        // Create config with hidden_sections
        let config_dir = dir.path().join("config");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("ui.config.md"),
            "---\ntype: config\nhidden_sections:\n  - Bookmark\n  - Recipe\n---\n",
        )
        .unwrap();

        let count = migrate_hidden_sections_to_visible(vault_path).unwrap();
        assert_eq!(count, 2);

        // Check type notes were created
        let bookmark = std::fs::read_to_string(dir.path().join("type/bookmark.md")).unwrap();
        assert!(bookmark.contains("visible: false"));
        assert!(bookmark.contains("title: Bookmark"));

        let recipe = std::fs::read_to_string(dir.path().join("type/recipe.md")).unwrap();
        assert!(recipe.contains("visible: false"));

        // Config should no longer have hidden_sections
        let config_content = std::fs::read_to_string(config_dir.join("ui.config.md")).unwrap();
        assert!(!config_content.contains("hidden_sections"));
    }

    #[test]
    fn migrate_hidden_sections_updates_existing_type_note() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        // Create config with hidden_sections
        let config_dir = dir.path().join("config");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("ui.config.md"),
            "---\ntype: config\nhidden_sections:\n  - Project\n---\n",
        )
        .unwrap();

        // Create existing type note without visible
        let type_dir = dir.path().join("type");
        std::fs::create_dir_all(&type_dir).unwrap();
        std::fs::write(
            type_dir.join("project.md"),
            "---\ntype: Type\ntitle: Project\nicon: briefcase\n---\n\n# Project\n",
        )
        .unwrap();

        let count = migrate_hidden_sections_to_visible(vault_path).unwrap();
        assert_eq!(count, 1);

        let content = std::fs::read_to_string(type_dir.join("project.md")).unwrap();
        assert!(content.contains("visible: false"));
        assert!(
            content.contains("icon: briefcase"),
            "should preserve existing fields"
        );
    }

    #[test]
    fn migrate_hidden_sections_skips_when_no_hidden_sections() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        let config_dir = dir.path().join("config");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("ui.config.md"),
            "---\ntype: config\nzoom: 1.0\n---\n",
        )
        .unwrap();

        let count = migrate_hidden_sections_to_visible(vault_path).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn migrate_hidden_sections_skips_when_no_config_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let count = migrate_hidden_sections_to_visible(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn migrate_hidden_sections_does_not_duplicate_visible() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_str().unwrap();

        let config_dir = dir.path().join("config");
        std::fs::create_dir_all(&config_dir).unwrap();
        std::fs::write(
            config_dir.join("ui.config.md"),
            "---\ntype: config\nhidden_sections:\n  - Note\n---\n",
        )
        .unwrap();

        // Type note already has visible: false
        let type_dir = dir.path().join("type");
        std::fs::create_dir_all(&type_dir).unwrap();
        std::fs::write(
            type_dir.join("note.md"),
            "---\ntype: Type\ntitle: Note\nvisible: false\n---\n",
        )
        .unwrap();

        let count = migrate_hidden_sections_to_visible(vault_path).unwrap();
        assert_eq!(count, 1);

        let content = std::fs::read_to_string(type_dir.join("note.md")).unwrap();
        // Should have exactly one visible: false, not two
        assert_eq!(content.matches("visible:").count(), 1);
    }

    #[test]
    fn type_name_to_slug_converts_names() {
        assert_eq!(type_name_to_slug("Project"), "project");
        assert_eq!(type_name_to_slug("Weekly Review"), "weekly-review");
        assert_eq!(type_name_to_slug("My Note!"), "my-note");
    }

    #[test]
    fn yaml_safe_key_quoting() {
        assert_eq!(yaml_safe_key("simple"), "simple");
        assert_eq!(yaml_safe_key("has space"), "\"has space\"");
        assert_eq!(yaml_safe_key("has:colon"), "\"has:colon\"");
    }
}
