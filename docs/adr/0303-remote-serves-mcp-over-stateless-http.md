---
type: ADR
id: "0303"
title: "The Tolaria remote serves MCP over stateless Streamable HTTP, hand-written, behind its existing credentials"
status: active
date: 2026-11-17
---

## Context

People want MCP access to a vault from a machine with no GUI: a Linux box, a container, a Mac in the background (feature request "Headless Tolaria mode for always-on MCP access", GitHub issue 444). The desktop MCP server (`mcp-server/`) needs the Tauri app: it reads the vault from disk, talks to the UI over a websocket bridge and leaves git to the app. The Tolaria remote (`apps/server`, ADR 0186) already is the headless process: it owns a git clone of one vault, pulls before and pushes after every write, keeps conflict copies, indexes and searches the notes, and checks a bearer token or an access ticket on every request (ADR 0296). What is missing is an MCP transport.

`apps/server` is a plain directory of the root package. A dependency it adds lands in the root lockfile and the desktop app's dependency tree.

## Decision

- The remote serves MCP on `POST /mcp`, in the stateless form of the Streamable HTTP transport: one JSON-RPC message per request body, one JSON body per answer, `202` for notifications and responses, no `Mcp-Session-Id`, no server-sent stream (`GET` and `DELETE` answer `405`). Batches are refused. It speaks MCP `2025-06-18` and `2025-03-26`.
- The transport is written on Node's standard library (`apps/server/src/mcp/`), like the rest of the server. No `@modelcontextprotocol/sdk`.
- `/mcp` goes through the same request path as `/v1`: the bearer token or an access ticket, the per-account rate limit and the body limit apply unchanged. A viewer ticket is a read-only MCP connection; commits a ticket causes name its holder as co-author (ADR 0297). No OAuth in this step.
- Seven tools, with the desktop server's names and argument names: `search_notes`, `get_vault_context`, `list_vaults`, `get_note`, `create_note`, `update_note`, `append_to_note`. Git blob ids (`etag`) replace the desktop's file times for guarded edits. UI and vault-registry tools are not offered.
- The tools call the functions the REST routes call (`apps/server/src/operations.ts`): reads, writes and searches are checked against the request's access the same way, and a write is the same vault commit, so the doc index, search index, change feed and any open live document react to it exactly as to a `PUT`. A write that lands as a conflict copy is an error result that names the copy.
- `TOLARIA_MCP=0` leaves the route unserved.

## Options considered

- **The official SDK as a dependency.** Less code to own and protocol updates for free, but it adds a dependency tree (zod, express-style helpers) to the root lockfile and the desktop app's install for a few hundred lines of transport. The stateless subset is small and stable. Rejected; revisit if the subset grows (sessions, server-to-client requests).
- **An HTTP mode in `mcp-server/`.** Reuses the desktop tool code, but that code works on a local folder, writes without git and expects the Tauri UI. Headless users would get a second git integration without conflict copies, access checks or the live-document merge. Rejected.
- **A stdio proxy that forwards to the REST API.** Works with any client that spawns a command, but every client machine needs Node and the proxy installed, and it is one more process per agent. Clients that speak HTTP MCP can reach the server directly. Not built; a client that only speaks stdio can still use a generic stdio-to-HTTP bridge.

## Consequences

- An MCP client that can send a static `Authorization` header can use a self-hosted remote; clients that require OAuth cannot yet.
- MCP reads see the server's clone, which pulls on a timer (`TOLARIA_VAULT_FETCH_INTERVAL_MS`) and before every write; unflushed live edits are not in a `get_note` until the document is written, the same as for `GET /v1/files`.
- New MCP protocol revisions need a manual update of the known-versions list; an unknown requested version is answered with the newest known one.
