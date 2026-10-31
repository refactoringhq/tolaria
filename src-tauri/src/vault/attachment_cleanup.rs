use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::{DirEntry, WalkDir};

/// 单个被扫描文件的大小上限；更大的文件不可能是笔记，跳过以避免读入大文件。
const MAX_SCANNED_FILE_BYTES: u64 = 8 * 1024 * 1024;
const BACKUP_FOLDER_NAME: &str = "tolaria-removed-attachments";

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentRemovalResult {
    pub removed: bool,
    pub backup_path: Option<String>,
}

pub struct AttachmentRemovalRequest<'a> {
    pub attachment_path: &'a str,
    pub vault_path: &'a str,
}

pub struct AttachmentRestoreRequest<'a> {
    pub attachment_path: &'a str,
    pub backup_path: &'a str,
    pub vault_path: &'a str,
}

struct ReferenceScan<'a> {
    attachments: &'a Path,
    file_name: &'a str,
}

fn canonical_attachments_root(vault: &Path) -> Result<PathBuf, String> {
    vault
        .join("attachments")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachments folder: {error}"))
}

fn canonical_attachment(attachments: &Path, path: &Path) -> Result<PathBuf, String> {
    let source = path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachment: {error}"))?;
    if !source.is_file() || !source.starts_with(attachments) {
        return Err("Attachment path must stay inside the vault attachments folder".to_string());
    }
    Ok(source)
}

fn file_name_of(path: &Path) -> Result<&str, String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Invalid attachment filename".to_string())
}

fn hex_value(byte: u8) -> Option<u8> {
    char::from(byte)
        .to_digit(16)
        .and_then(|value| u8::try_from(value).ok())
}

