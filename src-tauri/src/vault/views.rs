use chrono::{DateTime, Duration, Months, NaiveDate, NaiveDateTime, Utc};
use regex::RegexBuilder;
use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::fs;
use std::path::Path;

use super::VaultEntry;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ViewKind {
    List,
    Kanban,
}

impl Default for ViewKind {
    fn default() -> Self {
        ViewKind::List
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ViewDefinition {
    pub name: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(
        default,
        rename = "listPropertiesDisplay",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub list_properties_display: Vec<String>,
    pub filters: FilterGroup,
    #[serde(default, skip_serializing_if = "is_default_view_kind")]
    pub kind: ViewKind,
}

fn is_default_view_kind(kind: &ViewKind) -> bool {
    *kind == ViewKind::default()
}

#[derive(Debug, Clone)]
pub enum FilterGroup {
    All(Vec<FilterNode>),
    Any(Vec<FilterNode>),
}

impl Serialize for FilterGroup {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(1))?;
        match self {
            FilterGroup::All(nodes) => map.serialize_entry("all", nodes)?,
            FilterGroup::Any(nodes) => map.serialize_entry("any", nodes)?,
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for FilterGroup {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct FilterGroupVisitor;

        impl<'de> Visitor<'de> for FilterGroupVisitor {
            type Value = FilterGroup;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a map with key 'all' or 'any'")
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<FilterGroup, M::Error> {
                let key: String = map
                    .next_key()?
                    .ok_or_else(|| de::Error::custom("expected 'all' or 'any' key"))?;
                match key.as_str() {
                    "all" => {
                        let nodes: Vec<FilterNode> = map.next_value()?;
                        Ok(FilterGroup::All(nodes))
                    }
                    "any" => {
                        let nodes: Vec<FilterNode> = map.next_value()?;
                        Ok(FilterGroup::Any(nodes))
                    }
                    other => Err(de::Error::unknown_field(other, &["all", "any"])),
                }
            }
        }

        deserializer.deserialize_map(FilterGroupVisitor)
    }
}

#[derive(Debug, Clone)]
pub enum FilterNode {
    Condition(FilterCondition),
    Group(FilterGroup),
}

impl Serialize for FilterNode {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            FilterNode::Condition(c) => c.serialize(serializer),
            FilterNode::Group(g) => g.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for FilterNode {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        // Deserialize into a generic YAML value, then try group first, then condition
        let value = serde_yaml::Value::deserialize(deserializer)?;
        if let serde_yaml::Value::Mapping(ref m) = value {
            // If the map has an "all" or "any" key, it's a group
            let all_key = serde_yaml::Value::String("all".to_string());
            let any_key = serde_yaml::Value::String("any".to_string());
            if m.contains_key(&all_key) || m.contains_key(&any_key) {
                let group: FilterGroup =
                    serde_yaml::from_value(value).map_err(de::Error::custom)?;
                return Ok(FilterNode::Group(group));
            }
        }
        let cond: FilterCondition = serde_yaml::from_value(value).map_err(de::Error::custom)?;
        Ok(FilterNode::Condition(cond))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterCondition {
    pub field: String,
    pub op: FilterOp,
    #[serde(default)]
    pub value: Option<serde_yaml::Value>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub regex: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum FilterOp {
    #[serde(rename = "equals")]
    Equals,
    #[serde(rename = "not_equals")]
    NotEquals,
    #[serde(rename = "contains")]
    Contains,
    #[serde(rename = "not_contains")]
    NotContains,
    #[serde(rename = "any_of")]
    AnyOf,
    #[serde(rename = "none_of")]
    NoneOf,
    #[serde(rename = "is_empty")]
    IsEmpty,
    #[serde(rename = "is_not_empty")]
    IsNotEmpty,
    #[serde(rename = "before")]
    Before,
    #[serde(rename = "after")]
    After,
}

/// A view file on disk: filename + parsed definition.
#[derive(Debug, Serialize, Clone)]
pub struct ViewFile {
    pub filename: String,
    pub definition: ViewDefinition,
}

/// Migrate views from `.laputa/views/` to `views/` in the vault root (one-time).
pub fn migrate_views(vault_path: &Path) {
    let old_dir = vault_path.join(".laputa").join("views");
    if !old_dir.is_dir() {
        return;
    }

    let entries = match fs::read_dir(&old_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let yml_files: Vec<_> = entries
        .flatten()
        .filter(|e| e.path().extension().and_then(|ext| ext.to_str()) == Some("yml"))
        .collect();

    if yml_files.is_empty() {
        return;
    }

    let new_dir = vault_path.join("views");
    if fs::create_dir_all(&new_dir).is_err() {
        log::warn!("Failed to create views/ directory for migration");
        return;
    }

    for entry in yml_files {
        let src = entry.path();
        let dst = new_dir.join(entry.file_name());
        if !dst.exists() {
            if let Err(e) = fs::rename(&src, &dst) {
                log::warn!("Failed to migrate view {:?}: {}", src, e);
            } else {
                log::info!("Migrated view {:?} → {:?}", src, dst);
            }
        }
    }

    // Clean up old directory if empty
    if fs::read_dir(&old_dir)
        .map(|mut d| d.next().is_none())
        .unwrap_or(false)
    {
        let _ = fs::remove_dir(&old_dir);
    }
}

/// Scan all `.yml` files from `vault_path/views/` and return parsed views.
fn is_view_definition_file(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()) == Some("yml")
}

fn read_view_file(path: &Path) -> Option<ViewFile> {
    if !is_view_definition_file(path) {
        return None;
    }

    let filename = path.file_name()?.to_string_lossy().to_string();
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) => {
            log::warn!("Failed to read view file {}: {}", filename, error);
            return None;
        }
    };
    let definition = match serde_yaml::from_str::<ViewDefinition>(&content) {
        Ok(definition) => definition,
        Err(error) => {
            log::warn!("Failed to parse view {}: {}", filename, error);
            return None;
        }
    };

    Some(ViewFile {
        filename,
        definition,
    })
}

pub fn scan_views(vault_path: &Path) -> Vec<ViewFile> {
    migrate_views(vault_path);
    let views_dir = vault_path.join("views");
    if !views_dir.is_dir() {
        return Vec::new();
    }

    let mut views = Vec::new();
    let entries = match fs::read_dir(&views_dir) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("Failed to read views directory: {}", e);
            return Vec::new();
        }
    };

    for entry in entries.flatten() {
        if let Some(view) = read_view_file(&entry.path()) {
            views.push(view);
        }
    }

    views.sort_by(|a, b| a.filename.cmp(&b.filename));
    views
}

/// Save a view definition as YAML to `vault_path/views/{filename}`.
pub fn save_view(
    vault_path: &Path,
    filename: &str,
    definition: &ViewDefinition,
) -> Result<(), String> {
    if !filename.ends_with(".yml") {
        return Err("Filename must end with .yml".to_string());
    }
    let views_dir = vault_path.join("views");
    fs::create_dir_all(&views_dir)
        .map_err(|e| format!("Failed to create views directory: {}", e))?;
    let yaml = serde_yaml::to_string(definition)
        .map_err(|e| format!("Failed to serialize view: {}", e))?;
    fs::write(views_dir.join(filename), yaml)
        .map_err(|e| format!("Failed to write view file: {}", e))
}

/// Delete a view file at `vault_path/views/{filename}`.
pub fn delete_view(vault_path: &Path, filename: &str) -> Result<(), String> {
    let path = vault_path.join("views").join(filename);
    fs::remove_file(&path).map_err(|e| format!("Failed to delete view: {}", e))
}

/// Evaluate a view definition against vault entries, returning indices of matching entries.
pub fn evaluate_view(definition: &ViewDefinition, entries: &[VaultEntry]) -> Vec<usize> {
    entries
        .iter()
        .enumerate()
        .filter(|(_, entry)| evaluate_group(&definition.filters, entry))
        .map(|(i, _)| i)
        .collect()
}

fn evaluate_group(group: &FilterGroup, entry: &VaultEntry) -> bool {
    match group {
        FilterGroup::All(nodes) => nodes.iter().all(|n| evaluate_node(n, entry)),
        FilterGroup::Any(nodes) => nodes.iter().any(|n| evaluate_node(n, entry)),
    }
}

fn evaluate_node(node: &FilterNode, entry: &VaultEntry) -> bool {
    match node {
        FilterNode::Condition(cond) => evaluate_condition(cond, entry),
        FilterNode::Group(group) => evaluate_group(group, entry),
    }
}

/// Extract the stem from a wikilink: `[[target|Alias]]` -> `target`, `[[target]]` -> `target`.
fn wikilink_stem(link: &str) -> &str {
    let s = link
        .strip_prefix("[[")
        .unwrap_or(link)
        .strip_suffix("]]")
        .unwrap_or(link);
    match s.split_once('|') {
        Some((stem, _)) => stem,
        None => s,
    }
}

fn relationship_candidates(link: &str) -> Vec<String> {
    let trimmed = link.trim();
    let inner = trimmed
        .strip_prefix("[[")
        .unwrap_or(trimmed)
        .strip_suffix("]]")
        .unwrap_or(trimmed);
    match inner.split_once('|') {
        Some((stem, alias)) => vec![trimmed.to_string(), stem.to_string(), alias.to_string()],
        None => vec![trimmed.to_string(), inner.to_string()],
    }
}

fn build_regex(pattern: &str) -> Option<regex::Regex> {
    RegexBuilder::new(pattern)
        .case_insensitive(true)
        .build()
        .ok()
}

fn parse_relative_amount(token: &str) -> Option<u32> {
    match token {
        "a" | "an" | "one" => Some(1),
        "two" => Some(2),
        "three" => Some(3),
        "four" => Some(4),
        "five" => Some(5),
        "six" => Some(6),
        "seven" => Some(7),
        "eight" => Some(8),
        "nine" => Some(9),
        "ten" => Some(10),
        "eleven" => Some(11),
        "twelve" => Some(12),
        _ => token.parse::<u32>().ok(),
    }
}

fn parse_relative_date_filter(value: &str, reference: DateTime<Utc>) -> Option<DateTime<Utc>> {
    let normalized = value.trim().to_lowercase();
    if normalized.is_empty() {
        return None;
    }

    let base = reference.date_naive().and_hms_opt(0, 0, 0)?.and_utc();
    match normalized.as_str() {
        "today" => return Some(base),
        "yesterday" => return Some(base - Duration::days(1)),
        "tomorrow" => return Some(base + Duration::days(1)),
        _ => {}
    }

    let tokens: Vec<&str> = normalized.split_whitespace().collect();
    let (future, amount_token, unit_token) = match tokens.as_slice() {
        ["in", amount, unit] => (true, *amount, *unit),
        [amount, unit, "ago"] => (false, *amount, *unit),
        _ => return None,
    };

    let amount = parse_relative_amount(amount_token)?;
    let unit = unit_token.strip_suffix('s').unwrap_or(unit_token);

    match (future, unit) {
        (true, "day") => Some(base + Duration::days(amount as i64)),
        (false, "day") => Some(base - Duration::days(amount as i64)),
        (true, "week") => Some(base + Duration::weeks(amount as i64)),
        (false, "week") => Some(base - Duration::weeks(amount as i64)),
        (true, "month") => base.checked_add_months(Months::new(amount)),
        (false, "month") => base.checked_sub_months(Months::new(amount)),
        (true, "year") => base.checked_add_months(Months::new(amount * 12)),
        (false, "year") => base.checked_sub_months(Months::new(amount * 12)),
        _ => None,
    }
}

fn parse_date_filter_timestamp(value: &str, reference: DateTime<Utc>) -> Option<i64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(date) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return Some(date.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis());
    }

