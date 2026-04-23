use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use tempfile::NamedTempFile;
use walkdir::WalkDir;

use super::rename_transaction::RenameWorkspace;
use crate::frontmatter::{update_frontmatter_content, FrontmatterValue};

/// Result of a rename operation
#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResult {
    /// New absolute file path after rename
    pub new_path: String,
    /// Number of other files updated (wiki link replacements)
    pub updated_files: usize,
    /// Number of linked-note rewrites that failed and need manual attention
    pub failed_updates: usize,
}

#[derive(Debug, Default)]
struct WikilinkUpdateSummary {
    updated_files: usize,
    failed_updates: usize,
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

/// Build a regex that matches wiki links referencing any of the provided targets.
fn build_wikilink_pattern(targets: &[&str]) -> Option<Regex> {
    let escaped_targets: Vec<String> = targets
        .iter()
        .filter(|target| !target.is_empty())
        .map(|target| regex::escape(target))
        .collect();
    if escaped_targets.is_empty() {
        return None;
    }
    let pattern_str = format!(r"\[\[(?:{})(\|[^\]]*?)?\]\]", escaped_targets.join("|"));
    Regex::new(&pattern_str).ok()
}

/// Check if a path is a vault markdown file eligible for wikilink replacement.
fn is_replaceable_md_file(path: &Path, exclude: &Path) -> bool {
    path.is_file() && path != exclude && path.extension().is_some_and(|ext| ext == "md")
}

/// Replace wikilink references in a single file's content. Returns updated content if changed.
fn replace_wikilinks_in_content(content: &str, re: &Regex, new_target: &str) -> Option<String> {
    if !re.is_match(content) {
        return None;
    }
    let replaced = re.replace_all(content, |caps: &regex::Captures| match caps.get(1) {
        Some(pipe) => format!("[[{}{}]]", new_target, pipe.as_str()),
        None => format!("[[{}]]", new_target),
    });
    if replaced != content {
        Some(replaced.into_owned())
    } else {
        None
    }
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

fn unique_wikilink_targets(targets: Vec<&str>) -> Vec<&str> {
    let mut seen = HashSet::new();
    targets
        .into_iter()
        .filter(|target| !target.is_empty())
        .filter(|target| seen.insert(*target))
        .collect()
}

fn collect_legacy_wikilink_targets<'a>(old_title: &'a str, old_path_stem: &'a str) -> Vec<&'a str> {
    let old_filename_stem = old_path_stem.rsplit('/').next().unwrap_or(old_path_stem);
    unique_wikilink_targets(vec![old_title, old_path_stem, old_filename_stem])
}

/// Replace wiki link references across all vault markdown files.
fn update_wikilinks_in_vault(
    vault_path: &Path,
    old_targets: &[&str],
    new_target: &str,
    exclude_path: &Path,
) -> WikilinkUpdateSummary {
    let re = match build_wikilink_pattern(old_targets) {
        Some(r) => r,
        None => return WikilinkUpdateSummary::default(),
    };
    replace_wikilinks_in_files(collect_md_files(vault_path, exclude_path), &re, new_target)
}

fn replace_wikilinks_in_files(
    files: Vec<std::path::PathBuf>,
    re: &Regex,
    replacement: &str,
) -> WikilinkUpdateSummary {
    let mut summary = WikilinkUpdateSummary::default();
    for path in files.iter() {
        match rewrite_wikilinks_in_file(path, re, replacement) {
            Ok(true) => summary.updated_files += 1,
            Ok(false) => {}
            Err(_) => summary.failed_updates += 1,
        }
    }
    summary
}

fn rewrite_wikilinks_in_file(path: &Path, re: &Regex, replacement: &str) -> Result<bool, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let Some(new_content) = replace_wikilinks_in_content(&content, re, replacement) else {
        return Ok(false);
    };

    fs::write(path, &new_content)
        .map(|_| true)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

/// Extract the value of the `title:` frontmatter field from raw content.
fn extract_fm_title_value(content: &str) -> Option<String> {
    if !content.starts_with("---\n") {
        return None;
    }
    let fm = content[4..].split("\n---").next()?;
    fm.lines()
        .map(str::trim_start)
        .find_map(extract_title_value_from_frontmatter_line)
}

fn extract_title_value_from_frontmatter_line(line: &str) -> Option<String> {
    ["title:", "\"title\":"]
        .iter()
        .find_map(|prefix| line.strip_prefix(prefix))
        .map(str::trim)
        .map(|value| value.trim_matches('"').trim_matches('\''))
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
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

pub(crate) fn recover_pending_rename_transactions(vault: &Path) -> Result<(), String> {
    super::rename_transaction::recover_pending_rename_transactions(vault)
}

fn persist_staged_note(staged: NamedTempFile, target_path: &Path) -> Result<(), String> {
    staged
        .persist(target_path)
        .map(|_| ())
        .map_err(|e| format!("Failed to replace {}: {}", target_path.display(), e.error))
}

fn finalize_rename(vault: &Path, old_targets: &[&str], new_file: &Path) -> RenameResult {
    let new_path = new_file.to_string_lossy().to_string();
    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let new_path_stem = to_path_stem(&new_path, &vault_prefix).to_string();
    let summary = update_wikilinks_in_vault(vault, old_targets, &new_path_stem, new_file);
    RenameResult {
        new_path,
        updated_files: summary.updated_files,
        failed_updates: summary.failed_updates,
    }
}

fn normalize_filename_stem(new_filename_stem: &str) -> Result<String, String> {
    let trimmed = new_filename_stem.trim();
    let stem = trimmed.strip_suffix(".md").unwrap_or(trimmed).trim();
    if stem.is_empty() {
        return Err("New filename cannot be empty".to_string());
    }
    if is_invalid_filename_stem(stem) {
        return Err("Invalid filename".to_string());
    }
    Ok(stem.to_string())
}

fn is_invalid_filename_stem(stem: &str) -> bool {
    stem == "." || stem == ".." || stem.contains('/') || stem.contains('\\')
}

struct LoadedNote {
    content: String,
    filename: String,
    title: String,
}

fn unchanged_result(path: &str) -> RenameResult {
    RenameResult {
        new_path: path.to_string(),
        updated_files: 0,
        failed_updates: 0,
    }
}

fn validate_new_title(new_title: &str) -> Result<&str, String> {
    let trimmed = new_title.trim();
    if trimmed.is_empty() {
        return Err("New title cannot be empty".to_string());
    }
    Ok(trimmed)
}

fn ensure_existing_note(old_file: &Path, old_path: &str) -> Result<(), String> {
    if old_file.exists() {
        return Ok(());
    }
    Err(format!("File does not exist: {}", old_path))
}

fn load_note_for_title_rename(
    old_file: &Path,
    old_path: &str,
    old_title_hint: Option<&str>,
) -> Result<LoadedNote, String> {
    let content =
        fs::read_to_string(old_file).map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let fm_title = extract_fm_title_value(&content);
    let extracted_title = super::extract_title(fm_title.as_deref(), &content, &filename);

    Ok(LoadedNote {
        content,
        filename,
        title: old_title_hint.unwrap_or(&extracted_title).to_string(),
    })
}

fn persist_title_only_update(
    workspace: &RenameWorkspace,
    old_file: &Path,
    updated_content: &str,
    old_path: &str,
) -> Result<RenameResult, String> {
    persist_staged_note(workspace.stage_note_content(updated_content)?, old_file)?;
    Ok(unchanged_result(old_path))
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

    recover_pending_rename_transactions(vault)?;
    ensure_existing_note(old_file, old_path)?;
    let new_title = validate_new_title(new_title)?;
    let loaded = load_note_for_title_rename(old_file, old_path, old_title_hint)?;

    // Check both title and filename: even if the title in content matches,
    // the filename may still be stale (e.g. "untitled-note.md" after user changed H1).
    let expected_filename = format!("{}.md", title_to_slug(new_title));
    let title_unchanged = loaded.title == new_title;
    let filename_matches = loaded.filename == expected_filename;

    if title_unchanged && filename_matches {
        return Ok(unchanged_result(old_path));
    }

    // Update content only if the title actually changed
    let updated_content = if title_unchanged {
        loaded.content.clone()
    } else {
        update_note_title_in_content(&loaded.content, new_title)
    };
    let workspace = RenameWorkspace::new(vault)?;

    if filename_matches {
        return persist_title_only_update(&workspace, old_file, &updated_content, old_path);
    }

    let parent_dir = old_file
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let committed = workspace
        .operation(old_path, old_file)
        .rename_with_candidates(
            workspace.stage_note_content(&updated_content)?,
            &expected_filename,
            parent_dir,
        )?;
    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let old_targets = collect_legacy_wikilink_targets(&loaded.title, old_path_stem);
    Ok(finalize_rename(vault, &old_targets, committed.new_file()))
}

/// Rename only the file path stem while preserving title/frontmatter content.
pub fn rename_note_filename(
    vault_path: &str,
    old_path: &str,
    new_filename_stem: &str,
) -> Result<RenameResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(old_path);

    recover_pending_rename_transactions(vault)?;

    if !old_file.exists() {
        return Err(format!("File does not exist: {}", old_path));
    }

    let normalized_stem = normalize_filename_stem(new_filename_stem)?;
    let old_filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let content =
        fs::read_to_string(old_file).map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let fm_title = extract_fm_title_value(&content);
    let old_title = super::extract_title(fm_title.as_deref(), &content, &old_filename);
    let new_filename = format!("{}.md", normalized_stem);

    if old_filename == new_filename {
        return Ok(unchanged_result(old_path));
    }

    let parent_dir = old_file
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let new_file = parent_dir.join(&new_filename);
    let workspace = RenameWorkspace::new(vault)?;
    let committed = workspace
        .operation(old_path, old_file)
        .rename_exact(workspace.stage_note_content(&content)?, &new_file)?;

    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let old_targets = collect_legacy_wikilink_targets(&old_title, old_path_stem);
    Ok(finalize_rename(vault, &old_targets, committed.new_file()))
}

/// Move a note into a different folder while preserving its filename and content.
pub fn move_note_to_folder(
    vault_path: &str,
    old_path: &str,
    destination_folder_path: &str,
) -> Result<RenameResult, String> {
    let vault = Path::new(vault_path);
    let old_file = Path::new(old_path);
    let destination_dir = Path::new(destination_folder_path);

    recover_pending_rename_transactions(vault)?;
    ensure_existing_note(old_file, old_path)?;

    if !destination_dir.exists() {
        return Err(format!(
            "Folder does not exist: {}",
            destination_folder_path
        ));
    }
    if !destination_dir.is_dir() {
        return Err(format!(
            "Folder is not a directory: {}",
            destination_folder_path
        ));
    }

    let old_filename = old_file
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let content =
        fs::read_to_string(old_file).map_err(|e| format!("Failed to read {}: {}", old_path, e))?;
    let fm_title = extract_fm_title_value(&content);
    let old_title = super::extract_title(fm_title.as_deref(), &content, &old_filename);
    let new_file = destination_dir.join(&old_filename);

    if new_file == old_file {
        return Ok(unchanged_result(old_path));
    }

    let workspace = RenameWorkspace::new(vault)?;
    let committed = workspace
        .operation(old_path, old_file)
        .rename_exact(workspace.stage_note_content(&content)?, &new_file)?;

    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let old_path_stem = to_path_stem(old_path, &vault_prefix);
    let old_targets = collect_legacy_wikilink_targets(&old_title, old_path_stem);
    Ok(finalize_rename(vault, &old_targets, committed.new_file()))
}

/// Check if a filename matches the untitled pattern (e.g. "untitled-note-1234567890.md").
fn is_untitled_filename(filename: &str) -> bool {
    let stem = filename.strip_suffix(".md").unwrap_or(filename);
    // Match: untitled-note-{digits} or untitled-{type}-{digits}
    stem.starts_with("untitled-")
        && stem
            .rsplit('-')
            .next()
            .is_some_and(|s| s.chars().all(|c| c.is_ascii_digit()))
}

/// Auto-rename an untitled note based on its H1 heading.
/// Returns `Some(RenameResult)` if renamed, `None` if conditions not met.
/// This is a ONE-SHOT rename: only fires for untitled-* files with an H1.
pub fn auto_rename_untitled(
    vault_path: &str,
    note_path: &str,
) -> Result<Option<RenameResult>, String> {
    let path = Path::new(note_path);
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    if !is_untitled_filename(&filename) {
        return Ok(None);
    }

    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", note_path, e))?;

    let h1_title = match super::parsing::extract_h1_title(&content) {
        Some(t) => t,
        None => return Ok(None),
    };

    let result = rename_note(vault_path, note_path, &h1_title, None)?;
    Ok(Some(result))
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
        // Build title from filename stem (kebab-case → Title Case)
        let old_title = super::parsing::slug_to_title(old_filename_stem);
        // The new file is the exclude target (don't rewrite wikilinks inside the renamed file itself)
        let new_file = vault.join(&rename.new_path);
        let old_targets = collect_legacy_wikilink_targets(&old_title, old_stem);
        let summary = update_wikilinks_in_vault(vault, &old_targets, new_stem, &new_file);
        total_updated += summary.updated_files;
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

    struct RenameTestRequest<'a> {
        path: &'a str,
        content: &'a str,
        new_title: &'a str,
        old_title_hint: Option<&'a str>,
    }

    fn rename_test_note_file(
        vault: &Path,
        request: RenameTestRequest<'_>,
    ) -> (std::path::PathBuf, RenameResult) {
        create_test_file(vault, request.path, request.content);
        let old_path = vault.join(request.path);
        let result = rename_note(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            request.new_title,
            request.old_title_hint,
        )
        .unwrap();
        (old_path, result)
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
        assert!(other_content.contains("[[note/sprint-retrospective]]"));
        assert!(!other_content.contains("[[Weekly Review]]"));

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[note/sprint-retrospective]]"));
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
    fn test_rename_note_noop_variants() {
        for old_title_hint in [None, Some("My Note")] {
            let dir = TempDir::new().unwrap();
            let vault = dir.path();
            let (old_path, result) = rename_test_note_file(
                vault,
                RenameTestRequest {
                    path: "note/my-note.md",
                    content: "# My Note\n\nContent.\n",
                    new_title: "My Note",
                    old_title_hint,
                },
            );

            assert_eq!(result.new_path, old_path.to_str().unwrap());
            assert_eq!(result.updated_files, 0);
            assert_eq!(result.failed_updates, 0);
        }
    }

    #[test]
    fn test_rename_note_updates_legacy_wikilink_targets() {
        struct WikilinkRewriteCase<'a> {
            ref_content: &'a str,
            note_content: &'a str,
            new_title: &'a str,
            expected_link: &'a str,
            removed_link: Option<&'a str>,
        }

        let cases = [
            WikilinkRewriteCase {
                ref_content: "# Ref\n\nSee [[Weekly Review|my review]] for info.\n",
                note_content: "# Weekly Review\n",
                new_title: "Sprint Retro",
                expected_link: "[[note/sprint-retro|my review]]",
                removed_link: None,
            },
            WikilinkRewriteCase {
                ref_content: "# Ref\n\nSee [[weekly-review]] for info.\n",
                note_content: "# Weekly Review\n",
                new_title: "Sprint Retro",
                expected_link: "[[note/sprint-retro]]",
                removed_link: Some("[[weekly-review]]"),
            },
            WikilinkRewriteCase {
                ref_content: "See [[Weekly Review]] for details.\n",
                note_content: "---\nIs A: Note\n---\n# Weekly Review\n\nContent.\n",
                new_title: "Sprint Retrospective",
                expected_link: "[[note/sprint-retrospective]]",
                removed_link: Some("[[Weekly Review]]"),
            },
        ];

        for case in cases {
            let dir = TempDir::new().unwrap();
            let vault = dir.path();
            create_test_file(vault, "note/ref.md", case.ref_content);
            let (_old_path, result) = rename_test_note_file(
                vault,
                RenameTestRequest {
                    path: "note/weekly-review.md",
                    content: case.note_content,
                    new_title: case.new_title,
                    old_title_hint: None,
                },
            );

            assert_eq!(result.updated_files, 1);
            let ref_content = fs::read_to_string(vault.join("note/ref.md")).unwrap();
            assert!(ref_content.contains(case.expected_link));
            if let Some(removed_link) = case.removed_link {
                assert!(!ref_content.contains(removed_link));
            }
        }
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
    fn test_rename_note_filename_preserves_title_and_updates_path_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "note/project-kickoff.md",
            "---\ntitle: Project Kickoff\ntype: Note\n---\n\n# Project Kickoff\n\nBody.\n",
        );
        create_test_file(
            vault,
            "note/ref.md",
            "# Ref\n\nSee [[note/project-kickoff]] and [[Project Kickoff]].\n",
        );

