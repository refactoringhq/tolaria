use crate::vault;

use super::vault::VaultBoundary;

#[tauri::command]
pub async fn batch_delete_notes_async(
    paths: Vec<String>,
    vault_path: Option<String>,
) -> Result<Vec<String>, String> {
    let boundary = VaultBoundary::from_request(vault_path.as_deref())?;
    let validated_paths = boundary.validate_existing_paths(&paths)?;
    tokio::task::spawn_blocking(move || vault::batch_delete_notes(&validated_paths))
        .await
        .map_err(|e| format!("Task panicked: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn batch_delete_notes_async_validates_and_deletes_inside_vault() {
        let dir = tempfile::TempDir::new().unwrap();
        let first = dir.path().join("first.md");
        let second = dir.path().join("nested/second.md");
        std::fs::create_dir_all(second.parent().unwrap()).unwrap();
        std::fs::write(&first, "# First\n").unwrap();
        std::fs::write(&second, "# Second\n").unwrap();

        let deleted = batch_delete_notes_async(
            vec![
                first.to_string_lossy().to_string(),
                "nested/second.md".to_string(),
            ],
            Some(dir.path().to_string_lossy().to_string()),
        )
        .await
        .unwrap();

        assert_eq!(deleted.len(), 2);
        assert!(!first.exists());
        assert!(!second.exists());
    }
}
