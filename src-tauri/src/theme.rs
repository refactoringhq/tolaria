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

/// Create `dir` and write each `(filename, content)` pair if the directory doesn't exist yet.
fn seed_dir_with_files(dir: &Path, files: &[(&str, &str)], log_msg: &str) {
    if dir.is_dir() {
        return;
    }
    if fs::create_dir_all(dir).is_err() {
        return;
    }
    for (name, content) in files {
        let _ = fs::write(dir.join(name), content);
    }
    log::info!("{log_msg}");
}

/// Seed the `_themes/` directory with built-in themes if it doesn't exist yet.
/// Safe to call multiple times — only writes files that are missing.
pub fn seed_default_themes(vault_path: &str) {
    seed_dir_with_files(
        &Path::new(vault_path).join("_themes"),
        &[
            ("default.json", DEFAULT_THEME),
            ("dark.json", DARK_THEME),
            ("minimal.json", MINIMAL_THEME),
        ],
        "Seeded _themes/ with built-in themes",
    );
}

/// Seed the vault `theme/` directory with built-in vault-based theme notes.
/// Per-file idempotent: creates the directory if missing, writes each default
/// file only when it doesn't exist or is empty (corrupt). Never overwrites
/// existing files that have content.
pub fn seed_vault_themes(vault_path: &str) {
    let theme_dir = Path::new(vault_path).join("theme");
    if fs::create_dir_all(&theme_dir).is_err() {
        return;
    }
    let defaults: &[(&str, &str)] = &[
        ("default.md", DEFAULT_VAULT_THEME),
        ("dark.md", DARK_VAULT_THEME),
        ("minimal.md", MINIMAL_VAULT_THEME),
    ];
    let mut seeded = false;
    for (name, content) in defaults {
        let path = theme_dir.join(name);
        let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
        if needs_write {
            let _ = fs::write(&path, content);
            seeded = true;
        }
    }
    if seeded {
        log::info!("Seeded theme/ with built-in vault themes");
    }
}

/// Ensure vault theme files exist. Returns an error if the theme directory
/// cannot be created (e.g. read-only filesystem).
pub fn ensure_vault_themes(vault_path: &str) -> Result<(), String> {
    let theme_dir = Path::new(vault_path).join("theme");
    fs::create_dir_all(&theme_dir)
        .map_err(|e| format!("Failed to create theme directory: {e}"))?;
    let defaults: &[(&str, &str)] = &[
        ("default.md", DEFAULT_VAULT_THEME),
        ("dark.md", DARK_VAULT_THEME),
    ];
    for (name, content) in defaults {
        let path = theme_dir.join(name);
        let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
        if needs_write {
            fs::write(&path, content)
                .map_err(|e| format!("Failed to write theme/{name}: {e}"))?;
        }
    }
    Ok(())
}

/// Create a new vault theme note in `theme/` directory.
/// Returns the absolute path to the newly created theme note.
pub fn create_vault_theme(vault_path: &str, name: Option<&str>) -> Result<String, String> {
    let theme_dir = Path::new(vault_path).join("theme");
    fs::create_dir_all(&theme_dir).map_err(|e| format!("Failed to create theme directory: {e}"))?;

    let display_name = name.unwrap_or("Untitled Theme");
    let slug = slugify(display_name);
    let filename = format!("{}.md", find_available_stem(&theme_dir, &slug, "md"));
    let path = theme_dir.join(&filename);

    let content = vault_theme_note_content(display_name, &DEFAULT_VAULT_THEME_VARS);
    fs::write(&path, content).map_err(|e| format!("Failed to write theme note: {e}"))?;

    Ok(path.to_string_lossy().to_string())
}

/// Convert a display name to a URL-safe slug.
fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

/// Find an available filename stem (base, base-2, base-3, …) that doesn't conflict when `ext` is appended.
fn find_available_stem(dir: &Path, base: &str, ext: &str) -> String {
    if !dir.join(format!("{base}.{ext}")).exists() {
        return base.to_string();
    }
    for i in 2.. {
        let candidate = format!("{base}-{i}");
        if !dir.join(format!("{candidate}.{ext}")).exists() {
            return candidate;
        }
    }
    unreachable!()
}

/// Build a vault theme note markdown string from a name and CSS variable map.
fn vault_theme_note_content(name: &str, vars: &[(&str, &str)]) -> String {
    let mut fm = format!("---\nIs A: Theme\nDescription: {name} theme\n");
    for (key, value) in vars {
        // Values with '#' or spaces need quoting; others can be bare strings.
        if value.contains('#') || value.contains('\'') || value.contains(',') {
            fm.push_str(&format!("{key}: \"{value}\"\n"));
        } else {
            fm.push_str(&format!("{key}: {value}\n"));
        }
    }
    fm.push_str("---\n\n");
    fm.push_str(&format!(
        "# {name} Theme\n\nA custom {name} theme for Laputa.\n"
    ));
    fm
}

