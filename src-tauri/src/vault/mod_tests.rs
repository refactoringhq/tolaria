use super::*;
use std::collections::HashMap;
use std::fs;
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

fn parse_test_entry(dir: &TempDir, name: &str, content: &str) -> VaultEntry {
    create_test_file(dir.path(), name, content);
    parse_md_file(&dir.path().join(name)).unwrap()
}

#[test]
fn test_reload_entry_returns_fresh_data() {
    let dir = TempDir::new().unwrap();
    create_test_file(
        dir.path(),
        "my-note.md",
        "---\ntitle: My Note\nStatus: Active\n---\n# My Note\n\nOriginal.",
    );
    let entry = reload_entry(&dir.path().join("my-note.md")).unwrap();
    assert_eq!(entry.title, "My Note");
    assert_eq!(entry.status, Some("Active".to_string()));

    // Modify on disk and reload — must see the new content
    create_test_file(
        dir.path(),
        "my-note.md",
        "---\ntitle: My Note\nStatus: Done\n---\n# My Note\n\nUpdated.",
    );
    let fresh = reload_entry(&dir.path().join("my-note.md")).unwrap();
    assert_eq!(fresh.status, Some("Done".to_string()));
}

#[test]
fn test_reload_entry_nonexistent_file() {
    let result = reload_entry(std::path::Path::new("/nonexistent/path/note.md"));
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("does not exist"));
}

const FULL_FM_CONTENT: &str = "---\ntitle: Laputa Project\nIs A: Project\naliases:\n  - Laputa\n  - Castle in the Sky\nBelongs to:\n  - Studio Ghibli\nRelated to:\n  - Miyazaki\nStatus: Active\nOwner: Luca\nCadence: Weekly\n---\n# Laputa Project\n\nThis is a project note.\n";

#[test]
fn test_parse_full_frontmatter_identity() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.title, "Laputa Project");
    assert_eq!(entry.is_a, Some("Project".to_string()));
    assert_eq!(entry.filename, "laputa.md");
}

#[test]
fn test_parse_full_frontmatter_lists() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.aliases, vec!["Laputa", "Castle in the Sky"]);
    // Belongs to / Related to are no longer first-class fields.
    // As arrays of plain strings (no wikilinks), they don't appear in
    // relationships or properties — only wikilink arrays become relationships,
    // and only scalars become properties.
    assert!(entry.relationships.get("Belongs to").is_none());
    assert!(entry.relationships.get("Related to").is_none());
}

#[test]
fn test_parse_full_frontmatter_scalars() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "laputa.md", FULL_FM_CONTENT);
    assert_eq!(entry.status, Some("Active".to_string()));
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
}

#[test]
fn test_parse_empty_frontmatter() {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(
        &dir,
        "just-a-title.md",
        "---\n---\n# Just a Title\n\nNo frontmatter fields.",
    );
    // No title in frontmatter → derived from filename slug (H1 is body content)
    assert_eq!(entry.title, "Just A Title");
    assert!(entry.aliases.is_empty());

    assert!(entry.belongs_to.is_empty());
    assert_eq!(entry.status, None);
}

#[test]
fn test_parse_no_frontmatter() {
    let dir = TempDir::new().unwrap();
    let content = "# A Note Without Frontmatter\n\nJust markdown.";
    create_test_file(dir.path(), "a-note-without-frontmatter.md", content);

    let entry = parse_md_file(&dir.path().join("a-note-without-frontmatter.md")).unwrap();
    // No title in frontmatter → derived from filename
    assert_eq!(entry.title, "A Note Without Frontmatter");
}

#[test]
fn test_parse_single_string_aliases() {
    let dir = TempDir::new().unwrap();
    let content = "---\naliases: SingleAlias\n---\n# Test\n";
    create_test_file(dir.path(), "single-alias.md", content);

    let entry = parse_md_file(&dir.path().join("single-alias.md")).unwrap();
    assert_eq!(entry.aliases, vec!["SingleAlias"]);
}

