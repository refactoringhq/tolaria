use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

fn has_legacy_is_a(fm_content: &str) -> bool {
    fm_content.lines().any(|line| {
        let t = line.trim_start();
        t.starts_with("is_a:")
            || t.starts_with("\"Is A\":")
            || t.starts_with("'Is A':")
            || t.starts_with("Is A:")
    })
}

/// Extract the value from a legacy `is_a` / `Is A` line.
fn extract_is_a_value(line: &str) -> Option<&str> {
    let t = line.trim_start();
    for prefix in &["is_a:", "\"Is A\":", "'Is A':", "Is A:"] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let v = rest.trim();
            return Some(v);
        }
    }
    None
}

/// Migrate a single file's frontmatter from `is_a`/`Is A` to `type`.
/// Returns Ok(true) if the file was modified, Ok(false) if no migration needed.
fn migrate_file_is_a_to_type(path: &Path) -> Result<bool, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    if !content.starts_with("---\n") {
        return Ok(false);
    }
    let fm_end = match content[4..].find("\n---") {
        Some(i) => i + 4,
        None => return Ok(false),
    };
    let fm_content = &content[4..fm_end];

    if !has_legacy_is_a(fm_content) {
        return Ok(false);
    }

    // Check if `type:` already exists
    let has_type = fm_content.lines().any(|line| {
        let t = line.trim_start();
        t.starts_with("type:")
    });

    let mut new_lines: Vec<String> = Vec::new();
    let mut is_a_value: Option<String> = None;

    for line in fm_content.lines() {
        if let Some(val) = extract_is_a_value(line) {
            is_a_value = Some(val.to_string());
            // Skip list continuations after is_a
            continue;
        }
        new_lines.push(line.to_string());
    }

    // If type: doesn't exist and we found an is_a value, add type:
    if !has_type {
        if let Some(ref val) = is_a_value {
            // Insert type: at the beginning (after other keys is fine too, but beginning is clean)
            new_lines.insert(0, format!("type: {}", val));
        }
    }

    let rest = &content[fm_end + 4..];
    let new_content = format!("---\n{}\n---{}", new_lines.join("\n"), rest);

    fs::write(path, &new_content)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;

    Ok(true)
}

/// Migrate all markdown files in the vault from `is_a`/`Is A` to `type`.
/// Returns the number of files migrated.
pub fn migrate_is_a_to_type(vault_path: &str) -> Result<usize, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let mut migrated = 0;
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
            continue;
        }

        match migrate_file_is_a_to_type(path) {
            Ok(true) => {
                log::info!("Migrated is_a → type: {}", path.display());
                migrated += 1;
            }
            Ok(false) => {}
            Err(e) => {
                log::warn!("Failed to migrate {}: {}", path.display(), e);
            }
        }
    }

    Ok(migrated)
}

/// Folders that are NOT flattened — they contain assets, not notes.
const KEEP_FOLDERS: &[&str] = &["attachments", "assets"];

