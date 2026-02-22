use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct VaultConfig {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppSettings {
    #[serde(default)]
    pub vaults: Vec<VaultConfig>,
}

/// Return the settings file path: <app_config_dir>/settings.json
fn settings_path() -> Result<PathBuf, String> {
    // Use a consistent config directory: ~/.config/com.tauri.dev/ (matches app identifier)
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Cannot determine config directory".to_string())?;
    let app_dir = config_dir.join("com.tauri.dev");
    Ok(app_dir.join("settings.json"))
}

pub fn load_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse settings: {}", e))
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let data = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&path, data)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

pub fn get_vaults() -> Result<Vec<VaultConfig>, String> {
    let settings = load_settings()?;
    Ok(settings.vaults)
}

pub fn add_vault(path: &str) -> Result<VaultConfig, String> {
    let abs_path = Path::new(path);

    if !abs_path.exists() {
        return Err(format!("Folder does not exist: {}", path));
    }
    if !abs_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let canonical = abs_path.canonicalize()
        .map_err(|e| format!("Failed to resolve path: {}", e))?;
    let canonical_str = canonical.to_str()
        .ok_or_else(|| "Invalid UTF-8 in path".to_string())?
        .to_string();

    // Derive label from folder name
    let label = canonical.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Vault")
        .to_string();

    let mut settings = load_settings()?;

    // Deduplicate: skip if path already exists
    if settings.vaults.iter().any(|v| v.path == canonical_str) {
        // Return the existing vault config
        return Ok(settings.vaults.iter().find(|v| v.path == canonical_str).unwrap().clone());
    }

    let vault = VaultConfig {
        label,
        path: canonical_str,
    };
    settings.vaults.push(vault.clone());
    save_settings(&settings)?;

    Ok(vault)
}

pub fn remove_vault(path: &str) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.vaults.retain(|v| v.path != path);
    save_settings(&settings)
}

pub fn init_vault(path: &str) -> Result<(), String> {
    let dir = Path::new(path);

    if !dir.exists() {
        // Create the directory for new vaults
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    if !dir.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Check if already a git repo
    let git_dir = dir.join(".git");
    if git_dir.exists() {
        return Ok(()); // Already initialized
    }

    // Run git init
    let output = Command::new("git")
        .args(["init"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Failed to run git init: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git init failed: {}", stderr));
    }

    // Create .gitkeep if directory is empty (no files besides .git)
    let has_files = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .any(|entry| {
            entry
                .ok()
                .and_then(|e| e.file_name().into_string().ok())
                .map(|name| name != ".git")
                .unwrap_or(false)
        });

    if !has_files {
        fs::write(dir.join(".gitkeep"), "")
            .map_err(|e| format!("Failed to create .gitkeep: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_default_settings() {
        let settings = AppSettings::default();
        assert!(settings.vaults.is_empty());
    }

    #[test]
    fn test_settings_roundtrip() {
        let dir = TempDir::new().unwrap();
        let settings_file = dir.path().join("settings.json");

        let settings = AppSettings {
            vaults: vec![
                VaultConfig {
                    label: "Test".to_string(),
                    path: "/tmp/test-vault".to_string(),
                },
            ],
        };

        let data = serde_json::to_string_pretty(&settings).unwrap();
        fs::write(&settings_file, &data).unwrap();

        let loaded: AppSettings = serde_json::from_str(&fs::read_to_string(&settings_file).unwrap()).unwrap();
        assert_eq!(loaded.vaults.len(), 1);
        assert_eq!(loaded.vaults[0].label, "Test");
        assert_eq!(loaded.vaults[0].path, "/tmp/test-vault");
    }

    #[test]
    fn test_init_vault_new_directory() {
        let dir = TempDir::new().unwrap();
        let vault_path = dir.path().join("new-vault");

        init_vault(vault_path.to_str().unwrap()).unwrap();

        assert!(vault_path.join(".git").exists());
        assert!(vault_path.join(".gitkeep").exists());
    }

    #[test]
    fn test_init_vault_existing_git_repo() {
        let dir = TempDir::new().unwrap();
        let vault_path = dir.path();

        // Initialize git repo first
        Command::new("git")
            .args(["init"])
            .current_dir(vault_path)
            .output()
            .unwrap();

        // Create a file so it's not empty
        fs::write(vault_path.join("test.md"), "# Test").unwrap();

        // init_vault should succeed without error (skip git init)
        init_vault(vault_path.to_str().unwrap()).unwrap();

        // .gitkeep should NOT be created since there are files
        assert!(!vault_path.join(".gitkeep").exists());
    }

    #[test]
    fn test_init_vault_existing_directory_with_files() {
        let dir = TempDir::new().unwrap();
        let vault_path = dir.path();

        fs::write(vault_path.join("notes.md"), "# Notes").unwrap();

        init_vault(vault_path.to_str().unwrap()).unwrap();

        assert!(vault_path.join(".git").exists());
        // .gitkeep should not be created since directory has files
        assert!(!vault_path.join(".gitkeep").exists());
    }

    #[test]
    fn test_add_vault_nonexistent_path() {
        let result = add_vault("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_vault_config_serialization() {
        let vault = VaultConfig {
            label: "My Vault".to_string(),
            path: "/home/user/vault".to_string(),
        };
        let json = serde_json::to_string(&vault).unwrap();
        assert!(json.contains("My Vault"));
        assert!(json.contains("/home/user/vault"));

        let deserialized: VaultConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.label, "My Vault");
        assert_eq!(deserialized.path, "/home/user/vault");
    }
}