#[test]
fn test_scan_vault_root_and_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "project.md",
        "---\ntype: Type\n---\n# Project\n",
    );
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(dir.path(), "not-markdown.txt", "This should be ignored");

    let entries = scan_vault(dir.path()).unwrap();
    assert_eq!(entries.len(), 3);

    let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
    assert!(filenames.contains(&"root.md"));
    assert!(filenames.contains(&"project.md"));
    assert!(filenames.contains(&"notes.md"));
}

#[test]
fn test_scan_vault_skips_non_protected_subfolders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root Note\n");
    create_test_file(
        dir.path(),
        "random-folder/nested.md",
        "---\ntype: Note\n---\n# Nested\n",
    );
    create_test_file(
        dir.path(),
        "project/old-project.md",
        "---\ntype: Project\n---\n# Old\n",
    );

    let entries = scan_vault(dir.path()).unwrap();
    assert_eq!(entries.len(), 1, "only root .md files should be scanned");
    assert_eq!(entries[0].filename, "root.md");
}

#[test]
fn test_scan_vault_includes_all_protected_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), "attachments/notes.md", "# Attachment note\n");
    create_test_file(dir.path(), "assets/image.md", "# Asset\n");

    let entries = scan_vault(dir.path()).unwrap();
    assert_eq!(entries.len(), 3);
}

#[test]
fn test_scan_vault_skips_hidden_folders() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "root.md", "# Root\n");
    create_test_file(dir.path(), ".laputa/cache.md", "# Cache\n");
    create_test_file(dir.path(), ".git/objects.md", "# Git\n");

    let entries = scan_vault(dir.path()).unwrap();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].filename, "root.md");
}

#[test]
fn test_scan_vault_nonexistent_path() {
    let result = scan_vault(Path::new("/nonexistent/path/that/does/not/exist"));
    assert!(result.is_err());
}

#[test]
fn test_parse_malformed_yaml() {
    let dir = TempDir::new().unwrap();
    // Malformed YAML — gray_matter should handle this gracefully
    let content = "---\nIs A: [unclosed bracket\n---\n# Malformed\n";
    create_test_file(dir.path(), "malformed.md", content);

    let entry = parse_md_file(&dir.path().join("malformed.md"));
    // Should still succeed — gray_matter may parse partially or skip
    assert!(entry.is_ok());
}

#[test]
fn test_get_note_content() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
    create_test_file(dir.path(), "test.md", content);

    let path = dir.path().join("test.md");
    let result = get_note_content(&path);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), content);
}

#[test]
fn test_get_note_content_nonexistent() {
    let result = get_note_content(Path::new("/nonexistent/path/file.md"));
    assert!(result.is_err());
}

#[test]
fn test_parse_md_file_has_snippet() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world! This is a snippet.";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
    assert_eq!(entry.snippet, "Hello, world! This is a snippet.");
}

#[test]
fn test_parse_md_file_has_word_count() {
    let dir = TempDir::new().unwrap();
    let content =
        "---\nIs A: Note\n---\n# Test Note\n\nHello world. This is a test with seven words.";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
    assert_eq!(entry.word_count, 9);
}

#[test]
fn test_parse_md_file_word_count_empty_body() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Empty Note\n";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
    assert_eq!(entry.word_count, 0);
}

#[test]
fn test_parse_relationships_array() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Responsibility
Has:
  - "[[essay/foo|Foo Essay]]"
  - "[[essay/bar|Bar Essay]]"
Topics:
  - "[[topic/rust]]"
  - "[[topic/wasm]]"
Status: Active
---
# Publish Essays
"#;
    create_test_file(dir.path(), "publish-essays.md", content);

    let entry = parse_md_file(&dir.path().join("publish-essays.md")).unwrap();
    assert_eq!(entry.relationships.len(), 3); // Has, Topics, Type
    assert_eq!(
        entry.relationships.get("Has").unwrap(),
        &vec![
            "[[essay/foo|Foo Essay]]".to_string(),
            "[[essay/bar|Bar Essay]]".to_string()
        ]
    );
    assert_eq!(
        entry.relationships.get("Topics").unwrap(),
        &vec!["[[topic/rust]]".to_string(), "[[topic/wasm]]".to_string()]
    );
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[responsibility]]".to_string()]
    );
}

