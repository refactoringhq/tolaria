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
    fs::create_dir_all(&theme_dir).map_err(|e| format!("Failed to create theme directory: {e}"))?;
    let defaults: &[(&str, &str)] = &[
        ("default.md", DEFAULT_VAULT_THEME),
        ("dark.md", DARK_VAULT_THEME),
        ("minimal.md", MINIMAL_VAULT_THEME),
    ];
    for (name, content) in defaults {
        let path = theme_dir.join(name);
        let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
        if needs_write {
            fs::write(&path, content).map_err(|e| format!("Failed to write theme/{name}: {e}"))?;
        }
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
        let path = themes_dir.join(name);
        let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
        if needs_write {
            fs::write(&path, content)
                .map_err(|e| format!("Failed to write _themes/{name}: {e}"))?;
        }
    }

    // Seed theme/ markdown notes (reuses ensure_vault_themes for consistency)
    ensure_vault_themes(vault_path)?;

    Ok("Default themes restored".to_string())
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
        fs::write(theme_dir.join("default.md"), DEFAULT_VAULT_THEME).unwrap();
        let vp = vault.to_str().unwrap();

        restore_default_themes(vp).unwrap();
        assert!(themes_dir.join("dark.json").exists());
        assert!(themes_dir.join("minimal.json").exists());
        assert!(theme_dir.join("dark.md").exists());
        assert!(theme_dir.join("minimal.md").exists());
        let content = fs::read_to_string(theme_dir.join("default.md")).unwrap();
        assert!(content.contains("Light theme with warm"));
    }
}
