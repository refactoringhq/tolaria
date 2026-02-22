use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

use crate::frontmatter::{update_frontmatter_content, FrontmatterValue};
use super::parse::extract_title;

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

    let result: Vec<String> = content.lines().map(|l| {
        if l.trim().starts_with("# ") { format!("# {}", new_title) } else { l.to_string() }
    }).collect();

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
    path.is_file()
        && path != exclude
        && path.extension().is_some_and(|ext| ext == "md")
}

/// Replace wikilink references in a single file's content. Returns updated content if changed.
fn replace_wikilinks_in_content(content: &str, re: &Regex, new_title: &str) -> Option<String> {
    if !re.is_match(content) {
        return None;
    }
    let replaced = re.replace_all(content, |caps: &regex::Captures| {
        match caps.get(1) {
            Some(pipe) => format!("[[{}{}]]", new_title, pipe.as_str()),
            None => format!("[[{}]]", new_title),
        }
    });
    if replaced != content { Some(replaced.into_owned()) } else { None }
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
    files.iter().filter(|path| {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => return false,
        };
        match replace_wikilinks_in_content(&content, &re, params.new_title) {
            Some(new_content) => fs::write(path, &new_content).is_ok(),
            None => false,
        }
    }).count()
}

/// Check if frontmatter contains a `title:` key.
fn frontmatter_has_title_key(content: &str) -> bool {
    if !content.starts_with("---\n") {
        return false;
    }
    content[4..].split("\n---").next()
        .map(|fm| fm.lines().any(|l| {
            let t = l.trim_start();
            t.starts_with("title:") || t.starts_with("\"title\":")
        }))
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

/// Strip vault prefix and .md suffix to get the relative path stem.
fn to_path_stem<'a>(abs_path: &'a str, vault_prefix: &str) -> &'a str {
    abs_path
        .strip_prefix(vault_prefix)
        .unwrap_or(abs_path)
        .strip_suffix(".md")
        .unwrap_or(abs_path)
}

/// Rename a note: update its title, rename the file, and update wiki links across the vault.
pub fn rename_note(vault_path: &str, old_path: &str, new_title: &str) -> Result<RenameResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(old_path);

    if !old_file.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }
    let new_title = new_title.trim();
    if new_title.is_empty() {
        return Err("New title cannot be empty".to_string());
    }

    let content = fs::read_to_string(old_file)
        .map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let old_filename = old_file.file_name()
        .map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
    let old_title = extract_title(&content, &old_filename);

    if old_title == new_title {
        return Ok(RenameResult { new_path: old_path.to_string(), updated_files: 0 });
    }

    let updated_content = update_note_title_in_content(&content, new_title);

    let parent_dir = old_file.parent().ok_or("Cannot determine parent directory")?;
    let new_file = parent_dir.join(format!("{}.md", title_to_slug(new_title)));
    let new_path_str = new_file.to_string_lossy().to_string();

    fs::write(&new_file, &updated_content)
        .map_err(|e| format!("Failed to write {}: {}", new_path_str, e))?;
    if old_file != new_file {
        fs::remove_file(old_file)
            .map_err(|e| format!("Failed to remove old file {}: {}", old_path, e))?;
    }

    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let updated_files = update_wikilinks_in_vault(&WikilinkReplacement {
        vault_path: vault, old_title: &old_title, new_title, old_path_stem, exclude_path: &new_file,
    });

    Ok(RenameResult { new_path: new_path_str, updated_files })
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
        create_test_file(vault, "note/weekly-review.md", "---\nIs A: Note\n---\n# Weekly Review\n\nContent here.\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
        ).unwrap();

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
        create_test_file(vault, "note/weekly-review.md", "---\nIs A: Note\n---\n# Weekly Review\n\nContent.\n");
        create_test_file(vault, "note/other.md", "---\nIs A: Note\n---\n# Other\n\nSee [[Weekly Review]] for details.\n");
        create_test_file(vault, "project/my-project.md", "---\nIs A: Project\nRelated to:\n  - \"[[Weekly Review]]\"\n---\n# My Project\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retrospective",
        ).unwrap();

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
        ).unwrap();

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
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_rename_note_preserves_pipe_alias_in_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/weekly-review.md", "# Weekly Review\n");
        create_test_file(vault, "note/ref.md", "# Ref\n\nSee [[Weekly Review|my review]] for info.\n");

        let old_path = vault.join("note/weekly-review.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "Sprint Retro",
        ).unwrap();

        assert_eq!(result.updated_files, 1);
        let ref_content = fs::read_to_string(vault.join("note/ref.md")).unwrap();
        assert!(ref_content.contains("[[Sprint Retro|my review]]"));
    }

    #[test]
    fn test_rename_note_updates_title_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/old.md", "---\ntitle: Old Name\nIs A: Note\n---\n# Old Name\n");

        let old_path = vault.join("note/old.md");
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "New Name",
        ).unwrap();

        let content = fs::read_to_string(&result.new_path).unwrap();
        assert!(content.contains("title: New Name"));
        assert!(content.contains("# New Name"));
    }
}
