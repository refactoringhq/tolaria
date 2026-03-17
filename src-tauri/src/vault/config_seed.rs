use std::fs;
use std::path::Path;

use super::getting_started::AGENTS_MD;

/// Content for `config.md` — gives the Config type a sidebar icon and label.
const CONFIG_TYPE_DEFINITION: &str = "\
---
Is A: Type
icon: gear-six
color: gray
order: 90
sidebar label: Config
---

# Config

Vault configuration files. These control how AI agents, tools, and other integrations interact with this vault.
";

/// Write a file if it doesn't exist or is empty (corrupt). Returns true if written.
fn write_if_missing(path: &Path, content: &str) -> Result<bool, String> {
    let needs_write = !path.exists() || fs::metadata(path).map_or(true, |m| m.len() == 0);
    if needs_write {
        fs::write(path, content).map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
    }
    Ok(needs_write)
}

/// Seed `AGENTS.md` at vault root if missing or empty (idempotent, per-file).
/// Also seeds `config.md` type definition for sidebar visibility.
pub fn seed_config_files(vault_path: &str) {
    let vault = Path::new(vault_path);

    let agents_path = vault.join("AGENTS.md");
    let needs_write =
        !agents_path.exists() || fs::metadata(&agents_path).map_or(true, |m| m.len() == 0);
    if needs_write {
        let _ = fs::write(&agents_path, AGENTS_MD);
        log::info!("Seeded AGENTS.md at vault root");
    }

    ensure_config_type_definition(vault_path);
}

/// Ensure `config.md` exists at vault root (gives Config type a sidebar icon/color).
fn ensure_config_type_definition(vault_path: &str) {
    let path = Path::new(vault_path).join("config.md");
    let needs_write = !path.exists() || fs::metadata(&path).map_or(true, |m| m.len() == 0);
    if needs_write {
        let _ = fs::write(&path, CONFIG_TYPE_DEFINITION);
    }
}

/// Migrate legacy `config/agents.md` → root `AGENTS.md` for existing vaults.
///
/// - If `config/agents.md` has real content and root `AGENTS.md` is missing/empty/stub:
///   move content to root, remove legacy file.
/// - If root `AGENTS.md` doesn't exist: write defaults.
/// - Cleans up empty `config/` directory after migration.
///
/// Always idempotent and silent.
pub fn migrate_agents_md(vault_path: &str) {
    let vault = Path::new(vault_path);
    let root_agents = vault.join("AGENTS.md");
    let config_agents = vault.join("config").join("agents.md");

    // If legacy config/agents.md exists with real content, migrate it to root
    if config_agents.exists() {
        let config_content = fs::read_to_string(&config_agents).unwrap_or_default();
        if !config_content.is_empty() {
            // Only migrate if root AGENTS.md is missing, empty, or is a stub
            let root_is_stub_or_missing = !root_agents.exists()
                || fs::read_to_string(&root_agents)
                    .map_or(true, |c| c.is_empty() || c.contains("See config/agents.md"));

            if root_is_stub_or_missing {
                let _ = fs::write(&root_agents, &config_content);
                log::info!("Migrated config/agents.md content to root AGENTS.md");
            }
            // Remove legacy file
            let _ = fs::remove_file(&config_agents);
            log::info!("Removed legacy config/agents.md");
        }
    }

    // Clean up empty config/ directory
    let config_dir = vault.join("config");
    if config_dir.is_dir() {
        let is_empty = fs::read_dir(&config_dir).map_or(true, |mut d| d.next().is_none());
        if is_empty {
            let _ = fs::remove_dir(&config_dir);
            log::info!("Removed empty config/ directory");
        }
    }

    // Ensure root AGENTS.md exists with content
    if !root_agents.exists() {
        let _ = fs::write(&root_agents, AGENTS_MD);
    }
}

