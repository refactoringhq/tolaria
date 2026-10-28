# Manage Display Preferences

Source: guides/manage-display-preferences.md
URL: /guides/manage-display-preferences

# Manage Display Preferences

Display preferences live in local app settings unless a setting is intentionally stored in the note or vault.

## Theme

Choose Light, Dark, Hybrid, or System in Settings:

- **Light** — Light sidebar and light note content.
- **Dark** — Dark sidebar and dark note content.
- **Hybrid** — Dark sidebar with light note content.
- **System** — Follows the operating system appearance at runtime.

You can also switch to Light, Dark, or System from the command palette. Hybrid is only in Settings for now.

## Note Width

Set the default rich-editor width in Settings:

- **Normal** for focused writing.
- **Wide** for tables, diagrams, dense notes, and generated documents.

An individual note can override the default width from the editor toolbar. That override is stored as `_width` in the note frontmatter.

## Sidebar Labels

Tolaria can pluralize type names in the sidebar. Turn this off in Settings if your type names should be shown exactly as written, or use `_sidebar_label` on a type document for an explicit label.

## Vault Content

Settings also control whether Gitignored files and non-Markdown file categories are visible in the app. Use these controls to keep generated or local-only files out of regular note workflows.