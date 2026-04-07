# CLAUDE.md — Laputa Vault

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
- Edit `CLAUDE.md` (this file)

Do not modify app configuration files — those are local to each installation.
