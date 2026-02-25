//! Pure text-processing helpers for markdown content parsing.
//! Snippet extraction, markdown stripping, date parsing, and string utilities.

/// Extract the title from a markdown file's content.
/// Tries the first H1 heading (`# Title`), falls back to filename without extension.
pub(super) fn extract_title(content: &str, filename: &str) -> String {
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

/// Remove YAML frontmatter (triple-dash delimited) from content.
fn strip_frontmatter(content: &str) -> &str {
    let Some(rest) = content.strip_prefix("---") else {
        return content;
    };
    match rest.find("---") {
        Some(end) => rest[end + 3..].trim_start(),
        None => content,
    }
}

/// Check if a line is useful for snippet extraction (not blank, heading, code fence, or rule).
fn is_snippet_line(line: &str) -> bool {
    let t = line.trim();
    !t.is_empty() && !t.starts_with('#') && !t.starts_with("```") && !t.starts_with("---")
}

/// Truncate a string to `max_len` bytes at a valid UTF-8 boundary, appending "...".
fn truncate_with_ellipsis(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        return s.to_string();
    }
    let mut idx = max_len;
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    format!("{}...", &s[..idx])
}

/// Extract a snippet: first ~160 chars of content after frontmatter/title, stripped of markdown.
pub(super) fn extract_snippet(content: &str) -> String {
    let without_fm = strip_frontmatter(content);
    let body = without_h1_line(without_fm).unwrap_or(without_fm);
    let clean: String = body
        .lines()
        .filter(|line| is_snippet_line(line))
        .collect::<Vec<&str>>()
        .join(" ");
    truncate_with_ellipsis(&strip_markdown_chars(&clean), 160)
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
        if c == delimiter {
            break;
        }
        buf.push(c);
    }
    buf
}

/// Skip all chars until a delimiter (consuming the delimiter).
fn skip_until(chars: &mut impl Iterator<Item = char>, delimiter: char) {
    for c in chars.by_ref() {
        if c == delimiter {
            break;
        }
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

/// Check if a string contains a wikilink pattern `[[...]]`.
pub(super) fn contains_wikilink(s: &str) -> bool {
    s.contains("[[") && s.contains("]]")
}

/// Extract all outgoing wikilink targets from content.
/// Finds `[[target]]` and `[[target|display]]` patterns, returning just the target part.
/// Returns a sorted, deduplicated Vec of targets.
pub(super) fn extract_outgoing_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut search_from = 0;
    let bytes = content.as_bytes();
    while search_from + 3 < bytes.len() {
        let Some(start) = content[search_from..].find("[[") else {
            break;
        };
        let abs_start = search_from + start + 2;
        let Some(end) = content[abs_start..].find("]]") else {
            break;
        };
        let inner = &content[abs_start..abs_start + end];
        let target = match inner.find('|') {
            Some(idx) => &inner[..idx],
            None => inner,
        };
        if !target.is_empty() {
            links.push(target.to_string());
        }
        search_from = abs_start + end + 2;
    }
    links.sort();
    links.dedup();
    links
}

pub(super) fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

/// Parse an ISO 8601 date string to Unix timestamp (seconds since epoch).
/// Handles "2025-05-23T14:35:00.000Z" and "2025-05-23" formats.
pub(super) fn parse_iso_date(date_str: &str) -> Option<u64> {
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

#[cfg(test)]
mod tests {
    use super::*;

    // --- extract_title tests ---

    #[test]
    fn test_extract_title_from_h1() {
        let content = "---\nIs A: Note\n---\n# My Great Note\n\nSome content here.";
        assert_eq!(extract_title(content, "my-great-note.md"), "My Great Note");
    }

    #[test]
    fn test_extract_title_fallback_to_filename() {
        let content = "Just some content without a heading.";
        assert_eq!(
            extract_title(content, "fallback-title.md"),
            "fallback-title"
        );
    }

    #[test]
    fn test_extract_title_empty_h1_falls_back() {
        let content = "# \n\nSome content.";
        assert_eq!(extract_title(content, "empty-h1.md"), "empty-h1");
    }

    // --- extract_snippet tests ---

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

    // --- strip_markdown_chars tests ---

    #[test]
    fn test_strip_markdown_chars_plain_text() {
        assert_eq!(strip_markdown_chars("hello world"), "hello world");
    }

    #[test]
    fn test_strip_markdown_chars_emphasis() {
        assert_eq!(
            strip_markdown_chars("**bold** and *italic*"),
            "bold and italic"
        );
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
        assert_eq!(
            strip_markdown_chars("[click here](https://example.com)"),
            "click here"
        );
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

    // --- extract_outgoing_links tests ---

    #[test]
    fn test_extract_outgoing_links_basic() {
        let content = "# Note\n\nSee [[Alice]] and [[Bob]] for details.";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["Alice", "Bob"]);
    }

    #[test]
    fn test_extract_outgoing_links_pipe_syntax() {
        let content = "Link to [[project/alpha|Alpha Project]] here.";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["project/alpha"]);
    }

    #[test]
    fn test_extract_outgoing_links_deduplicates() {
        let content = "See [[Alice]] and then [[Alice]] again.";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["Alice"]);
    }

    #[test]
    fn test_extract_outgoing_links_sorted() {
        let content = "[[Zebra]] then [[Alpha]] then [[Middle]]";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["Alpha", "Middle", "Zebra"]);
    }

    #[test]
    fn test_extract_outgoing_links_with_frontmatter() {
        let content = "---\nHas:\n  - \"[[task/design]]\"\n---\n# Note\n\nSee [[person/alice]].";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["person/alice", "task/design"]);
    }

    #[test]
    fn test_extract_outgoing_links_empty_content() {
        assert!(extract_outgoing_links("").is_empty());
        assert!(extract_outgoing_links("No links here").is_empty());
    }

    #[test]
    fn test_extract_outgoing_links_unclosed_bracket() {
        // First [[ matches with the only ]], yielding "unclosed and [[valid"
        let content = "[[unclosed and [[valid]]";
        let links = extract_outgoing_links(content);
        assert_eq!(links, vec!["unclosed and [[valid"]);
    }
}
