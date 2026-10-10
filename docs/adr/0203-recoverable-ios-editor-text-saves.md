# 0203: Recoverable text saves in the standalone iOS app

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Context

The editor/Git write queue retries failures in memory (ADR 0196), but cannot
survive process termination. Expo SDK 54's string-file writer replaces bytes
non-atomically on iOS. The provider-file foundation (ADR 0198) is not yet wired
to editor saves. Git checkout recovery (ADR 0201) does not cover local edits.

## Decision

- Retain reducer write plans and the per-vault queue. Route text saves through
  a small asynchronous method in the existing iOS workspace module.
- Before replacing a file, atomically publish a versioned record containing its
  relative path, previous SHA-256 digest (or absence), and complete next bytes.
  Replace the destination atomically, then remove the record last.
- Store one outstanding record per root under private Application Support,
  outside the vault and Git staging. Key roots by their home-relative path so
  an iOS container UUID change does not orphan the record.
- Replay under the same lock and file coordinator as saves. A destination with
  the old digest may be replaced; one with the desired digest is already complete.
  Any other state, including unexpected deletion, fails closed and retains the
  record. Validate paths and reject symlinks on both initial save and replay.
- Recover before native indexing, repository reads, further mutations, and the
  saved-workspace barrier used by sync. Drop a cached launch index if replay
  changed the file set. Incomplete Git checkout and text replay cannot interleave.
- Restrict this backend to app-container Documents, Caches, and temporary roots.
  It does not turn copied vaults into linked original folders.

## Limits

This guarantees recovery for published text saves across process termination,
not every unsent keystroke, multi-file transactional rename/delete, or physical
storage failure. A failed journal publication never changes the destination.
Unexpected external changes block opening/syncing until explicitly resolved;
the pending bytes are retained rather than silently discarded or force-applied.

Expo Go and Android continue using the existing adapter: custom iOS code is not
available there and this guarantee must not be advertised for those runtimes.
Configuration saves use the same mechanism in their existing private root.
No new dependency, public file format, or user-facing copy is introduced.

## Verification

Foundation tests inject interruptions at each publication boundary. Native QA
also terminates and relaunches the actual iPad app between publication and
recovery, verifies frontmatter and stale-index invalidation, and checks that an
external edit prevents reads, writes, and Git operations. All fixtures are
disposable app-cache files; original user vaults are never mutated.
