---
type: ADR
id: "0076"
title: "Note retargeting separates type changes from folder moves"
status: active
date: 2026-04-22
---

## Context

ADR-0025 made `type:` the canonical classification field, and ADR-0033 reopened subfolders as a valid way to organize files in the vault. Once Tolaria exposed both type sections and the folder tree in the sidebar, note reorganization had an unresolved ambiguity: does retargeting a note mean changing its semantic type, moving its file, or both?

Without an explicit model, drag-and-drop and command-palette flows would need to duplicate their own validation and persistence logic, and Tolaria could easily drift back toward the old type-folder coupling that ADR-0006 deliberately removed.

## Decision

**Tolaria treats note retargeting as one shared interaction model with two distinct mutation paths: types change metadata, folders change file paths.**

- Retargeting a note to a type updates only the note's `type:` frontmatter. The file stays where it is.
- Retargeting a note to a folder preserves the current filename and `type:` value, and moves the file through the same crash-safe rename transaction pipeline used for backend rename commands.
- Drag/drop targets and command-palette actions both route through the same frontend retargeting abstraction so validation, dialogs, collision handling, and success/error behavior stay consistent.

## Options considered

- **Shared retargeting model with separate type-vs-folder semantics** (chosen): preserves ADR-0025/ADR-0006's decoupling of type from path, lets folder moves reuse ADR-0075's crash-safe rename guarantees, and keeps multiple UI surfaces behaviorally aligned.
- **Treat folders as the source of truth for note type**: simpler mental model for some vaults, but it reintroduces path-based type inference and makes type changes depend on file moves again.
- **Implement drag/drop and command-palette retargeting as separate flows**: lower short-term coordination cost, but it duplicates mutation rules and makes consistency regressions likely.

## Consequences

- Type sections are semantic targets only; they must never imply a filesystem move.
- Folder targets are physical move operations; they must preserve filename/title behavior, reject collisions, and rewrite path-based wikilinks through the shared rename pipeline.
- Future note-retargeting surfaces should reuse the shared retargeting abstraction instead of introducing another mutation path.
- Re-evaluate this ADR if Tolaria later supports bulk retargeting, folder rules that intentionally infer type, or another organization primitive that needs different semantics.