fn percent_decode(content: &str) -> String {
    let bytes = content.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let escaped = (bytes[index] == b'%')
            .then(|| {
                Some((
                    hex_value(*bytes.get(index + 1)?)?,
                    hex_value(*bytes.get(index + 2)?)?,
                ))
            })
            .flatten();
        match escaped {
            Some((high, low)) => {
                decoded.push(high * 16 + low);
                index += 3;
            }
            None => {
                decoded.push(bytes[index]);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

/// 只要文件名以原文或 URL 编码形式出现，就视为仍被引用（宁可少删，不可误删）。
fn mentions_file_name(content: &str, file_name: &str) -> bool {
    content.contains(file_name) || percent_decode(content).contains(file_name)
}

fn visible_entry(entry: &DirEntry) -> bool {
    entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
}

fn small_file(entry: &DirEntry) -> bool {
    entry.file_type().is_file()
        && entry
            .metadata()
            .is_ok_and(|metadata| metadata.len() <= MAX_SCANNED_FILE_BYTES)
}

fn scannable_file(scan: &ReferenceScan<'_>, path: &Path) -> bool {
    !path.starts_with(scan.attachments)
}

fn file_mentions_attachment(scan: &ReferenceScan<'_>, path: &Path) -> bool {
    fs::read(path).is_ok_and(|bytes| {
        std::str::from_utf8(&bytes).is_ok_and(|content| mentions_file_name(content, scan.file_name))
    })
}

fn vault_references_attachment(vault: &Path, scan: &ReferenceScan<'_>) -> bool {
    WalkDir::new(vault)
        .follow_links(false)
        .into_iter()
        .filter_entry(visible_entry)
        .filter_map(Result::ok)
        .filter(small_file)
        .map(DirEntry::into_path)
        .filter(|path| scannable_file(scan, path))
        .any(|path| file_mentions_attachment(scan, &path))
}

fn move_file(source: &Path, destination: &Path) -> Result<(), String> {
    if fs::rename(source, destination).is_ok() {
        return Ok(());
    }
    // 跨卷时 rename 会失败，退回到复制后删除。
    fs::copy(source, destination).map_err(|error| format!("Failed to move attachment: {error}"))?;
    fs::remove_file(source).map_err(|error| format!("Failed to remove attachment: {error}"))
}

fn backup_root() -> PathBuf {
    std::env::temp_dir().join(BACKUP_FOLDER_NAME)
}

fn backup_destination(file_name: &str) -> Result<PathBuf, String> {
    let folder = backup_root().join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&folder)
        .map_err(|error| format!("Failed to create attachment backup folder: {error}"))?;
    Ok(folder.join(file_name))
}

/// 当附件不再被库内任何文件引用时，把它移到系统临时目录中的备份位置。
/// 调用方应在笔记保存落盘之后调用，这样扫描到的就是最新内容。
pub fn remove_unreferenced_attachment(
    request: AttachmentRemovalRequest<'_>,
) -> Result<AttachmentRemovalResult, String> {
    let vault = Path::new(request.vault_path)
        .canonicalize()
        .map_err(|error| format!("Failed to resolve vault path: {error}"))?;
    let attachments = canonical_attachments_root(&vault)?;
    let source = canonical_attachment(&attachments, Path::new(request.attachment_path))?;
    let scan = ReferenceScan {
        attachments: &attachments,
        file_name: file_name_of(&source)?,
    };
    if vault_references_attachment(&vault, &scan) {
        return Ok(AttachmentRemovalResult {
            removed: false,
            backup_path: None,
        });
    }
    let backup = backup_destination(scan.file_name)?;
    move_file(&source, &backup)?;
    log::info!("Removed unreferenced attachment: {}", source.display());
    Ok(AttachmentRemovalResult {
        removed: true,
        backup_path: Some(backup.to_string_lossy().into_owned()),
    })
}

fn canonical_backup(path: &Path) -> Result<PathBuf, String> {
    let root = backup_root()
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachment backup folder: {error}"))?;
    let backup = path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachment backup: {error}"))?;
    if !backup.is_file() || !backup.starts_with(root) {
        return Err("Attachment backup must stay inside the backup folder".to_string());
    }
    Ok(backup)
}

fn restore_destination(attachments: &Path, path: &Path) -> Result<PathBuf, String> {
    let file_name = file_name_of(path)?;
    let parent = path.parent().ok_or("Attachment has no parent folder")?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create attachments folder: {error}"))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| format!("Failed to resolve attachments folder: {error}"))?;
    if !parent.starts_with(attachments) {
        return Err("Attachment path must stay inside the vault attachments folder".to_string());
    }
    let destination = parent.join(file_name);
    if destination.exists() {
        return Err("An attachment already exists at this path".to_string());
    }
    Ok(destination)
}

/// 把之前移除的附件从备份位置移回原路径（用于撤销删除）。
pub fn restore_removed_attachment(request: AttachmentRestoreRequest<'_>) -> Result<String, String> {
    let vault = Path::new(request.vault_path)
        .canonicalize()
        .map_err(|error| format!("Failed to resolve vault path: {error}"))?;
    fs::create_dir_all(vault.join("attachments"))
        .map_err(|error| format!("Failed to create attachments folder: {error}"))?;
    let attachments = canonical_attachments_root(&vault)?;
    let backup = canonical_backup(Path::new(request.backup_path))?;
    let destination = restore_destination(&attachments, Path::new(request.attachment_path))?;
    move_file(&backup, &destination)?;
    if let Some(folder) = backup.parent() {
        let _ = fs::remove_dir(folder);
    }
    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn vault_with_attachment(name: &str) -> (TempDir, PathBuf) {
        let dir = TempDir::new().unwrap();
        let attachments = dir.path().join("attachments");
        fs::create_dir_all(&attachments).unwrap();
        let attachment = attachments.join(name);
        fs::write(&attachment, b"image data").unwrap();
        (dir, attachment)
    }

    fn remove(dir: &TempDir, attachment: &Path) -> AttachmentRemovalResult {
        remove_unreferenced_attachment(AttachmentRemovalRequest {
            attachment_path: attachment.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap()
    }

    #[test]
    fn removes_attachment_without_references_and_restores_it() {
        let (dir, attachment) = vault_with_attachment("photo.png");
        fs::write(dir.path().join("note.md"), "# Note\n\nNo images here.\n").unwrap();

        let result = remove(&dir, &attachment);

        assert!(result.removed);
        assert!(!attachment.exists());
        let backup = result.backup_path.unwrap();
        assert_eq!(fs::read(&backup).unwrap(), b"image data");

        let restored = restore_removed_attachment(AttachmentRestoreRequest {
            attachment_path: attachment.to_str().unwrap(),
            backup_path: &backup,
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap();

        assert_eq!(fs::read(restored).unwrap(), b"image data");
        assert!(!Path::new(&backup).exists());
    }

    #[test]
    fn keeps_attachment_referenced_by_another_note() {
        let (dir, attachment) = vault_with_attachment("photo name.png");
        fs::create_dir_all(dir.path().join("projects")).unwrap();
        fs::write(
            dir.path().join("projects/other.md"),
            "![photo](../attachments/photo%20name.png)\n",
        )
        .unwrap();

        let result = remove(&dir, &attachment);

        assert_eq!(
            result,
            AttachmentRemovalResult {
                removed: false,
                backup_path: None
            }
        );
        assert!(attachment.exists());
    }

    #[test]
    fn keeps_attachment_referenced_by_wikilink_embed() {
        let (dir, attachment) = vault_with_attachment("diagram.pdf");
        fs::write(
            dir.path().join("other.md"),
            "See ![[diagram.pdf|Diagram]]\n",
        )
        .unwrap();

        assert!(!remove(&dir, &attachment).removed);
        assert!(attachment.exists());
    }

    #[test]
    fn ignores_hidden_folders_and_the_attachments_folder() {
        let (dir, attachment) = vault_with_attachment("photo.png");
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(dir.path().join(".git/index.md"), "attachments/photo.png").unwrap();
        fs::write(dir.path().join("attachments/notes.txt"), "photo.png").unwrap();

        let result = remove(&dir, &attachment);

        assert!(result.removed);
        assert!(!attachment.exists());
    }

    #[test]
    fn rejects_files_outside_the_attachment_folder() {
        let (dir, _) = vault_with_attachment("inside.png");
        let outside = dir.path().join("outside.png");
        fs::write(&outside, b"outside").unwrap();

        let error = remove_unreferenced_attachment(AttachmentRemovalRequest {
            attachment_path: outside.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap_err();

        assert!(error.contains("inside the vault attachments folder"));
        assert!(outside.exists());
    }

    #[test]
    fn restore_refuses_backups_outside_the_backup_folder_and_existing_files() {
        let (dir, attachment) = vault_with_attachment("photo.png");
        let stray = dir.path().join("stray.png");
        fs::write(&stray, b"stray").unwrap();

        let outside_error = restore_removed_attachment(AttachmentRestoreRequest {
            attachment_path: dir.path().join("attachments/new.png").to_str().unwrap(),
            backup_path: stray.to_str().unwrap(),
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap_err();
        assert!(outside_error.contains("backup"));

        let backup = remove(&dir, &attachment).backup_path.unwrap();
        fs::write(&attachment, b"replacement").unwrap();
        let existing_error = restore_removed_attachment(AttachmentRestoreRequest {
            attachment_path: attachment.to_str().unwrap(),
            backup_path: &backup,
            vault_path: dir.path().to_str().unwrap(),
        })
        .unwrap_err();
        assert!(existing_error.contains("already exists"));
        assert!(Path::new(&backup).exists());
    }

    #[test]
    fn decodes_percent_escapes_without_panicking_on_truncated_input() {
        assert_eq!(percent_decode("a%20b%2"), "a b%2");
        assert_eq!(percent_decode("%E6%97%85.png"), "旅.png");
        assert!(mentions_file_name("attachments/%E6%97%85.png", "旅.png"));
    }
}
