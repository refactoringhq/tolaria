use std::sync::OnceLock;

use ironcalc_base::Model;
use regex::Regex;

use super::SHEET_INDEX;

#[derive(Clone, Copy)]
pub(super) struct SheetText<'a>(&'a str);

impl<'a> SheetText<'a> {
    pub(super) fn new(value: &'a str) -> Self {
        Self(value)
    }
}

pub(super) fn external_ref_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\[\[([^\]\n]+?)\]\]\.(\$?)([A-Za-z]+)(\$?)([1-9]\d*)").unwrap())
}

fn numeric_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$").unwrap())
}

fn percent_regex() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^-?[$€£]?\s*[\d,]+(?:\.\d+)?%$").unwrap())
}

pub(super) fn is_external_formula_input(value: SheetText<'_>) -> bool {
    let value = value.0;
    value.trim_start().starts_with('=') && external_ref_regex().is_match(value)
}

fn normalize_target(target: SheetText<'_>) -> String {
    let target = target.0;
    target.trim().to_lowercase()
}

pub(super) fn wikilink_target(raw: SheetText<'_>) -> String {
    let raw = raw.0;
    raw.split_once('|')
        .map(|(target, _)| target)
        .unwrap_or(raw)
        .to_string()
}

pub(super) fn link_key(source_path: SheetText<'_>, target: SheetText<'_>) -> String {
    format!("{}\n{}", source_path.0, normalize_target(target))
}

pub(super) fn workbook_name_from_path(path: SheetText<'_>) -> String {
    let path = path.0;
    path.rsplit(['/', '\\'])
        .next()
        .unwrap_or("Tolaria Sheet")
        .trim_end_matches(".md")
        .to_string()
}

fn first_line_break_len(content: SheetText<'_>, index: usize) -> usize {
    let content = content.0;
    let bytes = content.as_bytes();
    match (bytes.get(index), bytes.get(index + 1)) {
        (Some(b'\r'), Some(b'\n')) => 2,
        (Some(b'\n' | b'\r'), _) => 1,
        _ => 0,
    }
}

fn is_frontmatter_delimiter(line: SheetText<'_>) -> bool {
    let line = line.0;
    line.strip_prefix("---")
        .map(|rest| rest.chars().all(|ch| ch == ' ' || ch == '\t'))
        .unwrap_or(false)
}

fn split_sheet_body(content: SheetText<'_>) -> &str {
    let content = content.0;
    if !content.starts_with("---") {
        return content;
    }

    let opening_line_break = first_line_break_len(SheetText::new(content), 3);
    if opening_line_break == 0 {
        return content;
    }

    let mut line_start = 3 + opening_line_break;
    while line_start < content.len() {
        let mut line_end = line_start;
        while line_end < content.len() && !matches!(content.as_bytes()[line_end], b'\n' | b'\r') {
            line_end += 1;
        }

        if is_frontmatter_delimiter(SheetText::new(&content[line_start..line_end])) {
            let closing_line_break = first_line_break_len(SheetText::new(content), line_end);
            return &content[line_end + closing_line_break..];
        }

        let line_break = first_line_break_len(SheetText::new(content), line_end);
        if line_break == 0 {
            break;
        }
        line_start = line_end + line_break;
    }

    content
}

pub(super) fn parse_sheet_rows(content: SheetText<'_>) -> Vec<Vec<String>> {
    parse_csv_rows(SheetText::new(split_sheet_body(content).trim_end()))
}

fn parse_csv_rows(source: SheetText<'_>) -> Vec<Vec<String>> {
    let source = source.0;
    if source.is_empty() {
        return Vec::new();
    }

    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .has_headers(false)
        .from_reader(source.as_bytes());

    reader
        .records()
        .filter_map(Result::ok)
        .map(|record| record.iter().map(str::to_string).collect())
        .collect()
}

fn strip_symmetric_markup(value: SheetText<'_>, marker: SheetText<'_>) -> Option<String> {
    let value = value.0;
    let marker = marker.0;
    let inner = value.strip_prefix(marker)?.strip_suffix(marker)?;
    let formula_candidate = inner.trim_start_matches(['*', '_', '~']).trim_start();
    if formula_candidate.starts_with('=') || inner.is_empty() {
        return None;
    }
    Some(inner.to_string())
}

pub(super) fn parse_sheet_markdown_cell_value(value: SheetText<'_>) -> String {
    let value = value.0;
    if value.starts_with('=') {
        return value.to_string();
    }

    for marker in ["***", "**", "__", "_", "*", "~~"] {
        if let Some(inner) = strip_symmetric_markup(SheetText::new(value), SheetText::new(marker)) {
            return inner;
        }
    }

    value.to_string()
}

pub(super) fn column_index_from_name(name: SheetText<'_>) -> Option<usize> {
    let name = name.0;
    let mut value = 0usize;
    for ch in name.chars() {
        if !ch.is_ascii_alphabetic() {
            return None;
        }
        value = value * 26 + (ch.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    (value > 0).then_some(value)
}

fn column_name_from_index(mut index: usize) -> String {
    let mut name = String::new();
    while index > 0 {
        let remainder = (index - 1) % 26;
        name.insert(0, (b'A' + remainder as u8) as char);
        index = (index - 1) / 26;
    }
    name
}

pub(super) fn cell_address(row: usize, column: usize) -> String {
    format!("{}{}", column_name_from_index(column), row)
}

fn normalized_numeric_formula_literal(value: SheetText<'_>) -> Option<String> {
    let value = value.0;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Some("0".to_string());
    }
    if numeric_regex().is_match(trimmed) {
        return Some(trimmed.to_string());
    }

    if percent_regex().is_match(trimmed) {
        let normalized = trimmed
            .chars()
            .filter(|ch| !matches!(ch, '$' | '€' | '£' | ',' | ' ' | '%'))
            .collect::<String>();
        if let Ok(parsed) = normalized.parse::<f64>() {
            return Some((parsed / 100.0).to_string());
        }
    }

    let normalized = trimmed
        .trim_start_matches(['$', '€', '£'])
        .trim_start()
        .replace(',', "");
    numeric_regex().is_match(&normalized).then_some(normalized)
}

fn text_formula_literal(value: SheetText<'_>) -> String {
    let value = value.0;
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
            .replace('\r', "\\r")
    )
}

pub(super) fn external_cell_formula_literal(
    model: &Model<'_>,
    row: i32,
    column: i32,
    raw_content: SheetText<'_>,
) -> String {
    let raw_content = raw_content.0;
    if !raw_content.trim_start().starts_with('=') {
        return normalized_numeric_formula_literal(SheetText::new(raw_content))
            .unwrap_or_else(|| text_formula_literal(SheetText::new(raw_content)));
    }

    let formatted = model
        .get_formatted_cell_value(SHEET_INDEX, row, column)
        .unwrap_or_default();
    normalized_numeric_formula_literal(SheetText::new(&formatted))
        .unwrap_or_else(|| text_formula_literal(SheetText::new(&formatted)))
}