    if let Ok(datetime) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S") {
        return Some(datetime.and_utc().timestamp_millis());
    }

    if let Ok(datetime) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(datetime.with_timezone(&Utc).timestamp_millis());
    }

    parse_relative_date_filter(trimmed, reference).map(|datetime| datetime.timestamp_millis())
}

fn supports_regex(op: &FilterOp) -> bool {
    matches!(
        op,
        FilterOp::Contains | FilterOp::Equals | FilterOp::NotContains | FilterOp::NotEquals
    )
}

fn evaluate_condition(cond: &FilterCondition, entry: &VaultEntry) -> bool {
    let field = cond.field.as_str();
    let mut relationship_values: Option<&[String]> = None;

    // Boolean fields
    match field {
        "archived" => return evaluate_bool_field(entry.archived, &cond.op, &cond.value),
        "favorite" => return evaluate_bool_field(entry.favorite, &cond.op, &cond.value),
        _ => {}
    }

    // String/option fields
    let field_value: Option<String> = match field {
        "type" | "isA" => entry.is_a.clone(),
        "status" => entry.status.clone(),
        "title" => Some(entry.title.clone()),
        "body" => Some(entry.snippet.clone()),
        _ => {
            // Check properties first, then relationships
            if let Some(prop) = entry.properties.get(field) {
                match prop {
                    serde_json::Value::String(s) => Some(s.clone()),
                    serde_json::Value::Number(n) => Some(n.to_string()),
                    serde_json::Value::Bool(b) => Some(b.to_string()),
                    _ => None,
                }
            } else if let Some(rels) = entry.relationships.get(field) {
                relationship_values = Some(rels);
                None
            } else {
                None
            }
        }
    };

    let cond_value = cond.value.as_ref().and_then(yaml_value_to_string);
    let regex = if cond.regex && supports_regex(&cond.op) {
        cond_value.as_deref().and_then(build_regex)
    } else {
        None
    };

    if cond.regex && supports_regex(&cond.op) && regex.is_none() {
        return false;
    }

    if let Some(re) = regex.as_ref() {
        let matched = if let Some(prop) = field_value.as_deref() {
            re.is_match(prop)
        } else if let Some(rels) = relationship_values {
            rels.iter().any(|item| {
                relationship_candidates(item)
                    .into_iter()
                    .any(|candidate| re.is_match(&candidate))
            })
        } else {
            false
        };
        return match cond.op {
            FilterOp::Contains | FilterOp::Equals => matched,
            FilterOp::NotContains | FilterOp::NotEquals => !matched,
            _ => false,
        };
    }

    if let Some(rels) = relationship_values {
        return evaluate_relationship_op(&cond.op, rels, &cond.value);
    }

    match cond.op {
        FilterOp::Equals => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => f.eq_ignore_ascii_case(v),
            (None, None) => true,
            _ => false,
        },
        FilterOp::NotEquals => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => !f.eq_ignore_ascii_case(v),
            (None, None) => false,
            _ => true,
        },
        FilterOp::Contains => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => f.to_lowercase().contains(&v.to_lowercase()),
            _ => false,
        },
        FilterOp::NotContains => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => !f.to_lowercase().contains(&v.to_lowercase()),
            (None, _) => true,
            _ => true,
        },
        FilterOp::AnyOf => {
            let values = cond
                .value
                .as_ref()
                .and_then(yaml_value_to_string_vec)
                .unwrap_or_default();
            match &field_value {
                Some(f) => values.iter().any(|v| f.eq_ignore_ascii_case(v)),
                None => false,
            }
        }
        FilterOp::NoneOf => {
            let values = cond
                .value
                .as_ref()
                .and_then(yaml_value_to_string_vec)
                .unwrap_or_default();
            match &field_value {
                Some(f) => !values.iter().any(|v| f.eq_ignore_ascii_case(v)),
                None => true,
            }
        }
        FilterOp::IsEmpty => field_value.as_deref().map_or(true, |s| s.is_empty()),
        FilterOp::IsNotEmpty => field_value.as_deref().is_some_and(|s| !s.is_empty()),
        FilterOp::Before => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => match (
                parse_date_filter_timestamp(f, Utc::now()),
                parse_date_filter_timestamp(v, Utc::now()),
            ) {
                (Some(field_ts), Some(target_ts)) => field_ts < target_ts,
                _ => false,
            },
            _ => false,
        },
        FilterOp::After => match (&field_value, &cond_value) {
            (Some(f), Some(v)) => match (
                parse_date_filter_timestamp(f, Utc::now()),
                parse_date_filter_timestamp(v, Utc::now()),
            ) {
                (Some(field_ts), Some(target_ts)) => field_ts > target_ts,
                _ => false,
            },
            _ => false,
        },
    }
}

