---
type: ADR
id: "0032"
title: "Git actions (Changes, Pulse, Commit) in status bar, not sidebar"
status: active
date: 2026-03-31
---

## Context

The Laputa sidebar originally surfaced git-related affordances — a "Changes" nav item (visible when modified files > 0), a "Pulse" nav item, and a "Commit & Push" button — alongside the note-type navigation filters and sections. This mixed two concerns in the sidebar: **navigation** (where to go) and **git status / actions** (what changed, what to do). As the sidebar grew, the git items created visual noise and made the nav hierarchy harder to scan.

## Decision

**Move Changes, Pulse, and Commit & Push out of the sidebar and into the bottom status bar.** The status bar shows a GitDiff icon with an orange count badge for modified files; a Pulse icon sits next to it. Commit & Push is accessible via an icon button beside the Changes indicator. The sidebar now contains only navigation items (filters and type sections).

## Options considered

- **Keep git items in sidebar** (status quo): familiar placement, visible at all times. Rejected — mixes navigation and action concerns; sidebar becomes harder to scan.
- **Status bar** (chosen): consistent with app conventions (build number, sync status, vault switcher already live there); persistent but unobtrusive; follows macOS app patterns where status/action items live at window bottom.
- **Toolbar / breadcrumb bar**: would require a new chrome layer or polluting the per-note breadcrumb with global git state. Rejected.

## Consequences

- Sidebar props `modifiedCount`, `onCommitPush`, `isGitVault` removed; sidebar renders navigation-only
- `StatusBar` gains `onClickPending`, `onClickPulse`, `onCommitPush`, `isGitVault` props
- Sidebar tests for Changes/Pulse/Commit button removed; StatusBar tests extended
- Users find Commit & Push in the status bar (same location as sync indicators) rather than bottom of sidebar — small discoverability change, offset by status bar being always visible regardless of sidebar collapsed state
- Triggers re-evaluation if: user research shows git actions are hard to discover in the status bar
