use serde::{Deserialize, Serialize};

/// Value type for frontmatter updates
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum FrontmatterValue {
    String(String),
    Number(f64),
    Bool(bool),
    List(Vec<FrontmatterScalar>),
    Null,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum FrontmatterScalar {
    String(String),
    Number(f64),
    Bool(bool),
    Null,
}

impl FrontmatterScalar {
    fn to_yaml_list_item(&self) -> String {
        match self {
            Self::String(item) => YamlText(item).as_list_item(),
            Self::Number(number) => format!("  - {}", format_yaml_number(*number)),
            Self::Bool(value) => format!("  - {}", if *value { "true" } else { "false" }),
            Self::Null => "  - null".to_string(),
        }
    }
}

#[derive(Clone, Copy)]
struct YamlText<'a>(&'a str);

impl<'a> YamlText<'a> {
    /// Characters that require a YAML string value to be quoted.
    fn has_special_chars(self) -> bool {
        self.0.contains(':') || self.0.contains('#')
    }

    /// Check if a string starts with a YAML collection indicator (array or map).
    fn starts_as_collection(self) -> bool {
        self.0.starts_with('[') || self.0.starts_with('{')
    }

    fn is_coercible_word(self) -> bool {
        matches!(
            self.0.to_ascii_lowercase().as_str(),
            "true" | "false" | "null" | "yes" | "no" | "on" | "off" | "~"
        )
    }

    fn is_radix_number(self) -> bool {
        let Some((prefix, digits)) = self.0.as_bytes().split_first_chunk::<2>() else {
            return false;
        };
        let prefix_matches = match prefix {
            b"0x" | b"0X" => digits.iter().all(u8::is_ascii_hexdigit),
            b"0o" | b"0O" => digits.iter().all(|digit| matches!(digit, b'0'..=b'7')),
            _ => return false,
        };
        !digits.is_empty() && prefix_matches
    }

    fn is_special_float(self) -> bool {
        matches!(
            self.0
                .trim_start_matches(['+', '-'])
                .to_ascii_lowercase()
                .as_str(),
            ".inf" | ".nan"
        )
    }

    fn has_indicator_prefix(self) -> bool {
        self.0.chars().next().is_some_and(|c| {
            matches!(
                c,
                '#' | ':'
                    | '&'
                    | '*'
                    | '!'
                    | '|'
                    | '>'
                    | '\''
                    | '"'
                    | '%'
                    | '@'
                    | '`'
                    | '{'
                    | '}'
                    | '['
                    | ']'
                    | ','
            ) || (matches!(c, '-' | '?') && self.0.chars().nth(1).is_none_or(char::is_whitespace))
        })
    }

    fn has_yaml_line_break(self) -> bool {
        self.0
            .chars()
            .any(|c| c.is_control() || matches!(c, '\u{85}' | '\u{2028}' | '\u{2029}'))
    }

    /// Check whether a YAML string value needs quoting to avoid ambiguity.
    fn needs_quoting(self) -> bool {
        [
            self.has_special_chars(),
            self.starts_as_collection(),
            self.0.trim() != self.0,
            self.is_coercible_word(),
            self.is_radix_number(),
            self.is_special_float(),
            self.0.parse::<f64>().is_ok(),
            self.has_indicator_prefix(),
            self.0.contains('\\'),
            self.0.starts_with('\u{feff}'),
            self.has_yaml_line_break(),
            self.has_comment_indicator(),
        ]
        .into_iter()
        .any(|needs_quote| needs_quote)
    }

    fn has_comment_indicator(self) -> bool {
        self.0
            .chars()
            .zip(self.0.chars().skip(1))
            .any(|(previous, current)| {
                (previous.is_whitespace() || previous == '\u{feff}') && current == '#'
            })
    }

    /// Quote a string value using YAML double-quoted escape sequences.
    fn quoted(self) -> String {
        let mut escaped = String::new();
        for ch in self.0.chars() {
            match ch {
                '\\' => escaped.push_str("\\\\"),
                '"' => escaped.push_str("\\\""),
                '\0' => escaped.push_str("\\0"),
                '\u{feff}' => escaped.push_str("\\uFEFF"),
                '\n' => escaped.push_str("\\n"),
                '\r' => escaped.push_str("\\r"),
                '\t' => escaped.push_str("\\t"),
                '\u{85}' => escaped.push_str("\\N"),
                '\u{2028}' => escaped.push_str("\\L"),
                '\u{2029}' => escaped.push_str("\\P"),
                c if c.is_control() => escaped.push_str(&format!("\\u{:04x}", c as u32)),
                c => escaped.push(c),
            }
        }
        format!("\"{}\"", escaped)
    }

