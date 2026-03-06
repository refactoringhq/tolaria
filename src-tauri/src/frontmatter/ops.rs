use super::yaml::{format_yaml_field, FrontmatterValue};

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
        assert!(!line_is_key("StatusBar: value", "Status"));
    }

    #[test]
    fn test_split_frontmatter_empty_block() {
        let result = split_frontmatter("---\n---\n");
        assert!(result.is_ok());
        let (fm, rest) = result.unwrap();
        assert_eq!(fm, "");
        assert_eq!(rest, "\n");
    }

    #[test]
    fn test_split_frontmatter_empty_block_no_trailing_newline() {
        let result = split_frontmatter("---\n---");
        assert!(result.is_ok());
    }

    #[test]
    fn test_split_frontmatter_empty_block_with_body() {
        let result = split_frontmatter("---\n---\n\n# Title\n");
        assert!(result.is_ok());
        let (fm, rest) = result.unwrap();
        assert_eq!(fm, "");
        assert!(rest.contains("# Title"));
    }
}
