# 0198: Coordinate iOS provider files and reject stale writes

Date: 2026-10-10
Status: Accepted foundation; not yet enabled for user-selected live vaults

## Decision

Do not implement live external folders by retaining a raw URL or by silently
copying the folder into app storage. The iOS provider backend uses a directory
grant from the document picker, a minimal bookmark for future access, and scoped
access around each operation. Use Foundation's NSFileCoordinator and atomic file
replacement rather than a JavaScript approximation of provider synchronization.

Each read returns a SHA-256 revision. A write checks that revision under the
coordinated write operation, before replacing any bytes. A missing revision means
create-only. An external edit or deletion rejects the pending local write; it
does not overwrite or resurrect the provider's file. Reject path traversal,
symlink components, and mutations inside Git metadata.

The Foundation implementation is a small Swift package with filesystem tests.
A DEBUG-only Expo bridge additionally runs a disposable in-container proof on
iOS. Neither test substitutes for testing picker-granted iCloud or third-party
provider access on a physical device.

## Integration Requirements

Before exposing live folders, connect bookmark selection, asynchronous indexing,
and revision-aware writes to the workspace repository. Keep dirty editor content
when a provider conflict occurs and provide explicit recovery. Folder rename and
delete require coordinated subtree validation; do not fall back to unchecked Expo
filesystem operations for linked roots. Android needs its own persisted SAF tree
permission adapter. These are not implemented by this foundation commit.

Expo Go cannot include this custom module. Its picker session and the standalone
build's current copy importer must not be presented as equivalent live sync.

## QA Evidence

Standalone React Native does not necessarily write JavaScript console output to
the iOS unified log. Layout and persistence proofs therefore share an explicit
loopback-only HTTP collector. It accepts typed metrics and known proof prefixes;
remote hosts, credentials, and redirects are rejected. No production analytics
or note bodies are transmitted by this collector.
