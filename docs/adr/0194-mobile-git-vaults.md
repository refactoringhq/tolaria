# 0194: Mobile Git vaults use an embedded Git library

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Context

Tablets need two distinct storage modes: live access to a user-selected folder,
and an app-managed Git working copy. Copying a folder is not equivalent to opening
it, and a successful disk write does not prove remote synchronization.

## Decision

- Use isomorphic-git for object storage, pack transport, commits, and graph
  operations. Do not implement the Git protocol ourselves.
- Keep Git operations behind a filesystem/HTTP boundary, independent of React.
  Use real repositories, not mocked Git responses, for integration tests.
- Serialize operations per working copy. Never run checkout concurrently with
  editor writes. Preserve local changes in a commit before contacting a remote.
- Launch scope is HTTPS GitHub repositories, one vault at a time, manual sync.
  Never force-push, reset user commits, or silently choose a side of a conflict.
  Divergence must be visible and preserve both histories.
- Keep Git copies in app-owned storage, separate from file-provider folders.
  Do not create a second synchronization mechanism inside an iCloud folder.
- GitHub authentication uses device authorization (no client secret in the app).
  Persist tokens only in Expo SecureStore. Keep credentials out of repository
  URLs, configuration, logs, telemetry, and vault files. The public client ID is
  installation configuration; absence must not masquerade as working sign-in.
- Expo's React Native filesystem adapter implements the Node-shaped operations
  the library needs. It must reject paths outside the managed working copy and
  report unsupported symbolic links instead of following them.

## Consequences

This avoids a native Git binding per platform, but pack parsing and hashing use
the JavaScript runtime. Measure large-vault behavior on native devices before
enabling background sync. A UI-thread native gesture implementation remains
important during storage work. A dedicated worker/native Git backend may replace
the adapter later without changing the editor or sync state model.

Live iOS folders need security-scoped bookmarks plus coordinated file-provider
reads/writes and external-change refresh. Android needs persisted SAF permissions
and document-tree operations. These are separate native contracts, not raw path
concatenation or a silent import fallback.

## References

- https://isomorphic-git.org/docs/en/fs
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://docs.expo.dev/versions/v54.0.0/sdk/securestore/
