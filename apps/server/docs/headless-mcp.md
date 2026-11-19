# Run Tolaria's MCP on a box with no GUI

This guide sets up the Tolaria remote (`apps/server`) on a Linux server or a Mac that runs in the background, and connects an AI agent to it over MCP (the Model Context Protocol, which agents use to call tools). Settings and commands are described in full in the [server README](../README.md); this page only takes you through them in order.

## What you end up with

One process hosts one vault as a git working clone and answers MCP requests on `POST /mcp`, so an agent can search, read and edit notes. The vault's git remote (GitHub, GitLab, any git host) stays the hub: the server pulls from it every 30 seconds and before every write, and pushes each write as one commit. The desktop and mobile apps keep pushing and pulling as usual, so an agent sees a change from the desktop app only after the server's next pull: up to the fetch interval (`TOLARIA_VAULT_FETCH_INTERVAL_MS`, 30 seconds by default) after the desktop pushed it.

Each agent gets its own agent token: a long-lived credential with `viewer` or `editor` access to the whole vault or to single notes, which you can revoke on its own.

## Before you start

- A machine that stays on: a Linux server or VM, or a Mac.
- `git`, and a terminal on that machine.
- For path A: Docker with Compose v2 (`docker compose version`).
- For path B: Node 22.14 or newer (`node -v`) and pnpm 10.33.0, the version CI uses (`npm install -g pnpm@10.33.0`).
- A vault in a git repository you can push to, and permission to add a deploy key to it.
- A copy of the vault you can afford to break, if you want to try everything first. `pnpm server:seed /tmp/test-vault.git` makes a throwaway bare repository with fake notes, and the steps below work against it with `TOLARIA_VAULT_REMOTE_URL=/tmp/test-vault.git` (path B only: a container cannot see a host path).

## 1. Give the box access to the vault

The server pulls and pushes with the system `git`, using the SSH keys and credential helpers of the user it runs as. Keep passwords and access tokens out of the remote URL: it is stored in the clone's git config and shows up in error messages. For a private repository, use a deploy key: an SSH key that belongs to the repository, not to your account.

Create the key where your path expects it:

