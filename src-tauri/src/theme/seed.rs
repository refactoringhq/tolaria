use std::fs;
use std::path::Path;

use super::defaults::*;

/// Write a vault theme file if it doesn't exist or is empty (corrupt).
fn write_if_missing(path: &Path, content: &str) -> Result<bool, String> {
    let needs_write = !path.exists() || fs::metadata(path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    }
    Ok(needs_write)
}

/// Filenames for built-in vault theme notes at vault root (flat structure).
const VAULT_THEME_FILES: [&str; 3] = ["default-theme.md", "dark-theme.md", "minimal-theme.md"];

/// Seed built-in vault theme notes at vault root (flat structure).
/// Per-file idempotent: writes each default file only when it doesn't exist
/// or is empty (corrupt). Never overwrites existing files that have content.
pub fn seed_vault_themes(vault_path: &str) {
    let vault = Path::new(vault_path);
    let default_content = default_vault_theme();
    let dark_content = dark_vault_theme();
    let minimal_content = minimal_vault_theme();
    let defaults: &[(&str, &str)] = &[
        (VAULT_THEME_FILES[0], &default_content),
        (VAULT_THEME_FILES[1], &dark_content),
        (VAULT_THEME_FILES[2], &minimal_content),
    ];
    let mut seeded = false;
    for (name, content) in defaults {
        let wrote = write_if_missing(&vault.join(name), content).unwrap_or(false);
        seeded = seeded || wrote;
    }
    if seeded {
        log::info!("Seeded vault root with built-in vault themes");
    }
}

/// Ensure vault theme files exist at vault root (flat structure).
/// Returns an error on read-only filesystem.
pub fn ensure_vault_themes(vault_path: &str) -> Result<(), String> {
    let vault = Path::new(vault_path);
    let default_content = default_vault_theme();
    let dark_content = dark_vault_theme();
    let minimal_content = minimal_vault_theme();
    let defaults: &[(&str, &str)] = &[
        (VAULT_THEME_FILES[0], &default_content),
        (VAULT_THEME_FILES[1], &dark_content),
        (VAULT_THEME_FILES[2], &minimal_content),
    ];
    for (name, content) in defaults {
        write_if_missing(&vault.join(name), content)
            .map_err(|e| format!("Failed to write {name}: {e}"))?;
    }
    Ok(())
}

/// Restore default themes for a vault: seeds vault root theme notes (flat
/// structure) and the theme.md type definition. Per-file idempotent — never
/// overwrites files that already have content. Returns an error on read-only
/// filesystems.
pub fn restore_default_themes(vault_path: &str) -> Result<String, String> {
    // Seed vault theme notes at root (flat structure)
    ensure_vault_themes(vault_path)?;

    // Seed theme.md type definition so the Theme type has an icon and label in the sidebar
    ensure_theme_type_definition(vault_path)?;

    Ok("Default themes restored".to_string())
}

/// Create `theme.md` at vault root if it doesn't exist (gives the Theme type a sidebar icon/color).
pub fn ensure_theme_type_definition(vault_path: &str) -> Result<(), String> {
    let vault = Path::new(vault_path);
    write_if_missing(&vault.join("theme.md"), THEME_TYPE_DEFINITION)?;
    Ok(())
}

/// Migrate legacy `theme/` directory vault notes to root (flat structure).
///
/// Moves `theme/default.md` → `default-theme.md`, etc. Only moves a file if the
/// target doesn't exist yet (preserves existing root files). Cleans up the empty
/// `theme/` directory afterwards. Idempotent and silent.
pub fn migrate_theme_dir_to_root(vault_path: &str) {
    let vault = Path::new(vault_path);
    let theme_dir = vault.join("theme");
    if !theme_dir.is_dir() {
        return;
    }

    let migrations: &[(&str, &str)] = &[
        ("default.md", "default-theme.md"),
        ("dark.md", "dark-theme.md"),
        ("minimal.md", "minimal-theme.md"),
    ];

    for (old_name, new_name) in migrations {
        let old_path = theme_dir.join(old_name);
        let new_path = vault.join(new_name);
        if old_path.exists() && !new_path.exists() {
            if let Ok(content) = fs::read_to_string(&old_path) {
                if !content.is_empty() {
                    let _ = fs::write(&new_path, &content);
                    log::info!("Migrated theme/{old_name} → {new_name}");
                }
            }
            let _ = fs::remove_file(&old_path);
        } else if old_path.exists() {
            // Target exists, just remove the old file
            let _ = fs::remove_file(&old_path);
        }
    }

    // Clean up empty theme/ directory
    if theme_dir.is_dir() {
        let is_empty = fs::read_dir(&theme_dir).map_or(true, |mut d| d.next().is_none());
        if is_empty {
            let _ = fs::remove_dir(&theme_dir);
            log::info!("Removed empty theme/ directory");
        }
    }
}

