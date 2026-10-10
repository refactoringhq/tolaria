# 0201: Recover interrupted mobile Git checkouts before editing

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Context

Fast-forwarding a branch before replacing working-copy files can leave a partial
checkout after a write failure or process termination. A later checkpoint would
then commit the incomplete files as if the user had edited them. Regression tests
reproduced both premature HEAD advancement and this unintended follow-up commit.

## Decision

- Persist a versioned intent in `.git/tolaria-checkout.json` before checkout.
  It identifies the existing branch, starting commit, and target commit.
- Use the Git library's non-forced, `noUpdateHead` checkout. Advance the branch
  only after all file writes succeed; remove the intent last.
- Complete pending checkout before checkpointing or opening a managed vault.
  Validate the branch, HEAD, commit identifiers, and fast-forward ancestry first.
- Never force recovery over unexpected edits. Invalid journals, changed branch
  state, conflicts, or IO errors stop the operation and preserve its journal.
- The native workspace read/write boundary rejects a working copy with a pending
  intent. Closing a failed sync sheet cannot make partial files editable.
- Exercise write failures, restart, journal removal failure, corrupt intent,
  unexpected edits, and native read/write exclusion using disposable repositories.

## Consequences

This adds recoverable Git checkout, not a general durable editor-write journal.
Partial/corrupt intent writes fail closed and may need explicit repair. Automatic
recovery applies only to app-managed working copies and never resolves divergence
by choosing a side. The existing editor freeze/flush barrier remains mandatory.

## References

- https://isomorphic-git.org/docs/en/checkout
- ADR 0194 and ADR 0196