        let old_path = vault.join("note/project-kickoff.md");
        let result = rename_note_filename(
            vault.to_str().unwrap(),
            old_path.to_str().unwrap(),
            "manual-name",
        )
        .unwrap();

        assert!(result.new_path.ends_with("manual-name.md"));
        assert!(!old_path.exists());

        let renamed = fs::read_to_string(&result.new_path).unwrap();
        assert!(renamed.contains("title: Project Kickoff"));
        assert!(renamed.contains("# Project Kickoff"));

        let ref_content = fs::read_to_string(vault.join("note/ref.md")).unwrap();
        assert!(ref_content.contains("[[note/manual-name]]"));
        assert!(!ref_content.contains("[[Project Kickoff]]"));
        assert!(!ref_content.contains("[[note/project-kickoff]]"));
    }

    #[test]
    fn test_rename_note_filename_rejects_existing_destination() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/current.md", "# Current\n");
        create_test_file(vault, "note/manual-name.md", "# Existing\n");

        let result = rename_note_filename(
            vault.to_str().unwrap(),
            vault.join("note/current.md").to_str().unwrap(),
            "manual-name",
        );

        assert_eq!(result.unwrap_err(), "A note with that name already exists");
    }

    #[test]
    fn test_move_note_to_folder_preserves_filename_and_updates_wikilinks() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(
            vault,
            "projects/weekly-review.md",
            "---\ntitle: Weekly Review\n---\n# Weekly Review\nBody\n",
        );
        create_test_file(
            vault,
            "areas/linked.md",
            "Reference [[projects/weekly-review]]\n",
        );

        let result = move_note_to_folder(
            vault.to_str().unwrap(),
            vault.join("projects/weekly-review.md").to_str().unwrap(),
            vault.join("areas").to_str().unwrap(),
        )
        .expect("move should succeed");

        assert!(result.new_path.ends_with("areas/weekly-review.md"));
        assert!(!vault.join("projects/weekly-review.md").exists());
        assert!(vault.join("areas/weekly-review.md").exists());
        assert_eq!(
            fs::read_to_string(vault.join("areas/linked.md")).unwrap(),
            "Reference [[areas/weekly-review]]\n"
        );
    }

    #[test]
    fn test_move_note_to_folder_noop_when_destination_matches_current_parent() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "projects/weekly-review.md", "# Weekly Review\n");

        let source = vault.join("projects/weekly-review.md");
        let result = move_note_to_folder(
            vault.to_str().unwrap(),
            source.to_str().unwrap(),
            vault.join("projects").to_str().unwrap(),
        )
        .expect("move should noop");

        assert_eq!(result.new_path, source.to_string_lossy());
        assert!(source.exists());
        assert_eq!(result.updated_files, 0);
    }

    #[test]
    fn test_move_note_to_folder_rejects_existing_destination() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "projects/weekly-review.md", "# Weekly Review\n");
        create_test_file(vault, "areas/weekly-review.md", "# Existing\n");

        let result = move_note_to_folder(
            vault.to_str().unwrap(),
            vault.join("projects/weekly-review.md").to_str().unwrap(),
            vault.join("areas").to_str().unwrap(),
        );

        assert_eq!(result.unwrap_err(), "A note with that name already exists");
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
        assert!(other_content.contains("[[note/sprint-retrospective]]"));
        assert!(!other_content.contains("[[Weekly Review]]"));

        let project_content = fs::read_to_string(vault.join("project/my-project.md")).unwrap();
        assert!(project_content.contains("[[note/sprint-retrospective]]"));
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
    fn test_replace_wikilinks_in_files_reports_failed_updates() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        create_test_file(vault, "note/ref.md", "See [[Old Note]] for details.\n");

        let pattern = build_wikilink_pattern(&["Old Note"]).unwrap();
        let summary = replace_wikilinks_in_files(
            vec![vault.join("note/ref.md"), vault.join("note/missing.md")],
            &pattern,
            "note/new-note",
        );

        assert_eq!(summary.updated_files, 1);
        assert_eq!(summary.failed_updates, 1);
    }

    #[test]
    fn test_recover_pending_rename_transactions_restores_backup_when_new_file_is_missing() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        let old_path = vault.join("note/original.md");
        let new_path = vault.join("note/renamed.md");

        create_test_file(vault, "note/original.md", "# Original\n");

        let txn_dir = vault.join(".tolaria-rename-txn");
        fs::create_dir_all(&txn_dir).unwrap();

        let backup_path = txn_dir.join("rename-backup.bak");
        let manifest_path = txn_dir.join("rename-transaction.json");
        fs::rename(&old_path, &backup_path).unwrap();
        fs::write(
            &manifest_path,
            serde_json::json!({
                "old_path": old_path.to_string_lossy().to_string(),
                "new_path": new_path.to_string_lossy().to_string(),
                "backup_path": backup_path.to_string_lossy().to_string(),
            })
            .to_string(),
        )
        .unwrap();

        recover_pending_rename_transactions(vault).unwrap();

        assert!(old_path.exists());
        assert!(!new_path.exists());
        assert!(!backup_path.exists());
        assert!(!manifest_path.exists());
    }
}
