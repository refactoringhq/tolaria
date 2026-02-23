use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub anthropic_key: Option<String>,
    pub openai_key: Option<String>,
    pub google_key: Option<String>,
    pub github_token: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|d| d.join("com.laputa.app").join("settings.json"))
        .ok_or_else(|| "Could not determine config directory".to_string())
}

fn get_settings_at(path: &PathBuf) -> Result<Settings, String> {
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))
}

fn save_settings_at(path: &PathBuf, settings: Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Trim whitespace and convert empty strings to None
    let cleaned = Settings {
        anthropic_key: settings.anthropic_key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()),
        openai_key: settings.openai_key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()),
        google_key: settings.google_key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()),
        github_token: settings.github_token.map(|k| k.trim().to_string()).filter(|k| !k.is_empty()),
    };

    let json = serde_json::to_string_pretty(&cleaned)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

pub fn get_settings() -> Result<Settings, String> {
    get_settings_at(&settings_path()?)
}

pub fn save_settings(settings: Settings) -> Result<(), String> {
    save_settings_at(&settings_path()?, settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: save settings to a temp file and reload them.
    fn save_and_reload(settings: Settings) -> Settings {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("settings.json");
        save_settings_at(&path, settings).unwrap();
        get_settings_at(&path).unwrap()
    }

    #[test]
    fn test_default_settings_all_none() {
        let s = Settings::default();
        assert_eq!(
            format!("{:?}", s),
            format!("{:?}", Settings { anthropic_key: None, openai_key: None, google_key: None, github_token: None })
        );
    }

    #[test]
    fn test_settings_json_roundtrip() {
        let settings = Settings {
            anthropic_key: Some("sk-ant-test123".to_string()),
            openai_key: None,
            google_key: Some("AIza-test".to_string()),
            github_token: Some("gho_xyz789".to_string()),
        };
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.anthropic_key, settings.anthropic_key);
        assert_eq!(parsed.google_key, settings.google_key);
        assert_eq!(parsed.github_token, settings.github_token);
    }

    #[test]
    fn test_get_settings_returns_default_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        let result = get_settings_at(&path).unwrap();
        assert!(result.anthropic_key.is_none());
    }

    #[test]
    fn test_save_and_load_preserves_values() {
        let loaded = save_and_reload(Settings {
            anthropic_key: Some("sk-ant-key".to_string()),
            openai_key: Some("sk-openai".to_string()),
            google_key: None,
            github_token: Some("gho_token123".to_string()),
        });
        assert_eq!(loaded.anthropic_key.as_deref(), Some("sk-ant-key"));
        assert_eq!(loaded.openai_key.as_deref(), Some("sk-openai"));
        assert_eq!(loaded.github_token.as_deref(), Some("gho_token123"));
    }

    #[test]
    fn test_save_trims_whitespace() {
        let loaded = save_and_reload(Settings {
            anthropic_key: Some("  sk-ant-test  ".to_string()),
            openai_key: None,
            google_key: None,
            github_token: Some("  gho_abc  ".to_string()),
        });
        assert_eq!(loaded.anthropic_key.as_deref(), Some("sk-ant-test"));
        assert_eq!(loaded.github_token.as_deref(), Some("gho_abc"));
    }

    #[test]
    fn test_save_filters_empty_and_whitespace_only() {
        let loaded = save_and_reload(Settings {
            anthropic_key: Some("".to_string()),
            openai_key: Some("   ".to_string()),
            google_key: None,
            github_token: None,
        });
        assert!(loaded.anthropic_key.is_none());
        assert!(loaded.openai_key.is_none());
    }

    #[test]
    fn test_save_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("settings.json");

        save_settings_at(&path, Settings { anthropic_key: Some("key".to_string()), ..Default::default() }).unwrap();
        assert!(path.exists());
        assert_eq!(get_settings_at(&path).unwrap().anthropic_key.as_deref(), Some("key"));
    }

    #[test]
    fn test_get_settings_malformed_json() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("bad.json");
        fs::write(&path, "not valid json{{{").unwrap();

        let err = get_settings_at(&path).unwrap_err();
        assert!(err.contains("Failed to parse settings"));
    }

    #[test]
    fn test_settings_path_returns_ok() {
        let result = settings_path();
        assert!(result.is_ok());
        assert!(result.unwrap().to_str().unwrap().contains("com.laputa.app"));
    }
}