    /// Format a single YAML list item as `  - "value"`.
    fn as_list_item(self) -> String {
        let value = if self.needs_quoting() {
            self.quoted()
        } else {
            self.0.to_string()
        };
        format!("  - {value}")
    }

    /// Check whether a YAML key needs quoting (contains spaces, special chars, etc.).
    fn needs_key_quoting(self) -> bool {
        self.0
            .chars()
            .any(|c| !c.is_ascii_alphanumeric() && c != '_' && c != '-')
    }
}

/// Format a key for YAML output (quote if necessary)
pub fn format_yaml_key(key: &str) -> String {
    let yaml_key = YamlText(key);
    assert!(
        !key.chars().any(char::is_control),
        "frontmatter key must be single line"
    );
    if yaml_key.needs_key_quoting() {
        yaml_key.quoted()
    } else {
        key.to_string()
    }
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
                let yaml_text = YamlText(s);
                if yaml_text.needs_quoting() {
                    yaml_text.quoted()
                } else {
                    s.clone()
                }
            }
            FrontmatterValue::Number(n) => format_yaml_number(*n),
            FrontmatterValue::Bool(b) => if *b { "true" } else { "false" }.to_string(),
            FrontmatterValue::List(items) if items.is_empty() => "[]".to_string(),
            FrontmatterValue::List(items) => items
                .iter()
                .map(FrontmatterScalar::to_yaml_list_item)
                .collect::<Vec<_>>()
                .join("\n"),
            FrontmatterValue::Null => "null".to_string(),
        }
    }
}

