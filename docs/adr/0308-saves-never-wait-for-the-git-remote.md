---
type: ADR
id: "0308"
title: "Saves never wait for the git remote: network off the vault lock, retried pushes, deferred index writes"
status: active
date: 2026-11-24
---

## Context

Tolaria Web must confirm a save in under 150 ms at p95 while the vault stays connected to GitHub (TOL-424), and a slow or unreachable GitHub must never fail a save. ADR 0280 moved the push to a debounce timer, but a save still waited for GitHub in three ways:

- every mutation fetched from the remote first (`GitSync.pull()` under the vault lock), about 0.5 s against GitHub from Hetzner and up to git's 30 s timeout when GitHub does not answer;
- the background push and fetch held the vault lock for their whole network round trip, so a save made during a push waited 1–2 s;
- a debounce that every save resets never fired while the user kept typing, so commits reached GitHub only after the user stopped, and a failed push was retried only by the next save.

Profiling also showed that after each commit the entry index and the search index serialized and rewrote their whole snapshot (34 MB of JSON for the 6,060-note staging vault) and re-sorted every entry, which cost more than the commit itself.

Measured with `apps/server/scripts/save-bench.ts` (the `infra/perf.md` warm method: sequential saves on keep-alive, timed to the whole body) against a 2,000-note vault whose remote was given GitHub's measured fetch time (0.5 s) and the estimated push time (1.5 s): before, save p95 898 ms, commits on the remote up to 36 s after the save, 60 s per save with the remote blocked; after, save p95 121–142 ms on a heavily loaded box, commits on the remote within ~6.6 s, 95–124 ms per save with the remote blocked.

## Decision

**A save is acknowledged once its commit is on the server's disk. Nothing that talks to the git remote runs under the vault lock; the remote catches up in the background, and a push that fails is retried until it lands.**

- **The save path has no network.** With a push debounce (the default), `Vault` mutations no longer pull first. Upstream changes arrive through background fetches and `POST /v1/sync`, and are integrated under the vault lock in one step, so `Vault.update` still sees a consistent file. `pushDebounceMs: 0` keeps ADR 0186's inline pull-commit-push.
- **`RemoteMirror` owns the remote.** Fetches, pushes and syncs run one at a time on a network queue. Each takes the vault lock only for its local steps (`GitSync.unpushed`, `GitSync.integrate`); `git fetch` and `git push <commit>` run unlocked, which is safe because they write only the remote-tracking ref, and only network-queue tasks write that ref.
- **Pushes are bounded and retried.** A commit is pushed `pushDebounceMs` (2 s) after the last save, but never more than `maxPushDelayMs` (5 s) after the first unpushed commit, so a commit reaches GitHub within about 7 s even while the user keeps typing. A failed push is retried on its own after a growing delay (debounce × 2ⁿ, at most `maxPushRetryMs`, 30 s); a new commit schedules a sooner push. A rejected push fetches, replays local commits onto the remote's history (conflict copies for files both sides changed, as in ADR 0186) and tries again.
- **A commit is durable before it is acknowledged.** Every git command runs with `core.fsync=committed` and `core.fsyncMethod=batch`, so the objects and the ref of a commit are on disk before git reports success (measured cost: negligible on the box's NVMe).
- **Indexes are written later.** `VaultIndex` and `SearchIndex` update in memory on each change and write their stored copy at most every 30 s (`DeferredWrite`) and on shutdown. A stored copy names the commit it was taken at, so one that lags behind catches up from `changesSince` at the next start. They keep their items in path order with a binary insert instead of a full re-sort.
- **Fewer processes per save.** `GitRepo.head()` remembers HEAD until a command that may move it runs, so a save reads it once instead of three times.

This supersedes the "save path" parts of ADR 0280 (the pull on every write; pushes and fetches holding the lock; "retry on the next write"). Its change feed, debounce and shutdown flush stand.

## Alternatives considered

- **Keep the pull on the save path, only shorter** (fetch with a short timeout): still 0.5 s against GitHub, and still fails the budget whenever GitHub is slow.
- **A write-ahead journal before the git commit**: the commit is already a local, fsynced write of a few milliseconds; a journal would add a second durable format to recover from without making the save faster.
- **Durable Objects and Cloudflare Artifacts** (the decided end state): a later card; this one keeps the container and only removes the remote from the save path.

## Consequences

- A save that crosses a desktop push of the same file is answered `updated` and becomes a conflict copy when the server integrates the remote, a few seconds later; before, the server fetched first and answered `conflict` at once. Nothing is overwritten either way; the change feed's `pull` event and the listing show the copy.
- While GitHub is unreachable, commits accumulate locally and `push-failed` events repeat at the retry interval. The ADR 0280 durability rule stands: the server's clone is not the only copy for longer than the outage, and a backup or the remote must restore it.
- A crash loses no acknowledged save. It may lose up to 30 s of index writes, which the next start rebuilds from git.
- `Server-Timing` `pull` and `push` are about zero with background pushes; `commit` is the save.

## Advice

(No external input was sought before making this decision.)
