---
type: ADR
id: "0308"
title: "Discover saved views from Tolaria remote files"
status: active
date: 2026-11-24
---

## Context

Tolaria Web can list remote note entries and folders, but its `VaultBackend.chrome.listViews` operation was unavailable. The desktop stores each saved view as YAML in the vault's `views/` directory, so phone users could not reach saved views from the shared sidebar.

## Decision

The remote backend lists the `views/` file prefix, reads direct-child `.yml` and `.yaml` definitions, parses them with the `yaml` package, and passes valid definitions through the shared view normalization. It orders views by their configured order and then filename. Malformed definitions are skipped and left untouched, matching desktop behavior. The remote operation is read-only; view editing remains outside this change.

## Consequences

- Remote Web navigation can show the same saved views as the desktop without adding a server route or changing the wire protocol.
- The client has a direct `yaml` dependency for the remote file format.
- Nested files and other extensions are ignored. Invalid YAML remains in the vault for later repair.
