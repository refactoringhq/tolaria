---
type: ADR
id: "0312"
title: "Note history and restore through store-agnostic checkpoints on the Tolaria remote"
status: active
date: 2026-11-25
---

## Context

Every web save is already a git commit on the server (ADR 0309), but a Tolaria Web user had no way to see a note's earlier versions or get one back without a git client (TOL-421). Hosting will later keep checkpoints in Cloudflare Artifacts instead of the commit log, so whatever the web app learns to speak must not assume git.

We looked at three history surfaces before choosing the interaction. Notion opens "Version history" from the page's `•••` menu: a list of versions with times and authors beside a preview, and "Restore version", which adds a new version. Google Docs shows a right-hand list of versions, highlights what changed, and "Restore this version" also becomes a new version. Obsidian Sync's version history is a list of timestamps with a preview, a toggle to show changes, and a Restore button. GitHub's file history lists commits per file and shows each diff, but restoring is left to git.

## Decision

- Protocol 1.11 adds `GET /v1/history/<path>` (a note's checkpoints, newest first, with `id`, `time`, `author`, `message`; `?checkpoint=<id>` serves that version's bytes) and `POST /v1/restore` (`{ path, checkpoint }` answered with a `WriteResult`), behind the capabilities `history.read` and `history.restore`. A checkpoint `id` is opaque: the git server uses the full commit id and validates it as one; another store can use its own ids without a protocol change.
- Restore writes the checkpoint's content as a new commit (an explicit overwrite, like `If-Match: *`). Nothing is reset, every later checkpoint stays listed and readable, and an open live document takes the restored content through the same reconciliation as any other commit. Reading needs read access to the note; restoring needs write access.
- The diff is computed in the web client (`src/lib/noteHistory/lineDiff.ts`, a line LCS) between the note as the server has it now and the checkpoint, so the server only stores and serves versions.
- The web app opens it the Notion way: "Version history" in the note's `⋯` menu opens a right-hand drawer with the list, the diff against the current note, and "Restore this version"; viewers get the list and the diff without the button.

## Consequences

- Moving checkpoints to Cloudflare Artifacts means a new implementation of the two routes on the server side; the web client and the wire format stay as they are.
- Only notes (`.md`) have a history; attachments and vault-wide rollback are out of scope.
- The history follows a note's current path; versions from before a rename are not listed under the new name.
- The desktop keeps its own git history panel; the web inspector no longer asks the mock git layer for one.
