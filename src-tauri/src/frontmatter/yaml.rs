use serde::{Deserialize, Serialize};

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

/// Format a key-value pair as one or more YAML lines.
pub fn format_yaml_field(key: &str, value: &FrontmatterValue) -> Vec<String> {
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

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn test_to_yaml_value_multiline_uses_block_scalar() {
        let v = FrontmatterValue::String("line 1\nline 2\nline 3".to_string());
        let yaml = v.to_yaml_value();
        assert!(yaml.starts_with("|\n"));
        assert!(yaml.contains("  line 1"));
        assert!(yaml.contains("  line 2"));
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

    #[test]
    fn test_format_yaml_field_block_scalar() {
        let v = FrontmatterValue::String("## Objective\n\n## Timeline".to_string());
        let lines = format_yaml_field("template", &v);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].starts_with("template: |\n"));
        assert!(lines[0].contains("  ## Objective"));
        assert!(lines[0].contains("  ## Timeline"));
    }
}
