# Plan: long-lived scoped tokens for the Tolaria remote

Follows `docs/web/mcp-endpoint-plan.md` (ADR 0303). Same feature request: [Headless Tolaria mode for always-on MCP access](https://tolaria.canny.io/feature-requests/p/headless-tolaria-mode-for-always-on-mcp-access).

## Problem

An MCP client is configured once with a static `Authorization` header. The only static credential the server accepts is the owner token (`TOLARIA_SERVER_TOKEN`). Access tickets can be scoped to `viewer` or `editor`, but they live at most 10 minutes and are all derived from the owner token, so they cannot be pasted into a client config and cannot be revoked one by one across a restart. Every connected agent therefore has full owner access.

## Goal

The person running the server creates named tokens, each with a role and optionally a list of notes, pastes one into an agent's config, and can revoke it later without touching the owner token or any other client.

## Non-goals

- OAuth, accounts, or any multi-user control plane.
- An HTTP API for managing tokens. Management is a command run on the box.
- Changes to access tickets, to the MCP tools, or to the desktop app.
- Licence metadata (see the note in the MCP plan).

## Design

### The credential

`tat1.<id>.<secret>`

- `id`: 8 random bytes, base64url. Public: it appears in listings and logs.
- `secret`: 32 random bytes, base64url. Shown once, at creation.
- The prefix must not collide with the ticket prefix (`ta1.`); put it in `packages/protocol` next to the ticket constants.

It is sent as `Authorization: Bearer tat1.…`, like the other two credentials, and is accepted everywhere they are: every `/v1` route, `/mcp`, the collaboration websocket and the change feed.

### The token file

One JSON file on local disk, default `<TOLARIA_SERVER_DATA_DIR>/tokens.json`, overridable with `TOLARIA_SERVER_TOKENS_FILE`. It is never put in the blob store (which may be R2) and never inside the vault clone.

```json
{
  "version": 1,
  "tokens": [
    {
      "id": "…",
      "name": "phone",
      "hash": "<sha256 of the secret, base64url>",
      "grants": [{ "scope": "*", "role": "viewer" }],
      "createdAt": 1790000000000,
      "expiresAt": null,
      "author": { "name": "phone", "email": "…" }
    }
  ]
}
```

- Only the hash is stored. SHA-256 is enough because the secret is 256 random bits; compare with `timingSafeEqual`.
- Grants use the existing `AccessGrant` shape and the existing validation, with one extra rule: a token is never `owner`. Roles are `viewer` or `editor`, on the vault (`*`) or on single notes.
- Written atomically (temporary file, then rename) with mode `0600`. A missing file means no tokens. A malformed file is a startup error that names the file, and after startup a malformed reload keeps the last good set and logs once.
- At most 100 tokens. Names are unique, 1 to 64 characters.

### Verification

`Credentials.of` in `apps/server/src/credentials.ts` is the single place credentials are read; add the third kind there. A token gives `Access(subject, grants, createdAt, author)` with subject `token:<id>`, so:

- The rate limit and connection limits are per token (`subjectAccount`).
- Commits it causes name the token as a co-author through the existing `access.coAuthors()` path. Default author: the token's name, with an address under a reserved `.invalid` domain built from its id. `--author-name` and `--author-email` override it. Follow the `CoAuthor` validation already in `coAuthors.ts`.
- Owner-only routes (`POST /v1/access/revocations`) stay closed to tokens.

Unknown id, wrong secret, expired, or removed: `null`, which the existing code turns into `401`. Do not distinguish these cases in the response.

### Reload and revocation

The management command edits the file while the server runs, so the server re-reads it when its modification time or size changes, checked at most once a second on the request path (no watcher). When a reload finds a token gone or expired, the server also closes that subject's open websockets and change-feed connections through the existing `Revocations` machinery, as a ticket revocation does. A revoked token must stop working within about a second, on new requests and on connections already open.

### Managing tokens

`apps/server/scripts/token.ts`, exposed as `pnpm run server:token`. It works on the file directly and needs no running server; it reads `TOLARIA_SERVER_DATA_DIR` / `TOLARIA_SERVER_TOKENS_FILE` the same way the server does.

```
pnpm run server:token add --name phone --role viewer
pnpm run server:token add --name research-agent --role editor --note projects/alpha.md --note inbox/ideas.md
pnpm run server:token add --name ci --role viewer --expires-in 30d
pnpm run server:token list
pnpm run server:token revoke phone
```

- `add` prints the full credential once, and says it will not be shown again.
- `--note` may repeat; without it the grant is on the whole vault. Paths go through the same validation as ticket scopes.
- `list` prints id, name, role, scope summary, created, expires. Never a secret or a hash.
- `revoke` takes a name or an id.
- Bad input exits non-zero with one plain line. Put the logic in `apps/server/src/` so it is unit-tested; the script only parses arguments and prints.
- Document the Docker form (`docker exec … node --experimental-strip-types apps/server/scripts/token.ts …`) and check that the script is present in the image the `Dockerfile` builds.

### Things to get right

- Secrets and hashes never reach logs, error messages or `list` output.
- A token with single-note grants: MCP `create_note` is refused (it needs vault-wide `editor`, per ADR 0303), and search and `get_vault_context` show only what the grants cover. Confirm `get_vault_context` does not leak note counts, folder names or `AGENTS.md` outside the grants; fix it if it does.
- The server refuses to start if `TOLARIA_SERVER_TOKENS_FILE` resolves inside the vault directory.

## Tests (TDD, red then green)

Unit: parsing and validation of the file; minting and verifying; expiry with an injected clock; wrong secret with a right id; a token that claims `owner` is rejected; the 100-token and name rules; reload on change and keeping the last good set on a malformed reload.

Server (real git in temporary directories, existing helpers):

1. A viewer token reads over REST and over `/mcp`; every write is refused on both.
2. An editor token writes; the commit on the remote carries the token's co-author trailer.
3. A single-note token sees only its note in list, search, `get_note` and `get_vault_context`.
4. A token still works after the clock moves past the ticket lifetime (the point of the change).
5. Revoke while the server runs: the next request is `401`, and an open collaboration websocket and an open change feed are closed.
6. A token cannot call an owner-only route.
7. Rate limits are per token: exhausting one does not affect another or the owner.
8. The command: `add` then `list` then `revoke`, against a temporary file, including file mode `0600`.

Then one manual check against a seeded throwaway vault (`pnpm server:seed`): create a viewer token with the command, connect the `claude` CLI to `/mcp` with it (use `--mcp-config <file> --strict-mcp-config` so the user's Claude config is not touched), confirm a search works and a write is refused, revoke it, confirm the client is refused. Never point any of this at a real vault.

`pnpm test:server` with its coverage thresholds, `pnpm lint` and `npx tsc --noEmit` must pass.

## Docs

- `docs/web/protocol.md`: the token credential beside the bearer token and tickets. Follow the convention the last additive protocol changes (1.9, 1.10) used for the version number and the constants in `packages/protocol`.
- `apps/server/README.md`: `TOLARIA_SERVER_TOKENS_FILE` in the variable table; a "Tokens for agents" section with the three commands; update "Connect an MCP client" to recommend a scoped token over the owner token.
- `docs/web/threat-model.md`: what a leaked token gives and how to revoke it.
- `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md`: one paragraph each where credentials are described.
- A new ADR (next free number): long-lived scoped tokens in a local hashed file, managed by a command. Options considered: longer-lived tickets, tokens in environment variables, OAuth.

## Follow-ups, not in this change

- OAuth for clients that cannot send a bearer header.
- Last-used time per token.
- A management API for a front end.