| Path | Key file | `known_hosts` |
|---|---|---|
| A: Docker | `apps/server/deploy/ssh/id_ed25519` | `apps/server/deploy/ssh/known_hosts` |
| B: systemd | `/var/lib/tolaria/.ssh/id_ed25519` (the `tolaria` user's) | `/var/lib/tolaria/.ssh/known_hosts` |
| B: launchd | `~/.ssh/tolaria_deploy` | `~/.ssh/known_hosts` |

For Docker, from the checkout (step 2A shows the clone):

```bash
cd tolaria/apps/server/deploy
mkdir -m 700 ssh
ssh-keygen -t ed25519 -N '' -C tolaria-server -f ssh/id_ed25519
ssh-keyscan -t ed25519 github.com > ssh/known_hosts
sudo chown -R 1000:1000 ssh   # Linux only: the container runs as UID 1000
```

For systemd, after creating the `tolaria` user in step 2B:

```bash
sudo -u tolaria mkdir -m 700 /var/lib/tolaria/.ssh
sudo -u tolaria ssh-keygen -t ed25519 -N '' -C tolaria-server -f /var/lib/tolaria/.ssh/id_ed25519
ssh-keyscan -t ed25519 github.com | sudo -u tolaria tee /var/lib/tolaria/.ssh/known_hosts
```

For launchd:

```bash
ssh-keygen -t ed25519 -N '' -C tolaria-server -f ~/.ssh/tolaria_deploy
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
```

Replace `github.com` with your git host. `ssh-keyscan` trusts whatever answers; compare the printed key with the fingerprints your host publishes (GitHub lists them in its docs under "GitHub's SSH key fingerprints").

Then add the public key (the `.pub` file) to the repository as a deploy key **with write access**: on GitHub, Settings → Deploy keys → Add deploy key → "Allow write access"; on GitLab, Settings → Repository → Deploy keys → "Grant write permissions to this key". Without write access the server clones and reads, but every push fails.

Use the SSH form of the remote URL, for example `git@github.com:you/your-vault.git`.

**Commit identity.** Nothing to configure. The server sets the author and committer of its commits itself, to `Tolaria Remote <remote@tolaria.invalid>`, and ignores git's `user.name` and `user.email`. A commit made through an agent token adds a `Co-authored-by` trailer with the token's name, so `git log` shows which agent wrote what.

## 2A. Docker Compose (Linux, or a Mac)

The files are in [`apps/server/deploy/`](../deploy/): `compose.yaml` builds the image from the repository and keeps the server's data in a named volume, `tolaria-data`.

```bash
git clone https://github.com/refactoringhq/tolaria.git
cd tolaria/apps/server/deploy
cp tolaria.env.example tolaria.env
chmod 600 tolaria.env
```

Edit `tolaria.env`: set `TOLARIA_SERVER_TOKEN` to the output of `openssl rand -hex 24` and `TOLARIA_VAULT_REMOTE_URL` to the vault's SSH URL. This owner token gives full access; keep it for yourself and give agents their own tokens (step 3). Create `ssh/` as in step 1, then:

```bash
docker compose up -d --build
docker compose logs -f tolaria      # wait for "server ready", then Ctrl-C
curl http://127.0.0.1:8787/healthz  # {"status":"ok"}
```

The first build takes a few minutes. The server is published on `127.0.0.1:8787` only; step 4 puts something in front of it. `restart: unless-stopped` brings it back after a crash or a reboot of the Docker host.

## 2B. A native checkout under systemd (Linux) or launchd (macOS)

### systemd

Run the server as its own user, with the code in `/opt/tolaria` and the data in `/var/lib/tolaria/data`. The code directory must be writable by that user: the server bundles itself into `node_modules/.tmp` at every start.

```bash
sudo useradd --system --home-dir /var/lib/tolaria --create-home --shell /usr/sbin/nologin tolaria
sudo install -d -o tolaria -g tolaria /opt/tolaria
sudo -u tolaria git clone https://github.com/refactoringhq/tolaria.git /opt/tolaria
cd /opt/tolaria
sudo -u tolaria pnpm install --frozen-lockfile
```

Create the deploy key now (step 1), then the env file, readable by the service and nobody else:

```bash
sudo install -d -m 750 -o root -g tolaria /etc/tolaria
sudo install -m 640 -o root -g tolaria apps/server/deploy/tolaria.env.example /etc/tolaria/tolaria.env
sudoedit /etc/tolaria/tolaria.env
```

Install [`tolaria.service`](../deploy/tolaria.service). Its `ExecStart` runs `/usr/bin/node`; if `command -v node` prints another path, change that line first.

```bash
sudo cp apps/server/deploy/tolaria.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tolaria
journalctl -u tolaria -f            # wait for "server ready"
curl http://127.0.0.1:8787/healthz
```

The unit restarts the server when it exits with an error, and starts it at boot.

### launchd

A launchd user agent starts when you log in and keeps the server running while you are. A Mac that must serve before anyone logs in needs automatic login, or the plist installed as a launch daemon in `/Library/LaunchDaemons` with a `UserName` key (not covered here). A sleeping Mac answers nothing: turn off sleep for it.

```bash
git clone https://github.com/refactoringhq/tolaria.git ~/tolaria
cd ~/tolaria
pnpm install --frozen-lockfile
mkdir -p ~/.config/tolaria
install -m 600 apps/server/deploy/tolaria.env.example ~/.config/tolaria/tolaria.env
```

Edit `~/.config/tolaria/tolaria.env` as in 2A, and add a line so git uses the deploy key from step 1:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/tolaria_deploy -o IdentitiesOnly=yes"
```

Install [`md.tolaria.server.plist`](../deploy/md.tolaria.server.plist) with your user name filled in. It expects the checkout in `~/tolaria` and Node in `/opt/homebrew/bin` or `/usr/local/bin`; if `command -v node` prints another directory, add it to the plist's `PATH`.

```bash
sed "s/USERNAME/$USER/g" apps/server/deploy/md.tolaria.server.plist > ~/Library/LaunchAgents/md.tolaria.server.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/md.tolaria.server.plist
tail -f ~/Library/Logs/tolaria-server.log   # wait for "server ready"
curl http://127.0.0.1:8787/healthz
```

The data is in `~/Library/Application Support/Tolaria Server`. launchd starts the server again whenever it exits. To stop it: `launchctl bootout gui/$(id -u)/md.tolaria.server`.

## 3. Create an agent token and connect a client

Create one token per agent, with the least access it needs ([Tokens for agents](../README.md#tokens-for-agents) has every option). Run the command as the user the server runs as, so the server can read the token file:

```bash
# Docker, in apps/server/deploy
docker compose exec tolaria tolaria-token add --name claude-laptop --role editor

# systemd, in /opt/tolaria
sudo -u tolaria env TOLARIA_SERVER_DATA_DIR=/var/lib/tolaria/data pnpm run server:token add --name claude-laptop --role editor

# launchd, in ~/tolaria
TOLARIA_SERVER_DATA_DIR="$HOME/Library/Application Support/Tolaria Server" pnpm run server:token add --name claude-laptop --role editor
```

The command prints the token (`tat1.…`) once. The running server accepts it within about a second. Check it on the box:

```bash
curl -s http://127.0.0.1:8787/mcp \
  -H "Authorization: Bearer tat1.…" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The answer lists `search_notes`, `get_note`, `create_note` and the other tools. `list` and `revoke` take the same prefix as `add` (`docker compose exec tolaria tolaria-token list`).

Connect a client with the URL from step 4 (`https://…/mcp`). With Claude Code:

```bash
claude mcp add --transport http tolaria https://vault.example.com/mcp \
  --header "Authorization: Bearer tat1.…"
```

Any other client that takes a JSON configuration and can send a header:

```json
{ "mcpServers": { "tolaria": { "type": "http", "url": "https://vault.example.com/mcp",
  "headers": { "Authorization": "Bearer tat1.…" } } } }
```

## 4. Reach it from another device

The server speaks plain HTTP and listens on `127.0.0.1:8787`. Put one of these in front of it on the same box. Neither changes a Tolaria setting: both proxies connect to `127.0.0.1:8787`.

**Private: Tailscale.** Only devices in your tailnet (your private Tailscale network) can connect. With Tailscale installed and logged in on the box, and HTTPS certificates enabled for the tailnet in the admin console (DNS page):

```bash
sudo tailscale serve --bg 8787
tailscale serve status     # prints https://<machine>.<tailnet>.ts.net
```

The MCP URL is `https://<machine>.<tailnet>.ts.net/mcp`. Tailscale terminates TLS and forwards to the server on loopback; `sudo tailscale serve reset` removes it.

**Public: Caddy.** Point a DNS name at the box, open ports 80 and 443, and give Caddy this `Caddyfile`; it gets a certificate for the name by itself and also forwards the collaboration websockets:

```
vault.example.com {
	reverse_proxy 127.0.0.1:8787
}
```

The MCP URL is `https://vault.example.com/mcp`. On the public internet the tokens are the only protection: give agents `viewer` tokens where they only read, and `--expires-in` where they are temporary.

**When the proxy runs elsewhere.** Only if the proxy is on another machine does the server have to listen beyond loopback. Natively, set `TOLARIA_SERVER_HOST` to the address the proxy reaches (or `0.0.0.0`) and `TOLARIA_SERVER_ALLOW_NON_LOOPBACK=1` in the env file; the server refuses a non-loopback address without the second. In Docker the image already sets both inside the container, and the `ports:` line of `compose.yaml` decides who can connect: change `127.0.0.1:8787:8787` to the host address the proxy reaches. Never let the plain-HTTP port be reachable from the internet.

## Update

```bash
# Docker
cd tolaria && git pull && cd apps/server/deploy && docker compose up -d --build

# systemd
cd /opt/tolaria && sudo -u tolaria git pull && sudo -u tolaria pnpm install --frozen-lockfile
sudo systemctl restart tolaria

# launchd
cd ~/tolaria && git pull && pnpm install --frozen-lockfile
launchctl kickstart -k gui/$(id -u)/md.tolaria.server
```

The clone and the tokens are in the data directory, so they carry over. Old Docker images stay on disk until `docker image prune`.

## Back up

The data directory (`/app/data` in the `tolaria-data` volume, `/var/lib/tolaria/data`, or `~/Library/Application Support/Tolaria Server`) holds:

- `vault/`: the git clone. Every pushed commit is also on the git remote; a commit whose push failed exists only here.
- `state/`: the document index and the state of live documents.
- `tokens.json`: the agent tokens. This is the only copy. If it is lost, every agent needs a new token. Keep it on persistent disk: in Docker, the named volume, never the container's own filesystem.

Also keep the env file (it holds the owner token) somewhere safe, such as a password manager.

```bash
# Docker: the token file, or the whole volume as a tarball
docker compose cp tolaria:/app/data/tokens.json ./tokens.json.bak
docker run --rm -v tolaria_tolaria-data:/data:ro -v "$PWD":/backup debian:stable-slim \
  tar czf /backup/tolaria-data.tgz -C /data .

# Native
sudo tar czf tolaria-data.tgz -C /var/lib/tolaria data
```

## Troubleshooting

- **`env file …/tolaria.env not found`** from `docker compose`: create `tolaria.env` from `tolaria.env.example` first (2A).
- **The container keeps restarting, and the log shows `Host key verification failed`**: `known_hosts` is missing or does not name the git host of `TOLARIA_VAULT_REMOTE_URL`. Run the `ssh-keyscan` line of step 1 again.
- **`Load key "/home/node/.ssh/id_ed25519": Permission denied`**, then `Permission denied (publickey)`: on Linux, the key is not owned by UID 1000. Run `sudo chown -R 1000:1000 ssh`. To test the key on its own: `docker compose run --rm tolaria ssh -T git@github.com`.
- **A new token gets `401` on its very first request**: the server reads the token file again at most once a second. Retry.
- **The service does not start: `EACCES: permission denied, open '/var/lib/tolaria/data/tokens.json'`**, or the running server logs `tokens.json cannot be read: EACCES`: the token command ran as root and left the file owned by root. Run `sudo chown tolaria:tolaria /var/lib/tolaria/data/tokens.json`, and run the command with `sudo -u tolaria` from then on.
- **A write answers `"pushed": false`**: the push is queued and runs about two seconds later. If the commit never reaches the remote, look for `push failed` in the log; usually the deploy key has no write access.
- **`ExperimentalWarning` lines in the log** (systemd and launchd): Node's notices about the features the server uses. Harmless.

## Limits

- **No OAuth.** A client must send the token in an `Authorization` header. Clients that only connect through an OAuth sign-in are not supported yet.
- **One vault per server.** For a second vault, run a second server with its own data directory and port (in Docker, a copy of `deploy/` with another `name:` and `ports:`).
- **Reads can be up to 30 seconds behind** a desktop or mobile push (the fetch interval); writes always pull first. Edits someone is making in a live document in the web app reach `get_note` only once the document is written to its file.
- **Guarded writes.** `create_note` refuses a path that exists. `update_note` replaces the note unless you pass the `etag` from `get_note` as `expectedEtag`. A write that collides with a change on the remote is saved as a conflict copy and returned as an error naming the copy. Details: [MCP endpoint](../../../docs/web/protocol.md#mcp-endpoint) in the protocol.
- **Plain pushes.** The server's commits are unsigned and pushed straight to the branch, so a branch protection rule that requires signed commits or pull requests refuses them.