/// Determine a unique filename at `dest_dir`, appending -2, -3, etc. on collision.
fn unique_filename(dest_dir: &Path, filename: &str, taken: &HashSet<String>) -> String {
    if !dest_dir.join(filename).exists() && !taken.contains(filename) {
        return filename.to_string();
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
        let candidate = format!("{}-{}{}", stem, counter, ext);
        if !dest_dir.join(&candidate).exists() && !taken.contains(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

/// Flatten vault structure: move all notes from type-based subfolders to the vault root.
/// Skips `type/`, `config/`, `attachments/`, and `_themes/` folders.
/// Updates path-based wikilinks to title-based after moving.
/// Returns the number of files moved.
pub fn flatten_vault(vault_path: &str) -> Result<usize, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    // Collect all .md files in subfolders (not already at root, not in KEEP_FOLDERS)
    let mut to_move: Vec<(std::path::PathBuf, String)> = Vec::new();
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
            continue;
        }
        // Skip files already at vault root
        if path.parent() == Some(vault) {
            continue;
        }
        // Check if this file is inside a KEEP_FOLDER
        let rel = path.strip_prefix(vault).unwrap_or(path);
        let top_folder = rel
            .components()
            .next()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .unwrap_or_default();
        if KEEP_FOLDERS.iter().any(|&k| k == top_folder) {
            continue;
        }
        // Hidden folders (e.g. .laputa, .git)
        if top_folder.starts_with('.') {
            continue;
        }

        let filename = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_default();
        to_move.push((path.to_path_buf(), filename));
    }

    if to_move.is_empty() {
        return Ok(0);
    }

    // Build a map of old path → (new filename, old relative stem) for wikilink updates
    let mut taken: HashSet<String> = HashSet::new();
    // Pre-populate with files already at root
    if let Ok(entries) = fs::read_dir(vault) {
        for e in entries.flatten() {
            if e.path().is_file() {
                if let Some(name) = e.file_name().to_str() {
                    taken.insert(name.to_string());
                }
            }
        }
    }

    let vault_prefix = format!("{}/", vault.to_string_lossy());
    let mut moves: Vec<(std::path::PathBuf, std::path::PathBuf, String)> = Vec::new(); // (old, new, old_rel_stem)
    for (old_path, filename) in &to_move {
        let new_name = unique_filename(vault, filename, &taken);
        taken.insert(new_name.clone());
        let new_path = vault.join(&new_name);
        let old_rel = old_path
            .to_string_lossy()
            .strip_prefix(&vault_prefix)
            .unwrap_or(&old_path.to_string_lossy())
            .strip_suffix(".md")
            .unwrap_or(&old_path.to_string_lossy())
            .to_string();
        moves.push((old_path.clone(), new_path, old_rel));
    }

    // Move all files
    let mut moved = 0;
    for (old, new, _) in &moves {
        match fs::rename(old, new) {
            Ok(()) => moved += 1,
            Err(e) => log::warn!(
                "Failed to move {} → {}: {}",
                old.display(),
                new.display(),
                e
            ),
        }
    }

    // Update path-based wikilinks across the vault.
    // Replace [[folder/slug]] with [[slug]] (title-based).
    // Build a single regex matching any old path stem.
    let path_stems: Vec<&str> = moves.iter().map(|(_, _, stem)| stem.as_str()).collect();
    if !path_stems.is_empty() {
        let escaped: Vec<String> = path_stems.iter().map(|s| regex::escape(s)).collect();
        let pattern_str = format!(r"\[\[({})\]\]", escaped.join("|"));
        if let Ok(re) = Regex::new(&pattern_str) {
            // Collect all .md files in vault (now at root + keep folders)
            let all_md: Vec<std::path::PathBuf> = WalkDir::new(vault)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path().is_file() && e.path().extension().is_some_and(|ext| ext == "md")
                })
                .map(|e| e.into_path())
                .collect();

            for md_path in &all_md {
                let content = match fs::read_to_string(md_path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                if !re.is_match(&content) {
                    continue;
                }
                let replaced = re.replace_all(&content, |caps: &regex::Captures| {
                    let matched = caps.get(1).map(|m| m.as_str()).unwrap_or("");
                    // Extract just the filename stem (last segment)
                    let slug = matched.rsplit('/').next().unwrap_or(matched);
                    format!("[[{}]]", slug)
                });
                if replaced != content {
                    let _ = fs::write(md_path, replaced.as_ref());
                }
            }
        }
    }

    // Clean up empty directories (only type-folder directories, not KEEP_FOLDERS)
    for (old, _, _) in &moves {
        if let Some(parent) = old.parent() {
            if parent != vault {
                let _ = fs::remove_dir(parent); // only succeeds if empty
            }
        }
    }

    Ok(moved)
}

/// Result of a vault health check.
#[derive(Debug, Serialize, Default)]
pub struct VaultHealthReport {
    /// Files in non-protected subfolders (won't be scanned by scan_vault).
    pub stray_files: Vec<String>,
    /// Files whose filename doesn't match slugify(title).
    pub title_mismatches: Vec<TitleMismatch>,
}

/// A single filename-title mismatch.
#[derive(Debug, Serialize)]
pub struct TitleMismatch {
    pub path: String,
    pub filename: String,
    pub title: String,
    pub expected_filename: String,
}