#[test]
fn test_parse_relationships_single_string() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Owner: "[[person/luca-rossi|Luca Rossi]]"
Belongs to:
  - "[[responsibility/grow-newsletter]]"
---
# Some Project
"#;
    create_test_file(dir.path(), "some-project.md", content);

    let entry = parse_md_file(&dir.path().join("some-project.md")).unwrap();

    // Owner with wikilink should appear in relationships
    assert!(entry.relationships.get("Owner").is_some());
    // Wikilinks don't go to properties
    assert!(entry.properties.get("Owner").is_none());

    // Belongs to is a wikilink array, should appear in relationships
    let belongs = entry.relationships.get("Belongs to").unwrap();
    assert_eq!(
        belongs,
        &vec!["[[responsibility/grow-newsletter]]".to_string()]
    );
    // Also parsed in the dedicated field
    assert_eq!(entry.belongs_to, vec!["[[responsibility/grow-newsletter]]"]);
}

#[test]
fn test_parse_relationships_ignores_non_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Note
Status: Active
Tags:
  - productivity
  - writing
Custom Field: just a plain string
---
# A Note
"#;
    create_test_file(dir.path(), "plain-note.md", content);

    let entry = parse_md_file(&dir.path().join("plain-note.md")).unwrap();
    // Tags and Custom Field don't contain wikilinks — only the auto-generated "Type" relationship
    assert_eq!(entry.relationships.len(), 1);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[note]]".to_string()]
    );
}

const BIG_PROJECT_CONTENT: &str = "---\nIs A: Project\nHas:\n  - \"[[deliverable/mvp]]\"\n  - \"[[deliverable/v2]]\"\nTopics:\n  - \"[[topic/ai]]\"\n  - \"[[topic/compilers]]\"\nEvents:\n  - \"[[event/launch-day]]\"\nNotes:\n  - \"[[note/design-rationale]]\"\n  - \"[[note/meeting-2024-01]]\"\n  - \"[[note/meeting-2024-02]]\"\nOwner: \"[[person/alice]]\"\nRelated to:\n  - \"[[project/sibling-project]]\"\nBelongs to:\n  - \"[[area/engineering]]\"\nStatus: Active\n---\n# Big Project\n";

fn parse_big_project_rels() -> HashMap<String, Vec<String>> {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "big-project.md", BIG_PROJECT_CONTENT);
    entry.relationships
}

#[test]
fn test_parse_relationships_custom_fields() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Has").unwrap().len(), 2);
    assert_eq!(rels.get("Topics").unwrap().len(), 2);
    assert_eq!(rels.get("Events").unwrap().len(), 1);
}

#[test]
fn test_parse_relationships_owner_and_notes() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Notes").unwrap().len(), 3);
    // Owner with wikilink should be in relationships
    assert!(rels.get("Owner").is_some());
}

#[test]
fn test_parse_relationships_builtin_wikilink_fields() {
    let rels = parse_big_project_rels();
    assert_eq!(rels.get("Related to").unwrap().len(), 1);
    assert_eq!(rels.get("Belongs to").unwrap().len(), 1);
}

#[test]
fn test_parse_relationships_skip_keys_excluded_from_generic() {
    let rels = parse_big_project_rels();
    assert!(rels.get("Status").is_none());
    assert!(rels.get("Is A").is_none());
}

