use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Value type for frontmatter updates
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum FrontmatterValue {
    String(String),
    Number(f64),
    Bool(bool),
    List(Vec<String>),
    Null,
}

/// Characters that require a YAML string value to be quoted.
fn has_yaml_special_chars(s: &str) -> bool {
    s.contains(':') || s.contains('#')
}

/// Check if a string starts with a YAML collection indicator (array or map).
fn starts_as_yaml_collection(s: &str) -> bool {
    s.starts_with('[') || s.starts_with('{')
}

/// Check whether a YAML string value needs quoting to avoid ambiguity.
fn needs_yaml_quoting(s: &str) -> bool {
    has_yaml_special_chars(s)
        || starts_as_yaml_collection(s)
        || matches!(s, "true" | "false" | "null")
        || s.parse::<f64>().is_ok()
}

/// Quote a string value for YAML, escaping internal double quotes.
fn quote_yaml_string(s: &str) -> String {
    format!("\"{}\"", s.replace('\"', "\\\""))
}

/// Format a single YAML list item as `  - "value"`.
fn format_list_item(item: &str) -> String {
    format!("  - {}", quote_yaml_string(item))
}

/// Format a multi-line string as a YAML block scalar (`|`).
/// Each line is indented by 2 spaces; empty lines are preserved as blank.
fn format_block_scalar(s: &str) -> String {
    let indented = s
        .lines()
        .map(|l| {
            if l.is_empty() {
                String::new()
            } else {
                format!("  {}", l)
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("|\n{}", indented)
}

/// Format a number for YAML (integers without decimal, floats with).
fn format_yaml_number(n: f64) -> String {
    if n.fract() == 0.0 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

impl FrontmatterValue {
    pub fn to_yaml_value(&self) -> String {
        match self {
            FrontmatterValue::String(s) => {
                if s.contains('\n') {
                    format_block_scalar(s)
                } else if needs_yaml_quoting(s) {
                    quote_yaml_string(s)
                } else {
                    s.clone()
                }
            }
            FrontmatterValue::Number(n) => format_yaml_number(*n),
            FrontmatterValue::Bool(b) => if *b { "true" } else { "false" }.to_string(),
            FrontmatterValue::List(items) if items.is_empty() => "[]".to_string(),
            FrontmatterValue::List(items) => items
                .iter()
                .map(|item| format_list_item(item))
                .collect::<Vec<_>>()
                .join("\n"),
            FrontmatterValue::Null => "null".to_string(),
        }
    }
}

/// Check whether a YAML key needs quoting (contains spaces, special chars, etc.).
fn needs_key_quoting(key: &str) -> bool {
    key.chars()
        .any(|c| !c.is_ascii_alphanumeric() && c != '_' && c != '-')
}

/// Format a key for YAML output (quote if necessary)
pub fn format_yaml_key(key: &str) -> String {
    if needs_key_quoting(key) {
        format!("\"{}\"", key)
    } else {
        key.to_string()
    }
}

/// Check if a line defines a specific key (handles quoted and unquoted keys)
fn line_is_key(line: &str, key: &str) -> bool {
    let trimmed = line.trim_start();

    if trimmed.starts_with(key) && trimmed[key.len()..].starts_with(':') {
        return true;
    }

    let dq = format!("\"{}\":", key);
    if trimmed.starts_with(&dq) {
        return true;
    }

    let sq = format!("'{}\':", key);
    if trimmed.starts_with(&sq) {
        return true;
    }

    false
}

/// Format a key-value pair as one or more YAML lines.
fn format_yaml_field(key: &str, value: &FrontmatterValue) -> Vec<String> {
    let yaml_key = format_yaml_key(key);
    let yaml_value = value.to_yaml_value();
    if yaml_value.starts_with("|\n") {
        // Block scalar: key and indicator on the same line, content follows
        vec![format!("{}: {}", yaml_key, yaml_value)]
    } else if yaml_value.contains('\n') {
        vec![format!("{}:", yaml_key), yaml_value]
    } else {
        vec![format!("{}: {}", yaml_key, yaml_value)]
    }
}

/// Check if a line continues the previous key's value (indented list item,
/// block scalar content, or blank line inside a block scalar).
fn is_value_continuation(line: &str) -> bool {
    line.is_empty() || line.starts_with("  ") || line.starts_with('\t')
}

/// Split content into frontmatter body and the rest after the closing `---`.
/// Returns `(fm_content, rest)` where `fm_content` is between the opening and closing `---`.
fn split_frontmatter(content: &str) -> Result<(&str, &str), String> {
    let after_open = &content[4..];
    // Handle empty frontmatter: closing --- immediately after opening ---\n
    if let Some(stripped) = after_open.strip_prefix("---") {
        return Ok(("", stripped));
    }
    let fm_end = after_open
        .find("\n---")
        .map(|i| i + 4)
        .ok_or_else(|| "Malformed frontmatter: no closing ---".to_string())?;
    Ok((&content[4..fm_end], &content[fm_end + 4..]))
}

/// Wrap content in a new frontmatter block containing a single field.
fn prepend_new_frontmatter(content: &str, key: &str, value: &FrontmatterValue) -> String {
    let field_lines = format_yaml_field(key, value);
    format!("---\n{}\n---\n{}", field_lines.join("\n"), content)
}

/// Apply a field update to existing frontmatter lines.
/// Replaces the matching key (and its list continuations) with the new value,
/// or appends if the key is not found. If `value` is None, removes the key.
fn apply_field_update(lines: &[&str], key: &str, value: Option<&FrontmatterValue>) -> Vec<String> {
    let mut new_lines: Vec<String> = Vec::new();
    let mut found_key = false;
    let mut i = 0;

    while i < lines.len() {
        if !line_is_key(lines[i], key) {
            new_lines.push(lines[i].to_string());
            i += 1;
            continue;
        }

        found_key = true;
        i += 1;
        // Skip continuation lines belonging to this key (lists, block scalars)
        while i < lines.len() && is_value_continuation(lines[i]) {
            i += 1;
        }
        // Insert replacement value (if any)
        if let Some(v) = value {
            new_lines.extend(format_yaml_field(key, v));
        }
    }

    if let (false, Some(v)) = (found_key, value) {
        new_lines.extend(format_yaml_field(key, v));
    }

    new_lines
}

/// Internal function to update frontmatter content
pub fn update_frontmatter_content(
    content: &str,
    key: &str,
    value: Option<FrontmatterValue>,
) -> Result<String, String> {
    if !content.starts_with("---\n") {
        return match value {
            Some(v) => Ok(prepend_new_frontmatter(content, key, &v)),
            None => Ok(content.to_string()),
        };
    }

    let (fm_content, rest) = split_frontmatter(content)?;
    let lines: Vec<&str> = fm_content.lines().collect();
    let new_lines = apply_field_update(&lines, key, value.as_ref());
    let new_fm = new_lines.join("\n");
    Ok(format!("---\n{}\n---{}", new_fm, rest))
}

/// Helper to read a file, apply a frontmatter transformation, and write back.
pub fn with_frontmatter<F>(path: &str, transform: F) -> Result<String, String>
where
    F: FnOnce(&str) -> Result<String, String>,
{
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read {}: {}", path, e))?;

    let updated = transform(&content)?;

    fs::write(file_path, &updated).map_err(|e| format!("Failed to write {}: {}", path, e))?;

    Ok(updated)
}

/// Update a single frontmatter property in a markdown file.
pub fn update_frontmatter(
    path: &str,
    key: &str,
    value: FrontmatterValue,
) -> Result<String, String> {
    with_frontmatter(path, |content| {
        update_frontmatter_content(content, key, Some(value.clone()))
    })
}

/// Delete a frontmatter property from a markdown file.
pub fn delete_frontmatter_property(path: &str, key: &str) -> Result<String, String> {
    with_frontmatter(path, |content| {
        update_frontmatter_content(content, key, None)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_frontmatter_string() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "Status",
            Some(FrontmatterValue::String("Active".to_string())),
        )
        .unwrap();
        assert!(updated.contains("Status: Active"));
        assert!(!updated.contains("Status: Draft"));
    }

    #[test]
    fn test_update_frontmatter_add_new_key() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "Owner",
            Some(FrontmatterValue::String("Luca".to_string())),
        )
        .unwrap();
        assert!(updated.contains("Owner: Luca"));
        assert!(updated.contains("Status: Draft"));
    }

    #[test]
    fn test_update_frontmatter_quoted_key() {
        let content = "---\n\"Is A\": Note\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "Is A",
            Some(FrontmatterValue::String("Project".to_string())),
        )
        .unwrap();
        assert!(updated.contains("\"Is A\": Project"));
        assert!(!updated.contains("Note"));
    }

    #[test]
    fn test_update_frontmatter_list() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "aliases",
            Some(FrontmatterValue::List(vec![
                "Alias1".to_string(),
                "Alias2".to_string(),
            ])),
        )
        .unwrap();
        assert!(updated.contains("aliases:"));
        assert!(updated.contains("  - \"Alias1\""));
        assert!(updated.contains("  - \"Alias2\""));
    }

    #[test]
    fn test_update_frontmatter_replace_list() {
        let content = "---\naliases:\n  - Old1\n  - Old2\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "aliases",
            Some(FrontmatterValue::List(vec!["New1".to_string()])),
        )
        .unwrap();
        assert!(updated.contains("  - \"New1\""));
        assert!(!updated.contains("Old1"));
        assert!(!updated.contains("Old2"));
        assert!(updated.contains("Status: Draft"));
    }

    #[test]
    fn test_delete_frontmatter_property() {
        let content = "---\nStatus: Draft\nOwner: Luca\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Owner", None).unwrap();
        assert!(!updated.contains("Owner"));
        assert!(updated.contains("Status: Draft"));
    }

    #[test]
    fn test_delete_frontmatter_list_property() {
        let content = "---\naliases:\n  - Alias1\n  - Alias2\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "aliases", None).unwrap();
        assert!(!updated.contains("aliases"));
        assert!(!updated.contains("Alias1"));
        assert!(updated.contains("Status: Draft"));
    }

    #[test]
    fn test_update_frontmatter_no_existing() {
        let content = "# Test\n\nSome content here.";
        let updated = update_frontmatter_content(
            content,
            "Status",
            Some(FrontmatterValue::String("Draft".to_string())),
        )
        .unwrap();
        assert!(updated.starts_with("---\n"));
        assert!(updated.contains("Status: Draft"));
        assert!(updated.contains("# Test"));
    }

    #[test]
    fn test_update_frontmatter_bool() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated =
            update_frontmatter_content(content, "Reviewed", Some(FrontmatterValue::Bool(true)))
                .unwrap();
        assert!(updated.contains("Reviewed: true"));
    }

    #[test]
    fn test_format_yaml_key_simple() {
        assert_eq!(format_yaml_key("Status"), "Status");
        assert_eq!(format_yaml_key("is_a"), "is_a");
    }

    #[test]
    fn test_format_yaml_key_with_spaces() {
        assert_eq!(format_yaml_key("Is A"), "\"Is A\"");
        assert_eq!(format_yaml_key("Created at"), "\"Created at\"");
    }

    // --- to_yaml_value quoting tests ---

    #[test]
    fn test_to_yaml_value_string_needs_quoting_colon() {
        let v = FrontmatterValue::String("key: value".to_string());
        assert_eq!(v.to_yaml_value(), "\"key: value\"");
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_hash() {
        let v = FrontmatterValue::String("has # comment".to_string());
        assert_eq!(v.to_yaml_value(), "\"has # comment\"");
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_bracket() {
        let v = FrontmatterValue::String("[array-like]".to_string());
        assert_eq!(v.to_yaml_value(), "\"[array-like]\"");
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_brace() {
        let v = FrontmatterValue::String("{object-like}".to_string());
        assert_eq!(v.to_yaml_value(), "\"{object-like}\"");
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_bool_like() {
        assert_eq!(
            FrontmatterValue::String("true".to_string()).to_yaml_value(),
            "\"true\""
        );
        assert_eq!(
            FrontmatterValue::String("false".to_string()).to_yaml_value(),
            "\"false\""
        );
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_null_like() {
        assert_eq!(
            FrontmatterValue::String("null".to_string()).to_yaml_value(),
            "\"null\""
        );
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_number_like() {
        assert_eq!(
            FrontmatterValue::String("42".to_string()).to_yaml_value(),
            "\"42\""
        );
        assert_eq!(
            FrontmatterValue::String("3.14".to_string()).to_yaml_value(),
            "\"3.14\""
        );
    }

    #[test]
    fn test_to_yaml_value_string_plain() {
        let v = FrontmatterValue::String("Hello World".to_string());
        assert_eq!(v.to_yaml_value(), "Hello World");
    }

    #[test]
    fn test_to_yaml_value_number_integer() {
        let v = FrontmatterValue::Number(42.0);
        assert_eq!(v.to_yaml_value(), "42");
    }

    #[test]
    fn test_to_yaml_value_number_float() {
        let v = FrontmatterValue::Number(3.14);
        assert_eq!(v.to_yaml_value(), "3.14");
    }

    #[test]
    fn test_to_yaml_value_null() {
        assert_eq!(FrontmatterValue::Null.to_yaml_value(), "null");
    }

    #[test]
    fn test_to_yaml_value_empty_list() {
        let v = FrontmatterValue::List(vec![]);
        assert_eq!(v.to_yaml_value(), "[]");
    }

    #[test]
    fn test_to_yaml_value_list_with_colon() {
        let v = FrontmatterValue::List(vec!["key: value".to_string()]);
        assert_eq!(v.to_yaml_value(), "  - \"key: value\"");
    }

    // --- update_frontmatter_content additional type tests ---

    #[test]
    fn test_update_frontmatter_number() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated =
            update_frontmatter_content(content, "Priority", Some(FrontmatterValue::Number(5.0)))
                .unwrap();
        assert!(updated.contains("Priority: 5"));
    }

    #[test]
    fn test_update_frontmatter_number_float() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated =
            update_frontmatter_content(content, "Score", Some(FrontmatterValue::Number(9.5)))
                .unwrap();
        assert!(updated.contains("Score: 9.5"));
    }

    #[test]
    fn test_update_frontmatter_null() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated =
            update_frontmatter_content(content, "ClearMe", Some(FrontmatterValue::Null)).unwrap();
        assert!(updated.contains("ClearMe: null"));
    }

    #[test]
    fn test_update_frontmatter_empty_list() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated =
            update_frontmatter_content(content, "tags", Some(FrontmatterValue::List(vec![])))
                .unwrap();
        assert!(updated.contains("tags: []"));
    }

    #[test]
    fn test_update_frontmatter_malformed_no_closing_fence() {
        let content = "---\nStatus: Draft\nNo closing fence here";
        let result = update_frontmatter_content(
            content,
            "Status",
            Some(FrontmatterValue::String("Active".to_string())),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Malformed frontmatter"));
    }

    // --- delete non-existent key (should be no-op) ---

    #[test]
    fn test_delete_nonexistent_key_noop() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "NonExistent", None).unwrap();
        assert_eq!(updated, content);
    }

    #[test]
    fn test_delete_from_no_frontmatter_noop() {
        let content = "# Test\n\nSome content.";
        let updated = update_frontmatter_content(content, "NonExistent", None).unwrap();
        assert_eq!(updated, content);
    }

    // --- line_is_key tests ---

    #[test]
    fn test_line_is_key_unquoted() {
        assert!(line_is_key("Status: Draft", "Status"));
        assert!(!line_is_key("Status: Draft", "Owner"));
    }

    #[test]
    fn test_line_is_key_double_quoted() {
        assert!(line_is_key("\"Is A\": Note", "Is A"));
        assert!(!line_is_key("\"Is A\": Note", "Status"));
    }

    #[test]
    fn test_line_is_key_single_quoted() {
        assert!(line_is_key("'Is A': Note", "Is A"));
    }

    #[test]
    fn test_line_is_key_leading_whitespace() {
        assert!(line_is_key("  Status: Draft", "Status"));
    }

    #[test]
    fn test_line_is_key_partial_match() {
        // "StatusBar" should not match key "Status"
        assert!(!line_is_key("StatusBar: value", "Status"));
    }

    // --- with_frontmatter error cases ---

    #[test]
    fn test_with_frontmatter_file_not_found() {
        let result = with_frontmatter("/nonexistent/path/file.md", |c| Ok(c.to_string()));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    // --- roundtrip tests ---

    #[test]
    fn test_roundtrip_update_string() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "Status",
            Some(FrontmatterValue::String("Active".to_string())),
        )
        .unwrap();
        // Parse back with gray_matter
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter.parse(&updated);
        let data = parsed.data.unwrap();
        if let gray_matter::Pod::Hash(map) = data {
            assert_eq!(map.get("Status").unwrap().as_string().unwrap(), "Active");
        } else {
            panic!("Expected hash");
        }
    }

    #[test]
    fn test_roundtrip_update_list() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(
            content,
            "aliases",
            Some(FrontmatterValue::List(vec![
                "A".to_string(),
                "B".to_string(),
            ])),
        )
        .unwrap();
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter.parse(&updated);
        let data = parsed.data.unwrap();
        if let gray_matter::Pod::Hash(map) = data {
            let aliases = map.get("aliases").unwrap();
            if let gray_matter::Pod::Array(arr) = aliases {
                assert_eq!(arr.len(), 2);
                assert_eq!(arr[0].as_string().unwrap(), "A");
                assert_eq!(arr[1].as_string().unwrap(), "B");
            } else {
                panic!("Expected array");
            }
        } else {
            panic!("Expected hash");
        }
    }

    #[test]
    fn test_roundtrip_add_then_delete() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let with_owner = update_frontmatter_content(
            content,
            "Owner",
            Some(FrontmatterValue::String("Luca".to_string())),
        )
        .unwrap();
        assert!(with_owner.contains("Owner: Luca"));
        let without_owner = update_frontmatter_content(&with_owner, "Owner", None).unwrap();
        assert!(!without_owner.contains("Owner"));
        assert!(without_owner.contains("Status: Draft"));
    }

    // --- format_yaml_key additional tests ---

    #[test]
    fn test_format_yaml_key_with_colon() {
        assert_eq!(format_yaml_key("key:value"), "\"key:value\"");
    }

    #[test]
    fn test_format_yaml_key_with_hash() {
        assert_eq!(format_yaml_key("has#tag"), "\"has#tag\"");
    }

    #[test]
    fn test_format_yaml_key_with_period() {
        assert_eq!(format_yaml_key("key.name"), "\"key.name\"");
    }

    // --- split_frontmatter / empty frontmatter edge cases ---

    #[test]
    fn test_split_frontmatter_empty_block() {
        // ---\n---\n  (no fields between opening and closing ---)
        let result = split_frontmatter("---\n---\n");
        assert!(
            result.is_ok(),
            "split_frontmatter should handle empty frontmatter block"
        );
        let (fm, rest) = result.unwrap();
        assert_eq!(fm, "");
        assert_eq!(rest, "\n");
    }

    #[test]
    fn test_split_frontmatter_empty_block_no_trailing_newline() {
        // ---\n---  (no trailing newline)
        let result = split_frontmatter("---\n---");
        assert!(
            result.is_ok(),
            "split_frontmatter should handle empty frontmatter without trailing newline"
        );
    }

    #[test]
    fn test_split_frontmatter_empty_block_with_body() {
        // ---\n---\n\n# Title\n
        let result = split_frontmatter("---\n---\n\n# Title\n");
        assert!(
            result.is_ok(),
            "split_frontmatter should handle empty frontmatter with body"
        );
        let (fm, rest) = result.unwrap();
        assert_eq!(fm, "");
        assert!(rest.contains("# Title"));
    }

    #[test]
    fn test_update_frontmatter_empty_block() {
        let content = "---\n---\n\n# Test\n";
        let result = update_frontmatter_content(
            content,
            "title",
            Some(FrontmatterValue::String("New Title".to_string())),
        );
        assert!(
            result.is_ok(),
            "update_frontmatter_content should handle empty frontmatter block"
        );
        let updated = result.unwrap();
        assert!(updated.contains("title: New Title"));
    }

    // --- block scalar (multi-line string) tests ---

    #[test]
    fn test_to_yaml_value_multiline_uses_block_scalar() {
        let v = FrontmatterValue::String("line 1\nline 2\nline 3".to_string());
        let yaml = v.to_yaml_value();
        assert!(yaml.starts_with("|\n"));
        assert!(yaml.contains("  line 1"));
        assert!(yaml.contains("  line 2"));
    }

    #[test]
    fn test_format_yaml_field_block_scalar() {
        let v = FrontmatterValue::String("## Objective\n\n## Timeline".to_string());
        let lines = format_yaml_field("template", &v);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].starts_with("template: |\n"));
        assert!(lines[0].contains("  ## Objective"));
        assert!(lines[0].contains("  ## Timeline"));
    }

    #[test]
    fn test_update_frontmatter_block_scalar_add() {
        let content = "---\ntype: Type\n---\n# Project\n";
        let template = "## Objective\n\n## Timeline";
        let updated = update_frontmatter_content(
            content,
            "template",
            Some(FrontmatterValue::String(template.to_string())),
        )
        .unwrap();
        assert!(updated.contains("template: |"));
        assert!(updated.contains("  ## Objective"));
        assert!(updated.contains("  ## Timeline"));
        assert!(updated.contains("type: Type"));
    }

    #[test]
    fn test_update_frontmatter_block_scalar_replace() {
        let content = "---\ntype: Type\ntemplate: |\n  ## Old\n  \n  ## Stuff\ncolor: green\n---\n# Project\n";
        let new_template = "## New\n\n## Content";
        let updated = update_frontmatter_content(
            content,
            "template",
            Some(FrontmatterValue::String(new_template.to_string())),
        )
        .unwrap();
        assert!(updated.contains("  ## New"));
        assert!(updated.contains("  ## Content"));
        assert!(!updated.contains("## Old"));
        assert!(!updated.contains("## Stuff"));
        assert!(updated.contains("color: green"));
    }

    #[test]
    fn test_delete_frontmatter_block_scalar() {
        let content =
            "---\ntype: Type\ntemplate: |\n  ## Heading\n  \n  ## Body\ncolor: green\n---\n# Project\n";
        let updated = update_frontmatter_content(content, "template", None).unwrap();
        assert!(!updated.contains("template"));
        assert!(!updated.contains("## Heading"));
        assert!(updated.contains("color: green"));
    }

    #[test]
    fn test_roundtrip_block_scalar() {
        let content = "---\ntype: Type\n---\n# Project\n";
        let template = "## Objective\n\nDescribe the goal.\n\n## Timeline\n\nKey dates.";
        let updated = update_frontmatter_content(
            content,
            "template",
            Some(FrontmatterValue::String(template.to_string())),
        )
        .unwrap();
        // Parse back with gray_matter
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        let parsed = matter.parse(&updated);
        let data = parsed.data.unwrap();
        if let gray_matter::Pod::Hash(map) = data {
            let roundtripped = map.get("template").unwrap().as_string().unwrap();
            assert!(roundtripped.contains("## Objective"));
            assert!(roundtripped.contains("## Timeline"));
            assert!(roundtripped.contains("Describe the goal."));
        } else {
            panic!("Expected hash");
        }
    }

    #[test]
    fn test_update_frontmatter_no_body_after_closing() {
        // Frontmatter with title, no body after closing ---
        let content = "---\ntitle: Old\n---\n";
        let result = update_frontmatter_content(
            content,
            "title",
            Some(FrontmatterValue::String("New".to_string())),
        );
        assert!(result.is_ok());
        let updated = result.unwrap();
        assert!(updated.contains("title: New"));
        assert!(!updated.contains("title: Old"));
    }
}
