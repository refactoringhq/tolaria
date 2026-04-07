use std::fs;
use std::path::{Path, PathBuf};

/// Default location for the Getting Started vault.
pub fn default_vault_path() -> Result<PathBuf, String> {
    dirs::document_dir()
        .map(|d| d.join("Getting Started"))
        .ok_or_else(|| "Could not determine Documents directory".to_string())
}

/// Check whether a vault path exists on disk.
pub fn vault_exists(path: &str) -> bool {
    Path::new(path).is_dir()
}

struct SampleFile {
    rel_path: &'static str,
    content: &'static str,
}

/// Default AGENTS.md content — vault instructions for AI agents.
/// Describes Laputa vault mechanics only; no vault-specific structure.
/// The vault scanner will pick this up as a regular entry.
pub(super) const AGENTS_MD: &str = r##"# AGENTS.md — Laputa Vault

This is a [Laputa](https://github.com/refactoringhq/laputa-app) vault — a folder of markdown files with YAML frontmatter forming a personal knowledge graph.

## Note structure

Every note is a markdown file. The **first H1 heading in the body is the title** — there is no `title:` frontmatter field.

```yaml
---
is_a: TypeName        # the note's type (must match the title of a type file in the vault)
url: https://...      # example property
belongs_to: "[[other-note]]"
related_to:
  - "[[note-a]]"
  - "[[note-b]]"
---

# Note Title

Body content in markdown.
```

System properties are prefixed with `_` (e.g. `_organized`, `_pinned`, `_icon`) — these are app-managed, do not set or show them to users unless specifically asked.

## Types

A type is a note with `is_a: Type`. Type files live in the vault root:

```yaml
---
is_a: Type
_icon: books          # Phosphor icon name in kebab-case
_color: "#8b5cf6"     # hex color
---

# TypeName
```

To find what types exist: look for files with `is_a: Type` in the vault root.

## Relationships

Any frontmatter property whose value is a wikilink is a relationship. Backlinks are computed automatically.

Standard names: `belongs_to`, `related_to`, `has`. Custom names are valid.

## Wikilinks

- `[[filename]]` or `[[Note Title]]` — link by filename or title
- `[[filename|display text]]` — with custom display text
- Works in frontmatter values and markdown body

## Views

Saved filters live in `views/` as `.view.json` files:

```json
{
  "title": "Active Notes",
  "filters": [
    {"property": "is_a", "operator": "equals", "value": "Note"},
    {"property": "status", "operator": "equals", "value": "Active"}
  ],
  "sort": {"property": "title", "direction": "asc"}
}
```

## Filenames

Use kebab-case: `my-note-title.md`. One note per file.

## What you can do

- Create/edit notes with correct frontmatter and H1 title
- Create new type files
- Add or modify relationships
- Create/edit views in `views/`
- Edit `AGENTS.md` (this file)

Do not modify app configuration files — those are local to each installation.
"##;

const SAMPLE_FILES: &[SampleFile] = &[
    SampleFile {
        rel_path: "project.md",
        content: "---\ntype: Type\nicon: rocket-launch\ncolor: purple\norder: 1\n---\n\n# Project\n\nA Project is a time-bounded effort with a clear goal and an eventual completion date. Projects belong to a quarter or area and advance specific goals.\n",
    },
    SampleFile {
        rel_path: "note.md",
        content: "---\ntype: Type\nicon: note\ncolor: blue\norder: 2\n---\n\n# Note\n\nA Note is a general-purpose document — research notes, meeting notes, strategy docs, or anything that doesn't fit a more specific type.\n",
    },
    SampleFile {
        rel_path: "person.md",
        content: "---\ntype: Type\nicon: user\ncolor: green\norder: 3\n---\n\n# Person\n\nA Person represents someone you interact with — a colleague, friend, mentor, or collaborator.\n",
    },
    SampleFile {
        rel_path: "topic.md",
        content: "---\ntype: Type\nicon: tag\ncolor: yellow\norder: 4\n---\n\n# Topic\n\nA Topic is a subject area or interest category that groups related notes, projects, and people.\n",
    },
    SampleFile {
        rel_path: "theme.md",
        content: "---\ntype: Type\nicon: palette\ncolor: purple\norder: 50\n---\n\n# Theme\n\nA visual theme for Laputa. Each theme defines CSS custom properties that control colors, typography, and spacing.\n",
    },
    SampleFile {
        rel_path: "config.md",
        content: "---\ntype: Type\nicon: gear-six\ncolor: gray\norder: 90\nsidebar label: Config\n---\n\n# Config\n\nVault configuration files. These control how AI agents, tools, and other integrations interact with this vault.\n",
    },
    SampleFile {
        rel_path: "welcome-to-laputa.md",
        content: r#"---
type: Note
Related to:
  - "[[Editor Basics]]"
  - "[[Using Properties]]"
  - "[[Wiki-Links and Relationships]]"
---

# Welcome to Laputa

Welcome to your new knowledge vault! Laputa helps you organize your thoughts, projects, and relationships using **wiki-linked markdown files**.

## How it works

Every note is a markdown file with optional YAML frontmatter at the top. All notes live at the vault root. The `type` field in the frontmatter determines the note's type — set `type: Project` for a Project, `type: Person` for a Person, and so on.

## What to explore

- [[Editor Basics]] — Learn about headings, lists, checkboxes, and formatting
- [[Using Properties]] — See how frontmatter properties work (status, dates, relationships)
- [[Wiki-Links and Relationships]] — Connect your notes with `[[wiki-links]]`
- [[Sample Project]] — A sample project with relationships and status
- [[Sample Collaborator]] — A sample person entry

## Tips

- Press **⌘P** to quick-open any note by title
- Press **⌘K** to open the command palette
- Press **⌘N** to create a new note
- Use the **sidebar** on the left to browse by type
- Use the **inspector** on the right to edit properties and see backlinks
"#,
    },
    SampleFile {
        rel_path: "editor-basics.md",
        content: r#"---
type: Note
Related to: "[[Welcome to Laputa]]"
---

# Editor Basics

Laputa uses a rich markdown editor. Here are the key formatting features:

## Headings

Use `#` for headings. The first H1 heading becomes the note's title.

## Lists

- Bullet lists use `-` or `*`
- They can be nested
  - Like this
  - And this

1. Numbered lists work too
2. Just start with a number

## Checkboxes

- [x] Completed task
- [ ] Pending task
- [ ] Another thing to do

## Text formatting

You can use **bold**, *italic*, `inline code`, and ~~strikethrough~~ text.

## Code blocks

```javascript
function hello() {
  console.log("Hello from Laputa!");
}
```

## Blockquotes

> "The best way to have a good idea is to have lots of ideas." — Linus Pauling
"#,
    },
    SampleFile {
        rel_path: "using-properties.md",
        content: r#"---
type: Note
Status: Active
Related to:
  - "[[Welcome to Laputa]]"
  - "[[Wiki-Links and Relationships]]"
---

# Using Properties

Every note can have **properties** defined in the YAML frontmatter at the top of the file. Properties appear in the inspector panel on the right side of the screen.

## Common properties

- **type** — The note's type (Project, Note, Person, etc.)
- **Status** — Current state: Active, Done, Paused, Archived, Dropped
- **Belongs to** — Parent relationship (e.g., a project belongs to a quarter)
- **Related to** — Lateral connections to other notes
- **Owner** — The person responsible

## How to edit properties

1. Open the **inspector panel** (right side)
2. Click on any property value to edit it
3. For relationship fields, type `[[` to search for notes
4. Use the **+ Add property** button to add custom fields

## Custom properties

You can add any custom property. If the value contains `[[wiki-links]]`, Laputa will treat it as a relationship and show it as a clickable link in the inspector.
"#,
    },
    SampleFile {
        rel_path: "wiki-links-and-relationships.md",
        content: r#"---
type: Note
Related to:
  - "[[Welcome to Laputa]]"
  - "[[Using Properties]]"
---

# Wiki-Links and Relationships

Wiki-links are the core of Laputa's knowledge graph. They let you connect any note to any other note using the `[[double bracket]]` syntax.

## Creating links

Type `[[` in the editor to open the link suggestion menu. Start typing to search for a note, then select it. The link will look like this: [[Welcome to Laputa]].

## Backlinks

When note A links to note B, note B automatically shows a **backlink** to note A in the inspector panel. This means you never have to manually maintain bidirectional links.

## Relationships in frontmatter

You can also define relationships in the frontmatter:

```yaml
Belongs to: "[[Sample Project]]"
Related to:
  - "[[Editor Basics]]"
  - "[[Using Properties]]"
```

These appear as clickable pills in the inspector and are navigable with a single click.

## Building your knowledge graph

Over time, your wiki-links form a rich web of connections. Use the **Referenced By** section in the inspector to discover how notes relate to each other.
"#,
    },
    SampleFile {
        rel_path: "sample-project.md",
        content: r#"---
type: Project
Status: Active
Owner: "[[Sample Collaborator]]"
Related to: "[[Getting Started]]"
---

# Sample Project

This is an example project to show how projects work in Laputa.

## Overview

Projects are time-bounded efforts with clear goals. They have a **status** (Active, Paused, Done, Dropped) and can be linked to people, topics, and other notes.

## Goals

- [ ] Explore the Laputa editor and its features
- [ ] Create your first custom note
- [ ] Link notes together using wiki-links
- [ ] Try editing properties in the inspector

## Notes

This project is owned by [[Sample Collaborator]] and relates to [[Getting Started]]. You can see these relationships in the inspector panel on the right.
"#,
    },
    SampleFile {
        rel_path: "sample-collaborator.md",
        content: r#"---
type: Person
---

# Sample Collaborator

This is an example person entry. In your vault, you might create entries for colleagues, friends, mentors, or anyone you interact with regularly.

## What person entries are for

- Track who owns which projects
- Record meeting notes linked to specific people
- Build a network of relationships between people, projects, and topics

## Connections

This person is the owner of [[Sample Project]]. Check the **Referenced By** section in the inspector to see all notes that link back here.
"#,
    },
    SampleFile {
        rel_path: "getting-started.md",
        content: r#"---
type: Topic
---

# Getting Started

This topic groups notes related to learning and getting started with Laputa.

## Related notes

- [[Welcome to Laputa]] — Start here for an overview
- [[Editor Basics]] — Formatting and editor features
- [[Using Properties]] — Frontmatter and the inspector
- [[Wiki-Links and Relationships]] — Building your knowledge graph
- [[Sample Project]] — A sample project with relationships
"#,
    },
];

/// Create the Getting Started vault at the specified path.
/// Returns the absolute path to the created vault.
pub fn create_getting_started_vault(target_path: &str) -> Result<String, String> {
    let vault_dir = Path::new(target_path);

    if vault_dir.exists()
        && vault_dir
            .read_dir()
            .map(|mut d| d.next().is_some())
            .unwrap_or(false)
    {
        return Err(format!(
            "Directory already exists and is not empty: {}",
            target_path
        ));
    }

    fs::create_dir_all(vault_dir)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;

    // Write AGENTS.md with vault instructions at root (flat structure)
    fs::write(vault_dir.join("AGENTS.md"), AGENTS_MD)
        .map_err(|e| format!("Failed to write AGENTS.md: {}", e))?;

    for sample in SAMPLE_FILES {
        let file_path = vault_dir.join(sample.rel_path);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }
        fs::write(&file_path, sample.content)
            .map_err(|e| format!("Failed to write {}: {}", sample.rel_path, e))?;
    }

    crate::git::init_repo(target_path)?;

    Ok(vault_dir
        .canonicalize()
        .unwrap_or_else(|_| vault_dir.to_path_buf())
        .to_string_lossy()
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_vault_path_is_in_documents() {
        let path = default_vault_path().unwrap();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains("Documents"));
        assert!(path_str.ends_with("Getting Started"));
    }

    #[test]
    fn test_vault_exists_false_for_missing() {
        assert!(!vault_exists("/nonexistent/vault/path/abc123"));
    }

    #[test]
    fn test_create_getting_started_vault_creates_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("test-vault");
        let result = create_getting_started_vault(vault_path.to_str().unwrap());
        assert!(result.is_ok());

        // Verify key files exist (flat structure — no config/ or theme/ dirs)
        assert!(vault_path.join("AGENTS.md").exists());
        assert!(!vault_path.join("config").exists());
        assert!(vault_path.join("welcome-to-laputa.md").exists());
        assert!(vault_path.join("editor-basics.md").exists());
        assert!(vault_path.join("using-properties.md").exists());
        assert!(vault_path.join("wiki-links-and-relationships.md").exists());
        assert!(vault_path.join("sample-project.md").exists());
        assert!(vault_path.join("sample-collaborator.md").exists());
        assert!(vault_path.join("getting-started.md").exists());
        assert!(vault_path.join("project.md").exists());
        assert!(vault_path.join("note.md").exists());
        assert!(vault_path.join("person.md").exists());
        assert!(vault_path.join("topic.md").exists());
        assert!(vault_path.join("config.md").exists());
    }

    #[test]
    fn test_create_vault_rejects_non_empty_directory() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("non-empty");
        fs::create_dir_all(&vault_path).unwrap();
        fs::write(vault_path.join("existing.md"), "# Existing").unwrap();

        let result = create_getting_started_vault(vault_path.to_str().unwrap());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not empty"));
    }

    #[test]
    fn test_create_vault_allows_empty_directory() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("empty-dir");
        fs::create_dir_all(&vault_path).unwrap();

        let result = create_getting_started_vault(vault_path.to_str().unwrap());
        assert!(result.is_ok());
    }

    #[test]
    fn test_sample_files_have_valid_frontmatter() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("validation-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        for sample in SAMPLE_FILES {
            let file_path = vault_path.join(sample.rel_path);
            let content = fs::read_to_string(&file_path).unwrap();
            // Verify each file has frontmatter delimiters
            assert!(
                content.starts_with("---\n"),
                "{} should start with frontmatter",
                sample.rel_path
            );
            assert!(
                content.matches("---").count() >= 2,
                "{} should have closing frontmatter delimiter",
                sample.rel_path
            );
        }
    }

    #[test]
    fn test_sample_files_parseable_as_vault_entries() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("parse-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        let entries =
            crate::vault::scan_vault(&vault_path, &std::collections::HashMap::new()).unwrap();
        // SAMPLE_FILES + AGENTS.md
        assert_eq!(entries.len(), SAMPLE_FILES.len() + 1);
    }

    #[test]
    fn test_agents_md_present_at_root_after_vault_creation() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("agents-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        let agents_path = vault_path.join("AGENTS.md");
        assert!(agents_path.exists(), "AGENTS.md should exist at vault root");

        let content = fs::read_to_string(&agents_path).unwrap();
        assert!(content.contains("Laputa Vault"));
        assert!(content.contains("## Note structure"));
        assert!(content.contains("## Types"));
        assert!(content.contains("## Wikilinks"));
        assert!(content.contains("## Relationships"));
        assert!(content.contains("## Views"));
        // Must NOT be a stub
        assert!(
            !content.contains("See config/agents.md"),
            "AGENTS.md should have full content, not a redirect"
        );
    }

    #[test]
    fn test_agents_md_parseable_as_vault_entry() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("agents-parse-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        let entry = crate::vault::parse_md_file(&vault_path.join("AGENTS.md"), None).unwrap();
        // H1 is now the primary title source
        assert_eq!(
            entry.title,
            "AGENTS.md \u{2014} Laputa Vault"
        );
        // Config files have no frontmatter type field — type is None
        assert_eq!(entry.is_a, None);
    }

    #[test]
    fn test_create_getting_started_vault_initializes_git() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("git-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        assert!(vault_path.join(".git").exists());

        let log = std::process::Command::new("git")
            .args(["log", "--oneline"])
            .current_dir(&vault_path)
            .output()
            .unwrap();
        let log_str = String::from_utf8_lossy(&log.stdout);
        assert!(log_str.contains("Initial vault setup"));
    }

    #[test]
    fn test_create_getting_started_vault_no_untracked_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let vault_path = dir.path().join("clean-vault");
        create_getting_started_vault(vault_path.to_str().unwrap()).unwrap();

        let status = std::process::Command::new("git")
            .args(["status", "--porcelain"])
            .current_dir(&vault_path)
            .output()
            .unwrap();
        assert!(
            String::from_utf8_lossy(&status.stdout).trim().is_empty(),
            "All files should be committed, no untracked files"
        );
    }
}