/// Format a key-value pair as one or more YAML lines.
pub fn format_yaml_field(key: &str, value: &FrontmatterValue) -> Vec<String> {
    let yaml_key = format_yaml_key(key);
    let yaml_value = value.to_yaml_value();
    if yaml_value.starts_with("|\n") {
        // Block scalar: key and indicator on the same line, content follows
        vec![format!("{}: {}", yaml_key, yaml_value)]
    } else if matches!(value, FrontmatterValue::List(items) if !items.is_empty()) {
        vec![format!("{}:", yaml_key), yaml_value]
    } else {
        vec![format!("{}: {}", yaml_key, yaml_value)]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_string_yaml_value(input: &str, expected: &str) {
        let value = FrontmatterValue::String(input.to_string());
        assert_eq!(value.to_yaml_value(), expected);
    }

    fn assert_field_lines(key: &str, value: FrontmatterValue, expected: &[&str]) {
        let lines = format_yaml_field(key, &value);
        let expected_lines = expected
            .iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>();
        assert_eq!(lines, expected_lines);
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_cases() {
        for (input, expected) in [
            ("key: value", "\"key: value\""),
            ("has # comment", "\"has # comment\""),
            ("[array-like]", "\"[array-like]\""),
            ("{object-like}", "\"{object-like}\""),
            ("true", "\"true\""),
            ("false", "\"false\""),
            ("null", "\"null\""),
            ("42", "\"42\""),
            ("3.14", "\"3.14\""),
        ] {
            assert_string_yaml_value(input, expected);
        }
    }

    #[test]
    fn test_to_yaml_value_quotes_only_valid_radix_numbers() {
        for input in ["0x10", "0X10", "0o17", "0O17"] {
            assert_string_yaml_value(input, &format!("\"{input}\""));
        }
        for input in ["0x", "0X", "0o", "0O"] {
            assert_string_yaml_value(input, input);
        }
    }

    #[test]
    fn test_to_yaml_value_string_plain() {
        assert_string_yaml_value("Hello World", "Hello World");
    }

    #[test]
    fn test_to_yaml_value_number_integer() {
        let v = FrontmatterValue::Number(42.0);
        assert_eq!(v.to_yaml_value(), "42");
    }

    #[test]
    fn test_to_yaml_value_number_float() {
        let v = FrontmatterValue::Number(3.125);
        assert_eq!(v.to_yaml_value(), "3.125");
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
        let v = FrontmatterValue::List(vec![FrontmatterScalar::String("key: value".to_string())]);
        assert_eq!(v.to_yaml_value(), "  - \"key: value\"");
    }

    #[test]
    fn test_to_yaml_value_list_keeps_plain_string_unquoted() {
        let value = FrontmatterValue::List(vec![FrontmatterScalar::String("plain".to_string())]);
        assert_eq!(value.to_yaml_value(), "  - plain");
    }

    #[test]
    fn test_to_yaml_value_mixed_scalar_list() {
        let value = FrontmatterValue::List(vec![
            FrontmatterScalar::Bool(true),
            FrontmatterScalar::Number(15.0),
            FrontmatterScalar::Null,
            FrontmatterScalar::String("null".to_string()),
        ]);
        assert_eq!(
            value.to_yaml_value(),
            "  - true\n  - 15\n  - null\n  - \"null\""
        );
    }

    #[test]
    fn test_to_yaml_value_multiline_uses_escaped_quotes() {
        let v = FrontmatterValue::String("line 1\nline 2\nline 3".to_string());
        assert_eq!(v.to_yaml_value(), "\"line 1\\nline 2\\nline 3\"");
    }

    #[test]
    fn test_to_yaml_value_nul_round_trips_with_yaml_reader() {
        let input = "before\0after";
        let value = FrontmatterValue::String(input.to_string());
        let emitted = value.to_yaml_value();
        assert_eq!(emitted, "\"before\\0after\"");
        let parsed: String = serde_yaml::from_str(&emitted).unwrap();
        assert_eq!(parsed, input);
    }

    #[test]
    fn test_to_yaml_value_leading_bom_round_trips_with_yaml_reader() {
        let input = "\u{feff}value";
        let value = FrontmatterValue::String(input.to_string());
        let emitted = value.to_yaml_value();
        assert_eq!(emitted, "\"\\uFEFFvalue\"");
        let parsed: String = serde_yaml::from_str(&emitted).unwrap();
        assert_eq!(parsed, input);
    }

    #[test]
    fn test_to_yaml_value_control_characters_round_trip_with_yaml_reader() {
        let input = (1..=8)
            .chain(0x0b..=0x0c)
            .chain(0x0e..=0x1f)
            .map(char::from)
            .collect::<String>();
        let emitted = FrontmatterValue::String(input.clone()).to_yaml_value();
        let parsed: String = serde_yaml::from_str(&emitted).unwrap();
        assert_eq!(parsed, input);
    }

    #[test]
    fn test_format_yaml_key_simple() {
        for (input, expected) in [("Status", "Status"), ("is_a", "is_a")] {
            assert_eq!(format_yaml_key(input), expected);
        }
    }

    #[test]
    fn test_format_yaml_key_quotes_when_needed() {
        for (input, expected) in [
            ("Is A", "\"Is A\""),
            ("Created at", "\"Created at\""),
            ("key:value", "\"key:value\""),
            ("has#tag", "\"has#tag\""),
            ("key.name", "\"key.name\""),
        ] {
            assert_eq!(format_yaml_key(input), expected);
        }
    }

    #[test]
    fn test_format_yaml_field_multiline() {
        let v = FrontmatterValue::String("## Objective\n\n## Timeline".to_string());
        let lines = format_yaml_field("template", &v);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0], "template: \"## Objective\\n\\n## Timeline\"");
    }

    #[test]
    fn test_format_yaml_field_list_layouts() {
        assert_field_lines(
            "_list_properties_display",
            FrontmatterValue::List(vec![FrontmatterScalar::String("Belongs to".to_string())]),
            &["_list_properties_display:", "  - Belongs to"],
        );
        assert_field_lines("tags", FrontmatterValue::List(vec![]), &["tags: []"]);
        assert_field_lines(
            "tags",
            FrontmatterValue::List(vec![
                FrontmatterScalar::String("Alpha".to_string()),
                FrontmatterScalar::String("Beta".to_string()),
            ]),
            &["tags:", "  - Alpha\n  - Beta"],
        );
    }
}
