use crate::vault::{
    self, AttachmentRemovalRequest, AttachmentRemovalResult, AttachmentRenameRequest,
    AttachmentRenameResult, AttachmentRestoreRequest,
};

use super::VaultBoundary;

#[tauri::command]
pub fn rename_attachment(
    vault_path: String,
    source_path: String,
    requested_name: String,
) -> Result<AttachmentRenameResult, String> {
    let boundary = VaultBoundary::from_request(Some(&vault_path))?;
    let validated = boundary.validate_existing_paths(&[source_path])?;
    vault::rename_attachment(AttachmentRenameRequest {
        requested_name: &requested_name,
        source_path: &validated[0],
        vault_path: boundary.requested_root().to_string_lossy().as_ref(),
    })
}

/// `attachment_path` 为库内相对路径，例如 `attachments/photo.png`。
#[tauri::command]
pub fn remove_unreferenced_attachment(
    vault_path: String,
    attachment_path: String,
) -> Result<AttachmentRemovalResult, String> {
    let boundary = VaultBoundary::from_request(Some(&vault_path))?;
    let requested = boundary.child_path(&attachment_path)?;
    let validated =
        boundary.validate_existing_paths(&[requested.to_string_lossy().into_owned()])?;
    vault::remove_unreferenced_attachment(AttachmentRemovalRequest {
        attachment_path: &validated[0],
        vault_path: boundary.requested_root().to_string_lossy().as_ref(),
    })
}

/// 把 `remove_unreferenced_attachment` 移走的附件放回 `attachment_path`（库内相对路径）。
#[tauri::command]
pub fn restore_removed_attachment(
    vault_path: String,
    attachment_path: String,
    backup_path: String,
) -> Result<String, String> {
    let boundary = VaultBoundary::from_request(Some(&vault_path))?;
    let destination = boundary.child_path(&attachment_path)?;
    vault::restore_removed_attachment(AttachmentRestoreRequest {
        attachment_path: destination.to_string_lossy().as_ref(),
        backup_path: &backup_path,
        vault_path: boundary.requested_root().to_string_lossy().as_ref(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn vault_with_attachment() -> TempDir {
        let dir = TempDir::new().unwrap();
        fs::create_dir_all(dir.path().join("attachments")).unwrap();
        fs::write(dir.path().join("attachments/photo.png"), b"image").unwrap();
        fs::write(dir.path().join("note.md"), "# Note\n").unwrap();
        dir
    }

    fn vault_path(dir: &TempDir) -> String {
        dir.path().to_string_lossy().into_owned()
    }

    #[test]
    fn removes_and_restores_attachment_by_vault_relative_path() {
        let dir = vault_with_attachment();
        let attachment = dir.path().join("attachments/photo.png");

        let result =
            remove_unreferenced_attachment(vault_path(&dir), "attachments/photo.png".into())
                .unwrap();
        assert!(result.removed);
        assert!(!attachment.exists());

        restore_removed_attachment(
            vault_path(&dir),
            "attachments/photo.png".into(),
            result.backup_path.unwrap(),
        )
        .unwrap();
        assert_eq!(fs::read(attachment).unwrap(), b"image");
    }

    #[test]
    fn rejects_paths_that_climb_out_of_the_vault() {
        let dir = vault_with_attachment();

        assert!(remove_unreferenced_attachment(vault_path(&dir), "../outside.png".into()).is_err());
        assert!(restore_removed_attachment(
            vault_path(&dir),
            "attachments/../../outside.png".into(),
            "/tmp/missing.png".into(),
        )
        .is_err());
        assert!(dir.path().join("attachments/photo.png").exists());
    }
}
