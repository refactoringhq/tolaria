# 0196: Freeze and flush editors before replacing working-copy files

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Context

TenTap reads documents asynchronously through a WebView bridge. A pending reply
can arrive after Git checkout and overwrite a newly pulled note. A fire-and-forget
save command and a successful later write are not sufficient proof of persistence.

## Decision

- Each editor registers an awaitable preparation operation. It freezes input,
  invalidates older autosave replies, reads the final document, and queues its save.
- Final document reads have a bounded timeout. Failure restores editing and
  prevents checkout; it must never be converted into a successful empty save.
- File mutations and Git share a queue keyed by the actual working-copy root,
  not the adapter's virtual `/vault` path.
- Failed file operations remain queued in order. Successful operations are
  removed individually, so retries do not replay completed moves or deletions.
  Sync retries outstanding writes and stops if they still cannot be saved.
- The sync owner remounts from a fresh disk snapshot after Git starts. The old
  editor stays frozen during replacement, including unmount autosave. A failure
  before the save barrier instead resumes the existing editor and its draft.

## Consequences

These guarantees require the vault manager to use the preparation registry;
adding a raw sync button that bypasses it is not supported. Pending write retries
are in-memory recovery, not a durable crash-recovery journal. Crash-safe atomic
file replacement remains a separate storage concern.