fn evaluate_bool_field(field_val: bool, op: &FilterOp, value: &Option<serde_yaml::Value>) -> bool {
    match op {
        FilterOp::Equals => {
            let expected = value.as_ref().and_then(|v| v.as_bool()).unwrap_or(true);
            field_val == expected
        }
        FilterOp::NotEquals => {
            let expected = value.as_ref().and_then(|v| v.as_bool()).unwrap_or(true);
            field_val != expected
        }
        FilterOp::IsEmpty => !field_val,
        FilterOp::IsNotEmpty => field_val,
        _ => false,
    }
}

fn evaluate_relationship_op(
    op: &FilterOp,
    rels: &[String],
    value: &Option<serde_yaml::Value>,
) -> bool {
    match op {
        FilterOp::Contains => {
            let target = value.as_ref().and_then(yaml_value_to_string);
            match target {
                Some(t) => {
                    let t_stem = wikilink_stem(&t).to_lowercase();
                    rels.iter()
                        .any(|r| wikilink_stem(r).to_lowercase() == t_stem)
                }
                None => false,
            }
        }
        FilterOp::NotContains => {
            let target = value.as_ref().and_then(yaml_value_to_string);
            match target {
                Some(t) => {
                    let t_stem = wikilink_stem(&t).to_lowercase();
                    !rels
                        .iter()
                        .any(|r| wikilink_stem(r).to_lowercase() == t_stem)
                }
                None => true,
            }
        }
        FilterOp::AnyOf => {
            let values = value
                .as_ref()
                .and_then(yaml_value_to_string_vec)
                .unwrap_or_default();
            rels.iter().any(|r| {
                let r_stem = wikilink_stem(r).to_lowercase();
                values
                    .iter()
                    .any(|v| wikilink_stem(v).to_lowercase() == r_stem)
            })
        }
        FilterOp::NoneOf => {
            let values = value
                .as_ref()
                .and_then(yaml_value_to_string_vec)
                .unwrap_or_default();
            !rels.iter().any(|r| {
                let r_stem = wikilink_stem(r).to_lowercase();
                values
                    .iter()
                    .any(|v| wikilink_stem(v).to_lowercase() == r_stem)
            })
        }
        FilterOp::IsEmpty => rels.is_empty(),
        FilterOp::IsNotEmpty => !rels.is_empty(),
        FilterOp::Equals => {
            let target = value.as_ref().and_then(yaml_value_to_string);
            match target {
                Some(t) => {
                    rels.len() == 1
                        && wikilink_stem(&rels[0]).to_lowercase()
                            == wikilink_stem(&t).to_lowercase()
                }
                None => rels.is_empty(),
            }
        }
        FilterOp::NotEquals => {
            let target = value.as_ref().and_then(yaml_value_to_string);
            match target {
                Some(t) => {
                    rels.len() != 1
                        || wikilink_stem(&rels[0]).to_lowercase()
                            != wikilink_stem(&t).to_lowercase()
                }
                None => !rels.is_empty(),
            }
        }
        _ => false,
    }
}

