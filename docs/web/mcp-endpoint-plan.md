# Plan: MCP endpoint on the Tolaria remote (headless MCP)

Feature request: [Headless Tolaria mode for always-on MCP access](https://tolaria.canny.io/feature-requests/p/headless-tolaria-mode-for-always-on-mcp-access) (GitHub issue 444).

## Goal

A person runs `apps/server` on a box with no GUI (bare Linux, Docker, a Mac in the background) and points an MCP client at it. The client can search, read, create and edit notes in the vault. The server keeps the vault in step with its git remote, so the desktop and mobile apps see the agent's edits and the agent sees theirs.

`apps/server` already provides the headless process, the git clone, pull/commit/push with conflict copies, the search index, bearer-token auth, access tickets and rate limits. This plan only adds an MCP transport on top of those services.

## Non-goals for this change

- OAuth. Auth is the existing bearer token or access ticket. OAuth for clients that cannot send a static header is a follow-up.
- Changes to the desktop `mcp-server/` package or the Tauri app.
- UI tools (`open_note`, `highlight_editor`, `refresh_vault`) and vault registry tools (`attach_vault`, `clone_vault`). The server hosts one vault and has no UI.
- TLS. The server stays plain HTTP behind a proxy, as today.
- Licence metadata. `docs/web/licensing-boundary.md` lists an "Agent API gateway" as proprietary and is still a draft; whether this endpoint lands upstream is the owner's call. Add no licence headers or files.

## Design

### Transport

MCP Streamable HTTP in its stateless form, on one route: `POST /mcp`.

- The body is one JSON-RPC 2.0 message. A request is answered with `200` and `content-type: application/json` holding the JSON-RPC response. A notification or a response is answered with `202` and no body.
- `GET /mcp` and `DELETE /mcp` answer `405` with an `allow` header: the server opens no SSE stream and keeps no session, so it sends no `Mcp-Session-Id`.
- Methods: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`. Any other method gets JSON-RPC error `-32601`. Malformed JSON gets `-32700`, a malformed message `-32600`, bad tool arguments `-32602`.
- `initialize` answers with the client's requested protocol version when it is one the server knows (`2025-06-18`, `2025-03-26`), otherwise with the newest it knows. Capabilities: `{ tools: {} }`. A later request whose `MCP-Protocol-Version` header names an unknown version gets `400`.
- A JSON array body (the batching that `2025-03-26` allowed) is refused with `-32600`; say so in the protocol doc.
- A tool that fails returns a normal result with `isError: true` and a plain message, as the desktop server does. Transport and auth failures stay HTTP errors (`401`, `429`, `413`) from the existing code path.

Write this by hand on Node's standard library, as the rest of the file service is. Do not add `@modelcontextprotocol/sdk` to the root package: `apps/server` is a directory of the root package and the SDK would land in the desktop app's lockfile. If the hand-written transport turns out not to interoperate with a real client, stop and report instead of adding the dependency.

### Auth, limits and access

`/mcp` goes through the same `answer()` path in `apps/server/src/server.ts` as every `/v1` route, so the bearer check, the per-account rate limit and the body size limit apply unchanged. Each tool enforces the request's `Access`:

- Read tools use `requireRead` and filter lists with `access.visible`, exactly as the matching REST handler does.
- `create_note` needs `requireVaultWrite`; `update_note` and `append_to_note` need `requireWrite` on the path.
- A viewer ticket therefore gives an agent a read-only connection. Commits caused by a ticket carry `access.coAuthors()`, as REST writes do.

`TOLARIA_MCP=0` leaves the route unserved (404), mirroring `TOLARIA_COLLAB=0`. Default: on.

### Tools

Same names and argument names as the desktop server (`mcp-server/index.js`) so prompts and agent instructions carry over. `vaultPath` arguments are not offered: there is one vault.

| Tool | Behaviour on the server |
|---|---|
| `search_notes` `{query, limit?}` | The search index, as `GET /v1/search` does. Title, path and snippet per hit |
| `get_vault_context` `{}` | Vault name, branch, note count, types, top-level folders, recent notes, and the text of a root `AGENTS.md` when it exists and is readable |
| `list_vaults` `{}` | The one served vault, for parity with clients that call it first |
| `get_note` `{path}` | `{path, frontmatter, content, etag}`. `etag` replaces the desktop's `mtimeMs` |
| `create_note` `{path, content?, title?, type?}` | Creates only: fails when the path exists (the `If-None-Match: *` precondition). Path must end in `.md` |
| `update_note` `{path, content, expectedEtag?}` | Replaces the whole note. With `expectedEtag` it fails when the note changed since it was read; without it, it writes over the current revision |
| `append_to_note` `{path, content}` | Appends to the body through `Vault.update`, so a concurrent change is not lost |

Tool annotations (`readOnlyHint` and friends) follow the desktop server.

Rules for the handlers:

- **Call what the REST handlers call.** Each tool must go through the same internal function as its REST counterpart in `apps/server/src/routes.ts`, not straight to `Vault`, wherever the REST handler does more (path validation, access checks, a note that is open as a live Yjs document, doc index updates, the change feed). If a REST handler's logic is inline, extract it into a shared function and have both callers use it. Before writing the write tools, read how `PUT /v1/files/<path>` treats a note that is currently open in a collaboration room and make the MCP write behave identically.
- **Conflict copies.** When a write lands as a conflict copy, the tool result says so and names the copy's path. It is not reported as plain success.
- **Frontmatter.** Reuse a parser already in the repository (`gray-matter` is a root dependency if the server does not already have its own). Never rewrite or reformat frontmatter on `append_to_note`.

### Code layout

- `apps/server/src/mcp/jsonRpc.ts`: parsing and replying, error codes, protocol version choice. No vault knowledge.
- `apps/server/src/mcp/tools.ts`: tool definitions and handlers over `Services` and `Access`.
- `apps/server/src/mcp/route.ts`: the `POST /mcp` handler that joins the two.
- `apps/server/src/routes.ts`: register `/mcp` in the route table. `apps/server/src/config.ts`: `TOLARIA_MCP`.

Keep each file small and each function simple; the repository gates on CodeScene file health.

## Tests (TDD, red then green)

`apps/server/test/mcp.test.ts`, with the existing helpers (real git repositories in temporary directories, `DesktopClone` standing in for the desktop app):

1. Handshake: `initialize` → `notifications/initialized` (202) → `tools/list` returns the seven tools.
2. No credential → `401`; wrong method → `405`; unknown JSON-RPC method → `-32601`; bad JSON → `-32700`; batch array refused.
3. Each read tool against the seed vault.
4. `create_note` makes exactly one commit that reaches the remote; creating the same path again is an error result.
5. `update_note` with a stale `expectedEtag` is an error result and changes nothing; with a current one it commits.
6. `append_to_note` keeps the existing bytes, frontmatter included, byte-identical.
7. Desktop pushes a note, the server pulls, `get_note` and `search_notes` see it.
8. Desktop and MCP change the same note: the result names the conflict copy and both versions exist.
9. Viewer ticket: reads work, every write tool is refused, notes outside a single-note grant are invisible in search and `get_note`.
10. `TOLARIA_MCP=0` → 404. Rate limit applies to `/mcp`.

Then one manual end-to-end check with a real MCP client against a throwaway vault (`pnpm server:seed`), for example `claude mcp add --transport http tolaria http://127.0.0.1:8787/mcp --header "Authorization: Bearer <token>"` and a search, a read and a write. Record what was run and what the client printed. Never point any of this at a real vault.

`pnpm test:server` must pass with its coverage thresholds, plus `pnpm lint` and `npx tsc --noEmit`.

## Docs

- `docs/web/protocol.md`: an "MCP endpoint" section (route, auth, methods, tools, error mapping, no batching, no sessions).
- `apps/server/README.md`: `TOLARIA_MCP` in the variable table and a short "Connect an MCP client" section with a client config example and the sync behaviour in two sentences.
- `docs/ARCHITECTURE.md`: one paragraph under "Tolaria remote".
- A new ADR in `docs/adr/` (next free number): the remote serves MCP over stateless Streamable HTTP, hand-written, behind the existing credentials. Options considered: SDK dependency, HTTP mode in `mcp-server/`, stdio proxy.

## Follow-ups, not in this change

- OAuth 2.1 (protected-resource metadata and an authorization server) for clients that cannot send a bearer header.
- A published image or one-line install for self-hosters.
- History, rename and delete tools once the first set has been used.
