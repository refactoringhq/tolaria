# Tolaria server

The Tolaria remote: a small service that hosts one vault as a git working clone and exposes the file API and the collaboration channel of the [Tolaria remote protocol](../../docs/web/protocol.md). Spikes S3 (TOL-5) and S4 (TOL-8); see the spike reports for [files](../../docs/web/s3-spike-report.md) and [collaboration](../../docs/web/s4-spike-report.md).

Every save is one git commit, made after pulling from the vault's git remote and followed by a push. A write that is based on an outdated revision is saved as a conflict copy; nothing is overwritten silently.

A note can also be opened as a live Yjs document on `/v1/collab/docs/<docId>`. Edits are written to the note's markdown file on a cadence, with untouched lines byte-identical, and a commit pulled from git is merged into the live document or forked into a conflict copy.

## Run

Node 22.14 or newer and `git` on the `PATH`. From the repository root:

```bash
TOLARIA_SERVER_TOKEN="$(openssl rand -hex 24)" \
TOLARIA_VAULT_REMOTE_URL=/path/to/vault.git \
TOLARIA_SERVER_DATA_DIR=/var/lib/tolaria \
pnpm run server
```

Use `pnpm run server`: bare `pnpm server` is a pnpm built-in command.

| Variable | Default | Meaning |
|---|---|---|
| `TOLARIA_SERVER_TOKEN` | none, required | Bearer token for every route except `/healthz`. At least 16 characters. The server does not start without it |
| `TOLARIA_VAULT_REMOTE_URL` | none | Git URL of the vault. Required until the working clone exists |
| `TOLARIA_VAULT_BRANCH` | the remote's default | Branch to serve |
| `TOLARIA_VAULT_FETCH_INTERVAL_MS` | `30000` | Pull from the remote this often, so desktop pushes reach open documents. `0` pulls only before a write or on `POST /v1/sync` |
| `TOLARIA_SERVER_DATA_DIR` | `./data` | Holds `vault/` (the clone) and `state/` (doc index) |
| `TOLARIA_BLOBSTORE` | `local` | Blob store for doc index and Yjs snapshots: `local` (disk under `state/`) or `r2` (S3-compatible) |
| `TOLARIA_R2_BUCKET` | none | R2 bucket name (required when `TOLARIA_BLOBSTORE=r2` or `TOLARIA_INDEX_SNAPSHOTS=r2`) |
| `TOLARIA_R2_ENDPOINT` | none | R2 endpoint URL (required when `TOLARIA_BLOBSTORE=r2` or `TOLARIA_INDEX_SNAPSHOTS=r2`) |
| `TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT` | unset | At startup the server refuses an R2 endpoint that is, or resolves to, a private, loopback, link-local, CGNAT or metadata address. Set to `1`, together with `NODE_ENV=development`, to reach a local MinIO or podman S3; refused otherwise (the Docker image sets `NODE_ENV=production`). Every store connection is checked again after its own DNS lookup |
| `TOLARIA_R2_REGION` | none | R2 region (required when `TOLARIA_BLOBSTORE=r2` or `TOLARIA_INDEX_SNAPSHOTS=r2`) |
| `TOLARIA_R2_ACCESS_KEY_ID` | none | R2 access key (required when `TOLARIA_BLOBSTORE=r2` or `TOLARIA_INDEX_SNAPSHOTS=r2`) |
| `TOLARIA_R2_SECRET_ACCESS_KEY` | none | R2 secret key (required when `TOLARIA_BLOBSTORE=r2` or `TOLARIA_INDEX_SNAPSHOTS=r2`) |
| `TOLARIA_INDEX_SNAPSHOTS` | unset | `r2`: keep gzipped snapshots of the entry and search indexes in the R2 bucket above, so a server on a fresh disk loads them instead of reading every note. Fetched while the vault clones, caught up with the commits since (or rebuilt when more than 500 files changed, or when unreadable), published after startup and on shutdown |
| `TOLARIA_INDEX_SNAPSHOT_PREFIX` | none | Key prefix of one vault's snapshots (required with `TOLARIA_INDEX_SNAPSHOTS`), e.g. `vaults/<id>`. The server adds a digest of its own code, so it never reads snapshots of other code |
| `TOLARIA_SERVER_HOST` | `127.0.0.1` | Bind address |
| `TOLARIA_SERVER_PORT` | `8787` | Port |
| `TOLARIA_SERVER_ALLOW_NON_LOOPBACK` | unset | Set to `1` to bind a non-loopback address. The server speaks plain HTTP: only do this behind a TLS-terminating proxy |
| `TOLARIA_SERVER_MAX_BODY_BYTES` | `26214400` | Largest accepted request body, and websocket message up to 16 MiB unless `TOLARIA_COLLAB_MAX_MESSAGE_BYTES` is set |
| `TOLARIA_COLLAB` | on | Set to `0` to leave the collaboration channel unserved |
| `TOLARIA_COLLAB_IDLE_MS` | `5000` | Write an edited document this long after its last edit |
| `TOLARIA_COLLAB_MAX_WAIT_MS` | `60000` | Write it at the latest this long after its first unwritten edit |
| `TOLARIA_COLLAB_LINGER_MS` | `30000` | Keep a document without clients open this long |
| `TOLARIA_RATE_LIMIT_PER_SECOND` | `50` | Requests one account (the token) gains per second: a token bucket over every route but `/healthz` and every websocket upgrade admitted (token or ticket) or refused with the token. Beyond it: `429 rate_limited` with `Retry-After`. Requests without the token, and websocket upgrades refused (`401`, `404`) without it, share a bucket of their own |
| `TOLARIA_RATE_LIMIT_BURST` | `500` | Requests a full bucket allows at once |
| `TOLARIA_COLLAB_MAX_CONNECTIONS` | `128` | Open websockets of the account over every document; one more is refused with `429` |
| `TOLARIA_COLLAB_MAX_CONNECTIONS_PER_DOC` | `32` | Open websockets of one document |
| `TOLARIA_COLLAB_MAX_MESSAGE_BYTES` | the body limit | Largest websocket message, at most 16 MiB; a larger one closes the socket with `1009` |
| `TOLARIA_COLLAB_SOCKET_IDLE_TIMEOUT_MS` | `60000` | The server pings each websocket this often and closes one with `4408` that sent nothing since the last ping, not even a pong |

