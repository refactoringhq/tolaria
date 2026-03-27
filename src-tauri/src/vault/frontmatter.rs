use crate::vault::parsing::contains_wikilink;
use serde::Deserialize;
use std::collections::HashMap;

/// Intermediate struct to capture YAML frontmatter fields.
#[derive(Debug, Deserialize, Default)]
pub(crate) struct Frontmatter {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(rename = "type", alias = "Is A", alias = "is_a")]
    pub is_a: Option<StringOrList>,
    #[serde(default)]
    pub aliases: Option<StringOrList>,
    #[serde(
        rename = "Archived",
        alias = "archived",
        default,
        deserialize_with = "deserialize_bool_or_string"
    )]
    pub archived: Option<bool>,
    #[serde(
        rename = "Trashed",
        alias = "trashed",
        default,
        deserialize_with = "deserialize_bool_or_string"
    )]
    pub trashed: Option<bool>,
    #[serde(rename = "Status", alias = "status", default)]
    pub status: Option<StringOrList>,
    #[serde(rename = "Trashed at", alias = "trashed_at")]
    pub trashed_at: Option<StringOrList>,
    #[serde(default)]
    pub icon: Option<StringOrList>,
    #[serde(default)]
    pub color: Option<StringOrList>,
    #[serde(default)]
    pub order: Option<i64>,
    #[serde(rename = "sidebar label", default)]
    pub sidebar_label: Option<StringOrList>,
    #[serde(default)]
    pub template: Option<StringOrList>,
    #[serde(default)]
    pub sort: Option<StringOrList>,
    #[serde(default)]
    pub view: Option<StringOrList>,
    #[serde(default)]
    pub visible: Option<bool>,
}

/// Custom deserializer for boolean fields that may arrive as strings.
/// YAML `Yes`/`No` get converted to JSON strings by gray_matter, so we
/// need to accept both actual booleans and their string representations.
fn deserialize_bool_or_string<'de, D>(deserializer: D) -> Result<Option<bool>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de;

    struct BoolOrStringVisitor;

    impl<'de> de::Visitor<'de> for BoolOrStringVisitor {
        type Value = Option<bool>;

        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("a boolean or a string representing a boolean")
        }

        fn visit_bool<E: de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            match v.to_lowercase().as_str() {
                "true" | "yes" | "1" => Ok(Some(true)),
                "false" | "no" | "0" | "" => Ok(Some(false)),
                _ => Ok(Some(false)),
            }
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
    }

    deserializer.deserialize_any(BoolOrStringVisitor)
}

/// Handles YAML fields that can be either a single string or a list of strings.
#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
pub(crate) enum StringOrList {
    Single(String),
    List(Vec<String>),
}

impl StringOrList {
    pub fn into_vec(self) -> Vec<String> {
        match self {
            StringOrList::Single(s) => vec![s],
            StringOrList::List(v) => v,
        }
    }

    /// Normalize to a single scalar: unwrap single-element arrays, take first
    /// element of multi-element arrays, return scalar unchanged, empty array → None.
    pub fn into_scalar(self) -> Option<String> {
        match self {
            StringOrList::Single(s) => Some(s),
            StringOrList::List(mut v) => {
                if v.is_empty() {
                    None
                } else {
                    Some(v.swap_remove(0))
                }
            }
        }
    }
}

/// Parse frontmatter from raw YAML data extracted by gray_matter.
fn parse_frontmatter(data: &HashMap<String, serde_json::Value>) -> Frontmatter {
    static KNOWN_KEYS: &[&str] = &[
        "title",
        "type",
        "Is A",
        "is_a",
        "aliases",
        "Archived",
        "archived",
        "Trashed",
        "trashed",
        "Trashed at",
        "trashed_at",
        "icon",
        "color",
        "order",
        "sidebar label",
        "template",
        "sort",
        "view",
        "visible",
        "notion_id",
        "Status",
        "status",
    ];
    let filtered: serde_json::Map<String, serde_json::Value> = data
        .iter()
        .filter(|(k, _)| KNOWN_KEYS.contains(&k.as_str()))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    let value = serde_json::Value::Object(filtered);
    serde_json::from_value(value).unwrap_or_default()
}

/// Known non-relationship frontmatter keys to skip (case-insensitive comparison).
/// Only skip keys that can never contain wikilinks.
/// Note: owner and cadence are NOT skipped — they should appear in generic properties.
const SKIP_KEYS: &[&str] = &[
    "title",
    "is a",
    "type",
    "aliases",
    "archived",
    "trashed",
    "trashed at",
    "icon",
    "color",
    "order",
    "sidebar label",
    "template",
    "sort",
    "view",
    "visible",
    "status",
];

/// Extract all wikilink-containing fields from raw YAML frontmatter.
pub(crate) fn extract_relationships(
    data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, Vec<String>> {
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

/// Extract custom scalar properties from raw YAML frontmatter.
pub(crate) fn extract_properties(
    data: &HashMap<String, serde_json::Value>,
) -> HashMap<String, serde_json::Value> {
    let mut properties = HashMap::new();

    for (key, value) in data {
        let lower = key.to_ascii_lowercase();
        if SKIP_KEYS.iter().any(|k| k.eq_ignore_ascii_case(&lower)) {
            continue;
        }

        match value {
            serde_json::Value::String(s) => {
                if !contains_wikilink(s) {
                    properties.insert(key.clone(), value.clone());
                }
            }
            serde_json::Value::Number(_) | serde_json::Value::Bool(_) => {
                properties.insert(key.clone(), value.clone());
            }
            // Handle single-element arrays: unwrap to scalar.
            // This ensures YAML like "Owner: [Luca]" or "Owner:\n  - Luca" works correctly.
            serde_json::Value::Array(arr) => {
                if arr.len() == 1 {
                    if let Some(serde_json::Value::String(s)) = arr.first() {
                        if !contains_wikilink(s) {
                            properties.insert(key.clone(), serde_json::Value::String(s.clone()));
                        }
                    }
                }
            }
            _ => {}
        }
    }

    properties
}

/// Resolve `is_a` from frontmatter only.
pub(crate) fn resolve_is_a(fm_is_a: Option<StringOrList>) -> Option<String> {
    fm_is_a.and_then(|a| a.into_vec().into_iter().next())
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

/// Extract frontmatter, relationships, and custom properties from parsed gray_matter data.
pub(crate) fn extract_fm_and_rels(
    data: Option<gray_matter::Pod>,
) -> (
    Frontmatter,
    HashMap<String, Vec<String>>,
    HashMap<String, serde_json::Value>,
) {
    let hash = match data {
        Some(gray_matter::Pod::Hash(map)) => map,
        _ => return (Frontmatter::default(), HashMap::new(), HashMap::new()),
    };
    let json_map: HashMap<String, serde_json::Value> =
        hash.into_iter().map(|(k, v)| (k, pod_to_json(v))).collect();
    (
        parse_frontmatter(&json_map),
        extract_relationships(&json_map),
        extract_properties(&json_map),
    )
}
