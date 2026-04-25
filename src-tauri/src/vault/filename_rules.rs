const WINDOWS_RESERVED_DEVICE_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

pub(crate) fn validate_filename_stem(stem: &str) -> Result<(), String> {
    validate_portable_name_segment(stem, "Invalid filename")
}

pub(crate) fn validate_folder_name(name: &str) -> Result<(), String> {
    validate_portable_name_segment(name, "Invalid folder name")
}

pub(crate) fn validate_view_filename_stem(stem: &str) -> Result<(), String> {
    validate_portable_name_segment(stem, "Invalid view filename")
}

fn validate_portable_name_segment(value: &str, message: &str) -> Result<(), String> {
    if is_invalid_portable_name_segment(value) {
        return Err(message.to_string());
    }

    Ok(())
}

fn is_invalid_portable_name_segment(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || matches!(trimmed, "." | "..") {
        return true;
    }

    if trimmed.ends_with('.') || trimmed.ends_with(' ') {
        return true;
    }

    if trimmed.chars().any(is_invalid_portable_name_char) {
        return true;
    }

    is_windows_reserved_device_name(trimmed)
}

fn is_invalid_portable_name_char(ch: char) -> bool {
    ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
}

fn is_windows_reserved_device_name(value: &str) -> bool {
    let candidate = value
        .split('.')
        .next()
        .unwrap_or(value)
        .to_ascii_uppercase();
    WINDOWS_RESERVED_DEVICE_NAMES
        .iter()
        .any(|reserved| candidate == *reserved)
}

#[cfg(test)]
mod tests {
    use super::{validate_filename_stem, validate_folder_name, validate_view_filename_stem};

    #[test]
    fn accepts_portable_names() {
        assert_eq!(validate_filename_stem("meeting-notes"), Ok(()));
        assert_eq!(validate_filename_stem("draft.v2"), Ok(()));
        assert_eq!(validate_folder_name("Projects"), Ok(()));
        assert_eq!(validate_view_filename_stem("active-projects"), Ok(()));
    }

    #[test]
    fn rejects_reserved_windows_device_names() {
        assert_eq!(
            validate_filename_stem("con"),
            Err("Invalid filename".to_string())
        );
        assert_eq!(
            validate_folder_name("Lpt1"),
            Err("Invalid folder name".to_string())
        );
        assert_eq!(
            validate_view_filename_stem("aux"),
            Err("Invalid view filename".to_string())
        );
    }

    #[test]
    fn rejects_windows_invalid_characters_and_suffixes() {
        assert_eq!(
            validate_filename_stem("quarterly:plan"),
            Err("Invalid filename".to_string())
        );
        assert_eq!(
            validate_folder_name("Research?"),
            Err("Invalid folder name".to_string())
        );
        assert_eq!(
            validate_view_filename_stem("overview. "),
            Err("Invalid view filename".to_string())
        );
    }
}
