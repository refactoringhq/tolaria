use std::fs;
use std::path::Path;

use super::defaults::*;

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

/// Write a vault theme file if it doesn't exist or is empty (corrupt).
fn write_if_missing(path: &Path, content: &str) -> Result<bool, String> {
    let needs_write = !path.exists() || fs::metadata(path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    }
    Ok(needs_write)
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
    let default_content = default_vault_theme();
    let dark_content = dark_vault_theme();
    let minimal_content = minimal_vault_theme();
    let defaults: &[(&str, &str)] = &[
        ("default.md", &default_content),
        ("dark.md", &dark_content),
        ("minimal.md", &minimal_content),
    ];
    let mut seeded = false;
    for (name, content) in defaults {
        let wrote = write_if_missing(&theme_dir.join(name), content).unwrap_or(false);
        seeded = seeded || wrote;
    }
    if seeded {
        log::info!("Seeded theme/ with built-in vault themes");
    }
}

/// Ensure vault theme files exist. Returns an error if the theme directory
/// cannot be created (e.g. read-only filesystem).
pub fn ensure_vault_themes(vault_path: &str) -> Result<(), String> {
    let theme_dir = Path::new(vault_path).join("theme");
    fs::create_dir_all(&theme_dir).map_err(|e| format!("Failed to create theme directory: {e}"))?;
    let default_content = default_vault_theme();
    let dark_content = dark_vault_theme();
    let minimal_content = minimal_vault_theme();
    let defaults: &[(&str, &str)] = &[
        ("default.md", &default_content),
        ("dark.md", &dark_content),
        ("minimal.md", &minimal_content),
    ];
    for (name, content) in defaults {
        write_if_missing(&theme_dir.join(name), content)
            .map_err(|e| format!("Failed to write theme/{name}: {e}"))?;
    }
    Ok(())
}

/// Restore default themes for a vault: seeds both `_themes/` (JSON) and
/// `theme/` (markdown notes). Per-file idempotent — never overwrites files
/// that already have content. Returns an error on read-only filesystems.
pub fn restore_default_themes(vault_path: &str) -> Result<String, String> {
    // Seed _themes/ JSON files (per-file idempotent)
    let themes_dir = Path::new(vault_path).join("_themes");
    fs::create_dir_all(&themes_dir)
        .map_err(|e| format!("Failed to create _themes directory: {e}"))?;
    let json_defaults: &[(&str, &str)] = &[
        ("default.json", DEFAULT_THEME),
        ("dark.json", DARK_THEME),
        ("minimal.json", MINIMAL_THEME),
    ];
    for (name, content) in json_defaults {
        write_if_missing(&themes_dir.join(name), content)?;
    }

    // Seed theme/ markdown notes (reuses ensure_vault_themes for consistency)
    ensure_vault_themes(vault_path)?;

    // Seed type/theme.md so the Theme type has an icon and label in the sidebar
    ensure_theme_type_definition(vault_path)?;

    Ok("Default themes restored".to_string())
}

/// Create `type/theme.md` if it doesn't exist (gives the Theme type a sidebar icon/color).
pub fn ensure_theme_type_definition(vault_path: &str) -> Result<(), String> {
    let type_dir = Path::new(vault_path).join("type");
    fs::create_dir_all(&type_dir).map_err(|e| format!("Failed to create type directory: {e}"))?;
    write_if_missing(&type_dir.join("theme.md"), THEME_TYPE_DEFINITION)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

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
    fn test_seed_vault_themes_writes_missing_files_in_existing_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(theme_dir.join("default.md"), &default_vault_theme()).unwrap();
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
        fs::write(theme_dir.join("default.md"), "").unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("type: Theme"));
    }

    #[test]
    fn test_seed_vault_themes_preserves_existing_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        let custom = "---\ntype: Theme\nbackground: \"#FF0000\"\n---\n# Custom\n";
        fs::write(theme_dir.join("default.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        seed_vault_themes(vp);
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(
            content.contains("#FF0000"),
            "existing content must be preserved"
        );
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
        assert!(vault.join("theme").join("minimal.md").exists());
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
        assert!(content.contains("type: Theme"));
    }

    #[test]
    fn test_ensure_vault_themes_preserves_custom_themes() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&theme_dir).unwrap();
        let custom = "---\ntype: Theme\nbackground: \"#123456\"\n---\n";
        fs::write(theme_dir.join("default.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("#123456"));
    }

    #[test]
    fn test_restore_default_themes_creates_both_dirs() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        let msg = restore_default_themes(vp).unwrap();
        assert_eq!(msg, "Default themes restored");
        assert!(vault.join("_themes").join("default.json").exists());
        assert!(vault.join("_themes").join("dark.json").exists());
        assert!(vault.join("_themes").join("minimal.json").exists());
        assert!(vault.join("theme").join("default.md").exists());
        assert!(vault.join("theme").join("dark.md").exists());
        assert!(vault.join("theme").join("minimal.md").exists());
        assert!(
            vault.join("type").join("theme.md").exists(),
            "restore must create type/theme.md"
        );
        let type_content = fs::read_to_string(vault.join("type").join("theme.md")).unwrap();
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
        let path = vault.join("type").join("theme.md");
        assert!(path.exists());
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("type: Type"));
        assert!(content.contains("icon: palette"));
    }

    #[test]
    fn test_ensure_theme_type_definition_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let type_dir = vault.join("type");
        fs::create_dir_all(&type_dir).unwrap();
        let custom = "---\ntype: Type\nicon: swatches\ncolor: green\n---\n# Theme\n";
        fs::write(type_dir.join("theme.md"), custom).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_theme_type_definition(vp).unwrap();
        let content = fs::read_to_string(type_dir.join("theme.md")).unwrap();
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
        fs::write(vault.join("theme").join("default.md"), custom).unwrap();

        restore_default_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("theme").join("default.md")).unwrap();
        assert!(
            content.contains("#CUSTOM"),
            "must not overwrite existing content"
        );
    }

    #[test]
    fn test_restore_default_themes_fills_partial_state() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let themes_dir = vault.join("_themes");
        let theme_dir = vault.join("theme");
        fs::create_dir_all(&themes_dir).unwrap();
        fs::create_dir_all(&theme_dir).unwrap();
        fs::write(themes_dir.join("default.json"), DEFAULT_THEME).unwrap();
        fs::write(theme_dir.join("default.md"), &default_vault_theme()).unwrap();
        let vp = vault.to_str().unwrap();

        restore_default_themes(vp).unwrap();
        assert!(themes_dir.join("dark.json").exists());
        assert!(themes_dir.join("minimal.json").exists());
        assert!(theme_dir.join("dark.md").exists());
        assert!(theme_dir.join("minimal.md").exists());
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("Light theme with warm"));
    }

    #[test]
    fn test_seeded_default_theme_contains_editor_properties() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let vp = vault.to_str().unwrap();

        ensure_vault_themes(vp).unwrap();
        let content = fs::read_to_string(vault.join("theme").join("default.md")).unwrap();

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
}
