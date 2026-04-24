---
type: ADR
id: "0080"
title: "Optional Git integration — non-Git vaults open normally with a user-initiated enable path"
status: active
date: 2026-04-24
supersedes: "0034"
---

## Context

ADR-0034 made Git a hard prerequisite: opening a vault without a `.git` directory displayed a blocking modal that prevented all app use until the user either ran `git init` or switched vaults. This choice was made to prevent silent failures (empty Pulse/Changes, broken commit) from invisible degradation.

The blocking gate turned out to be a significant adoption barrier:
- Users migrating from Obsidian or other Markdown tools already have notes in plain folders with no Git history.
- Users who want version control only optionally, or not at all, are forced into a Git decision before they can use the app.
- The escape hatch ("Choose another vault") is confusing — it implies the user's existing vault is wrong rather than that Git is simply not yet enabled.

The backend already tolerated non-Git vaults: `scan_vault_cached` falls back to a full filesystem scan when `git_head_hash` is unavailable (ADR-0014's fallback path), and `get_modified_files` etc. fail gracefully with an error that the frontend already surfaced through `isGitVault = !vault.modifiedFilesError`.

## Decision

**Git is optional per-vault. A vault without a `.git` directory opens normally. Git features are disabled but visible as an opt-in the user can enable at any time.**

Concrete changes:

- The `GitRequiredModal` blocking gate is removed. The app renders the full vault UI immediately for any scannable directory.
- `useGitRepoStatus(vaultPath)` is a new hook that checks `is_git_repo` (the same lightweight Tauri command) and exposes `{ isGitVault, refresh }`. The hook defaults to `true` (fail-open) on error and in browser/dev mode, preserving the existing behavior for those environments.
- `isGitVault` in App.tsx now comes from `useGitRepoStatus` rather than `!vault.modifiedFilesError`, making it an explicit, up-to-date signal rather than an error-derived heuristic.
- When `!isGitVault`, Git-dependent status-bar badges (Changes, Commit, Sync, Conflicts, NoRemote, Pulse/History) are hidden. A single `EnableGitBadge` appears in their place.
- Clicking `EnableGitBadge` (or the "Enable Git" button in Settings → Git section, or the "Enable Git for This Vault" command palette entry) opens `EnableGitDialog`, which runs `init_git_repo` and calls `refresh()` on success. The UI immediately reflects the newly Git-enabled state.
- `init_git_repo` (Tauri command) is now idempotent: if `.git` already exists it returns `Ok(())` rather than producing a confusing double-init error.
- `init_git_repo` on a populated non-Git directory works correctly: `git init` → `ensure_gitignore` → `git add .` → "Initial vault setup" commit. All pre-existing files land in the initial commit. This was already the behavior; a Rust test now covers it explicitly.
- The command palette exposes only the `enableGit` command when `!isGitVault` and all normal Git commands when `isGitVault`.
- Settings → Git section shows the "Enable Git" CTA and hides the AutoGit/auto-pull controls when `!isGitVault`, and shows the full AutoGit controls when `isGitVault`. This avoids presenting non-functional toggles.
- Mobile: `is_git_repo` already returns `false` on mobile. The non-Git flow is now the intended and consistent mobile behavior, not a special case.

## Consequences

- Existing users with Git vaults see no behavior change.
- Users opening plain Markdown folders (Obsidian migrations, shared drives, etc.) can now use the app immediately and enable Git on their own schedule.
- ADR-0014 (git-based vault cache): the non-Git fallback path (full filesystem scan when `git_head_hash` is unavailable) is now an explicitly supported, first-class mode rather than a silent degradation. No change to the cache implementation is required.
- ADR-0070 (local-first remote connection) remains consistent: "Git on, remote off" was already a valid state. "Git off" is now also valid.
- Silent failures (empty Pulse/Changes/commit when Git was absent) are replaced by explicit UI absence — the badges simply do not appear until Git is enabled, so there is nothing to fail silently.
- The ADR-0034 concern about invisible degradation is addressed by making the Git-off state explicit and surfaced through a CTA rather than hidden.
