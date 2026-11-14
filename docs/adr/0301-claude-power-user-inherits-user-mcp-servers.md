---
type: ADR
id: "0301"
title: "Claude Code Power User inherits the user's MCP servers"
status: proposed
date: 2026-11-09
---

## Context

ADR-0092 introduced per-vault Vault Safe / Power User modes and rejected a global toggle; ADR-0103 maps the modes per adapter. Claude Code runs with Tolaria's inline `--mcp-config` plus `--strict-mcp-config` in both modes, so Claude ignores every MCP server the user configured for Claude Code: user and project scope, plugins, and claude.ai connectors. Every other adapter keeps the user's MCP servers: Codex adds Tolaria through `-c` overrides, GitHub Copilot through `--additional-mcp-config`, OpenCode, Pi, Kiro and Antigravity merge Tolaria into the user's configuration, and Hermes uses the user's configuration unchanged. Users ask for parity on Canny ("Support all MCP configured in Claude user scope"). `--strict-mcp-config` arrived together with removing `--dangerously-skip-permissions`; since then Claude's own permission rules gate every tool call.

## Decision

**Claude Code Power User keeps Tolaria's inline `--mcp-config` but omits `--strict-mcp-config`, so the user's own Claude MCP servers load next to Tolaria MCP. Vault Safe keeps `--strict-mcp-config`.**

## Options considered

- **Power User omits `--strict-mcp-config`** (chosen): reuses the explicit per-vault opt-in, keeps Tolaria MCP, adds no setting. Calls to user MCP tools still need the user's own allow rules.
- **Global `strict_mcp_config` setting (PR #788)**: also covers managed enterprise configs, but adds a hidden global toggle, which ADR-0092 rejected, and drops Tolaria MCP when disabled.
- **Omit `--strict-mcp-config` in both modes**: full parity with other adapters, but Vault Safe would no longer be limited to file, search and edit tools.
- **Also pass `--setting-sources user,local`**: keeps servers from the vault's `.mcp.json` from starting, but Power User would also ignore the vault's shared `.claude/settings.json`, such as allow rules and environment settings.
- **Merge user servers into the inline config**: duplicates Claude's own scope resolution and cannot include plugins or claude.ai connectors.

## Consequences

- Power User Claude runs can use the user's MCP servers. In `acceptEdits` print mode, calls without a matching allow rule are denied.
- Power User also starts servers defined in the vault's `.mcp.json`. In print mode, Claude Code starts them without asking for approval; only their tool calls need allow rules. Like shell access, Power User is therefore meant for vaults the user trusts.
- Tolaria's inline server wins over a same-named server from other scopes, so an externally registered `tolaria` entry does not shadow the vault-bound one.
- In print mode, claude.ai connectors connect in the background and can be missing in the first model turn. `MCP_CONNECTION_NONBLOCKING=0` would make them available immediately at the cost of several seconds of startup time. Re-evaluate if users need connectors in the first turn.
- Managed enterprise MCP configs that reject `--mcp-config` remain unsupported and need a separate fallback change.
