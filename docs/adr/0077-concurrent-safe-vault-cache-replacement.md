---
type: ADR
id: "0077"
title: "Concurrent-safe vault cache replacement"
status: active
date: 2026-04-24
---

## Context

ADR-0014 and ADR-0024 established Tolaria's git-based persistent vault cache and moved it outside the vault directory. That cache was still being rewritten with a simple temp-file-and-rename flow.

Once Tolaria started reopening the same vault from multiple windows/processes more often, that write model became too optimistic: two scans could both build valid cache payloads from different moments in time, and the slower writer could still atomically replace a fresher cache written by another window. The cache needed cross-window safety without introducing a long-lived coordinator process or making vault open dependent on heavyweight IPC.

## Decision

**Tolaria now treats vault-cache replacement as a best-effort compare-and-swap operation instead of an unconditional atomic overwrite.**

- Each scan still builds the next cache payload in memory and writes it to a temp file first.
- Before replacing the real cache file, Tolaria acquires a short-lived lock file for that vault cache path.
- After the lock is acquired, Tolaria rechecks the on-disk cache fingerprint and only renames the temp file into place if another window/process has not already refreshed the cache.
- If the cache changed underneath the current scan, Tolaria skips the replace and keeps the newer on-disk cache.
- Stale cache-write locks are garbage-collected after a short timeout so a crashed writer does not block future refreshes.

## Options considered

- **Lock + fingerprint guarded replacement** (chosen): keeps the cache file external and file-based, avoids overwriting fresher cache state from another Tolaria window, and preserves graceful fallback to filesystem rescans. Cons: cache writes become best-effort rather than guaranteed after every scan.
- **Keep unconditional temp-file + rename**: simplest implementation, but concurrent windows can regress the cache to an older view even though each individual replace is atomic.
- **Centralized cache service or long-lived process mutex**: strongest coordination story, but too much operational complexity for a local desktop app and would create new failure modes around boot, process lifetime, and IPC.

## Consequences

- Tolaria's cache correctness model is now "latest successful guarded replace wins," not "every scan must write a cache file."
- Cache refreshes must tolerate a skipped write when another window/process already produced a fresher cache.
- Temp-file writes and renames still provide corruption resistance, but freshness is protected separately by the writer lock and fingerprint check.
- Cache-write failures remain non-fatal: Tolaria logs them and falls back to rebuilding from the filesystem when needed.
- Re-evaluate if Tolaria later needs stronger cross-process coordination than lock-file + fingerprint checks can provide.