#[test]
fn test_parse_relationships_single_vs_array_wikilinks() {
    // Verifies both single wikilink strings and arrays are parsed correctly.
    let dir = TempDir::new().unwrap();
    let content = r#"---
Mentor: "[[person/bob|Bob Smith]]"
Reviewers:
  - "[[person/carol]]"
  - "[[person/dave]]"
Context: "[[area/research]]"
---
# A Note
"#;
    create_test_file(dir.path(), "single-vs-array.md", content);

    let entry = parse_md_file(&dir.path().join("single-vs-array.md")).unwrap();

    // Single string → Vec with one element
    assert_eq!(
        entry.relationships.get("Mentor").unwrap(),
        &vec!["[[person/bob|Bob Smith]]".to_string()]
    );
    // Array → Vec with multiple elements
    assert_eq!(
        entry.relationships.get("Reviewers").unwrap(),
        &vec![
            "[[person/carol]]".to_string(),
            "[[person/dave]]".to_string()
        ]
    );
    // Another single string
    assert_eq!(
        entry.relationships.get("Context").unwrap(),
        &vec!["[[area/research]]".to_string()]
    );
}

const SKIP_KEYS_CONTENT: &str = "---\nIs A: \"[[project]]\"\nAliases:\n  - \"[[alias/foo]]\"\nStatus: \"[[status/active]]\"\nCadence: \"[[cadence/weekly]]\"\nCreated at: \"[[time/2024-01-01]]\"\nCreated time: \"[[time/noon]]\"\nReal Relation: \"[[note/important]]\"\n---\n# Skip Keys Test\n";

fn parse_skip_keys_rels() -> (HashMap<String, Vec<String>>, usize) {
    let dir = TempDir::new().unwrap();
    let entry = parse_test_entry(&dir, "skip-keys.md", SKIP_KEYS_CONTENT);
    let len = entry.relationships.len();
    (entry.relationships, len)
}

#[test]
fn test_skip_keys_identity_fields_excluded() {
    let (rels, _) = parse_skip_keys_rels();
    assert!(rels.get("Is A").is_none());
    assert!(rels.get("Aliases").is_none());
    assert!(rels.get("Status").is_none());
}

#[test]
fn test_skip_keys_temporal_fields_excluded() {
    let (rels, _) = parse_skip_keys_rels();
    assert!(rels.get("Cadence").is_some());
    assert!(rels.get("Created at").is_some());
    assert!(rels.get("Created time").is_some());
}

#[test]
fn test_skip_keys_real_relation_included() {
    let (rels, len) = parse_skip_keys_rels();
    assert_eq!(
        rels.get("Real Relation").unwrap(),
        &vec!["[[note/important]]".to_string()]
    );
    // "Real Relation" + "Type" + "Cadence" + "Created at" + "Created time"
    assert_eq!(len, 5);
    assert_eq!(rels.get("Type").unwrap(), &vec!["[[project]]".to_string()]);
    assert!(rels.get("Cadence").is_some());
    assert!(rels.get("Created at").is_some());
    assert!(rels.get("Created time").is_some());
}

#[test]
fn test_parse_relationships_mixed_wikilinks_and_plain_in_array() {
    // Verifies that within an array, only wikilink entries are kept.
    let dir = TempDir::new().unwrap();
    let content = r#"---
References:
  - "[[source/paper-a]]"
  - "just a plain string"
  - "[[source/paper-b]]"
  - "no links here"
---
# Mixed Array
"#;
    create_test_file(dir.path(), "mixed-array.md", content);

    let entry = parse_md_file(&dir.path().join("mixed-array.md")).unwrap();

    // Only the wikilink entries should be captured
    assert_eq!(
        entry.relationships.get("References").unwrap(),
        &vec![
            "[[source/paper-a]]".to_string(),
            "[[source/paper-b]]".to_string()
        ]
    );
}

// --- type from frontmatter only (no folder inference) ---

#[test]
fn test_type_from_frontmatter_only() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "test.md", "---\ntype: Custom\n---\n# Test\n");
    let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
    assert_eq!(entry.is_a, Some("Custom".to_string()));
}

