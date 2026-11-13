---
type: ADR
id: "0065"
title: "Root-managed AI guidance files with Claude shim"
status: active
date: 2026-04-14
---

## Context

Tolaria now supports multiple local CLI agents, but vault-level guidance still carried legacy assumptions. Existing vault bootstrap and repair flows centered on `config/agents.md`, while modern coding agents expect instructions at the vault root. That mismatch made managed guidance harder to reason about, left Claude Code compatibility implicit, and gave the UI no reliable way to distinguish between Tolaria-managed files that can be repaired and user-authored custom guidance that must be preserved.

## Decision

**Tolaria manages vault AI guidance at the vault root.** `AGENTS.md` is the canonical shared guidance file. Claude Code now reads `AGENTS.md` natively, so `CLAUDE.md` remains an optional compatibility shim for older Claude Code versions but its absence or damage does not make a vault unhealthy when `AGENTS.md` is valid. Tolaria continues to classify managed guidance files so repair flows restore only Tolaria-managed guidance without overwriting custom user files. Gemini CLI still uses `GEMINI.md` by default, so its compatibility shim remains required unless users configure another context filename.

## Options considered

- **Root `AGENTS.md` as canonical, with optional Claude shim and required default Gemini shim** (chosen): keeps one source of truth while matching current Claude Code and Gemini CLI discovery behavior.
- **Keep managed guidance under `config/agents.md`**: preserves the older structure, but hides a user-facing integration contract behind legacy config paths and keeps Claude compatibility indirect.
- **Maintain separate full instruction files for each agent**: simple per tool, but duplicates instructions and increases drift risk whenever guidance changes.

## Consequences

- New and repaired vaults may seed `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` at the vault root for compatibility; Claude shim status does not trigger a warning while valid `AGENTS.md` exists.
- Legacy `config/agents.md` content is migrated forward when safe, then the obsolete file is removed.
- The status bar and command palette can expose a first-class restore action because backend guidance state is normalized.
- Custom root guidance files are preserved instead of being silently overwritten by repair flows.
- Tolaria keeps a single shared guidance document even while supporting multiple CLI agents.
- Re-evaluate if supported agents stop relying on root-level files or if future agent integrations require materially different vault instructions instead of a shared source of truth.
