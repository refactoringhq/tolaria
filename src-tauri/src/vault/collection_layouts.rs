use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize, Serialize)]
struct LayoutDocument {
    collection: String,
    presentation: serde_json::Value,
}

fn layout_file_path(vault_path: &Path, collection: &str) -> Result<PathBuf, String> {
    if collection.is_empty() || collection.len() > 2048 {
        return Err("Invalid collection key".to_string());
    }
    let filename = format!("{}.yml", URL_SAFE_NO_PAD.encode(collection.as_bytes()));
    Ok(vault_path.join("layouts").join(filename))
}

fn is_layout_yaml(entry: &fs::DirEntry) -> Result<bool, String> {
    let is_file = entry
        .file_type()
        .map_err(|error| format!("Failed to inspect layout entry: {error}"))?
        .is_file();
    Ok(is_file
        && entry
            .path()
            .extension()
            .and_then(|extension| extension.to_str())
            == Some("yml"))
}

fn parse_layout_file(path: &Path) -> Result<LayoutDocument, String> {
    let content =
        fs::read_to_string(path).map_err(|error| format!("Failed to read layout file: {error}"))?;
    serde_yaml::from_str(&content).map_err(|error| format!("Failed to parse layout file: {error}"))
}

pub fn scan_collection_layouts(
    vault_path: &Path,
) -> Result<BTreeMap<String, serde_json::Value>, String> {
    let directory = vault_path.join("layouts");
    if !directory.exists() {
        return Ok(BTreeMap::new());
    }
    let entries = fs::read_dir(&directory)
        .map_err(|error| format!("Failed to read layouts directory: {error}"))?;
    let mut layouts = BTreeMap::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to read layout entry: {error}"))?;
        if is_layout_yaml(&entry)? {
            let document = parse_layout_file(&entry.path())?;
            layouts.insert(document.collection, document.presentation);
        }
    }
    Ok(layouts)
}

pub fn save_collection_layout(
    vault_path: &Path,
    collection: &str,
    presentation: serde_json::Value,
) -> Result<(), String> {
    let path = layout_file_path(vault_path, collection)?;
    let directory = path
        .parent()
        .ok_or_else(|| "Invalid layout file path".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Failed to create layouts directory: {error}"))?;
    let document = LayoutDocument {
        collection: collection.to_string(),
        presentation,
    };
    let yaml = serde_yaml::to_string(&document)
        .map_err(|error| format!("Failed to serialize layout: {error}"))?;
    write_layout_yaml(&path, &yaml)
}

fn write_layout_yaml(path: &Path, yaml: &str) -> Result<(), String> {
    if fs::read_to_string(path).is_ok_and(|existing| existing == yaml) {
        return Ok(());
    }
    let directory = path
        .parent()
        .ok_or_else(|| "Invalid layout file path".to_string())?;
    let mut staged = tempfile::NamedTempFile::new_in(directory)
        .map_err(|error| format!("Failed to stage layout file: {error}"))?;
    staged
        .write_all(yaml.as_bytes())
        .map_err(|error| format!("Failed to write layout file: {error}"))?;
    staged
        .persist(&path)
        .map(|_| ())
        .map_err(|error| format!("Failed to replace layout file: {}", error.error))
}

pub fn delete_collection_layout(vault_path: &Path, collection: &str) -> Result<(), String> {
    let path = layout_file_path(vault_path, collection)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete layout file: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn layout_config_roundtrips_as_human_readable_yaml() {
        let vault = tempfile::TempDir::new().unwrap();
        let config = json!({
            "type": "kanban",
            "groupBy": "status",
            "columnOrder": ["doing", "planned"],
            "properties": ["owner"]
        });

        save_collection_layout(vault.path(), "folder:root:clients", config.clone()).unwrap();

        assert_eq!(
            scan_collection_layouts(vault.path())
                .unwrap()
                .get("folder:root:clients"),
            Some(&config)
        );
        let yaml =
            fs::read_to_string(layout_file_path(vault.path(), "folder:root:clients").unwrap())
                .unwrap();
        assert!(yaml.contains("groupBy: status"));
        assert!(yaml.contains("collection: folder:root:clients"));
    }

    #[test]
    fn layout_config_is_not_rewritten_when_unchanged() {
        let vault = tempfile::TempDir::new().unwrap();
        let config = json!({"type": "kanban", "groupBy": "status"});
        save_collection_layout(vault.path(), "builtin:all", config.clone()).unwrap();
        let path = layout_file_path(vault.path(), "builtin:all").unwrap();
        let before = fs::metadata(&path).unwrap().modified().unwrap();

        save_collection_layout(vault.path(), "builtin:all", config).unwrap();

        assert_eq!(fs::metadata(path).unwrap().modified().unwrap(), before);
    }
}
