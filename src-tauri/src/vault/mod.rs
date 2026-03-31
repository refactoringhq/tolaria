mod cache;
mod config_seed;
mod entry;
mod file;
mod frontmatter;
mod getting_started;
mod image;
mod migration;
mod parsing;
mod rename;
mod title_sync;
mod trash;

pub use cache::{invalidate_cache, scan_vault_cached};
pub use config_seed::{migrate_agents_md, repair_config_files, seed_config_files};
pub use entry::{FolderNode, VaultEntry};
pub use file::{get_note_content, save_note_content};
pub use getting_started::{create_getting_started_vault, default_vault_path, vault_exists};
pub use image::{copy_image_to_vault, save_image};
pub use migration::{flatten_vault, migrate_is_a_to_type, vault_health_check, VaultHealthReport};
pub use rename::{
    detect_renames, rename_note, update_wikilinks_for_renames, DetectedRename, RenameResult,
};
pub use title_sync::{sync_title_on_open, SyncAction};
pub use trash::{batch_delete_notes, delete_note, empty_trash, is_file_trashed, purge_trash};

use file::read_file_metadata;
use frontmatter::{extract_fm_and_rels, resolve_is_a};
use parsing::{count_body_words, extract_outgoing_links, extract_snippet, extract_title};

use gray_matter::engine::YAML;
use gray_matter::Matter;
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Parse a single markdown file into a VaultEntry.
pub fn parse_md_file(path: &Path) -> Result<VaultEntry, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let (frontmatter, mut relationships, properties) = extract_fm_and_rels(parsed.data);

    let title = extract_title(frontmatter.title.as_deref(), &content, &filename);
    let snippet = extract_snippet(&content);
    let word_count = count_body_words(&content);
    let outgoing_links = extract_outgoing_links(&parsed.content);
    let (modified_at, created_at, file_size) = read_file_metadata(path)?;
    let is_a = resolve_is_a(frontmatter.is_a);

    // Add "Type" relationship: isA becomes a navigable link to the type document.
    // Skip for type documents themselves (isA == "Type") to avoid self-referential links.
    if let Some(ref type_name) = is_a {
        if type_name != "Type" {
            let type_link = if type_name.starts_with("[[") && type_name.ends_with("]]") {
                type_name.clone()
            } else {
                format!("[[{}]]", type_name.to_lowercase())
            };
            relationships.insert("Type".to_string(), vec![type_link]);
        }
    }

    let belongs_to = relationships.get("Belongs to").cloned().unwrap_or_default();
    let related_to = relationships.get("Related to").cloned().unwrap_or_default();

    Ok(VaultEntry {
        path: path.to_string_lossy().to_string(),
        filename,
        title,
        is_a,
        snippet,
        relationships,
        aliases: frontmatter
            .aliases
            .map(|a| a.into_vec())
            .unwrap_or_default(),
        belongs_to,
        related_to,
        status: frontmatter.status.and_then(|v| v.into_scalar()),
        archived: frontmatter.archived.unwrap_or(false),
        trashed: frontmatter.trashed.unwrap_or(false),
        trashed_at: frontmatter
            .trashed_at
            .and_then(|v| v.into_scalar())
            .as_deref()
            .and_then(parsing::parse_iso_date),
        modified_at,
        created_at,
        file_size,
        icon: frontmatter.icon.and_then(|v| v.into_scalar()),
        color: frontmatter.color.and_then(|v| v.into_scalar()),
        order: frontmatter.order,
        sidebar_label: frontmatter.sidebar_label.and_then(|v| v.into_scalar()),
        template: frontmatter.template.and_then(|v| v.into_scalar()),
        sort: frontmatter.sort.and_then(|v| v.into_scalar()),
        view: frontmatter.view.and_then(|v| v.into_scalar()),
        visible: frontmatter.visible,
        word_count,
        outgoing_links,
        properties,
    })
}

/// Re-read a single file from disk and return a fresh VaultEntry.
pub fn reload_entry(path: &Path) -> Result<VaultEntry, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {}", path.display()));
    }
    parse_md_file(path)
}

/// Directories that are never shown in the folder tree or scanned for notes.
const HIDDEN_DIRS: &[&str] = &[".git", ".laputa", ".DS_Store"];

fn is_hidden_dir(name: &str) -> bool {
    name.starts_with('.') || HIDDEN_DIRS.contains(&name)
}

fn is_md_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|ext| ext == "md")
}

fn try_parse_md(path: &Path, entries: &mut Vec<VaultEntry>) {
    match parse_md_file(path) {
        Ok(vault_entry) => entries.push(vault_entry),
        Err(e) => log::warn!("Skipping file: {}", e),
    }
}

/// Scan all .md files in the vault, including subdirectories.
/// Hidden directories (starting with `.`) are excluded.
fn scan_all_md_files(vault_path: &Path, entries: &mut Vec<VaultEntry>) {
    let walker = WalkDir::new(vault_path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                // Skip the vault root itself (depth 0) — we only filter subdirs
                if e.depth() == 0 {
                    return true;
                }
                return !is_hidden_dir(&name);
            }
            true
        });
    for entry in walker.filter_map(|e| e.ok()) {
        if is_md_file(entry.path()) {
            try_parse_md(entry.path(), entries);
        }
    }
}

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &Path) -> Result<Vec<VaultEntry>, String> {
    if !vault_path.exists() {
        return Err(format!(
            "Vault path does not exist: {}",
            vault_path.display()
        ));
    }
    if !vault_path.is_dir() {
        return Err(format!(
            "Vault path is not a directory: {}",
            vault_path.display()
        ));
    }

    let mut entries = Vec::new();
    scan_all_md_files(vault_path, &mut entries);

    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(entries)
}

/// Build a tree of visible folders in the vault.
/// Excludes hidden directories (starting with `.`).
pub fn scan_vault_folders(vault_path: &Path) -> Result<Vec<FolderNode>, String> {
    if !vault_path.is_dir() {
        return Err(format!("Not a directory: {}", vault_path.display()));
    }
    fn build_tree(dir: &Path, vault_root: &Path) -> Vec<FolderNode> {
        let mut nodes: Vec<FolderNode> = Vec::new();
        let entries = match fs::read_dir(dir) {
            Ok(d) => d,
            Err(_) => return nodes,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if is_hidden_dir(&name) {
                continue;
            }
            let rel_path = path
                .strip_prefix(vault_root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            let children = build_tree(&path, vault_root);
            nodes.push(FolderNode {
                name,
                path: rel_path,
                children,
            });
        }
        nodes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        nodes
    }
    Ok(build_tree(vault_path, vault_path))
}

#[cfg(test)]
#[path = "mod_tests.rs"]
mod tests;
