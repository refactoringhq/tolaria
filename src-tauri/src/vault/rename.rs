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
pub(super) fn title_to_slug(title: &str) -> String {
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

/// Extract the value of the `title:` frontmatter field from raw content.
fn extract_fm_title_value(content: &str) -> Option<String> {
    if !content.starts_with("---\n") {
        return None;
    }
    let fm = content[4..].split("\n---").next()?;
    for line in fm.lines() {
        let t = line.trim_start();
        for prefix in &["title:", "\"title\":"] {
            if let Some(rest) = t.strip_prefix(prefix) {
                let val = rest.trim().trim_matches('"').trim_matches('\'');
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

/// Update the `title:` frontmatter field in content.
/// Always writes `title` to frontmatter (creates it if absent).
/// H1 headings are body content and are NOT modified — the title source
/// of truth is frontmatter `title:` → filename, never H1.
fn update_note_title_in_content(content: &str, new_title: &str) -> String {
    let value = FrontmatterValue::String(new_title.to_string());
    match update_frontmatter_content(content, "title", Some(value)) {
        Ok(c) => c,
        Err(_) => content.to_string(),
    }
}

/// Strip vault prefix and .md suffix to get the relative path stem (e.g., "project/weekly-review").
fn to_path_stem<'a>(abs_path: &'a str, vault_prefix: &str) -> &'a str {
    abs_path
        .strip_prefix(vault_prefix)
        .unwrap_or(abs_path)
        .strip_suffix(".md")
        .unwrap_or(abs_path)
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

/// Rename a note: update its frontmatter title, rename the file, and update wiki links across the vault.
///
/// When `old_title_hint` is provided it is used instead of extracting the title from
/// the file's frontmatter/filename.  This is needed when the caller has already saved
/// updated content to disk before triggering the rename.
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
    let fm_title = extract_fm_title_value(&content);
    let extracted_title = super::extract_title(fm_title.as_deref(), &content, &old_filename);
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

/// A detected rename: old path → new path (both relative to vault root).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectedRename {
    pub old_path: String,
    pub new_path: String,
}

/// Detect renamed files by comparing working tree against HEAD using git diff.
pub fn detect_renames(vault_path: &str) -> Result<Vec<DetectedRename>, String> {
    let vault = Path::new(vault_path);
    let output = std::process::Command::new("git")
        .args(["diff", "HEAD", "--name-status", "--diff-filter=R", "-M"])
        .current_dir(vault)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]); // No HEAD yet or other git issue — no renames
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let renames: Vec<DetectedRename> = stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 && parts[0].starts_with('R') {
                let old = parts[1].to_string();
                let new = parts[2].to_string();
                if old.ends_with(".md") && new.ends_with(".md") {
                    return Some(DetectedRename {
                        old_path: old,
                        new_path: new,
                    });
                }
            }
            None
        })
        .collect();

    Ok(renames)
}

/// Update wikilinks across the vault for a list of detected renames.
/// Returns the total number of files updated.
pub fn update_wikilinks_for_renames(
    vault_path: &str,
    renames: &[DetectedRename],
) -> Result<usize, String> {
    let vault = Path::new(vault_path);
    let mut total_updated = 0;

    for rename in renames {
        let old_stem = rename
            .old_path
            .strip_suffix(".md")
            .unwrap_or(&rename.old_path);
        let new_stem = rename
            .new_path
            .strip_suffix(".md")
            .unwrap_or(&rename.new_path);
        let old_filename_stem = old_stem.split('/').next_back().unwrap_or(old_stem);
        let new_filename_stem = new_stem.split('/').next_back().unwrap_or(new_stem);

        // Build title from filename stem (kebab-case → Title Case)
        let old_title = super::parsing::slug_to_title(old_filename_stem);
        let new_title = super::parsing::slug_to_title(new_filename_stem);

        // The new file is the exclude target (don't rewrite wikilinks inside the renamed file itself)
        let new_file = vault.join(&rename.new_path);

        let updated = update_wikilinks_in_vault(&WikilinkReplacement {
            vault_path: vault,
            old_title: &old_title,
            new_title: &new_title,
            old_path_stem: old_filename_stem,
            exclude_path: &new_file,
        });
        total_updated += updated;
    }

    Ok(total_updated)
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
        // H1 is body content — rename must NOT modify it
        assert!(new_content.contains("# Weekly Review"));
        assert!(new_content.contains("title: Sprint Retrospective"));
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
        // H1 is body content — rename must NOT modify it
        assert!(content.contains("# Old Name"));
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
        // H1 is body content — rename must NOT modify it
        assert!(content.contains("# Old Heading"));
        assert!(content.contains("title: New Heading"));
    }

    #[test]
    fn test_rename_note_frontmatter_and_h1_no_body() {
        let content = rename_test_note(
            "note/full-empty.md",
            "---\ntitle: My Note\ntype: Note\nstatus: Active\n---\n\n# My Note\n\n",
            "Renamed Note",
        );
        assert!(content.contains("title: Renamed Note"));
        // H1 is body content — rename must NOT modify it
        assert!(content.contains("# My Note"));
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
    fn test_rename_note_does_not_modify_h1() {
        // H1 is body content — rename should only update frontmatter title, not H1
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/old.md",
            "---\ntitle: Old Title\ntype: Note\n---\n\n# Old Title\n\nSome body text.\n",
        );

        let old_path = vault.join("note/old.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Brand New Title",
            None,
        )
        .unwrap();

        let content = fs::read_to_string(&result.new_path).unwrap();
        assert!(
            content.contains("title: Brand New Title"),
            "frontmatter title should be updated"
        );
        assert!(
            content.contains("# Old Title"),
            "H1 must NOT be modified by rename"
        );
        assert!(
            !content.contains("# Brand New Title"),
            "H1 must NOT match new title"
        );
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
}
