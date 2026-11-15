use crate::vault;
use serde_json::Value;
use std::path::Path;

use super::boundary::with_boundary;

#[tauri::command]
pub fn list_collection_layouts(
    vault_path: String,
) -> Result<std::collections::BTreeMap<String, Value>, String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        boundary.child_path("layouts")?;
        vault::scan_collection_layouts(boundary.requested_root())
    })
}

#[tauri::command]
pub fn save_collection_layout_cmd(
    vault_path: String,
    collection: String,
    presentation: Value,
) -> Result<(), String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        boundary.child_path("layouts")?;
        vault::save_collection_layout(
            Path::new(boundary.requested_root()),
            &collection,
            presentation,
        )
    })
}

#[tauri::command]
pub fn delete_collection_layout_cmd(vault_path: String, collection: String) -> Result<(), String> {
    with_boundary(Some(vault_path.as_str()), |boundary| {
        boundary.child_path("layouts")?;
        vault::delete_collection_layout(Path::new(boundary.requested_root()), &collection)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn layout_commands_roundtrip_through_vault_boundary() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();
        let presentation = json!({"type": "kanban", "groupBy": "status"});

        save_collection_layout_cmd(
            vault_path.clone(),
            "builtin:all".to_string(),
            presentation.clone(),
        )
        .unwrap();

        assert_eq!(
            list_collection_layouts(vault_path.clone())
                .unwrap()
                .get("builtin:all"),
            Some(&presentation)
        );
        delete_collection_layout_cmd(vault_path.clone(), "builtin:all".to_string()).unwrap();
        assert!(list_collection_layouts(vault_path).unwrap().is_empty());
    }

    #[test]
    fn layout_commands_reject_invalid_vault_boundary() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().join("vault");
        let outside = dir.path().join("outside");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, root.join("layouts")).unwrap();

        let result = save_collection_layout_cmd(
            root.to_string_lossy().to_string(),
            "builtin:all".to_string(),
            json!({"type": "kanban"}),
        );

        #[cfg(unix)]
        assert!(result.is_err());
        #[cfg(not(unix))]
        assert!(result.is_ok());
    }
}
