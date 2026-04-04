use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct ModifiedFile {
    pub path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub status: String,
}

/// Get list of modified/added/deleted files in the vault (uncommitted changes).
pub fn get_modified_files(vault_path: &str) -> Result<Vec<ModifiedFile>, String> {
    let vault = Path::new(vault_path);

    let output = Command::new("git")
        .args(["status", "--porcelain", "--untracked-files=all"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git status failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files = stdout
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| {
            if line.len() < 4 {
                return None;
            }
            let status_code = &line[..2];
            let path = line[3..].trim().to_string();

            // Only include markdown files
            if !path.ends_with(".md") {
                return None;
            }

            let status = match status_code.trim() {
                "M" | "MM" | "AM" => "modified",
                "A" => "added",
                "D" => "deleted",
                "??" => "untracked",
                "R" | "RM" => "renamed",
                _ => "modified",
            };

            let full_path = vault.join(&path).to_string_lossy().to_string();

            Some(ModifiedFile {
                path: full_path,
                relative_path: path,
                status: status.to_string(),
            })
        })
        .collect();

    Ok(files)
}

/// Discard uncommitted changes to a single file.
///
/// - **Modified / Deleted**: `git checkout -- <file>` restores the last committed version.
/// - **Untracked / Added**: the file is removed from disk.
///
/// The `relative_path` must be relative to `vault_path` (the same format
/// returned by [`get_modified_files`]).
pub fn discard_file_changes(vault_path: &str, relative_path: &str) -> Result<(), String> {
    let vault = Path::new(vault_path);
    let abs = vault.join(relative_path);

    // Safety: ensure the resolved path stays inside the vault.
    // Safety: reject any relative_path that tries to escape the vault via `..`.
    for component in std::path::Path::new(relative_path).components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err("File path is outside the vault".into());
        }
    }
    if abs.exists() {
        let canonical_vault = vault
            .canonicalize()
            .map_err(|e| format!("Cannot resolve vault path: {e}"))?;
        let canonical_file = abs
            .canonicalize()
            .map_err(|e| format!("Cannot resolve file path: {e}"))?;
        if !canonical_file.starts_with(&canonical_vault) {
            return Err("File path is outside the vault".into());
        }
    }

    // Determine the file status from `git status --porcelain`.
    let output = Command::new("git")
        .args(["status", "--porcelain", "--", relative_path])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git status: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().find(|l| l.len() >= 4);

    let status_code = line
        .map(|l| l[..2].trim().to_string())
        .unwrap_or_default();

    match status_code.as_str() {
        "??" => {
            // Untracked — remove from disk.
            std::fs::remove_file(&abs)
                .map_err(|e| format!("Failed to delete untracked file: {e}"))?;
        }
        _ => {
            // Modified, deleted, added-to-index, renamed, etc. — restore via git.
            // Unstage first (ignore errors — file might not be staged).
            let _ = Command::new("git")
                .args(["reset", "HEAD", "--", relative_path])
                .current_dir(vault)
                .output();

            let checkout = Command::new("git")
                .args(["checkout", "--", relative_path])
                .current_dir(vault)
                .output()
                .map_err(|e| format!("Failed to run git checkout: {e}"))?;

            if !checkout.status.success() {
                let stderr = String::from_utf8_lossy(&checkout.stderr);
                return Err(format!("git checkout failed: {}", stderr.trim()));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::git_commit;
    use crate::git::tests::setup_git_repo;
    use std::fs;
    use std::process::Command;

    #[test]
    fn test_get_modified_files() {
        let dir = setup_git_repo();
        let vault = dir.path();

        // Create and commit a file
        fs::write(vault.join("note.md"), "# Note\n").unwrap();
        Command::new("git")
            .args(["add", "note.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Add note"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Modify it
        fs::write(vault.join("note.md"), "# Note\n\nUpdated.").unwrap();
        // Add an untracked file
        fs::write(vault.join("new.md"), "# New\n").unwrap();

        let modified = get_modified_files(vault.to_str().unwrap()).unwrap();

        assert!(modified.len() >= 2);
        let statuses: Vec<&str> = modified.iter().map(|f| f.status.as_str()).collect();
        assert!(statuses.contains(&"modified"));
        assert!(statuses.contains(&"untracked"));
    }

    #[test]
    fn test_get_modified_files_untracked_in_subdirectory() {
        let dir = setup_git_repo();
        let vault = dir.path();

        // Create initial commit so git is initialized
        fs::write(vault.join("init.md"), "# Init\n").unwrap();
        Command::new("git")
            .args(["add", "init.md"])
            .current_dir(vault)
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-m", "Initial"])
            .current_dir(vault)
            .output()
            .unwrap();

        // Create a new untracked file in a subdirectory (simulates new note creation)
        fs::create_dir_all(vault.join("note")).unwrap();
        fs::write(vault.join("note/brand-new.md"), "# Brand New\n").unwrap();

        let modified = get_modified_files(vault.to_str().unwrap()).unwrap();

        assert_eq!(modified.len(), 1);
        assert_eq!(modified[0].status, "untracked");
        assert_eq!(modified[0].relative_path, "note/brand-new.md");
        assert!(
            modified[0].path.ends_with("/note/brand-new.md"),
            "Full path should end with relative path: {}",
            modified[0].path
        );
    }

    #[test]
    fn test_commit_flow_modified_files_then_commit_clears() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        // Create and commit initial file
        fs::write(vault.join("flow.md"), "# Original\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Modify the file on disk
        fs::write(vault.join("flow.md"), "# Modified\n").unwrap();

        // get_modified_files should detect the change
        let modified = get_modified_files(vp).unwrap();
        assert!(
            modified.iter().any(|f| f.relative_path == "flow.md"),
            "Modified file should be detected after write"
        );

        // Commit the change
        let result = git_commit(vp, "update flow").unwrap();
        assert!(
            result.contains("1 file changed") || result.contains("flow.md"),
            "Commit output should reference the changed file: {}",
            result
        );

        // After commit, get_modified_files should return empty
        let after = get_modified_files(vp).unwrap();
        assert!(
            after.is_empty(),
            "No modified files should remain after commit, found: {:?}",
            after
        );
    }

    #[test]
    fn test_discard_modified_file() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Original\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Modify the file
        fs::write(vault.join("note.md"), "# Changed\n").unwrap();
        assert_eq!(get_modified_files(vp).unwrap().len(), 1);

        // Discard
        discard_file_changes(vp, "note.md").unwrap();

        let content = fs::read_to_string(vault.join("note.md")).unwrap();
        assert_eq!(content, "# Original\n");
        assert!(get_modified_files(vp).unwrap().is_empty());
    }

    #[test]
    fn test_discard_untracked_file() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("init.md"), "# Init\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Create an untracked file
        fs::write(vault.join("new.md"), "# New\n").unwrap();
        assert!(vault.join("new.md").exists());

        discard_file_changes(vp, "new.md").unwrap();

        assert!(!vault.join("new.md").exists());
        assert!(get_modified_files(vp).unwrap().is_empty());
    }

    #[test]
    fn test_discard_deleted_file() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        fs::write(vault.join("note.md"), "# Original\n").unwrap();
        git_commit(vp, "initial").unwrap();

        // Delete the file
        fs::remove_file(vault.join("note.md")).unwrap();
        assert!(!vault.join("note.md").exists());

        discard_file_changes(vp, "note.md").unwrap();

        assert!(vault.join("note.md").exists());
        let content = fs::read_to_string(vault.join("note.md")).unwrap();
        assert_eq!(content, "# Original\n");
    }

    #[test]
    fn test_discard_rejects_path_outside_vault() {
        let dir = setup_git_repo();
        let vault = dir.path();
        let vp = vault.to_str().unwrap();

        // Need an initial commit so git status works
        fs::write(vault.join("init.md"), "# Init\n").unwrap();
        git_commit(vp, "initial").unwrap();

        let result = discard_file_changes(vp, "../../../etc/passwd");
        assert!(result.is_err(), "Should reject path outside vault, got: {:?}", result);
        assert!(
            result.unwrap_err().contains("outside the vault"),
            "Error should mention 'outside the vault'"
        );
    }
}
