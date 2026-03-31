# Architecture Decision Records

This folder contains Architecture Decision Records (ADRs) for the Laputa app.

## Format

Each ADR is a markdown note with YAML frontmatter. Template:

```markdown
---
type: ADR
id: "0001"
title: "Short decision title"
status: proposed        # proposed | active | superseded | retired
date: YYYY-MM-DD
superseded_by: "0007"  # only if status: superseded
---

## Context
What situation led to this decision? What forces and constraints are at play?

## Decision
**What was decided.** State it clearly in one or two sentences — bold so it stands out.

## Options considered
- **Option A** (chosen): brief description — pros / cons
- **Option B**: brief description — pros / cons
- **Option C**: brief description — pros / cons

## Consequences
What becomes easier or harder as a result?
What are the positive and negative ramifications?
What would trigger re-evaluation of this decision?

## Advice
*(optional)* Input received before making this decision — who was consulted, what they said, when.
Omit if the decision was made unilaterally with no external input.
```

### Status lifecycle

```
proposed → active → superseded
                 ↘ retired      (decision no longer relevant, not replaced)
```

## Rules

- One decision per file
- Files named `NNNN-short-title.md` (monotonic numbering)
- Once `active`, never edit — supersede instead
- When superseded: update `status: superseded` and add `superseded_by: "NNNN"`
- ARCHITECTURE.md reflects the current state (active decisions only)

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-tauri-react-stack.md) | Tauri v2 + React as application stack | active |
| [0002](0002-filesystem-source-of-truth.md) | Filesystem as the single source of truth | active |
| [0003](0003-single-note-model.md) | Single note open at a time (no tabs) | active |
| [0004](0004-vault-vs-app-settings-storage.md) | Vault vs app settings for state storage | active |
| [0005](0005-tauri-ios-for-ipad.md) | Tauri v2 iOS for iPad support (vs SwiftUI rewrite) | active |
| [0006](0006-flat-vault-structure.md) | Flat vault structure (no type-based folders) | active |
| [0007](0007-title-filename-sync.md) | Title equals filename (slug sync) | active |
| [0008](0008-underscore-system-properties.md) | Underscore convention for system properties | active |
| [0009](0009-keyword-only-search.md) | Keyword-only search (remove semantic indexing) | active |
| [0010](0010-dynamic-wikilink-relationship-detection.md) | Dynamic wikilink relationship detection | active |
| [0011](0011-mcp-server-for-ai-integration.md) | MCP server for AI tool integration | active |
| [0012](0012-claude-cli-for-ai-agent.md) | Claude CLI subprocess for AI agent | active |
| [0013](0013-remove-theming-system.md) | Remove vault-based theming system | active |
| [0014](0014-git-based-vault-cache.md) | Git-based incremental vault cache | active |
| [0015](0015-auto-save-with-debounce.md) | Auto-save with 500ms debounce | active |
| [0016](0016-sentry-posthog-telemetry.md) | Sentry + PostHog telemetry with consent | active |
| [0017](0017-canary-release-channel.md) | Canary release channel and feature flags | active |
| [0018](0018-codescene-code-health-gates.md) | CodeScene code health gates in CI | active |
| [0019](0019-github-device-flow-oauth.md) | GitHub device flow OAuth for vault sync | active |
| [0020](0020-keyboard-first-design.md) | Keyboard-first design principle | active |
| [0021](0021-push-to-main-workflow.md) | Push directly to main (no PRs) | active |
| [0022](0022-blocknote-rich-text-editor.md) | BlockNote as the rich text editor | active |
| [0023](0023-repair-vault-auto-bootstrap.md) | Repair Vault auto-bootstrap pattern | active |
| [0024](0024-cache-outside-vault.md) | Vault cache stored outside vault directory | active |
| [0025](0025-type-field-canonical.md) | type: as canonical field (replacing Is A:) | active |
| [0026](0026-props-down-no-global-state.md) | Props-down callbacks-up (no global state) | active |
| [0027](0027-dual-ai-architecture.md) | Dual AI architecture (API chat + CLI agent) | superseded |
| [0028](0028-cli-agent-only-no-api-key.md) | CLI agent only — no direct Anthropic API key | active |
| [0029](0029-domain-command-builder-pattern.md) | Domain command builder pattern for useCommandRegistry | active |
| [0030](0030-rust-commands-module-split.md) | Rust commands/ module split by domain | active |
| [0031](0031-full-app-for-note-windows.md) | Full App instance for secondary note windows | active |
| [0032](0032-status-bar-for-git-actions.md) | Git actions (Changes, Pulse, Commit) in status bar, not sidebar | active |