/// Remove the legacy `_themes/` directory if it only contains default JSON files.
/// Leaves the directory intact if it has any custom (non-default) files.
/// Idempotent and silent.
pub fn migrate_legacy_themes_dir(vault_path: &str) {
    let themes_dir = Path::new(vault_path).join("_themes");
    if !themes_dir.is_dir() {
        return;
    }

    let default_filenames: &[&str] = &["default.json", "dark.json", "minimal.json"];

    // Check if directory only has default files (or is empty)
    let has_custom = fs::read_dir(&themes_dir).is_ok_and(|entries| {
        entries.filter_map(|e| e.ok()).any(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            !default_filenames.contains(&name_str.as_ref())
        })
    });

    if has_custom {
        return;
    }

    // Remove default JSON files then the empty directory
    for name in default_filenames {
        let _ = fs::remove_file(themes_dir.join(name));
    }
    let _ = fs::remove_dir(&themes_dir);
    log::info!("Removed legacy _themes/ directory");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_seed_vault_themes_creates_files_at_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        assert!(vault.join("default-theme.md").exists());
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
        // Must NOT create a theme/ subdirectory
        assert!(!vault.join("theme").exists());
    }

    #[test]
    fn test_seed_vault_themes_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        seed_vault_themes(vp); // second call should be a no-op
        assert!(vault.join("default-theme.md").exists());
    }

    #[test]
    fn test_seed_vault_themes_writes_missing_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("default-theme.md"), &default_vault_theme()).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
    }

    #[test]
    fn test_seed_vault_themes_reseeds_empty_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("default-theme.md"), "").unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(content.contains("type: Theme"));
    }

    #[test]
    fn test_seed_vault_themes_preserves_existing_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let custom = "---\ntype: Theme\nbackground: \"#FF0000\"\n---\n# Custom\n";
        fs::write(vault.join("default-theme.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(
            content.contains("#FF0000"),
            "existing content must be preserved"
        );
    }

    #[test]
    fn test_ensure_vault_themes_creates_root_level_defaults() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        assert!(vault.join("default-theme.md").exists());
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
        // Must NOT create a theme/ subdirectory
        assert!(!vault.join("theme").exists());
    }

    #[test]
    fn test_ensure_vault_themes_reseeds_empty_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("default-theme.md"), "").unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(content.contains("type: Theme"));
    }

    #[test]
    fn test_ensure_vault_themes_preserves_custom_themes() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let custom = "---\ntype: Theme\nbackground: \"#123456\"\n---\n";
        fs::write(vault.join("default-theme.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(content.contains("#123456"));
    }

    #[test]
    fn test_restore_default_themes_creates_flat_structure() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let msg = restore_default_themes(vp).unwrap();
        assert_eq!(msg, "Default themes restored");
        // Must NOT create _themes/ directory (legacy)
        assert!(!vault.join("_themes").exists());
        // Vault theme notes at root (flat structure)
        assert!(vault.join("default-theme.md").exists());
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
        // Must NOT create a theme/ subdirectory
        assert!(!vault.join("theme").is_dir());
        // Type definition at root
        assert!(
            vault.join("theme.md").exists(),
            "restore must create theme.md"
        );
        let type_content = fs::read_to_string(vault.join("theme.md")).unwrap();
        assert!(type_content.contains("type: Type"));
        assert!(type_content.contains("icon: palette"));
    }

    #[test]
    fn test_ensure_theme_type_definition_creates_file() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_theme_type_definition(vp).unwrap();
        let path = vault.join("theme.md");
        assert!(path.exists());
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("type: Type"));
        assert!(content.contains("icon: palette"));
    }

    #[test]
    fn test_ensure_theme_type_definition_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let custom = "---\ntype: Type\nicon: swatches\ncolor: green\n---\n# Theme\n";
        fs::write(vault.join("theme.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_theme_type_definition(vp).unwrap();
        let content = fs::read_to_string(vault.join("theme.md")).unwrap();
        assert!(
            content.contains("swatches"),
            "existing content must be preserved"
        );
    }

    #[test]
    fn test_restore_default_themes_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        restore_default_themes(vp).unwrap();
        let custom = "---\nIs A: Theme\nbackground: \"#CUSTOM\"\n---\n";
        fs::write(vault.join("default-theme.md"), custom).unwrap();

        restore_default_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(
            content.contains("#CUSTOM"),
            "must not overwrite existing content"
        );
    }

    #[test]
    fn test_restore_default_themes_fills_partial_state() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("default-theme.md"), &default_vault_theme()).unwrap();
        let vp = vault.to_str().unwrap();

        restore_default_themes(vp).unwrap();
        // Must NOT create _themes/ directory
        assert!(!vault.join("_themes").exists());
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(content.contains("Light theme with warm"));
    }

    #[test]
    fn test_seeded_default_theme_contains_editor_properties() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();

        // Must contain all editor properties from theme.json
        assert!(
            content.contains("editor-font-family:"),
            "missing editor-font-family"
        );
        assert!(
            content.contains("headings-h1-font-size:"),
            "missing headings-h1-font-size"
        );
        assert!(
            content.contains("lists-bullet-size:"),
            "missing lists-bullet-size"
        );
        assert!(
            content.contains("checkboxes-size:"),
            "missing checkboxes-size"
        );
        assert!(
            content.contains("inline-styles-bold-font-weight:"),
            "missing inline-styles-bold"
        );
        assert!(
            content.contains("code-blocks-font-family:"),
            "missing code-blocks-font-family"
        );
        assert!(
            content.contains("blockquote-border-left-width:"),
            "missing blockquote"
        );
        assert!(
            content.contains("table-border-color:"),
            "missing table-border-color"
        );
        assert!(
            content.contains("horizontal-rule-thickness:"),
            "missing horizontal-rule"
        );
        assert!(content.contains("colors-text:"), "missing colors-text");
    }

    #[test]
    fn test_migrate_theme_dir_moves_files_to_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(theme_dir.join("default.md"), &default_vault_theme()).unwrap();
        fs::write(theme_dir.join("dark.md"), &dark_vault_theme()).unwrap();
        fs::write(theme_dir.join("minimal.md"), &minimal_vault_theme()).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_theme_dir_to_root(vp);

        assert!(vault.join("default-theme.md").exists());
        assert!(vault.join("dark-theme.md").exists());
        assert!(vault.join("minimal-theme.md").exists());
        // Old files removed
        assert!(!theme_dir.join("default.md").exists());
        // Empty directory cleaned up
        assert!(!theme_dir.exists());
    }

    #[test]
    fn test_migrate_theme_dir_preserves_existing_root_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        let custom = "---\ntype: Theme\nbackground: \"#CUSTOM\"\n---\n# Custom\n";
        fs::write(vault.join("default-theme.md"), custom).unwrap();
        fs::write(theme_dir.join("default.md"), &default_vault_theme()).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_theme_dir_to_root(vp);

        let content = fs::read_to_string(vault.join("default-theme.md")).unwrap();
        assert!(
            content.contains("#CUSTOM"),
            "must preserve existing root file"
        );
    }

    #[test]
    fn test_migrate_theme_dir_noop_when_no_theme_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_theme_dir_to_root(vp);
        assert!(!vault.join("theme").exists());
    }

    #[test]
    fn test_migrate_theme_dir_keeps_nonempty_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(theme_dir.join("default.md"), &default_vault_theme()).unwrap();
        fs::write(theme_dir.join("custom-theme.md"), "custom content").unwrap();
        let vp = vault.to_str().unwrap();

        migrate_theme_dir_to_root(vp);

        assert!(vault.join("default-theme.md").exists());
        assert!(theme_dir.join("custom-theme.md").exists());
        assert!(theme_dir.exists());
    }

    #[test]
    fn test_migrate_legacy_themes_dir_removes_defaults_only() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let themes_dir = vault.join("_themes");
        fs::create_dir_all(&themes_dir).unwrap();
        fs::write(themes_dir.join("default.json"), DEFAULT_THEME).unwrap();
        fs::write(themes_dir.join("dark.json"), DARK_THEME).unwrap();
        fs::write(themes_dir.join("minimal.json"), MINIMAL_THEME).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_legacy_themes_dir(vp);

        assert!(
            !themes_dir.exists(),
            "_themes/ must be removed when only defaults"
        );
    }

    #[test]
    fn test_migrate_legacy_themes_dir_keeps_custom_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let themes_dir = vault.join("_themes");
        fs::create_dir_all(&themes_dir).unwrap();
        fs::write(themes_dir.join("default.json"), DEFAULT_THEME).unwrap();
        fs::write(themes_dir.join("custom.json"), r#"{"name":"Custom"}"#).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_legacy_themes_dir(vp);

        assert!(
            themes_dir.exists(),
            "_themes/ must be kept when custom files present"
        );
        assert!(themes_dir.join("default.json").exists());
        assert!(themes_dir.join("custom.json").exists());
    }

    #[test]
    fn test_migrate_legacy_themes_dir_noop_when_absent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_legacy_themes_dir(vp);

        assert!(!vault.join("_themes").exists());
    }

    #[test]
    fn test_migrate_legacy_themes_dir_removes_empty() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let themes_dir = vault.join("_themes");
        fs::create_dir_all(&themes_dir).unwrap();
        let vp = vault.to_str().unwrap();

        migrate_legacy_themes_dir(vp);

        assert!(!themes_dir.exists(), "empty _themes/ must be removed");
    }
}