#[test]
fn test_no_type_when_frontmatter_missing() {
    let dir = TempDir::new().unwrap();
    create_test_file(dir.path(), "note/test.md", "# Test\n");
    let entry = parse_md_file(&dir.path().join("note/test.md")).unwrap();
    assert_eq!(entry.is_a, None, "type should not be inferred from folder");
}

// --- created_at sourcing from filesystem ---

#[test]
fn test_created_at_from_filesystem() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Test\n";
    create_test_file(dir.path(), "test.md", content);

    let entry = parse_md_file(&dir.path().join("test.md")).unwrap();
    // created_at should be set from filesystem metadata (not None)
    assert!(
        entry.created_at.is_some(),
        "created_at should come from filesystem"
    );
}

// --- Type relationship tests ---

#[test]
fn test_type_relationship_added_for_regular_entries() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Project\n---\n# My Project\n";
    let entry = parse_test_entry(&dir, "project/my-project.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[project]]".to_string()]
    );
}

#[test]
fn test_type_relationship_skipped_for_type_documents() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("Type").is_none());
}

#[test]
fn test_no_type_relationship_without_frontmatter() {
    let dir = TempDir::new().unwrap();
    let content = "# A Person\n\nSome content.";
    let entry = parse_test_entry(&dir, "someone.md", content);
    assert_eq!(entry.is_a, None);
    assert!(entry.relationships.get("Type").is_none());
}

#[test]
fn test_type_relationship_handles_wikilink_is_a() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: \"[[experiment]]\"\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[experiment]]".to_string()]
    );
}

#[test]
fn test_type_from_frontmatter_not_folder() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Some Type\n";
    let entry = parse_test_entry(&dir, "some-type.md", content);
    assert_eq!(entry.is_a, Some("Type".to_string()));
}

// --- type key (post-migration) tests ---

#[test]
fn test_parse_type_key_lowercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\n---\n# My Project\n";
    let entry = parse_test_entry(&dir, "project/my-project.md", content);
    assert_eq!(entry.is_a, Some("Project".to_string()));
}

#[test]
fn test_type_key_generates_type_relationship() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Person\n---\n# Alice\n";
    let entry = parse_test_entry(&dir, "person/alice.md", content);
    assert_eq!(
        entry.relationships.get("Type").unwrap(),
        &vec!["[[person]]".to_string()]
    );
}

#[test]
fn test_type_key_not_in_relationships_as_generic() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\nHas:\n  - \"[[task/foo]]\"\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "note/test.md", content);
    // "type" key itself should not appear as a relationship (it's in SKIP_KEYS)
    // Only "Has" and the auto-generated "Type" should be relationships
    assert_eq!(entry.relationships.len(), 2);
    assert!(entry.relationships.get("Has").is_some());
    assert!(entry.relationships.get("Type").is_some());
}

// --- outgoing_links tests ---

#[test]
fn test_outgoing_links_extracted_from_content_body() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# My Note\n\nSee [[person/alice]] and [[topic/rust]].";
    let entry = parse_test_entry(&dir, "note/my-note.md", content);
    assert_eq!(entry.outgoing_links, vec!["person/alice", "topic/rust"]);
}

#[test]
fn test_outgoing_links_excludes_frontmatter_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = "---\nHas:\n  - \"[[task/design]]\"\n---\n# Note\n\nSee [[person/bob]].";
    let entry = parse_test_entry(&dir, "note/test.md", content);
    assert!(!entry.outgoing_links.contains(&"task/design".to_string()));
    assert!(entry.outgoing_links.contains(&"person/bob".to_string()));
}

#[test]
fn test_outgoing_links_handles_pipe_syntax() {
    let dir = TempDir::new().unwrap();
    let content = "# Note\n\nSee [[project/alpha|Alpha Project]] for details.";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.outgoing_links.contains(&"project/alpha".to_string()));
}

// --- save_note_content tests ---

#[test]
fn test_save_note_content_creates_parent_directory() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("new-type/untitled-note.md");
    let content = "---\ntitle: Untitled note\n---\n# Untitled note\n\n";

    assert!(!path.parent().unwrap().exists());
    save_note_content(path.to_str().unwrap(), content).unwrap();

    assert!(path.exists());
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

