---
type: ADR
id: "0034"
title: "Git repo required — blocking modal enforces vault prerequisite"
status: active
date: 2026-04-01
---

## Context

ADR-0014 (git-based vault cache) and ADR-0021 (push-to-main workflow) both assume the vault is a git repository, but neither codified it as a hard enforcement. In practice, opening a non-git folder silently degraded: the cache couldn't compute a commit hash, Pulse/Changes were empty, and commit/push commands failed. The failure mode was invisible to users.

## Decision

**When the app opens a vault that has no `.git` directory, a blocking modal prevents all app use until the user either initialises a git repository (git init + initial commit, offered as a one-click action) or selects a different vault. The check is performed by a new `is_git_repo` Tauri command. In browser/dev mode, the check fails open (modal is skipped).**

## Options considered

- **Option A** (chosen): Hard block via modal on vault open — unambiguous, prevents silent failures, surfaces the fix immediately. Downside: breaks existing workflows for users with non-git vaults; requires a clear escape hatch (choose different vault).
- **Option B**: Soft warning banner, allow using the app without git — avoids blocking users, but silent failures persist for Pulse/Changes/commit features.
- **Option C**: Auto-init git on vault open without asking — less friction, but surprising; user may not want their vault in git.

## Consequences

- Git is now a first-class prerequisite for Laputa vaults, not just implied by the cache strategy.
- The `is_git_repo` command is intentionally lightweight (checks for `.git` existence only; does not validate remote or commit history).
- The modal offers `git init` + an initial commit as a one-click path, lowering the barrier for new users.
- Browser mode bypasses the check so dev/Storybook workflows are unaffected.
- Re-evaluate if Laputa needs to support non-git vaults (e.g., iCloud-only, shared network drive); at that point ADR-0014 would also need revisiting.
