---
type: ADR
id: "0036"
title: "External rename detection via git diff on focus regain"
status: active
date: 2026-04-01
---

## Context

Laputa handles in-app renames (rename.rs) and propagates wikilink updates across the vault. But notes can also be renamed externally — from Finder, another editor, or a git operation (e.g., `git mv`). In those cases, the app had no way to detect that a rename had occurred, leaving wikilinks broken and the vault inconsistent.

The app already uses git for the cache (ADR-0014) and requires git as a vault prerequisite (ADR-0034), making git diff a natural and already-available detection mechanism.

## Decision

**When the app window regains focus, run `git diff --diff-filter=R --name-status HEAD` to detect file renames that occurred since the last committed HEAD. If any renamed `.md` files are found, show a non-blocking banner ("X file(s) renamed — update wikilinks?"). Accepting triggers the existing vault-wide wikilink replacement logic (reused from rename.rs). Ignoring dismisses the banner without changes. New Tauri commands: `detect_renames` and `update_wikilinks_for_renames`.**

## Options considered

- **Option A** (chosen): Git diff on focus regain, non-blocking banner — uses existing infrastructure, non-disruptive, user retains control. Downside: only detects renames that are staged/committed; uncommitted renames via `git mv` are captured, but renames done purely in Finder (no git involvement) are not.
- **Option B**: `FSEvents` / file-system watcher for rename events — catches all renames regardless of git. Downside: significantly more complex, requires Rust async machinery, false positives from editor temp files, and this feature is already planned as a separate enhancement.
- **Option C**: Scan for broken wikilinks on focus — correct but O(n) and noisy; doesn't tell us the new filename.

## Consequences

- Git's rename detection (`--diff-filter=R`) requires the rename to be git-tracked (either staged or committed); renames that happen outside git knowledge are not detected by this mechanism.
- The on-focus check runs `git diff HEAD` which is fast but adds a small shell invocation overhead each time the window activates. This is acceptable for typical vault sizes.
- `rename.rs` is now shared between in-app renames and external rename recovery — the replacement logic is the canonical entry point for wikilink bulk updates.
- The banner is non-blocking and "Ignore" is always available — the user never loses work.
- Re-evaluate if FS-level rename detection (outside git) becomes a priority; at that point this mechanism would be a fallback, not the primary strategy.