/// Slugify a title to produce the expected filename stem.
fn slugify(text: &str) -> String {
    let result: String = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let trimmed = result.trim_matches('-').to_string();
    // Collapse consecutive dashes
    let mut prev_dash = false;
    let collapsed: String = trimmed
        .chars()
        .filter(|&c| {
            if c == '-' {
                if prev_dash {
                    return false;
                }
                prev_dash = true;
            } else {
                prev_dash = false;
            }
            true
        })
        .collect();
    if collapsed.is_empty() {
        "untitled".to_string()
    } else {
        collapsed
    }
}

/// Check vault health: detect stray files and filename-title mismatches.
pub fn vault_health_check(vault_path: &str) -> Result<VaultHealthReport, String> {
    let vault = Path::new(vault_path);
    if !vault.exists() || !vault.is_dir() {
        return Err(format!(
            "Vault path does not exist or is not a directory: {}",
            vault_path
        ));
    }

    let mut report = VaultHealthReport::default();

    // 1. Detect stray files in non-protected subfolders
    for entry in WalkDir::new(vault)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
            continue;
        }
        // Skip root files (they're fine)
        if path.parent() == Some(vault) {
            continue;
        }
        let rel = path.strip_prefix(vault).unwrap_or(path);
        let top_folder = rel
            .components()
            .next()
            .map(|c| c.as_os_str().to_string_lossy().to_string())
            .unwrap_or_default();
        if KEEP_FOLDERS.iter().any(|&k| k == top_folder) || top_folder.starts_with('.') {
            continue;
        }
        report.stray_files.push(rel.to_string_lossy().to_string());
    }

    // 2. Detect filename-title mismatches (root .md files only)
    if let Ok(dir_entries) = fs::read_dir(vault) {
        let matter = gray_matter::Matter::<gray_matter::engine::YAML>::new();
        for dir_entry in dir_entries.flatten() {
            let path = dir_entry.path();
            if !path.is_file() || path.extension().map(|ext| ext != "md").unwrap_or(true) {
                continue;
            }
            let filename = path
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let parsed = matter.parse(&content);
            let fm_title = parsed.data.as_ref().and_then(|pod| {
                if let gray_matter::Pod::Hash(ref map) = pod {
                    if let Some(gray_matter::Pod::String(s)) = map.get("title") {
                        return Some(s.as_str());
                    }
                }
                None
            });
            let title = super::parsing::extract_title(fm_title, &content, &filename);
            let expected_stem = slugify(&title);
            let expected_filename = format!("{}.md", expected_stem);
            let current_stem = filename.strip_suffix(".md").unwrap_or(&filename);
            if current_stem != expected_stem {
                report.title_mismatches.push(TitleMismatch {
                    path: path.to_string_lossy().to_string(),
                    filename: filename.clone(),
                    title,
                    expected_filename,
                });
            }
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn write_file(dir: &std::path::Path, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        fs::write(&path, content).unwrap();
        path
    }

    // --- has_legacy_is_a ---

    #[test]
    fn test_has_legacy_is_a_detects_is_a_colon() {
        assert!(has_legacy_is_a("is_a: Person\nname: Alice"));
    }

    #[test]
    fn test_has_legacy_is_a_detects_quoted_is_a() {
        assert!(has_legacy_is_a("\"Is A\": Note\nname: Test"));
    }

    #[test]
    fn test_has_legacy_is_a_detects_bare_is_a() {
        assert!(has_legacy_is_a("Is A: Topic\n"));
    }

    #[test]
    fn test_has_legacy_is_a_returns_false_for_clean_frontmatter() {
        assert!(!has_legacy_is_a("type: Person\nname: Alice"));
    }

    // --- extract_is_a_value ---

    #[test]
    fn test_extract_is_a_value_from_is_a_colon() {
        assert_eq!(extract_is_a_value("is_a: Person"), Some("Person"));
    }

    #[test]
    fn test_extract_is_a_value_from_quoted() {
        assert_eq!(extract_is_a_value("\"Is A\": Note"), Some("Note"));
    }

    #[test]
    fn test_extract_is_a_value_returns_none_for_unrelated_line() {
        assert_eq!(extract_is_a_value("name: Alice"), None);
    }

    // --- migrate_file_is_a_to_type ---

    #[test]
    fn test_migrate_file_adds_type_and_removes_is_a() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\nis_a: Person\nname: Alice\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(result, "file should be migrated");
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("type: Person"), "should have type field");
        assert!(!content.contains("is_a:"), "should not have is_a field");
    }

    #[test]
    fn test_migrate_file_skips_when_no_frontmatter() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "# Just a heading\nNo frontmatter here.\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result, "file without frontmatter should not be migrated");
    }

    #[test]
    fn test_migrate_file_skips_when_already_has_type() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\ntype: Person\nname: Alice\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result, "file already with type should not be migrated");
    }

    #[test]
    fn test_migrate_file_skips_when_no_is_a_field() {
        let tmp = tempdir().unwrap();
        let path = write_file(
            tmp.path(),
            "note.md",
            "---\nname: Alice\ndate: 2024-01-01\n---\n# Alice\n",
        );
        let result = migrate_file_is_a_to_type(&path).unwrap();
        assert!(!result);
    }

    // --- migrate_is_a_to_type (public function) ---

    #[test]
    fn test_migrate_vault_returns_count_of_migrated_files() {
        let tmp = tempdir().unwrap();
        write_file(
            tmp.path(),
            "note1.md",
            "---\nis_a: Person\nname: Alice\n---\n",
        );
        write_file(tmp.path(), "note2.md", "---\nis_a: Topic\nname: AI\n---\n");
        write_file(
            tmp.path(),
            "note3.md",
            "---\ntype: Event\nname: Conf\n---\n",
        );
        let count = migrate_is_a_to_type(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(count, 2, "should migrate exactly 2 files");
    }

    #[test]
    fn test_migrate_vault_returns_error_for_nonexistent_path() {
        let result = migrate_is_a_to_type("/tmp/this-path-does-not-exist-laputa-test");
        assert!(result.is_err());
    }

    #[test]
    fn test_migrate_vault_ignores_non_markdown_files() {
        let tmp = tempdir().unwrap();
        write_file(tmp.path(), "image.png", "not a markdown file");
        write_file(tmp.path(), "data.json", "{\"is_a\": \"test\"}");
        let count = migrate_is_a_to_type(tmp.path().to_str().unwrap()).unwrap();
        assert_eq!(count, 0, "non-markdown files should be ignored");
    }

    // --- flatten_vault ---

    fn write_nested_file(
        dir: &std::path::Path,
        rel_path: &str,
        content: &str,
    ) -> std::path::PathBuf {
        let path = dir.join(rel_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn test_flatten_vault_moves_notes_to_root() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_nested_file(vault, "note/hello.md", "---\ntype: Note\n---\n# Hello\n");
        write_nested_file(
            vault,
            "project/my-proj.md",
            "---\ntype: Project\n---\n# My Proj\n",
        );

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 2);
        assert!(vault.join("hello.md").exists());
        assert!(vault.join("my-proj.md").exists());
        assert!(!vault.join("note/hello.md").exists());
        assert!(!vault.join("project/my-proj.md").exists());
    }

    #[test]
    fn test_flatten_vault_skips_protected_folders() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_nested_file(vault, "attachments/image.md", "# Image note\n");
        write_nested_file(vault, "note/hello.md", "---\ntype: Note\n---\n# Hello\n");

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 1);
        assert!(vault.join("hello.md").exists());
        assert!(vault.join("attachments/image.md").exists());
    }

    #[test]
    fn test_flatten_vault_handles_filename_collision() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "hello.md", "---\ntype: Note\n---\n# Root Hello\n");
        write_nested_file(
            vault,
            "note/hello.md",
            "---\ntype: Note\n---\n# Note Hello\n",
        );

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 1);
        assert!(vault.join("hello.md").exists());
        assert!(vault.join("hello-2.md").exists());
        // Root file unchanged
        let root_content = fs::read_to_string(vault.join("hello.md")).unwrap();
        assert!(root_content.contains("Root Hello"));
        // Moved file gets suffixed name
        let moved_content = fs::read_to_string(vault.join("hello-2.md")).unwrap();
        assert!(moved_content.contains("Note Hello"));
    }

    #[test]
    fn test_flatten_vault_updates_path_wikilinks() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_nested_file(
            vault,
            "note/hello.md",
            "---\ntype: Note\n---\n# Hello\n\nSee [[project/my-proj]] for details.\n",
        );
        write_nested_file(
            vault,
            "project/my-proj.md",
            "---\ntype: Project\n---\n# My Proj\n",
        );

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 2);
        let content = fs::read_to_string(vault.join("hello.md")).unwrap();
        assert!(content.contains("[[my-proj]]"));
        assert!(!content.contains("[[project/my-proj]]"));
    }

    #[test]
    fn test_flatten_vault_noop_when_already_flat() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "hello.md", "---\ntype: Note\n---\n# Hello\n");
        write_file(vault, "world.md", "---\ntype: Note\n---\n# World\n");

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_flatten_vault_nested_subfolders() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_nested_file(vault, "note/sub/deep.md", "---\ntype: Note\n---\n# Deep\n");

        let count = flatten_vault(vault.to_str().unwrap()).unwrap();
        assert_eq!(count, 1);
        assert!(vault.join("deep.md").exists());
    }

    #[test]
    fn test_flatten_vault_cleans_empty_directories() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_nested_file(vault, "note/hello.md", "---\ntype: Note\n---\n# Hello\n");

        flatten_vault(vault.to_str().unwrap()).unwrap();
        assert!(
            !vault.join("note").exists(),
            "empty folder should be removed"
        );
    }

    // --- slugify ---

    #[test]
    fn test_slugify_basic() {
        assert_eq!(slugify("Hello World"), "hello-world");
    }

    #[test]
    fn test_slugify_special_chars() {
        assert_eq!(slugify("My Note (v2)!"), "my-note-v2");
        assert_eq!(slugify("Sprint Retrospective"), "sprint-retrospective");
    }

    #[test]
    fn test_slugify_empty() {
        assert_eq!(slugify(""), "untitled");
    }

    #[test]
    fn test_slugify_unicode() {
        assert_eq!(slugify("Café Résumé"), "caf-r-sum");
    }

    // --- vault_health_check ---

    #[test]
    fn test_health_check_detects_stray_files() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "root-note.md", "---\ntype: Note\n---\n# Root Note\n");
        write_file(vault, "project.md", "---\ntype: Type\n---\n# Project\n");
        write_nested_file(
            vault,
            "old-folder/stray.md",
            "---\ntype: Note\n---\n# Stray\n",
        );

        let report = vault_health_check(vault.to_str().unwrap()).unwrap();
        assert_eq!(report.stray_files.len(), 1);
        assert!(report.stray_files[0].contains("stray.md"));
    }

    #[test]
    fn test_health_check_no_stray_when_flat() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "my-note.md", "# My Note\n");
        write_file(vault, "project.md", "---\ntype: Type\n---\n# Project\n");

        let report = vault_health_check(vault.to_str().unwrap()).unwrap();
        assert!(report.stray_files.is_empty());
    }

    #[test]
    fn test_health_check_detects_title_mismatch() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        // Filename is "wrong-name.md" but title frontmatter says "My Actual Title"
        write_file(
            vault,
            "wrong-name.md",
            "---\ntitle: My Actual Title\ntype: Note\n---\n# My Actual Title\n",
        );

        let report = vault_health_check(vault.to_str().unwrap()).unwrap();
        assert_eq!(report.title_mismatches.len(), 1);
        assert_eq!(report.title_mismatches[0].filename, "wrong-name.md");
        assert_eq!(
            report.title_mismatches[0].expected_filename,
            "my-actual-title.md"
        );
    }

    #[test]
    fn test_health_check_no_mismatch_when_correct() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "my-note.md", "---\ntype: Note\n---\n# My Note\n");

        let report = vault_health_check(vault.to_str().unwrap()).unwrap();
        assert!(report.title_mismatches.is_empty());
    }

    #[test]
    fn test_health_check_skips_hidden_folders() {
        let tmp = tempdir().unwrap();
        let vault = tmp.path();
        write_file(vault, "root.md", "# Root\n");
        write_nested_file(vault, ".git/config.md", "# Git Config\n");
        write_nested_file(vault, ".laputa/cache.md", "# Cache\n");

        let report = vault_health_check(vault.to_str().unwrap()).unwrap();
        assert!(report.stray_files.is_empty());
    }
}
