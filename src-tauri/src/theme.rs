use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

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

/// Set the active theme in vault settings.
pub fn set_active_theme(vault_path: &str, theme_id: &str) -> Result<(), String> {
    let mut settings = get_vault_settings(vault_path)?;
    settings.theme = Some(theme_id.to_string());
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

/// Seed the `_themes/` directory with built-in themes if it doesn't exist yet.
/// Safe to call multiple times — only writes files that are missing.
pub fn seed_default_themes(vault_path: &str) {
    let themes_dir = Path::new(vault_path).join("_themes");
    if themes_dir.is_dir() {
        return;
    }
    if fs::create_dir_all(&themes_dir).is_err() {
        return;
    }
    let _ = fs::write(themes_dir.join("default.json"), DEFAULT_THEME);
    let _ = fs::write(themes_dir.join("dark.json"), DARK_THEME);
    let _ = fs::write(themes_dir.join("minimal.json"), MINIMAL_THEME);
    log::info!("Seeded _themes/ with built-in themes");
}

/// Create a new theme file by copying the active theme (or default).
/// Returns the ID of the new theme.
pub fn create_theme(vault_path: &str, source_id: Option<&str>) -> Result<String, String> {
    let themes_dir = Path::new(vault_path).join("_themes");
    fs::create_dir_all(&themes_dir)
        .map_err(|e| format!("Failed to create _themes directory: {e}"))?;

    let new_id = find_available_id(&themes_dir, "untitled");

    let source = source_id.unwrap_or("default");
    let source_path = themes_dir.join(format!("{source}.json"));

    let content = if source_path.exists() {
        let mut theme: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(&source_path)
                .map_err(|e| format!("Failed to read source theme: {e}"))?,
        )
        .map_err(|e| format!("Failed to parse source theme: {e}"))?;

        if let Some(obj) = theme.as_object_mut() {
            obj.insert(
                "name".to_string(),
                serde_json::Value::String("Untitled Theme".to_string()),
            );
        }
        serde_json::to_string_pretty(&theme)
            .map_err(|e| format!("Failed to serialize new theme: {e}"))?
    } else {
        default_theme_json("Untitled Theme")
    };

    fs::write(themes_dir.join(format!("{new_id}.json")), content)
        .map_err(|e| format!("Failed to write new theme: {e}"))?;

    Ok(new_id)
}

/// Find a filename that doesn't conflict (untitled, untitled-2, untitled-3, ...).
fn find_available_id(dir: &Path, base: &str) -> String {
    if !dir.join(format!("{base}.json")).exists() {
        return base.to_string();
    }
    for i in 2.. {
        let candidate = format!("{base}-{i}");
        if !dir.join(format!("{candidate}.json")).exists() {
            return candidate;
        }
    }
    unreachable!()
}

/// Generate the default light theme JSON.
fn default_theme_json(name: &str) -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "name": name,
        "description": "Custom theme",
        "colors": {
            "background": "#FFFFFF",
            "foreground": "#37352F",
            "sidebar-background": "#F7F6F3",
            "accent": "#155DFF",
            "muted": "#787774",
            "border": "#E9E9E7"
        },
        "typography": {
            "font-family": "system-ui",
            "font-size-base": "14px"
        },
        "spacing": {
            "sidebar-width": "240px"
        }
    }))
    .unwrap()
}

/// Content for the built-in default (light) theme.
pub const DEFAULT_THEME: &str = r##"{
  "name": "Default",
  "description": "Light theme with warm, paper-like tones",
  "colors": {
    "background": "#FFFFFF",
    "foreground": "#37352F",
    "card": "#FFFFFF",
    "popover": "#FFFFFF",
    "primary": "#155DFF",
    "primary-foreground": "#FFFFFF",
    "secondary": "#EBEBEA",
    "secondary-foreground": "#37352F",
    "muted": "#F0F0EF",
    "muted-foreground": "#787774",
    "accent": "#EBEBEA",
    "accent-foreground": "#37352F",
    "destructive": "#E03E3E",
    "border": "#E9E9E7",
    "input": "#E9E9E7",
    "ring": "#155DFF",
    "sidebar-background": "#F7F6F3",
    "sidebar-foreground": "#37352F",
    "sidebar-border": "#E9E9E7",
    "sidebar-accent": "#EBEBEA"
  },
  "typography": {
    "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    "font-size-base": "14px"
  },
  "spacing": {
    "sidebar-width": "250px"
  }
}"##;

