---
type: ADR
id: "0300"
title: "Optimistic mobile workspace writes use per-path locks and selective rollback"
status: active
date: 2026-11-04
Platform: mobile
---

## Context

Mobile list actions such as organize, archive, favorite and delete should respond immediately, while persistence may take longer. A single global write queue unnecessarily blocks independent note edits. Applying the optimistic UI projection also creates a failure case: a rejected write must restore the prior state without overwriting a newer edit.

ADR 0285 remains the rule for editor content: disk is authoritative, writes use the normal persistence path, and indexing must not overwrite newer disk writes. This decision concerns optimistic workspace list and menu actions, not editor save barriers or index reconciliation.

## Decision

**Apply mobile workspace list/menu edits to the visible snapshot immediately, persist them asynchronously under deterministic per-path locks, and selectively roll back a failed write only while the affected state still matches that write's optimistic projection.** Preserve newer state, expose a retryable write-failure status, and serialize shared configuration writes under their own lock key.

Locks for a multi-path operation are acquired in sorted key order. Operations on disjoint paths may proceed concurrently; operations touching the same path wait for the earlier operation. The indexer remains read-only and never participates in these write locks.

## Alternatives considered

- **One global serial queue:** simple ordering, but an unrelated slow write blocks every other action.
- **Wait for persistence before updating the UI:** straightforward rollback semantics, but action latency is visible and feels unlike native list interactions.
- **Unconditional rollback on failure:** restores the captured snapshot, but can erase edits made after the failed operation began.

## Consequences

- List and menu actions appear immediate while disk work continues in the background.
- Independent edits can persist concurrently; conflicting edits to the same path remain ordered.
- A failed write restores only state still owned by that operation, preserving later changes, and leaves an actionable retry state.
- Editor text writes retain ADR 0285's disk-authoritative write path and save barrier; this ADR does not weaken that contract.
