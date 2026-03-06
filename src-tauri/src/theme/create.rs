use std::fs;
use std::path::Path;

use super::defaults::DEFAULT_VAULT_THEME_VARS;

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

/// Find an available filename stem (base, base-2, base-3, …) that doesn't
/// conflict when `ext` is appended.
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::defaults::*;
    use crate::theme::get_theme;
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
}
