use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VaultEntry {
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultList {
    pub vaults: Vec<VaultEntry>,
    pub active_vault: Option<String>,
    #[serde(default)]
    pub hidden_defaults: Vec<String>,
}

fn vault_list_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|d| d.join("com.laputa.app").join("vaults.json"))
        .ok_or_else(|| "Could not determine config directory".to_string())
}

fn load_at(path: &PathBuf) -> Result<VaultList, String> {
    if !path.exists() {
        return Ok(VaultList::default());
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read vault list: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse vault list: {}", e))
}

fn save_at(path: &PathBuf, list: &VaultList) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let json = serde_json::to_string_pretty(list)
        .map_err(|e| format!("Failed to serialize vault list: {}", e))?;
    fs::write(path, json).map_err(|e| format!("Failed to write vault list: {}", e))
}

pub fn load_vault_list() -> Result<VaultList, String> {
    load_at(&vault_list_path()?)
}

pub fn save_vault_list(list: &VaultList) -> Result<(), String> {
    save_at(&vault_list_path()?, list)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn save_and_reload(list: &VaultList) -> VaultList {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("vaults.json");
        save_at(&path, list).unwrap();
        load_at(&path).unwrap()
    }

    #[test]
    fn default_vault_list_is_empty() {
        let vl = VaultList::default();
        assert!(vl.vaults.is_empty());
        assert!(vl.active_vault.is_none());
    }

    #[test]
    fn roundtrip_preserves_data() {
        let list = VaultList {
            vaults: vec![
                VaultEntry {
                    label: "My Vault".to_string(),
                    path: "/Users/luca/Laputa".to_string(),
                },
                VaultEntry {
                    label: "Work".to_string(),
                    path: "/Users/luca/Work".to_string(),
                },
            ],
            active_vault: Some("/Users/luca/Laputa".to_string()),
            hidden_defaults: vec![],
        };
        let loaded = save_and_reload(&list);
        assert_eq!(loaded.vaults.len(), 2);
        assert_eq!(loaded.vaults[0].label, "My Vault");
        assert_eq!(loaded.vaults[0].path, "/Users/luca/Laputa");
        assert_eq!(loaded.vaults[1].label, "Work");
        assert_eq!(loaded.active_vault.as_deref(), Some("/Users/luca/Laputa"));
    }

    #[test]
    fn load_returns_default_for_missing_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        let result = load_at(&path).unwrap();
        assert!(result.vaults.is_empty());
        assert!(result.active_vault.is_none());
    }

    #[test]
    fn load_returns_error_for_malformed_json() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("bad.json");
        fs::write(&path, "not valid json{{{").unwrap();
        let err = load_at(&path).unwrap_err();
        assert!(err.contains("Failed to parse vault list"));
    }

    #[test]
    fn save_creates_parent_directories() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("nested").join("dir").join("vaults.json");
        let list = VaultList {
            vaults: vec![VaultEntry {
                label: "Test".to_string(),
                path: "/tmp/test".to_string(),
            }],
            active_vault: None,
            hidden_defaults: vec![],
        };
        save_at(&path, &list).unwrap();
        assert!(path.exists());
        let loaded = load_at(&path).unwrap();
        assert_eq!(loaded.vaults.len(), 1);
    }

    #[test]
    fn vault_list_path_returns_ok() {
        let result = vault_list_path();
        assert!(result.is_ok());
        assert!(result.unwrap().to_str().unwrap().contains("com.laputa.app"));
    }

    #[test]
    fn empty_vault_list_roundtrip() {
        let list = VaultList::default();
        let loaded = save_and_reload(&list);
        assert!(loaded.vaults.is_empty());
        assert!(loaded.active_vault.is_none());
        assert!(loaded.hidden_defaults.is_empty());
    }

    #[test]
    fn hidden_defaults_roundtrip() {
        let list = VaultList {
            vaults: vec![],
            active_vault: None,
            hidden_defaults: vec!["/Users/luca/Documents/Getting Started".to_string()],
        };
        let loaded = save_and_reload(&list);
        assert_eq!(loaded.hidden_defaults.len(), 1);
        assert_eq!(
            loaded.hidden_defaults[0],
            "/Users/luca/Documents/Getting Started"
        );
    }

    #[test]
    fn load_legacy_format_without_hidden_defaults() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("legacy.json");
        // Simulate old format without hidden_defaults field
        fs::write(&path, r#"{"vaults":[],"active_vault":null}"#).unwrap();
        let loaded = load_at(&path).unwrap();
        assert!(loaded.hidden_defaults.is_empty());
    }
}
