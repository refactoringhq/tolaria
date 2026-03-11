use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::frontmatter::{update_frontmatter_content, FrontmatterValue};

/// Result of a rename operation
#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    /// New absolute file path after rename
    pub new_path: String,
    /// Number of other files updated (wiki link replacements)
    pub updated_files: usize,
}

/// Convert a title to a filename slug (lowercase, hyphens, no special chars).
fn title_to_slug(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}

/// Update the first H1 heading in markdown content to a new title.
fn update_h1_title(content: &str, new_title: &str) -> String {
    let has_h1 = content.lines().any(|l| l.trim().starts_with("# "));
    if !has_h1 {
        return content.to_string();
    }

    let result: Vec<String> = content
        .lines()
        .map(|l| {
            if l.trim().starts_with("# ") {
                format!("# {}", new_title)
            } else {
                l.to_string()
            }
        })
        .collect();

    let joined = result.join("\n");
    if content.ends_with('\n') && !joined.ends_with('\n') {
        format!("{}\n", joined)
    } else {
        joined
    }
}

/// Build a regex that matches wiki links referencing old title or path stem.
fn build_wikilink_pattern(old_title: &str, old_path_stem: &str) -> Option<Regex> {
    let pattern_str = format!(
        r"\[\[(?:{}|{})(\|[^\]]*?)?\]\]",
        regex::escape(old_title),
        regex::escape(old_path_stem),
    );
    Regex::new(&pattern_str).ok()
}

/// Check if a path is a vault markdown file eligible for wikilink replacement.
fn is_replaceable_md_file(path: &Path, exclude: &Path) -> bool {
    path.is_file() && path != exclude && path.extension().is_some_and(|ext| ext == "md")
}

/// Replace wikilink references in a single file's content. Returns updated content if changed.
fn replace_wikilinks_in_content(content: &str, re: &Regex, new_title: &str) -> Option<String> {
    if !re.is_match(content) {
        return None;
    }
    let replaced = re.replace_all(content, |caps: &regex::Captures| match caps.get(1) {
        Some(pipe) => format!("[[{}{}]]", new_title, pipe.as_str()),
        None => format!("[[{}]]", new_title),
    });
    if replaced != content {
        Some(replaced.into_owned())
    } else {
        None
    }
}

/// Parameters for a vault-wide wikilink replacement.
struct WikilinkReplacement<'a> {
    vault_path: &'a Path,
    old_title: &'a str,
    new_title: &'a str,
    old_path_stem: &'a str,
    exclude_path: &'a Path,
}

/// Collect all .md file paths in vault eligible for wikilink replacement.
fn collect_md_files(vault_path: &Path, exclude: &Path) -> Vec<std::path::PathBuf> {
    WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.into_path())
        .filter(|p| is_replaceable_md_file(p, exclude))
        .collect()
}

/// Replace wiki link references across all vault markdown files.
fn update_wikilinks_in_vault(params: &WikilinkReplacement) -> usize {
    let re = match build_wikilink_pattern(params.old_title, params.old_path_stem) {
        Some(r) => r,
        None => return 0,
    };

    let files = collect_md_files(params.vault_path, params.exclude_path);
    files
        .iter()
        .filter(|path| {
            let content = match fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => return false,
            };
            match replace_wikilinks_in_content(&content, &re, params.new_title) {
                Some(new_content) => fs::write(path, &new_content).is_ok(),
                None => false,
            }
        })
        .count()
}

/// Check if frontmatter contains a `title:` key.
fn frontmatter_has_title_key(content: &str) -> bool {
    if !content.starts_with("---\n") {
        return false;
    }
    content[4..]
        .split("\n---")
        .next()
        .map(|fm| {
            fm.lines().any(|l| {
                let t = l.trim_start();
                t.starts_with("title:") || t.starts_with("\"title\":")
            })
        })
        .unwrap_or(false)
}

/// Update H1 and optionally the `title:` frontmatter field in content.
fn update_note_title_in_content(content: &str, new_title: &str) -> String {
    let mut updated = update_h1_title(content, new_title);
    if frontmatter_has_title_key(content) {
        let value = FrontmatterValue::String(new_title.to_string());
        if let Ok(c) = update_frontmatter_content(&updated, "title", Some(value)) {
            updated = c;
        }
    }
    updated
}

