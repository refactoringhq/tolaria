mod create;
pub mod defaults;
mod seed;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub use create::{create_theme, create_vault_theme};
pub use defaults::*;
pub use seed::{
    ensure_vault_themes, restore_default_themes, seed_default_themes, seed_vault_themes,
};

/// A theme file parsed from _themes/*.json in the vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeFile {
    /// Filename stem (e.g. "default" for _themes/default.json)
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub colors: HashMap<String, String>,
    #[serde(default)]
    pub typography: HashMap<String, String>,
    #[serde(default)]
    pub spacing: HashMap<String, String>,
}

/// Vault-level settings stored in .laputa/settings.json (git-tracked).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultSettings {
    #[serde(default)]
    pub theme: Option<String>,
}

/// List all theme files in _themes/ directory of the vault.
/// Seeds built-in themes if the directory is missing.
pub fn list_themes(vault_path: &str) -> Result<Vec<ThemeFile>, String> {
    let themes_dir = Path::new(vault_path).join("_themes");
    if !themes_dir.is_dir() {
        seed_default_themes(vault_path);
    }
    if !themes_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut themes = Vec::new();
    let entries =
        fs::read_dir(&themes_dir).map_err(|e| format!("Failed to read _themes directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        match parse_theme_file(&path) {
            Ok(theme) => themes.push(theme),
            Err(e) => log::warn!("Skipping theme file {}: {e}", path.display()),
        }
    }

    themes.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(themes)
}

/// Parse a single theme JSON file.
fn parse_theme_file(path: &Path) -> Result<ThemeFile, String> {
    let id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid theme filename".to_string())?;

    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {e}", path.display()))?;

    let mut theme: ThemeFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {e}", path.display()))?;

    theme.id = id;
    Ok(theme)
}

/// Read vault-level settings from .laputa/settings.json.
pub fn get_vault_settings(vault_path: &str) -> Result<VaultSettings, String> {
    let settings_path = Path::new(vault_path).join(".laputa").join("settings.json");
    if !settings_path.exists() {
        return Ok(VaultSettings::default());
    }
    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read vault settings: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault settings: {e}"))
}

/// Save vault-level settings to .laputa/settings.json.
pub fn save_vault_settings(vault_path: &str, settings: VaultSettings) -> Result<(), String> {
    let laputa_dir = Path::new(vault_path).join(".laputa");
    fs::create_dir_all(&laputa_dir)
        .map_err(|e| format!("Failed to create .laputa directory: {e}"))?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize vault settings: {e}"))?;
    fs::write(laputa_dir.join("settings.json"), json)
        .map_err(|e| format!("Failed to write vault settings: {e}"))
}

/// Set the active theme in vault settings. Pass `None` to clear.
pub fn set_active_theme(vault_path: &str, theme_id: Option<&str>) -> Result<(), String> {
    let mut settings = get_vault_settings(vault_path)?;
    settings.theme = theme_id.map(|s| s.to_string());
    save_vault_settings(vault_path, settings)
}

/// Read a single theme file by ID from the vault's _themes/ directory.
pub fn get_theme(vault_path: &str, theme_id: &str) -> Result<ThemeFile, String> {
    let path = Path::new(vault_path)
        .join("_themes")
        .join(format!("{theme_id}.json"));
    if !path.exists() {
        return Err(format!("Theme not found: {theme_id}"));
    }
    parse_theme_file(&path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_vault_with_themes(dir: &TempDir) -> String {
        let vault = dir.path().join("vault");
        let themes_dir = vault.join("_themes");
        fs::create_dir_all(&themes_dir).unwrap();
        fs::write(themes_dir.join("default.json"), DEFAULT_THEME).unwrap();
        fs::write(themes_dir.join("dark.json"), DARK_THEME).unwrap();
        vault.to_string_lossy().to_string()
    }

    #[test]
    fn test_list_themes_returns_sorted_list() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let themes = list_themes(&vault).unwrap();
        assert_eq!(themes.len(), 2);
        assert_eq!(themes[0].id, "dark");
        assert_eq!(themes[1].id, "default");
    }

    #[test]
    fn test_list_themes_seeds_defaults_when_no_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("empty-vault");
        fs::create_dir_all(&vault).unwrap();
        let themes = list_themes(vault.to_str().unwrap()).unwrap();
        assert_eq!(themes.len(), 3);
        let names: Vec<&str> = themes.iter().map(|t| t.name.as_str()).collect();
        assert!(names.contains(&"Default"));
        assert!(names.contains(&"Dark"));
        assert!(names.contains(&"Minimal"));
    }

    #[test]
    fn test_get_theme_by_id() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let theme = get_theme(&vault, "default").unwrap();
        assert_eq!(theme.name, "Default");
        assert!(!theme.colors.is_empty());
    }

    #[test]
    fn test_get_theme_not_found() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let result = get_theme(&vault, "nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_vault_settings_roundtrip() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let settings = get_vault_settings(vp).unwrap();
        assert!(settings.theme.is_none());

        set_active_theme(vp, Some("dark")).unwrap();
        let settings = get_vault_settings(vp).unwrap();
        assert_eq!(settings.theme.as_deref(), Some("dark"));

        set_active_theme(vp, None).unwrap();
        let settings = get_vault_settings(vp).unwrap();
        assert_eq!(settings.theme, None);
    }

    #[test]
    fn test_vault_settings_creates_laputa_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        assert!(!vault.join(".laputa").exists());
        save_vault_settings(
            vp,
            VaultSettings {
                theme: Some("light".into()),
            },
        )
        .unwrap();
        assert!(vault.join(".laputa").join("settings.json").exists());
    }

    #[test]
    fn test_parse_all_builtin_themes() {
        for (name, content) in [
            ("default", DEFAULT_THEME),
            ("dark", DARK_THEME),
            ("minimal", MINIMAL_THEME),
        ] {
            let theme: ThemeFile = serde_json::from_str(content)
                .unwrap_or_else(|e| panic!("Failed to parse {name} theme: {e}"));
            assert!(!theme.name.is_empty(), "{name} theme should have a name");
            assert!(!theme.colors.is_empty(), "{name} theme should have colors");
        }
    }

    #[test]
    fn test_list_themes_ignores_non_json_files() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let themes_dir = Path::new(&vault).join("_themes");
        fs::write(themes_dir.join("readme.txt"), "not a theme").unwrap();
        fs::write(themes_dir.join(".DS_Store"), "").unwrap();

        let themes = list_themes(&vault).unwrap();
        assert_eq!(themes.len(), 2);
    }

    #[test]
    fn test_list_themes_skips_malformed_json() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let themes_dir = Path::new(&vault).join("_themes");
        fs::write(themes_dir.join("broken.json"), "not valid json{{{").unwrap();

        let themes = list_themes(&vault).unwrap();
        assert_eq!(themes.len(), 2);
    }

    #[test]
    fn test_vault_theme_content_contains_all_vars() {
        let content = DEFAULT_VAULT_THEME;
        assert!(content.contains("background:"));
        assert!(content.contains("primary:"));
        assert!(content.contains("sidebar:"));
        assert!(content.contains("text-primary:"));
        assert!(content.contains("accent-blue:"));
        assert!(content.contains("editor-font-size:"));
    }
}