fn yaml_value_to_string(v: &serde_yaml::Value) -> Option<String> {
    match v {
        serde_yaml::Value::String(s) => Some(s.clone()),
        serde_yaml::Value::Number(n) => Some(n.to_string()),
        serde_yaml::Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

fn yaml_value_to_string_vec(v: &serde_yaml::Value) -> Option<Vec<String>> {
    v.as_sequence()
        .map(|seq| seq.iter().filter_map(yaml_value_to_string).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::collections::HashMap;

    fn make_entry(overrides: impl FnOnce(&mut VaultEntry)) -> VaultEntry {
        let mut entry = VaultEntry::default();
        overrides(&mut entry);
        entry
    }

    fn make_project_view(name: &str) -> ViewDefinition {
        ViewDefinition {
            name: name.to_string(),
            icon: None,
            color: None,
            sort: None,
            list_properties_display: Vec::new(),
            filters: FilterGroup::All(vec![FilterNode::Condition(FilterCondition {
                field: "type".to_string(),
                op: FilterOp::Equals,
                value: Some(serde_yaml::Value::String("Project".to_string())),
                regex: false,
            })]),
            kind: ViewKind::default(),
        }
    }

    #[test]
    fn view_kind_defaults_to_list_when_absent() {
        let yaml = "name: Backlog\nfilters:\n  all: []\n";
        let view: ViewDefinition = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(view.kind, ViewKind::List);
    }

    #[test]
    fn view_kind_kanban_round_trips() {
        let original = ViewDefinition {
            name: "Sprint 1".to_string(),
            icon: None,
            color: None,
            sort: None,
            list_properties_display: Vec::new(),
            filters: FilterGroup::All(vec![]),
            kind: ViewKind::Kanban,
        };
        let yaml = serde_yaml::to_string(&original).unwrap();
        assert!(yaml.contains("kind: kanban"), "expected kanban kind to serialize, got:\n{yaml}");
        let parsed: ViewDefinition = serde_yaml::from_str(&yaml).unwrap();
        assert_eq!(parsed.kind, ViewKind::Kanban);
    }

    #[test]
    fn view_kind_list_is_skipped_in_serialization() {
        let view = ViewDefinition {
            name: "Inbox".to_string(),
            icon: None,
            color: None,
            sort: None,
            list_properties_display: Vec::new(),
            filters: FilterGroup::All(vec![]),
            kind: ViewKind::List,
        };
        let yaml = serde_yaml::to_string(&view).unwrap();
        assert!(!yaml.contains("kind:"), "default 'list' kind should not appear in YAML, got:\n{yaml}");
    }

    #[test]
    fn test_parse_simple_view() {
        let yaml = r#"
name: Active Projects
icon: rocket
filters:
  all:
    - field: type
      op: equals
      value: Project
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();
        assert_eq!(def.name, "Active Projects");
        assert_eq!(def.icon.as_deref(), Some("rocket"));
        assert!(def.list_properties_display.is_empty());
        match &def.filters {
            FilterGroup::All(nodes) => {
                assert_eq!(nodes.len(), 1);
                match &nodes[0] {
                    FilterNode::Condition(c) => {
                        assert_eq!(c.field, "type");
                    }
                    _ => panic!("Expected condition"),
                }
            }
            _ => panic!("Expected All group"),
        }
    }

    #[test]
    fn test_evaluate_equals() {
        let yaml = r#"
name: Projects
filters:
  all:
    - field: type
      op: equals
      value: Project
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let matching = make_entry(|e| e.is_a = Some("Project".to_string()));
        let non_matching = make_entry(|e| e.is_a = Some("Note".to_string()));
        let entries = vec![matching, non_matching];

        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_evaluate_contains_relationship() {
        let yaml = r#"
name: Related to Target
filters:
  all:
    - field: Related to
      op: contains
      value: "[[target]]"
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let mut rels = HashMap::new();
        rels.insert(
            "Related to".to_string(),
            vec!["[[target]]".to_string(), "[[other]]".to_string()],
        );
        let matching = make_entry(|e| e.relationships = rels);

        let non_matching = make_entry(|_| {});
        let entries = vec![matching, non_matching];

        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_evaluate_regex_on_scalar_field() {
        let yaml = r#"
name: Regex Title
filters:
  all:
    - field: title
      op: contains
      value: "^alpha\\s+project$"
      regex: true
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let matching = make_entry(|e| e.title = "Alpha Project".to_string());
        let case_matching = make_entry(|e| e.title = "alpha project".to_string());
        let non_matching = make_entry(|e| e.title = "Alpha Notes".to_string());
        let entries = vec![matching, case_matching, non_matching];

        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0, 1]);
    }

    #[test]
    fn test_evaluate_regex_on_relationship_field() {
        let yaml = r#"
name: Regex Relationship
filters:
  all:
    - field: Related to
      op: contains
      value: "monday-(112|113)|Monday #112"
      regex: true
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let mut alias_rels = HashMap::new();
        alias_rels.insert(
            "Related to".to_string(),
            vec!["[[monday-112|Monday #112]]".to_string()],
        );
        let alias_match = make_entry(|e| e.relationships = alias_rels);

        let mut stem_rels = HashMap::new();
        stem_rels.insert("Related to".to_string(), vec!["[[monday-113]]".to_string()]);
        let stem_match = make_entry(|e| e.relationships = stem_rels);

        let mut other_rels = HashMap::new();
        other_rels.insert(
            "Related to".to_string(),
            vec!["[[tuesday-200|Tuesday]]".to_string()],
        );
        let non_matching = make_entry(|e| e.relationships = other_rels);

        let entries = vec![alias_match, stem_match, non_matching];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0, 1]);
    }

    #[test]
    fn test_invalid_regex_matches_nothing() {
        let yaml = r#"
name: Broken Regex
filters:
  all:
    - field: title
      op: contains
      value: "("
      regex: true
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let entries = vec![
            make_entry(|e| e.title = "Alpha Project".to_string()),
            make_entry(|e| e.title = "Beta Project".to_string()),
        ];

        let result = evaluate_view(&def, &entries);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_relative_date_filter_days_ago() {
        let reference = Utc.with_ymd_and_hms(2026, 4, 7, 12, 0, 0).unwrap();
        let parsed = parse_date_filter_timestamp("10 days ago", reference).unwrap();
        let expected = Utc
            .with_ymd_and_hms(2026, 3, 28, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        assert_eq!(parsed, expected);
    }

    #[test]
    fn test_parse_relative_date_filter_one_week_ago() {
        let reference = Utc.with_ymd_and_hms(2026, 4, 7, 12, 0, 0).unwrap();
        let parsed = parse_date_filter_timestamp("one week ago", reference).unwrap();
        let expected = Utc
            .with_ymd_and_hms(2026, 3, 31, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        assert_eq!(parsed, expected);
    }

    #[test]
    fn test_evaluate_nested_and_or() {
        let yaml = r#"
name: Complex
filters:
  all:
    - field: type
      op: equals
      value: Project
    - any:
        - field: status
          op: equals
          value: Active
        - field: status
          op: equals
          value: Planning
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let active_project = make_entry(|e| {
            e.is_a = Some("Project".to_string());
            e.status = Some("Active".to_string());
        });
        let planning_project = make_entry(|e| {
            e.is_a = Some("Project".to_string());
            e.status = Some("Planning".to_string());
        });
        let done_project = make_entry(|e| {
            e.is_a = Some("Project".to_string());
            e.status = Some("Done".to_string());
        });
        let active_note = make_entry(|e| {
            e.is_a = Some("Note".to_string());
            e.status = Some("Active".to_string());
        });

        let entries = vec![active_project, planning_project, done_project, active_note];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0, 1]);
    }

    #[test]
    fn test_evaluate_is_empty() {
        let yaml_empty = r#"
name: No Status
filters:
  all:
    - field: status
      op: is_empty
"#;
        let yaml_not_empty = r#"
name: Has Status
filters:
  all:
    - field: status
      op: is_not_empty
"#;
        let def_empty: ViewDefinition = serde_yaml::from_str(yaml_empty).unwrap();
        let def_not_empty: ViewDefinition = serde_yaml::from_str(yaml_not_empty).unwrap();

        let with_status = make_entry(|e| e.status = Some("Active".to_string()));
        let without_status = make_entry(|_| {});
        let entries = vec![with_status, without_status];

        assert_eq!(evaluate_view(&def_empty, &entries), vec![1]);
        assert_eq!(evaluate_view(&def_not_empty, &entries), vec![0]);
    }

    #[test]
    fn test_scan_views_reads_yml_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let views_dir = dir.path().join("views");
        fs::create_dir_all(&views_dir).unwrap();

        let yaml_a = "name: Alpha\nfilters:\n  all:\n    - field: type\n      op: equals\n      value: Note\n";
        let yaml_b = "name: Beta\nfilters:\n  any:\n    - field: status\n      op: equals\n      value: Active\n";
        fs::write(views_dir.join("a-view.yml"), yaml_a).unwrap();
        fs::write(views_dir.join("b-view.yml"), yaml_b).unwrap();
        // Non-yml file should be ignored
        fs::write(views_dir.join("readme.txt"), "ignore me").unwrap();

        let views = scan_views(dir.path());
        assert_eq!(views.len(), 2);
        assert_eq!(views[0].filename, "a-view.yml");
        assert_eq!(views[0].definition.name, "Alpha");
        assert_eq!(views[1].filename, "b-view.yml");
        assert_eq!(views[1].definition.name, "Beta");
    }

    #[test]
    fn test_migrate_views_from_old_location() {
        let dir = tempfile::TempDir::new().unwrap();
        let old_dir = dir.path().join(".laputa").join("views");
        fs::create_dir_all(&old_dir).unwrap();

        let yaml = "name: Migrated\nfilters:\n  all:\n    - field: type\n      op: equals\n      value: Note\n";
        fs::write(old_dir.join("test.yml"), yaml).unwrap();

        // scan_views should trigger migration and find the view
        let views = scan_views(dir.path());
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].definition.name, "Migrated");

        // File should now be in new location
        assert!(dir.path().join("views").join("test.yml").exists());
        // Old file should be gone
        assert!(!old_dir.join("test.yml").exists());
    }

    #[test]
    fn test_save_and_read_view() {
        let dir = tempfile::TempDir::new().unwrap();

        let mut def = make_project_view("Test View");
        def.icon = Some("star".to_string());
        def.sort = Some("modified:desc".to_string());
        def.list_properties_display = vec!["Priority".to_string(), "Owner".to_string()];

        save_view(dir.path(), "test.yml", &def).unwrap();

        let views = scan_views(dir.path());
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].definition.name, "Test View");
        assert_eq!(views[0].definition.icon.as_deref(), Some("star"));
        assert_eq!(
            views[0].definition.list_properties_display,
            vec!["Priority".to_string(), "Owner".to_string()]
        );

        delete_view(dir.path(), "test.yml").unwrap();
        let views = scan_views(dir.path());
        assert_eq!(views.len(), 0);
    }

    #[test]
    fn test_save_and_read_view_with_emoji_icon() {
        let dir = tempfile::TempDir::new().unwrap();

        let mut def = make_project_view("Monday");
        def.icon = Some("🗂️".to_string());

        save_view(dir.path(), "monday.yml", &def).unwrap();

        let views = scan_views(dir.path());
        assert_eq!(views.len(), 1);
        assert_eq!(views[0].definition.name, "Monday");
        assert_eq!(views[0].definition.icon.as_deref(), Some("🗂️"));
    }

    #[test]
    fn test_wikilink_stem_matching() {
        let yaml = r#"
name: Linked
filters:
  all:
    - field: Topics
      op: contains
      value: "[[target]]"
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        // Entry with aliased wikilink
        let mut rels = HashMap::new();
        rels.insert("Topics".to_string(), vec!["[[target|Alias]]".to_string()]);
        let matching = make_entry(|e| e.relationships = rels);

        // Entry with different target
        let mut rels2 = HashMap::new();
        rels2.insert("Topics".to_string(), vec!["[[other|Alias]]".to_string()]);
        let non_matching = make_entry(|e| e.relationships = rels2);

        let entries = vec![matching, non_matching];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_body_contains_filters_on_snippet() {
        let yaml = r#"
name: Body Search
filters:
  all:
    - field: body
      op: contains
      value: "quarterly"
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let matching = make_entry(|e| {
            e.title = "Match".to_string();
            e.snippet = "This is the quarterly review summary".to_string();
        });
        let non_matching = make_entry(|e| {
            e.title = "No match".to_string();
            e.snippet = "Daily standup notes".to_string();
        });
        let case_match = make_entry(|e| {
            e.title = "Case match".to_string();
            e.snippet = "QUARTERLY PLANNING session".to_string();
        });

        let entries = vec![matching, non_matching, case_match];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0, 2]);
    }

    #[test]
    fn test_body_not_contains() {
        let yaml = r#"
name: Body Exclude
filters:
  all:
    - field: body
      op: not_contains
      value: "draft"
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let final_note = make_entry(|e| {
            e.snippet = "Final version of the document".to_string();
        });
        let draft_note = make_entry(|e| {
            e.snippet = "This is a draft version".to_string();
        });

        let entries = vec![final_note, draft_note];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_body_combined_with_type_filter() {
        let yaml = r#"
name: Combined
filters:
  all:
    - field: type
      op: equals
      value: Note
    - field: body
      op: contains
      value: "important"
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let yes = make_entry(|e| {
            e.is_a = Some("Note".to_string());
            e.snippet = "This is important content".to_string();
        });
        let wrong_type = make_entry(|e| {
            e.is_a = Some("Project".to_string());
            e.snippet = "This is important content".to_string();
        });
        let no_match = make_entry(|e| {
            e.is_a = Some("Note".to_string());
            e.snippet = "Regular content".to_string();
        });

        let entries = vec![yes, wrong_type, no_match];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_body_is_empty() {
        let yaml = r#"
name: Empty Body
filters:
  all:
    - field: body
      op: is_empty
"#;
        let def: ViewDefinition = serde_yaml::from_str(yaml).unwrap();

        let empty = make_entry(|e| e.snippet = String::new());
        let has_content = make_entry(|e| e.snippet = "Some text here".to_string());

        let entries = vec![empty, has_content];
        let result = evaluate_view(&def, &entries);
        assert_eq!(result, vec![0]);
    }
}
