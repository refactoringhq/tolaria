use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    /// Markdown template for notes of this Type. When a new note is created
    /// with this type, the template body is pre-filled after the frontmatter.
    pub template: Option<String>,
    /// Default sort preference for the note list when viewing instances of this Type.
    /// Stored as "option:direction" (e.g. "modified:desc", "title:asc", "property:Priority:asc").
    pub sort: Option<String>,
    /// Default view mode for the note list when viewing instances of this Type.
    /// Stored as a string: "all", "editor-list", or "editor-only".
    pub view: Option<String>,
    /// Whether this Type is visible in the sidebar. Defaults to true when absent.
    pub visible: Option<bool>,
    /// Word count of the note body (excludes frontmatter and H1 title).
    #[serde(rename = "wordCount")]
    pub word_count: u32,
    /// All wikilink targets found in the note body (excludes frontmatter).
    /// Extracted from `[[target]]` and `[[target|display]]` patterns.
    #[serde(rename = "outgoingLinks", default)]
    pub outgoing_links: Vec<String>,
    /// Custom scalar frontmatter properties (non-relationship, non-structural).
    /// Only includes strings, numbers, and booleans — arrays/objects are excluded.
    #[serde(default)]
    pub properties: HashMap<String, serde_json::Value>,
}