The limits (ADR 0292, "Limits" in the protocol) are sized so the web app, collaborative editing and the e2e suites stay far below them; a test that needs others sets these variables, or `rateLimit` and `collab.limits` of `createVaultServer`. Edge rate limits in front of the container are configured elsewhere.

Other users get access through access tickets (protocol 1.9, ADR 0296): a front end that holds the token signs, per request, a short-lived ticket giving one user `viewer`, `editor` or `owner` on the vault or `viewer`/`editor` on single notes, and sends it as the bearer credential. The server verifies the HMAC with a key derived from `TOLARIA_SERVER_TOKEN`, so no other setting is needed; it enforces the ticket on every route and on the websocket, and `POST /v1/access/revocations` (owner only) refuses a user's older tickets and closes the connections their remaining grants no longer cover. `signAccessTicket` in `src/accessTickets.ts` mints one for a self-hosted proxy or a test.

Git credentials for a private remote come from the environment the server runs in (SSH agent or a credential helper), never from the URL.

## Try it against a throwaway vault

```bash
pnpm server:seed /tmp/test-vault.git        # a bare repository with a fake vault
TOLARIA_SERVER_TOKEN=local-dev-token-0123456789 TOLARIA_VAULT_REMOTE_URL=/tmp/test-vault.git \
  TOLARIA_SERVER_DATA_DIR=/tmp/tolaria-data pnpm run server

curl -H 'Authorization: Bearer local-dev-token-0123456789' http://127.0.0.1:8787/v1/files
pnpm server:bench /tmp/test-vault.git 100   # latency of 100 saves; writes to that remote
pnpm run server:collab-bench /tmp/test-vault.git 30   # commit cadence of collaborative editing
```

Never point the seed, the benchmark or a test at a real vault.

## Develop

From the repository root:

| Command | What it does |
|---|---|
| `pnpm test:server` | Tests with coverage thresholds (Vitest, Node environment, real git in temporary directories) |
| `pnpm build` | Typechecks this directory with the rest of the repository (`tsc -b`) |
| `pnpm lint` | ESLint |

The file service uses Node's standard library, the system `git`, and the wire types in `packages/protocol`. The collaboration channel adds `ws`, `yjs`, `y-protocols`, `lib0`, `jsdom` and, through `packages/markdown-yjs`, BlockNote and the markdown pipeline in `src/`. That shared code is written for a bundler, so `scripts/run.ts` bundles an entry point with esbuild before running it. The three Yjs packages are not declared in `package.json` yet; `yjsResolution.ts` explains how they are resolved and why (see the S4 spike report, "Dependencies").

Like `apps/web`, this is a directory of the root package, not a pnpm workspace package, so the lockfile is untouched. The desktop app does not import it and its bundle is unchanged by it.