#[test]
fn test_save_note_content_existing_directory() {
    let dir = TempDir::new().unwrap();
    fs::create_dir_all(dir.path().join("note")).unwrap();
    let path = dir.path().join("note/test.md");
    let content = "# Test\n";

    save_note_content(path.to_str().unwrap(), content).unwrap();
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

#[test]
fn test_save_note_content_deeply_nested_new_directory() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a/b/c/deep-note.md");
    let content = "---\ntitle: Deep\n---\n";

    save_note_content(path.to_str().unwrap(), content).unwrap();
    assert!(path.exists());
    assert_eq!(fs::read_to_string(&path).unwrap(), content);
}

// --- sidebar_label tests ---

#[test]
fn test_parse_sidebar_label_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsidebar label: News\n---\n# News\n";
    let entry = parse_test_entry(&dir, "news.md", content);
    assert_eq!(entry.sidebar_label, Some("News".to_string()));
}

#[test]
fn test_parse_sidebar_label_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sidebar_label, None);
}

#[test]
fn test_sidebar_label_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsidebar label: My Series\n---\n# Series\n";
    let entry = parse_test_entry(&dir, "series.md", content);
    assert!(entry.relationships.get("sidebar label").is_none());
}

// --- template field tests ---

#[test]
fn test_parse_template_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\ntemplate: \"## Objective\\n\\n## Timeline\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.template.is_some());
}

#[test]
fn test_parse_template_block_scalar() {
    let dir = TempDir::new().unwrap();
    let content =
        "---\ntype: Type\ntemplate: |\n  ## Objective\n  \n  ## Timeline\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.template.is_some());
    let tmpl = entry.template.unwrap();
    assert!(tmpl.contains("## Objective"));
    assert!(tmpl.contains("## Timeline"));
}

#[test]
fn test_parse_template_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Note\n";
    let entry = parse_test_entry(&dir, "note.md", content);
    assert_eq!(entry.template, None);
}

#[test]
fn test_template_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\ntemplate: \"## Heading\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("template").is_none());
}

// --- sort field tests ---

#[test]
fn test_parse_sort_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"modified:desc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sort, Some("modified:desc".to_string()));
}

#[test]
fn test_parse_sort_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.sort, None);
}

#[test]
fn test_sort_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"title:asc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.relationships.get("sort").is_none());
}

#[test]
fn test_sort_not_in_properties() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nsort: \"title:asc\"\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert!(entry.properties.get("sort").is_none());
}

// --- custom properties tests ---

#[test]
fn test_extract_properties_scalar_values() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Status: Active
Priority: High
Rating: 5
Due date: 2026-06-15
Reviewed: true
---
# Test
"#;
    let entry = parse_test_entry(&dir, "project/test.md", content);
    let expected: HashMap<String, serde_json::Value> = [
        ("Priority".into(), serde_json::Value::String("High".into())),
        ("Rating".into(), serde_json::json!(5)),
        (
            "Due date".into(),
            serde_json::Value::String("2026-06-15".into()),
        ),
        ("Reviewed".into(), serde_json::Value::Bool(true)),
    ]
    .into_iter()
    .collect();
    assert_eq!(entry.properties, expected);
}

#[test]
fn test_extract_properties_skips_structural_fields() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Is A: Project
Status: Active
Owner: Luca
Cadence: Weekly
Archived: false
Priority: High
---
# Test
"#;
    let entry = parse_test_entry(&dir, "project/test.md", content);
    // Priority + Owner + Cadence should survive — all others are structural
    assert_eq!(entry.properties.len(), 3);
    assert_eq!(
        entry.properties.get("Priority").and_then(|v| v.as_str()),
        Some("High")
    );
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
}

