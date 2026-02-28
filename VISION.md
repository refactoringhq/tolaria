# Laputa — Vision

Laputa is a personal knowledge base where humans and AI agents collaborate as equals.

---

## Core principles

### 1. The vault is the source of truth
Everything lives in the vault as plain text files. Notes, relations, configuration, instructions — all Markdown with YAML frontmatter. No proprietary database, no hidden state. If you can open a terminal, you can read your vault. If you can write Markdown, you can modify it.

### 2. Vault-native configuration
Laputa configures itself through files inside the vault — the same files you write and read every day. There is no separate "settings app" or admin panel. If you want to change a theme, you edit a note. If you want to give instructions to an AI agent, you write a note. If you want to define a template, you create a note.

This applies to:
- **`_themes/`** — themes as notes with a YAML block in the body. Edit `_themes/dark.md`, see the colors change in real time.
- **`AGENTS.md`** — instructions for AI agents. Write what you want them to know about your vault in plain language. They read it before acting.
- **`_templates/`** — note templates per type. Create `_templates/event.md` and every new event starts from that structure.
- **`_procedures/`** — recurring tasks as notes with a `schedule` frontmatter field.

The principle: **if it can be expressed in frontmatter + Markdown, it doesn't need a UI**.

### 3. Structure through types, not folders
Notes have a `type` field. Types determine folders, icons, and colors — but the structure is defined by the data, not the filesystem hierarchy. You can query "all events in February" without knowing anything about folder layout.

Relations between notes are expressed as frontmatter arrays: `people: [Marco, Sara]`. A wikilink `[[Marco]]` in the body navigates to the person note. The graph emerges from the data, not from a separate graph database.

### 4. The file is the interface
You can use Laputa's UI, or you can open a terminal. Or a text editor. Or Claude Code. They all operate on the same files. There is no difference between "the app" and "the vault" — the vault is the app.

This is why Laputa has an MCP server: external agents get the same tools the in-app AI panel uses. The interface is a convenience, not a requirement.

### 5. Humans and AI as collaborators
Pulse — the activity feed — shows the history of the vault without distinguishing between human commits and agent commits. That's intentional. Laputa is designed to be a space where you and your AI agents work together, each contributing to the same knowledge base.

The AI doesn't have a separate workspace. It works in yours.

---

## What Laputa is not

- Not a todo app (though you can use it as one)
- Not a note-taking app that syncs to the cloud (the vault is yours, sync however you want — git, iCloud, rsync)
- Not a replacement for a terminal (power users will use both)
- Not trying to abstract away git (git is a feature, not an implementation detail)

---

## The long game

A vault that grows with you for years. Events, people, projects, thoughts — all interconnected, all version-controlled, all accessible to any tool that can read a file.

Ten years from now, your vault should still be readable. Plain text is forever.