/// Content for the built-in dark theme.
pub const DARK_THEME: &str = r##"{
  "name": "Dark",
  "description": "Dark variant with deep navy tones",
  "colors": {
    "background": "#0f0f1a",
    "foreground": "#e0e0e0",
    "card": "#16162a",
    "popover": "#1e1e3a",
    "primary": "#155DFF",
    "primary-foreground": "#FFFFFF",
    "secondary": "#2a2a4a",
    "secondary-foreground": "#e0e0e0",
    "muted": "#1e1e3a",
    "muted-foreground": "#888888",
    "accent": "#2a2a4a",
    "accent-foreground": "#e0e0e0",
    "destructive": "#f44336",
    "border": "#2a2a4a",
    "input": "#2a2a4a",
    "ring": "#155DFF",
    "sidebar-background": "#1a1a2e",
    "sidebar-foreground": "#e0e0e0",
    "sidebar-border": "#2a2a4a",
    "sidebar-accent": "#2a2a4a"
  },
  "typography": {
    "font-family": "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    "font-size-base": "14px"
  },
  "spacing": {
    "sidebar-width": "250px"
  }
}"##;

/// Content for the built-in minimal theme.
pub const MINIMAL_THEME: &str = r##"{
  "name": "Minimal",
  "description": "High contrast, minimal chrome",
  "colors": {
    "background": "#FAFAFA",
    "foreground": "#111111",
    "card": "#FFFFFF",
    "popover": "#FFFFFF",
    "primary": "#000000",
    "primary-foreground": "#FFFFFF",
    "secondary": "#F0F0F0",
    "secondary-foreground": "#111111",
    "muted": "#F5F5F5",
    "muted-foreground": "#666666",
    "accent": "#F0F0F0",
    "accent-foreground": "#111111",
    "destructive": "#CC0000",
    "border": "#E0E0E0",
    "input": "#E0E0E0",
    "ring": "#000000",
    "sidebar-background": "#F5F5F5",
    "sidebar-foreground": "#111111",
    "sidebar-border": "#E0E0E0",
    "sidebar-accent": "#E8E8E8"
  },
  "typography": {
    "font-family": "'SF Mono', 'Menlo', monospace",
    "font-size-base": "13px"
  },
  "spacing": {
    "sidebar-width": "220px"
  }
}"##;

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

        // Default settings have no theme
        let settings = get_vault_settings(vp).unwrap();
        assert!(settings.theme.is_none());

        // Set and read back
        set_active_theme(vp, "dark").unwrap();
        let settings = get_vault_settings(vp).unwrap();
        assert_eq!(settings.theme.as_deref(), Some("dark"));
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
    fn test_create_theme_copies_source() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let new_id = create_theme(&vault, Some("default")).unwrap();
        assert_eq!(new_id, "untitled");

        let theme = get_theme(&vault, &new_id).unwrap();
        assert_eq!(theme.name, "Untitled Theme");
        assert!(!theme.colors.is_empty());
    }

    #[test]
    fn test_create_theme_increments_id() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);

        let id1 = create_theme(&vault, None).unwrap();
        assert_eq!(id1, "untitled");

        let id2 = create_theme(&vault, None).unwrap();
        assert_eq!(id2, "untitled-2");
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
        assert_eq!(themes.len(), 2); // only default and dark
    }

    #[test]
    fn test_list_themes_skips_malformed_json() {
        let dir = TempDir::new().unwrap();
        let vault = setup_vault_with_themes(&dir);
        let themes_dir = Path::new(&vault).join("_themes");
        fs::write(themes_dir.join("broken.json"), "not valid json{{{").unwrap();

        let themes = list_themes(&vault).unwrap();
        assert_eq!(themes.len(), 2); // broken.json is skipped
    }
}