#[test]
fn test_extract_properties_skips_wikilinks() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Mentor: "[[person/alice]]"
Company: Acme Corp
---
# Test
"#;
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.properties.get("Mentor").is_none());
    assert_eq!(
        entry.properties.get("Company").and_then(|v| v.as_str()),
        Some("Acme Corp")
    );
}

#[test]
fn test_extract_properties_skips_arrays() {
    let dir = TempDir::new().unwrap();
    let content = r#"---
Tags:
  - productivity
  - writing
Company: Acme Corp
---
# Test
"#;
    let entry = parse_test_entry(&dir, "test.md", content);
    assert!(entry.properties.get("Tags").is_none());
    assert_eq!(
        entry.properties.get("Company").and_then(|v| v.as_str()),
        Some("Acme Corp")
    );
}

#[test]
fn test_parse_trashed_title_case() {
    let dir = TempDir::new().unwrap();
    let content = "---\nTrashed: true\nTrashed at: \"2025-02-01\"\n---\n# Gone\n";
    let entry = parse_test_entry(&dir, "gone.md", content);
    assert!(entry.trashed);
    assert!(entry.trashed_at.is_some());
}

#[test]
fn test_parse_trashed_lowercase_alias() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntrashed: true\ntrashed_at: \"2025-02-01\"\n---\n# Gone\n";
    let entry = parse_test_entry(&dir, "gone.md", content);
    assert!(
        entry.trashed,
        "lowercase 'trashed' must be parsed via alias"
    );
    assert!(
        entry.trashed_at.is_some(),
        "lowercase 'trashed_at' must be parsed via alias"
    );
}

#[test]
fn test_parse_archived_lowercase_alias() {
    let dir = TempDir::new().unwrap();
    let content = "---\narchived: true\n---\n# Old Quarter\n";
    let entry = parse_test_entry(&dir, "old-quarter.md", content);
    assert!(
        entry.archived,
        "lowercase 'archived' must be parsed via alias (frontend writes lowercase)"
    );
}

#[test]
fn test_parse_archived_titlecase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: true\n---\n# Old Quarter\n";
    let entry = parse_test_entry(&dir, "old-quarter-2.md", content);
    assert!(entry.archived, "titlecase 'Archived' must also be parsed");
}

#[test]
fn test_trashed_false_when_absent() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active.md", content);
    assert!(!entry.trashed);
    assert!(entry.trashed_at.is_none());
}

// --- archived/trashed string-value tests ---

#[test]
fn test_parse_archived_yes_titlecase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: Yes\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old.md", content);
    assert!(entry.archived, "'Archived: Yes' must be parsed as true");
}

#[test]
fn test_parse_archived_yes_lowercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\narchived: yes\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old2.md", content);
    assert!(entry.archived, "'archived: yes' must be parsed as true");
}

#[test]
fn test_parse_archived_yes_uppercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: YES\n---\n# Old\n";
    let entry = parse_test_entry(&dir, "old3.md", content);
    assert!(entry.archived, "'Archived: YES' must be parsed as true");
}

#[test]
fn test_parse_archived_no() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: No\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active2.md", content);
    assert!(!entry.archived, "'Archived: No' must be parsed as false");
}

#[test]
fn test_parse_archived_false_string() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: \"false\"\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active3.md", content);
    assert!(
        !entry.archived,
        "'Archived: \"false\"' must be parsed as false"
    );
}

#[test]
fn test_parse_archived_zero() {
    let dir = TempDir::new().unwrap();
    let content = "---\nArchived: 0\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active4.md", content);
    assert!(!entry.archived, "'Archived: 0' must be parsed as false");
}

#[test]
fn test_parse_archived_absent() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Note\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active5.md", content);
    assert!(!entry.archived, "absent archived must default to false");
}

#[test]
fn test_parse_trashed_yes_titlecase() {
    let dir = TempDir::new().unwrap();
    let content = "---\nTrashed: Yes\n---\n# Gone\n";
    let entry = parse_test_entry(&dir, "gone2.md", content);
    assert!(entry.trashed, "'Trashed: Yes' must be parsed as true");
}

