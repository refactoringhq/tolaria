---
type: ADR
id: "0304"
title: "Agents get long-lived scoped tokens, kept hashed in a local file and managed by a command on the box"
status: active
date: 2026-11-17
---

## Context

The remote serves MCP (ADR 0303), and an MCP client is configured once with a static `Authorization` header. The only static credential the server accepted was the owner token (`TOLARIA_SERVER_TOKEN`). Access tickets (ADR 0296) can be scoped to `viewer`, `editor` or single notes, but they live at most 10 minutes and are derived from the owner token, so they cannot be pasted into a client's configuration and cannot be revoked one by one across a restart. Every connected agent therefore had full owner access, and withdrawing one meant changing the token for all of them.

The remote is self-hosted by one person on one box. It has no accounts and no database; its state is a git clone, a blob store (local or R2) and environment variables.

## Decision

- A third bearer credential, the agent token: `tat1.<id>.<secret>`, an 8-byte public id and a 32-byte secret, both base64url (protocol 1.11, capability `access.tokens`; the prefix is in `packages/protocol`).
- Tokens live in one JSON file on local disk, `TOLARIA_SERVER_TOKENS_FILE`, default `<TOLARIA_SERVER_DATA_DIR>/tokens.json`: never in the blob store, which may be R2, and never in the vault clone (the server refuses to start when the file resolves inside it). Each entry has the id, a name, the SHA-256 of the secret, grants, created and expiry times and a git author. SHA-256 is enough because the secret is 256 random bits; it is compared with `timingSafeEqual`. The file is written by a temporary file and a rename, with mode `0600`. At most 100 tokens, names unique.
- Grants use the access-ticket shape and validation, except that a token is never `owner`: `viewer` or `editor` on the vault or on single notes.
- `Credentials.of` reads the token beside the owner token and tickets and gives `Access` with subject `token:<id>`, so rate limits, websocket limits and `Co-authored-by` attribution (ADR 0297) work per token through the existing paths. Default author: the token's name at `<id>@tokens.tolaria.invalid`.
- The server re-reads the file when its `stat` (inode, size, modification time) changes, checked at most once a second on the request path and by a one-second unreferenced timer, with no file watcher. A token that disappears or expires is handed to `Revocations` like a revoked ticket subject, which closes its open websockets and change feeds. A malformed file stops startup with its name; a malformed reload keeps the last good set and logs once.
- Tokens are managed by `pnpm run server:token add|list|revoke` (`apps/server/scripts/token.ts`, logic in `apps/server/src/agentTokenAdmin.ts`), which edits the file directly and needs no running server. It runs under plain `node --experimental-strip-types`, so it works inside the container image. There is no HTTP API for tokens. Secrets are printed once by `add`; secrets and hashes never reach logs, error messages or `list`.

## Options considered

- **Longer-lived access tickets.** No new state, but a ticket is a signed bearer value with no server-side record: revoking one needs a cutoff per subject that must outlive the ticket, so a one-year ticket means a one-year revocation list in memory that a restart loses. Rejected.
- **Tokens in environment variables** (`TOLARIA_SERVER_AGENT_TOKENS=name:role:secret,…`). No file to manage, but adding or revoking one means editing the deployment and restarting, which closes every client; secrets sit in plain text in the environment and in process listings of some platforms. Rejected.
- **OAuth.** What MCP specifies for remote servers and what some clients require, but it needs an authorization server, consent screens, client registration and token storage: a control plane the self-hosted remote does not have. Left as a follow-up for clients that cannot send a bearer header.

## Consequences

- A person can give each agent the least access it needs and revoke it alone, within about a second, without touching the owner token.
- Reading the token file costs one `stat` per second at most, whatever the request rate; a file change costs one small synchronous read.
- The file must be on persistent local disk next to the clone; a container without a volume for its data directory loses its tokens on replacement.
- A server with several replicas (not supported today) would need the file on each, or a shared store.
- Last-used times and a management API for a front end are not recorded; both can be added without changing the credential.