/// Strip vault prefix and .md suffix to get the relative path stem (e.g., "project/weekly-review").
fn to_path_stem<'a>(abs_path: &'a str, vault_prefix: &str) -> &'a str {
    abs_path
        .strip_prefix(vault_prefix)
        .unwrap_or(abs_path)
        .strip_suffix(".md")
        .unwrap_or(abs_path)
}

/// Result of a move-to-type-folder operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct MoveResult {
    /// New absolute file path after move (same as old if no move happened).
    pub new_path: String,
    /// Number of other files updated (wikilink replacements).
    pub updated_links: usize,
    /// Whether the file was actually moved (false if already in the right folder).
    pub moved: bool,
}

/// Convert a type name to a folder slug. All known types are single lowercase words;
/// unknown types are slugified (lowercase, non-alphanumeric → hyphen).
fn type_to_folder_slug(type_name: &str) -> String {
    type_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-")
}

/// Determine a unique destination path, appending -2, -3, etc. if a file already exists.
fn unique_dest_path(dest_dir: &Path, filename: &str) -> std::path::PathBuf {
    let dest = dest_dir.join(filename);
    if !dest.exists() {
        return dest;
    }
    let stem = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = Path::new(filename)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    let mut counter = 2;
    loop {
        let candidate = dest_dir.join(format!("{}-{}{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

/// Move a note to the folder corresponding to its new type, and update wikilinks across the vault.
///
/// Returns `MoveResult` with `moved: false` if the note is already in the correct folder.
/// Creates the target folder if it does not exist.
pub fn move_note_to_type_folder(
    vault_path: &str,
    note_path: &str,
    new_type: &str,
) -> Result<MoveResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(note_path);

    if !old_file.exists() {
        return Err(format!("File does not exist: {}", note_path));
    }
    let new_type = new_type.trim();
    if new_type.is_empty() {
        return Err("Type cannot be empty".to_string());
    }

    let folder_slug = type_to_folder_slug(new_type);

    // Check if already in the correct folder
    let current_folder = old_file
        .parent()
        .and_then(|p| p.file_name())
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    if current_folder == folder_slug {
        return Ok(MoveResult {
            new_path: note_path.to_string(),
            updated_links: 0,
            moved: false,
        });
    }

    let filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    // Create target directory if needed
    let dest_dir = vault.join(&folder_slug);
    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Failed to create directory {}: {}", dest_dir.display(), e))?;
    }

    // Determine destination path (handle collisions)
    let new_file = unique_dest_path(&dest_dir, &filename);
    let new_path_str = new_file.to_string_lossy().to_string();

    // Read content and move
    let content =
        fs::read_to_string(old_file).map_err(|e| format!("Failed to read {}: {}", note_path, e))?;
    fs::write(&new_file, &content)
        .map_err(|e| format!("Failed to write {}: {}", new_path_str, e))?;
    fs::remove_file(old_file)
        .map_err(|e| format!("Failed to remove old file {}: {}", note_path, e))?;

    // Extract title for wikilink matching
    let old_filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let old_title = super::extract_title(&content, &old_filename);

    // Update wikilinks across the vault (title stays the same, path changes)
    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(note_path, &vault_prefix);
    let new_path_stem = to_path_stem(&new_path_str, &vault_prefix);

    // Build pattern matching old path stem (e.g. "note/weekly-review")
    let re = match build_wikilink_pattern(&old_title, old_path_stem) {
        Some(r) => r,
        None => {
            return Ok(MoveResult {
                new_path: new_path_str,
                updated_links: 0,
                moved: true,
            })
        }
    };

    // Determine the replacement: if path-style wikilinks were used, update to new path.
    // Title-style wikilinks [[My Note]] stay the same (title hasn't changed).
    let files = collect_md_files(vault, &new_file);
    let updated_links = files
        .iter()
        .filter(|path| {
            let file_content = match fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => return false,
            };
            if !re.is_match(&file_content) {
                return false;
            }
            // Replace path-based wikilinks (old_path_stem → new_path_stem)
            // and keep title-based wikilinks as-is.
            let replaced = re.replace_all(&file_content, |caps: &regex::Captures| {
                let full_match = caps.get(0).map(|m| m.as_str()).unwrap_or("");
                let pipe = caps.get(1);
                // If the match used the path stem, replace with new path stem
                if full_match.contains(old_path_stem) {
                    match pipe {
                        Some(p) => format!("[[{}{}]]", new_path_stem, p.as_str()),
                        None => format!("[[{}]]", new_path_stem),
                    }
                } else {
                    // Title-based link — keep as-is (title hasn't changed)
                    full_match.to_string()
                }
            });
            if replaced != file_content {
                fs::write(path, replaced.as_ref()).is_ok()
            } else {
                false
            }
        })
        .count();

    Ok(MoveResult {
        new_path: new_path_str,
        updated_links,
        moved: true,
    })
}

/// Rename a note: update its title, rename the file, and update wiki links across the vault.
///
/// When `old_title_hint` is provided it is used instead of extracting the title from
/// the file's H1 heading.  This is needed when the caller has already saved updated
/// content to disk (e.g. the editor saved a new H1 before triggering the rename)
/// so the on-disk H1 already matches `new_title`.
pub fn rename_note(
    vault_path: &str,
    old_path: &str,
    new_title: &str,
    old_title_hint: Option<&str>,
) -> Result<RenameResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(old_path);

    if !old_file.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }
    let new_title = new_title.trim();
    if new_title.is_empty() {
        return Err("New title cannot be empty".to_string());
    }

    let content =
        fs::read_to_string(old_file).map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let old_filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let extracted_title = super::extract_title(&content, &old_filename);
    let old_title = old_title_hint.unwrap_or(&extracted_title);

    // Check both title and filename: even if the title in content matches,
    // the filename may still be stale (e.g. "untitled-note.md" after user changed H1).
    let expected_filename = format!("{}.md", title_to_slug(new_title));
    let title_unchanged = old_title == new_title;
    let filename_matches = old_filename == expected_filename;

    if title_unchanged && filename_matches {
        return Ok(RenameResult {
            new_path: old_path.to_string(),
            updated_files: 0,
        });
    }

    // Update content only if the title actually changed
    let updated_content = if title_unchanged {
        content.clone()
    } else {
        update_note_title_in_content(&content, new_title)
    };

    // Compute new path, handling collisions with numeric suffix
    let parent_dir = old_file
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let new_file = unique_dest_path(parent_dir, &expected_filename);
    let new_path_str = new_file.to_string_lossy().to_string();

    fs::write(&new_file, &updated_content)
        .map_err(|e| format!("Failed to write {}: {}", new_path_str, e))?;
    if old_file != new_file {
        fs::remove_file(old_file)
            .map_err(|e| format!("Failed to remove old file {}: {}", old_path, e))?;
    }

    // Update wikilinks across the vault
    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let updated_files = update_wikilinks_in_vault(&WikilinkReplacement {
        vault_path: vault,
        old_title,
        new_title,
        old_path_stem,
        exclude_path: &new_file,
    });

    Ok(RenameResult {
        new_path: new_path_str,
        updated_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_title_to_slug() {
        assert_eq!(title_to_slug("Weekly Review"), "weekly-review");
        assert_eq!(title_to_slug("My  Note!  "), "my-note");
        assert_eq!(title_to_slug("Hello World"), "hello-world");
    }

    #[test]
    fn test_update_h1_title() {
        let content = "---\nIs A: Note\n---\n# Old Title\n\nContent here.\n";
        let updated = update_h1_title(content, "New Title");
        assert!(updated.contains("# New Title"));
        assert!(!updated.contains("# Old Title"));
        assert!(updated.contains("Content here."));
    }

    #[test]
    fn test_rename_note_basic() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\nIs A: Note\n---\n# Weekly Review\n\nContent here.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
            None,
        )
        .unwrap();

        assert!(result.new_path.ends_with("sprint-retrospective.md"));
        assert!(!old_path.exists());
        assert!(Path::new(&result.new_path).exists());

        let new_content = fs::read_to_string(&result.new_path).unwrap();
        assert!(new_content.contains("# Sprint Retrospective"));
    }

    #[test]
    fn test_rename_note_updates_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\nIs A: Note\n---\n# Weekly Review\n\nContent.\n",
        );
        create_test_file(
            vault,
            "note/other.md",
            "---\nIs A: Note\n---\n# Other\n\nSee [[Weekly Review]] for details.\n",
        );
        create_test_file(
            vault,
            "project/my-project.md",
            "---\nIs A: Project\nRelated to:\n  - \"[[Weekly Review]]\"\n---\n# My Project\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
            None,
        )
        .unwrap();

        assert_eq!(result.updated_files, 2);

        let other_content = fs::read_to_string(vault.join("note/other.md")).unwrap();
        assert!(other_content.contains("[[Sprint Retrospective]]"));
        assert!(!other_content.contains("[[Weekly Review]]"));

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[Sprint Retrospective]]"));
    }

    #[test]
    fn test_rename_note_same_title_noop() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/my-note.md", "# My Note\n\nContent.\n");

        let old_path = vault.join("note/my-note.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "My Note",
            None,
        )
        .unwrap();

        assert_eq!(result.new_path, old_path.to_str().unwrap());
        assert_eq!(result.updated_files, 0);
    }

    #[test]
    fn test_rename_note_empty_title_error() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/test.md", "# Test\n");

        let old_path = vault.join("note/test.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "  ",
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_rename_note_preserves_pipe_alias_in_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/weekly-review.md", "# Weekly Review\n");
        create_test_file(
            vault,
            "note/ref.md",
            "# Ref\n\nSee [[Weekly Review|my review]] for info.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retro",
            None,
        )
        .unwrap();

        assert_eq!(result.updated_files, 1);
        let ref_content = fs::read_to_string(vault.join("note/ref.md")).unwrap();
        assert!(ref_content.contains("[[Sprint Retro|my review]]"));
    }

    #[test]
    fn test_rename_note_updates_title_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/old.md",
            "---\ntitle: Old Name\nIs A: Note\n---\n# Old Name\n",
        );

        let old_path = vault.join("note/old.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "New Name",
            None,
        )
        .unwrap();

        let content = fs::read_to_string(&result.new_path).unwrap();
        assert!(content.contains("title: New Name"));
        assert!(content.contains("# New Name"));
    }

    // --- Regression: rename empty / minimal notes (nota vuota) ---

    /// Helper: create a note, rename it, assert the rename succeeded and old file is gone.
    /// Returns the content of the renamed file for further assertions.
    fn rename_test_note(filename: &str, content: &str, new_title: &str) -> String {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, filename, content);

        let old_path = vault.join(filename);
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            new_title,
            None,
        )
        .expect("rename_note should succeed");

        let expected_slug = title_to_slug(new_title);
        assert!(
            result.new_path.ends_with(&format!("{}.md", expected_slug)),
            "new path should end with slug: {}",
            expected_slug
        );
        assert!(!old_path.exists(), "old file should be removed");
        assert!(
            Path::new(&result.new_path).exists(),
            "new file should exist"
        );

        fs::read_to_string(&result.new_path).unwrap()
    }

    #[test]
    fn test_rename_note_empty_file() {
        rename_test_note("note/empty.md", "", "Renamed Empty");
    }

    #[test]
    fn test_rename_note_empty_frontmatter_no_body() {
        rename_test_note("note/empty-fm.md", "---\n---\n", "Renamed Note");
    }

    #[test]
    fn test_rename_note_frontmatter_title_no_body() {
        let content = rename_test_note(
            "note/titled.md",
            "---\ntitle: Old Title\ntype: Note\n---\n",
            "New Title",
        );
        assert!(content.contains("title: New Title"));
    }

    #[test]
    fn test_rename_note_h1_only_no_body() {
        let content = rename_test_note("note/heading-only.md", "# Old Heading\n", "New Heading");
        assert!(content.contains("# New Heading"));
    }

    #[test]
    fn test_rename_note_frontmatter_and_h1_no_body() {
        let content = rename_test_note(
            "note/full-empty.md",
            "---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n\n# My Note\n\n",
            "Renamed Note",
        );
        assert!(content.contains("title: Renamed Note"));
        assert!(content.contains("# Renamed Note"));
    }

    // --- rename-on-save: filename doesn't match title slug ---

    #[test]
    fn test_rename_note_filename_mismatch_same_title() {
        // Simulates: user created "Untitled note", changed H1 to "My New Note",
        // saved content (H1 now correct), but filename is still "untitled-note.md".
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/untitled-note.md",
            "---\ntitle: My New Note\ntype: Note\n---\n\n# My New Note\n\nContent.\n",
        );

        let old_path = vault.join("note/untitled-note.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "My New Note",
            None,
        )
        .unwrap();

        // File should be renamed to match the title slug
        assert!(
            result.new_path.ends_with("my-new-note.md"),
            "expected my-new-note.md, got {}",
            result.new_path
        );
        assert!(!old_path.exists(), "old file should be removed");
        assert!(Path::new(&result.new_path).exists());

        // Content should be preserved (title was already correct)
        let content = fs::read_to_string(&result.new_path).unwrap();
        assert!(content.contains("# My New Note"));
        assert!(content.contains("title: My New Note"));
    }

    #[test]
    fn test_rename_note_collision_appends_suffix() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        // Existing file with the slug we want
        create_test_file(
            vault,
            "note/my-note.md",
            "---\ntitle: My Note\ntype: Note\n---\n\n# My Note\n\nExisting.\n",
        );
        // File with wrong name that should be renamed to my-note.md
        create_test_file(
            vault,
            "note/untitled-note.md",
            "---\ntitle: My Note\ntype: Note\n---\n\n# My Note\n\nNew content.\n",
        );

        let old_path = vault.join("note/untitled-note.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "My Note",
            None,
        )
        .unwrap();

        // Should get a suffixed name to avoid collision
        assert!(
            result.new_path.ends_with("my-note-2.md"),
            "expected my-note-2.md, got {}",
            result.new_path
        );
        assert!(!old_path.exists());
        assert!(Path::new(&result.new_path).exists());
        // Original file should be untouched
        assert!(vault.join("note/my-note.md").exists());
    }

    // --- move_note_to_type_folder tests ---

    #[test]
    fn test_type_to_folder_slug_known_types() {
        assert_eq!(type_to_folder_slug("Person"), "person");
        assert_eq!(type_to_folder_slug("Project"), "project");
        assert_eq!(type_to_folder_slug("Quarter"), "quarter");
        assert_eq!(type_to_folder_slug("Note"), "note");
    }

    #[test]
    fn test_type_to_folder_slug_unknown_types() {
        assert_eq!(type_to_folder_slug("Key Result"), "key-result");
        assert_eq!(type_to_folder_slug("My Custom Type"), "my-custom-type");
    }

    #[test]
    fn test_move_note_basic() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\ntype: Quarter\n---\n# Weekly Review\n\nContent here.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        assert!(result.new_path.contains("/quarter/weekly-review.md"));
        assert!(!old_path.exists());
        assert!(Path::new(&result.new_path).exists());
    }

    #[test]
    fn test_move_note_already_in_correct_folder() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "quarter/weekly-review.md",
            "---\ntype: Quarter\n---\n# Weekly Review\n",
        );

        let path = vault.join("quarter/weekly-review.md");
        let result =
            move_note_to_type_folder(vault.to_str().unwrap(), path.to_str().unwrap(), "Quarter")
                .unwrap();

        assert!(!result.moved);
        assert_eq!(result.new_path, path.to_str().unwrap());
        assert_eq!(result.updated_links, 0);
    }

    #[test]
    fn test_move_note_creates_target_folder() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/my-note.md",
            "---\ntype: Quarter\n---\n# My Note\n",
        );

        let dest_dir = vault.join("quarter");
        assert!(!dest_dir.exists());

        let old_path = vault.join("note/my-note.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        assert!(dest_dir.exists());
        assert!(Path::new(&result.new_path).exists());
    }

    #[test]
    fn test_move_note_filename_collision() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/my-note.md",
            "---\ntype: Quarter\n---\n# My Note\n",
        );
        create_test_file(
            vault,
            "quarter/my-note.md",
            "---\ntype: Quarter\n---\n# Existing Note\n",
        );

        let old_path = vault.join("note/my-note.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        assert!(result.new_path.contains("/quarter/my-note-2.md"));
        assert!(!old_path.exists());
        assert!(Path::new(&result.new_path).exists());
        // Original file should still exist
        assert!(vault.join("quarter/my-note.md").exists());
    }

    #[test]
    fn test_move_note_updates_path_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\ntype: Quarter\n---\n# Weekly Review\n\nContent.\n",
        );
        create_test_file(
            vault,
            "project/my-project.md",
            "---\ntype: Project\n---\n# My Project\n\nSee [[note/weekly-review]] for details.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        assert_eq!(result.updated_links, 1);

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[quarter/weekly-review]]"));
        assert!(!project_content.contains("[[note/weekly-review]]"));
    }

    #[test]
    fn test_move_note_preserves_title_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\ntype: Quarter\n---\n# Weekly Review\n",
        );
        create_test_file(
            vault,
            "note/other.md",
            "---\ntype: Note\n---\n# Other\n\nSee [[Weekly Review]] for details.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        // Title-based wikilinks should be unchanged
        let other_content = fs::read_to_string(vault.join("note/other.md")).unwrap();
        assert!(other_content.contains("[[Weekly Review]]"));
    }

    #[test]
    fn test_move_note_collision_preserves_both_contents() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let moving_content =
            "---\ntype: Quarter\n---\n# Migrate newsletter to Beehiiv\n\nImportant content.\n";
        let existing_content =
            "---\ntype: Quarter\n---\n# Feedback for Laputa\n\nCompletely different note.\n";
        create_test_file(vault, "note/my-note.md", moving_content);
        create_test_file(vault, "quarter/my-note.md", existing_content);

        let old_path = vault.join("note/my-note.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        assert!(result.moved);
        // Must get a unique path, not the existing file's path
        assert!(result.new_path.contains("/quarter/my-note-2.md"));
        // Moved note must retain its own content
        let moved_content = fs::read_to_string(&result.new_path).unwrap();
        assert_eq!(moved_content, moving_content);
        // Existing note must be untouched
        let untouched = fs::read_to_string(vault.join("quarter/my-note.md")).unwrap();
        assert_eq!(untouched, existing_content);
    }

    #[test]
    fn test_rename_note_with_old_title_hint_updates_wikilinks() {
        // Simulates H1 sync: content already saved with new H1, but wikilinks still use old title.
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        // Note file already has the NEW H1 (simulating savePendingForPath before rename)
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\nIs A: Note\n---\n# Sprint Retrospective\n\nContent.\n",
        );
        create_test_file(
            vault,
            "note/other.md",
            "---\nIs A: Note\n---\n# Other\n\nSee [[Weekly Review]] for details.\n",
        );
        create_test_file(
            vault,
            "project/my-project.md",
            "---\nIs A: Project\nRelated to:\n  - \"[[Weekly Review]]\"\n---\n# My Project\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        // Without old_title_hint, rename_note would see H1 = "Sprint Retrospective" == new_title → noop
        // With old_title_hint = "Weekly Review", it knows to search for [[Weekly Review]] and replace
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
            Some("Weekly Review"),
        )
        .unwrap();

        assert_eq!(result.updated_files, 2);
        assert!(result.new_path.ends_with("sprint-retrospective.md"));
        assert!(!vault.join("note/weekly-review.md").exists());

        let other_content = fs::read_to_string(vault.join("note/other.md")).unwrap();
        assert!(other_content.contains("[[Sprint Retrospective]]"));
        assert!(!other_content.contains("[[Weekly Review]]"));

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[Sprint Retrospective]]"));
    }

    #[test]
    fn test_rename_note_without_hint_backward_compatible() {
        // Existing behavior: no hint, extracts title from H1
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/weekly-review.md",
            "---\nIs A: Note\n---\n# Weekly Review\n\nContent.\n",
        );
        create_test_file(
            vault,
            "note/other.md",
            "See [[Weekly Review]] for details.\n",
        );

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
            None,
        )
        .unwrap();

        assert_eq!(result.updated_files, 1);
        let other_content = fs::read_to_string(vault.join("note/other.md")).unwrap();
        assert!(other_content.contains("[[Sprint Retrospective]]"));
    }

    #[test]
    fn test_rename_note_hint_same_as_new_title_noop() {
        // If old_title_hint == new_title, should be a noop
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/my-note.md", "# My Note\n\nContent.\n");

        let old_path = vault.join("note/my-note.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "My Note",
            Some("My Note"),
        )
        .unwrap();

        assert_eq!(result.new_path, old_path.to_str().unwrap());
        assert_eq!(result.updated_files, 0);
    }

    #[test]
    fn test_move_note_empty_type_error() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/test.md", "# Test\n");

        let path = vault.join("note/test.md");
        let result = move_note_to_type_folder(vault.to_str().unwrap(), path.to_str().unwrap(), "");
        assert!(result.is_err());
    }

    #[test]
    fn test_move_note_nonexistent_file_error() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            vault.join("note/nope.md").to_str().unwrap(),
            "Quarter",
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_move_note_preserves_content() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let original = "---\ntype: Quarter\ntitle: My Note\n---\n# My Note\n\nImportant content.\n";
        create_test_file(vault, "note/my-note.md", original);

        let old_path = vault.join("note/my-note.md");
        let result = move_note_to_type_folder(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Quarter",
        )
        .unwrap();

        let content = fs::read_to_string(&result.new_path).unwrap();
        assert_eq!(content, original);
    }
}