#[test]
fn test_parse_trashed_yes_lowercase() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntrashed: yes\n---\n# Gone\n";
    let entry = parse_test_entry(&dir, "gone3.md", content);
    assert!(entry.trashed, "'trashed: yes' must be parsed as true");
}

#[test]
fn test_parse_trashed_no() {
    let dir = TempDir::new().unwrap();
    let content = "---\nTrashed: No\n---\n# Active\n";
    let entry = parse_test_entry(&dir, "active6.md", content);
    assert!(!entry.trashed, "'Trashed: No' must be parsed as false");
}

// --- visible field tests ---

#[test]
fn test_parse_visible_false_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert_eq!(entry.visible, Some(false));
}

#[test]
fn test_parse_visible_true_from_type_entry() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: true\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.visible, Some(true));
}

#[test]
fn test_parse_visible_missing_defaults_to_none() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\n---\n# Project\n";
    let entry = parse_test_entry(&dir, "project.md", content);
    assert_eq!(entry.visible, None);
}

#[test]
fn test_visible_not_in_relationships() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert!(entry.relationships.get("visible").is_none());
}

#[test]
fn test_visible_not_in_properties() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Type\nvisible: false\n---\n# Journal\n";
    let entry = parse_test_entry(&dir, "journal.md", content);
    assert!(entry.properties.get("visible").is_none());
}

// --- round-trip: canonical `type:` field and `Is A:` alias ---

#[test]
fn test_roundtrip_type_key_parses_correctly() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

#[test]
fn test_roundtrip_is_a_alias_still_works() {
    let dir = TempDir::new().unwrap();
    let content = "---\nIs A: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

#[test]
fn test_roundtrip_is_a_snake_case_alias_still_works() {
    let dir = TempDir::new().unwrap();
    let content = "---\nis_a: Quarter\n---\n# Q1 2026\n";
    let entry = parse_test_entry(&dir, "quarter/q1.md", content);
    assert_eq!(entry.is_a, Some("Quarter".to_string()));
}

// --- StringOrList normalization (uniform, no per-field special cases) ---

#[test]
fn test_single_element_array_owner_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Responsibility\nOwner:\n  - Luca\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(entry.is_a, Some("Responsibility".to_string()));
}

#[test]
fn test_single_element_array_cadence_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Procedure\nCadence:\n  - Weekly\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Weekly")
    );
    assert_eq!(entry.is_a, Some("Procedure".to_string()));
}

#[test]
fn test_single_element_array_status_unwraps_to_scalar() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\nStatus:\n  - Active\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(entry.status, Some("Active".to_string()));
    assert_eq!(entry.is_a, Some("Project".to_string()));
}

#[test]
fn test_scalar_fields_unchanged() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Project\nOwner: Luca\nCadence: Daily\nStatus: Done\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.properties.get("Owner").and_then(|v| v.as_str()),
        Some("Luca")
    );
    assert_eq!(
        entry.properties.get("Cadence").and_then(|v| v.as_str()),
        Some("Daily")
    );
    assert_eq!(entry.status, Some("Done".to_string()));
}

#[test]
fn test_absent_fields_no_crash() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Note\n---\n# Test\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(entry.status, None);
}

#[test]
fn test_array_field_does_not_break_type_detection() {
    let dir = TempDir::new().unwrap();
    let content = "---\ntype: Responsibility\nOwner:\n  - Luca\nCadence:\n  - Weekly\nStatus:\n  - Active\n---\n# My Responsibility\n";
    let entry = parse_test_entry(&dir, "test.md", content);
    assert_eq!(
        entry.is_a,
        Some("Responsibility".to_string()),
        "type must not be lost when other fields are arrays"
    );

    assert_eq!(entry.status, Some("Active".to_string()));
}

// Frontmatter update/delete tests are in frontmatter.rs
// save_image tests are in vault/image.rs
// purge_trash tests are in vault/trash.rs
// rename_note tests are in vault/rename.rs