/// Repair config files: ensure `AGENTS.md` at vault root and `config.md` type definition.
/// Migrates legacy `config/agents.md` to root if present.
/// Called by the "Repair Vault" command. Returns a status message.
pub fn repair_config_files(vault_path: &str) -> Result<String, String> {
    let vault = Path::new(vault_path);
    let root_agents = vault.join("AGENTS.md");
    let config_agents = vault.join("config").join("agents.md");

    // Step 1: Migrate legacy config/agents.md → root AGENTS.md
    if config_agents.exists() {
        let config_content = fs::read_to_string(&config_agents).unwrap_or_default();
        if !config_content.is_empty() {
            let root_is_stub_or_missing = !root_agents.exists()
                || fs::read_to_string(&root_agents)
                    .map_or(true, |c| c.is_empty() || c.contains("See config/agents.md"));

            if root_is_stub_or_missing {
                fs::write(&root_agents, &config_content)
                    .map_err(|e| format!("Failed to write AGENTS.md: {e}"))?;
            }
            fs::remove_file(&config_agents)
                .map_err(|e| format!("Failed to remove config/agents.md: {e}"))?;
        }
    }

    // Step 2: Clean up empty config/ directory
    let config_dir = vault.join("config");
    if config_dir.is_dir() {
        let is_empty = fs::read_dir(&config_dir).map_or(true, |mut d| d.next().is_none());
        if is_empty {
            let _ = fs::remove_dir(&config_dir);
        }
    }

    // Step 3: Seed AGENTS.md with defaults if still missing or empty
    write_if_missing(&root_agents, AGENTS_MD)?;

    // Step 4: Ensure config.md type definition at vault root
    write_if_missing(&vault.join("config.md"), CONFIG_TYPE_DEFINITION)?;

    Ok("Config files repaired".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_seed_config_files_creates_agents_at_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("AGENTS.md").exists());
        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(content.contains("Vault Instructions for AI Agents"));
        // Must NOT create config/ directory
        assert!(!vault.join("config").exists());
    }

    #[test]
    fn test_seed_config_files_creates_type_definition() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());

        assert!(vault.join("config.md").exists());
        let content = fs::read_to_string(vault.join("config.md")).unwrap();
        assert!(content.contains("Is A: Type"));
        assert!(content.contains("icon: gear-six"));
    }

    #[test]
    fn test_seed_config_files_is_idempotent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        seed_config_files(vault.to_str().unwrap());
        let custom = "# Custom Agent Config\nMy custom instructions\n";
        fs::write(vault.join("AGENTS.md"), custom).unwrap();

        seed_config_files(vault.to_str().unwrap());
        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(
            content.contains("Custom Agent Config"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_seed_config_files_reseeds_empty() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        fs::write(vault.join("AGENTS.md"), "").unwrap();

        seed_config_files(vault.to_str().unwrap());
        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(content.contains("Vault Instructions for AI Agents"));
    }

    #[test]
    fn test_migrate_agents_md_moves_config_to_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        let custom = "# My vault agent instructions\nCustom content\n";
        fs::write(config_dir.join("agents.md"), custom).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        let root_content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root_content.contains("My vault agent instructions"));
        assert!(!config_dir.join("agents.md").exists());
        assert!(!config_dir.exists());
    }

    #[test]
    fn test_migrate_agents_md_preserves_existing_root() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        let custom_root = "# My root agent config\nDo not overwrite\n";
        fs::write(vault.join("AGENTS.md"), custom_root).unwrap();
        fs::write(config_dir.join("agents.md"), "Legacy content").unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(content.contains("My root agent config"));
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_migrate_agents_md_replaces_stub_with_config_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        fs::write(
            vault.join("AGENTS.md"),
            "# Agent Instructions\nSee config/agents.md for vault instructions.\n",
        )
        .unwrap();
        let real_content = "# Real Agent Config\nImportant instructions\n";
        fs::write(config_dir.join("agents.md"), real_content).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(content.contains("Real Agent Config"));
    }

    #[test]
    fn test_migrate_agents_md_idempotent_when_no_legacy() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        assert!(vault.join("AGENTS.md").exists());
        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("Vault Instructions"));
    }

    #[test]
    fn test_migrate_agents_md_keeps_nonempty_config_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        fs::write(config_dir.join("agents.md"), "Agent content").unwrap();
        fs::write(config_dir.join("other.md"), "Other file").unwrap();

        migrate_agents_md(vault.to_str().unwrap());

        assert!(config_dir.exists());
        assert!(config_dir.join("other.md").exists());
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_repair_config_files_creates_all() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();

        let msg = repair_config_files(vault.to_str().unwrap()).unwrap();
        assert_eq!(msg, "Config files repaired");

        assert!(vault.join("AGENTS.md").exists());
        assert!(vault.join("config.md").exists());
        assert!(!vault.join("config").exists());

        let agents = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(agents.contains("Vault Instructions for AI Agents"));
    }

    #[test]
    fn test_repair_config_files_preserves_custom_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir_all(&vault).unwrap();
        let custom = "# My custom agent config\nDo not overwrite me\n";
        fs::write(vault.join("AGENTS.md"), custom).unwrap();

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(
            content.contains("My custom agent config"),
            "must preserve existing content"
        );
    }

    #[test]
    fn test_repair_config_files_migrates_legacy_config() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        let original = "# My vault agents instructions\nCustom content here\n";
        fs::write(config_dir.join("agents.md"), original).unwrap();

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let root = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(root.contains("My vault agents instructions"));
        assert!(!config_dir.join("agents.md").exists());
    }

    #[test]
    fn test_repair_config_files_replaces_stub_with_legacy() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path().join("vault");
        let config_dir = vault.join("config");
        fs::create_dir_all(&config_dir).unwrap();
        fs::write(
            vault.join("AGENTS.md"),
            "# Agent Instructions\nSee config/agents.md for vault instructions.\n",
        )
        .unwrap();
        let real = "# Real Instructions\nImportant stuff\n";
        fs::write(config_dir.join("agents.md"), real).unwrap();

        repair_config_files(vault.to_str().unwrap()).unwrap();

        let content = fs::read_to_string(vault.join("AGENTS.md")).unwrap();
        assert!(content.contains("Real Instructions"));
    }
}
