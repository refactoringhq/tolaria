---
type: ADR
id: "0310"
title: "Acknowledged saves keep their path when a background push meets a remote change"
status: active
date: 2026-11-24
---

## Context

ADR 0309 took the git remote off the save path: a save is answered once it is committed in the server's clone, and the commit reaches GitHub a few seconds later. When another device pushed the same file in between, the push is rejected and `GitSync` replays the server's commits onto the remote's history. The replay kept ADR 0186's rule: the remote's version keeps the path and the server's own version moves to a conflict copy.

That rule was made for a write that pulls first and is told `conflict` at once. After ADR 0309 the server's version has already been answered `updated` at its path. Moving it later contradicts that answer. Worse, a live note open in the web editor then adopted the desktop's text, and the web edits were only in a copy nobody was told about. The web conflict-copy end-to-end test (TOL-15) caught it.

## Decision

**With background pushes, a replay keeps the server's acknowledged version of a file both sides changed at its path, and saves the remote's version next to it as the conflict copy. Live documents are told about that copy.**

- `GitSync` takes `keepLocal` (`SyncOptions`). `Vault` sets it whenever pushes run in the background (`pushDebounceMs > 0`). With `pushDebounceMs: 0` every write still pulls first, and the ADR 0186 rule stays: the remote keeps the path and the write is answered `conflict`.
- The replay reports each such file as an `upsert` change with `conflictCopy` set to the copy's path. `CollabHub` passes it to the note's `NoteSession`, which names it in `meta.conflictCopy`, as a fork does (ADR 0290). The web shell then shows `ConflictCopyNotice`.
- A local deletion of a file the remote changed is still dropped, so the remote's edit is kept.

This supersedes the replay rule in ADR 0309's Consequences ("answered `updated` and becomes a conflict copy … a few seconds later") for background pushes.

## Alternatives considered

- **Keep the remote's version at the path and rewrite the live document**: the people typing lose the text under their cursor, and a save already answered `updated` silently moves.
- **Let the session fork again after the replay**: two copies of the same conflict, one of them holding the web's own text.
- **Pull before every save again**: brings GitHub back onto the save path (ADR 0309).

## Consequences

- A save answered `updated` stays at its path. The desktop's crossing version is in a conflict copy, and editors of the live note are told about it. Nothing is overwritten.
- A desktop user who pulls after such a crossing sees their own version in the copy, as when a live web editor forks (protocol 1.5).