/// Create a new theme file by copying the active theme (or default).
/// Returns the ID of the new theme.
pub fn create_theme(vault_path: &str, source_id: Option<&str>) -> Result<String, String> {
    let themes_dir = Path::new(vault_path).join("_themes");
    fs::create_dir_all(&themes_dir)
        .map_err(|e| format!("Failed to create _themes directory: {e}"))?;

    let new_id = find_available_stem(&themes_dir, "untitled", "json");

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

/// CSS variable key-value pairs for the default light vault theme.
pub const DEFAULT_VAULT_THEME_VARS: [(&str, &str); 46] = [
    // shadcn/ui base
    ("background", "#FFFFFF"),
    ("foreground", "#37352F"),
    ("card", "#FFFFFF"),
    ("popover", "#FFFFFF"),
    ("primary", "#155DFF"),
    ("primary-foreground", "#FFFFFF"),
    ("secondary", "#EBEBEA"),
    ("secondary-foreground", "#37352F"),
    ("muted", "#F0F0EF"),
    ("muted-foreground", "#787774"),
    ("accent", "#EBEBEA"),
    ("accent-foreground", "#37352F"),
    ("destructive", "#E03E3E"),
    ("border", "#E9E9E7"),
    ("input", "#E9E9E7"),
    ("ring", "#155DFF"),
    ("sidebar", "#F7F6F3"),
    ("sidebar-foreground", "#37352F"),
    ("sidebar-border", "#E9E9E7"),
    ("sidebar-accent", "#EBEBEA"),
    // Text hierarchy
    ("text-primary", "#37352F"),
    ("text-secondary", "#787774"),
    ("text-muted", "#B4B4B4"),
    ("text-heading", "#37352F"),
    // Backgrounds
    ("bg-primary", "#FFFFFF"),
    ("bg-sidebar", "#F7F6F3"),
    ("bg-hover", "#EBEBEA"),
    ("bg-hover-subtle", "#F0F0EF"),
    ("bg-selected", "#E8F4FE"),
    ("border-primary", "#E9E9E7"),
    // Accent colours
    ("accent-blue", "#155DFF"),
    ("accent-green", "#00B38B"),
    ("accent-orange", "#D9730D"),
    ("accent-red", "#E03E3E"),
    ("accent-purple", "#A932FF"),
    ("accent-yellow", "#F0B100"),
    ("accent-blue-light", "#155DFF14"),
    ("accent-green-light", "#00B38B14"),
    ("accent-purple-light", "#A932FF14"),
    ("accent-red-light", "#E03E3E14"),
    ("accent-yellow-light", "#F0B10014"),
    // Typography
    (
        "font-family",
        "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    ),
    ("font-size-base", "14px"),
    // Editor
    ("editor-font-size", "16"),
    ("editor-line-height", "1.5"),
    ("editor-max-width", "720"),
];

/// Vault-based theme note for the built-in Default theme.
pub const DEFAULT_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: Light theme with warm, paper-like tones\n\
background: \"#FFFFFF\"\n\
foreground: \"#37352F\"\n\
card: \"#FFFFFF\"\n\
popover: \"#FFFFFF\"\n\
primary: \"#155DFF\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#EBEBEA\"\n\
secondary-foreground: \"#37352F\"\n\
muted: \"#F0F0EF\"\n\
muted-foreground: \"#787774\"\n\
accent: \"#EBEBEA\"\n\
accent-foreground: \"#37352F\"\n\
destructive: \"#E03E3E\"\n\
border: \"#E9E9E7\"\n\
input: \"#E9E9E7\"\n\
ring: \"#155DFF\"\n\
sidebar: \"#F7F6F3\"\n\
sidebar-foreground: \"#37352F\"\n\
sidebar-border: \"#E9E9E7\"\n\
sidebar-accent: \"#EBEBEA\"\n\
text-primary: \"#37352F\"\n\
text-secondary: \"#787774\"\n\
text-muted: \"#B4B4B4\"\n\
text-heading: \"#37352F\"\n\
bg-primary: \"#FFFFFF\"\n\
bg-sidebar: \"#F7F6F3\"\n\
bg-hover: \"#EBEBEA\"\n\
bg-hover-subtle: \"#F0F0EF\"\n\
bg-selected: \"#E8F4FE\"\n\
border-primary: \"#E9E9E7\"\n\
accent-blue: \"#155DFF\"\n\
accent-green: \"#00B38B\"\n\
accent-orange: \"#D9730D\"\n\
accent-red: \"#E03E3E\"\n\
accent-purple: \"#A932FF\"\n\
accent-yellow: \"#F0B100\"\n\
accent-blue-light: \"#155DFF14\"\n\
accent-green-light: \"#00B38B14\"\n\
accent-purple-light: \"#A932FF14\"\n\
accent-red-light: \"#E03E3E14\"\n\
accent-yellow-light: \"#F0B10014\"\n\
font-family: \"'Inter', -apple-system, BlinkMacSystemFont, sans-serif\"\n\
font-size-base: 14px\n\
editor-font-size: 16\n\
editor-line-height: 1.5\n\
editor-max-width: 720\n\
---\n\
\n\
# Default Theme\n\
\n\
The default light theme for Laputa. Clean and warm, inspired by Notion.\n";

/// Vault-based theme note for the built-in Dark theme.
pub const DARK_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: Dark variant with deep navy tones\n\
background: \"#0f0f1a\"\n\
foreground: \"#e0e0e0\"\n\
card: \"#16162a\"\n\
popover: \"#1e1e3a\"\n\
primary: \"#155DFF\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#2a2a4a\"\n\
secondary-foreground: \"#e0e0e0\"\n\
muted: \"#1e1e3a\"\n\
muted-foreground: \"#888888\"\n\
accent: \"#2a2a4a\"\n\
accent-foreground: \"#e0e0e0\"\n\
destructive: \"#f44336\"\n\
border: \"#2a2a4a\"\n\
input: \"#2a2a4a\"\n\
ring: \"#155DFF\"\n\
sidebar: \"#1a1a2e\"\n\
sidebar-foreground: \"#e0e0e0\"\n\
sidebar-border: \"#2a2a4a\"\n\
sidebar-accent: \"#2a2a4a\"\n\
text-primary: \"#e0e0e0\"\n\
text-secondary: \"#888888\"\n\
text-muted: \"#666666\"\n\
text-heading: \"#e0e0e0\"\n\
bg-primary: \"#0f0f1a\"\n\
bg-sidebar: \"#1a1a2e\"\n\
bg-hover: \"#2a2a4a\"\n\
bg-hover-subtle: \"#1e1e3a\"\n\
bg-selected: \"#155DFF22\"\n\
border-primary: \"#2a2a4a\"\n\
accent-blue: \"#155DFF\"\n\
accent-green: \"#00B38B\"\n\
accent-orange: \"#D9730D\"\n\
accent-red: \"#f44336\"\n\
accent-purple: \"#A932FF\"\n\
accent-yellow: \"#F0B100\"\n\
accent-blue-light: \"#155DFF33\"\n\
accent-green-light: \"#00B38B33\"\n\
accent-purple-light: \"#A932FF33\"\n\
accent-red-light: \"#f4433633\"\n\
accent-yellow-light: \"#F0B10033\"\n\
font-family: \"'Inter', -apple-system, BlinkMacSystemFont, sans-serif\"\n\
font-size-base: 14px\n\
editor-font-size: 16\n\
editor-line-height: 1.5\n\
editor-max-width: 720\n\
---\n\
\n\
# Dark Theme\n\
\n\
A dark theme with deep navy tones for comfortable night-time reading.\n";

/// Vault-based theme note for the built-in Minimal theme.
pub const MINIMAL_VAULT_THEME: &str = "---\n\
Is A: Theme\n\
Description: High contrast, minimal chrome\n\
background: \"#FAFAFA\"\n\
foreground: \"#111111\"\n\
card: \"#FFFFFF\"\n\
popover: \"#FFFFFF\"\n\
primary: \"#000000\"\n\
primary-foreground: \"#FFFFFF\"\n\
secondary: \"#F0F0F0\"\n\
secondary-foreground: \"#111111\"\n\
muted: \"#F5F5F5\"\n\
muted-foreground: \"#666666\"\n\
accent: \"#F0F0F0\"\n\
accent-foreground: \"#111111\"\n\
destructive: \"#CC0000\"\n\
border: \"#E0E0E0\"\n\
input: \"#E0E0E0\"\n\
ring: \"#000000\"\n\
sidebar: \"#F5F5F5\"\n\
sidebar-foreground: \"#111111\"\n\
sidebar-border: \"#E0E0E0\"\n\
sidebar-accent: \"#E8E8E8\"\n\
text-primary: \"#111111\"\n\
text-secondary: \"#666666\"\n\
text-muted: \"#999999\"\n\
text-heading: \"#111111\"\n\
bg-primary: \"#FAFAFA\"\n\
bg-sidebar: \"#F5F5F5\"\n\
bg-hover: \"#EBEBEB\"\n\
bg-hover-subtle: \"#F5F5F5\"\n\
bg-selected: \"#00000014\"\n\
border-primary: \"#E0E0E0\"\n\
accent-blue: \"#000000\"\n\
accent-green: \"#006600\"\n\
accent-orange: \"#996600\"\n\
accent-red: \"#CC0000\"\n\
accent-purple: \"#660099\"\n\
accent-yellow: \"#996600\"\n\
accent-blue-light: \"#00000014\"\n\
accent-green-light: \"#00660014\"\n\
accent-purple-light: \"#66009914\"\n\
accent-red-light: \"#CC000014\"\n\
accent-yellow-light: \"#99660014\"\n\
font-family: \"'SF Mono', 'Menlo', monospace\"\n\
font-size-base: 13px\n\
editor-font-size: 15\n\
editor-line-height: 1.6\n\
editor-max-width: 680\n\
---\n\
\n\
# Minimal Theme\n\
\n\
High contrast, minimal chrome. Monospace typography throughout.\n";

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
        set_active_theme(vp, Some("dark")).unwrap();
        let settings = get_vault_settings(vp).unwrap();
        assert_eq!(settings.theme.as_deref(), Some("dark"));

        // Clear theme
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

    #[test]
    fn test_seed_vault_themes_creates_theme_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        assert!(!vault.join("theme").exists());
        seed_vault_themes(vp);
        assert!(vault.join("theme").is_dir());
        assert!(vault.join("theme").join("default.md").exists());
        assert!(vault.join("theme").join("dark.md").exists());
        assert!(vault.join("theme").join("minimal.md").exists());
    }

    #[test]
    fn test_seed_vault_themes_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        seed_vault_themes(vp); // second call should be a no-op
        assert!(vault.join("theme").join("default.md").exists());
    }

    #[test]
    fn test_create_vault_theme_creates_md_file() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let path = create_vault_theme(vp, Some("My Theme")).unwrap();
        assert!(std::path::Path::new(&path).exists());
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("Is A: Theme"));
        assert!(content.contains("# My Theme"));
        assert!(content.contains("background:"));
    }

    #[test]
    fn test_create_vault_theme_default_name() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let path = create_vault_theme(vp, None).unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("# Untitled Theme"));
    }

    #[test]
    fn test_create_vault_theme_avoids_conflicts() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let p1 = create_vault_theme(vp, Some("Custom")).unwrap();
        let p2 = create_vault_theme(vp, Some("Custom")).unwrap();
        assert_ne!(p1, p2);
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("My Cool Theme"), "my-cool-theme");
        assert_eq!(slugify("default"), "default");
        assert_eq!(slugify("Dark Mode!"), "dark-mode");
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

    #[test]
    fn test_seed_vault_themes_writes_missing_files_in_existing_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        // Only default exists — dark and minimal should be seeded
        fs::write(theme_dir.join("default.md"), DEFAULT_VAULT_THEME).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        assert!(theme_dir.join("dark.md").exists());
        assert!(theme_dir.join("minimal.md").exists());
    }

    #[test]
    fn test_seed_vault_themes_reseeds_empty_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        // Create empty file — should be re-seeded
        fs::write(theme_dir.join("default.md"), "").unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("Is A: Theme"));
    }

    #[test]
    fn test_seed_vault_themes_preserves_existing_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        let custom = "---\nIs A: Theme\nbackground: \"#FF0000\"\n---\n# Custom\n";
        fs::write(theme_dir.join("default.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("#FF0000"), "existing content must be preserved");
    }

    #[test]
    fn test_ensure_vault_themes_creates_dir_and_defaults() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        assert!(vault.join("theme").is_dir());
        assert!(vault.join("theme").join("default.md").exists());
        assert!(vault.join("theme").join("dark.md").exists());
    }

    #[test]
    fn test_ensure_vault_themes_reseeds_empty_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(theme_dir.join("default.md"), "").unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("Is A: Theme"));
    }

    #[test]
    fn test_ensure_vault_themes_preserves_custom_themes() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        let custom = "---\nIs A: Theme\nbackground: \"#123456\"\n---\n";
        fs::write(theme_dir.join("default.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("#123456"));
    }
}
