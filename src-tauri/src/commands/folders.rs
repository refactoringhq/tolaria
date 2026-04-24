use crate::vault::{self, FolderRenameResult};

use super::expand_tilde;

#[tauri::command]
pub fn rename_vault_folder(
    vault_path: String,
    folder_path: String,
    new_name: String,
) -> Result<FolderRenameResult, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::rename_folder(
        std::path::Path::new(vault_path.as_ref()),
        &folder_path,
        &new_name,
    )
}

#[tauri::command]
pub fn delete_vault_folder(vault_path: String, folder_path: String) -> Result<String, String> {
    let vault_path = expand_tilde(&vault_path);
    vault::delete_folder(std::path::Path::new(vault_path.as_ref()), &folder_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_commands_route_through_vault_path_boundary() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().to_string_lossy().to_string();
        let folder = dir.path().join("Inbox");
        std::fs::create_dir(&folder).unwrap();
        std::fs::write(folder.join("note.md"), "# Note\n").unwrap();

        let renamed = rename_vault_folder(
            vault_path.clone(),
            "Inbox".to_string(),
            "Organized".to_string(),
        )
        .unwrap();
        assert!(renamed.new_path.ends_with("Organized"));
        assert!(dir.path().join("Organized/note.md").exists());

        let deleted = delete_vault_folder(vault_path, "Organized".to_string()).unwrap();
        assert_eq!(deleted, "Organized");
        assert!(!dir.path().join("Organized").exists());
    }
}
