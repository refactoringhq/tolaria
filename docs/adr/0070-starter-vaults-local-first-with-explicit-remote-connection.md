---
type: ADR
id: "0070"
title: "Starter vaults are local-first with explicit remote connection"
status: active
date: 2026-04-19
---

## Context

ADR-0046 moved the Getting Started vault to a public GitHub repo cloned at runtime, and ADR-0059 established that Tolaria should support valid local-only vaults without treating a missing remote as an error.

That still left one mismatch: a freshly cloned starter vault inherited the template repo's `origin` remote. New users therefore landed in a vault that looked remote-backed by default, even though the intended workflow was to explore locally first and only connect a personal remote later. Keeping the starter remote also risked accidental pushes to the public template repo and gave Tolaria no safe place to reject incompatible remotes before tracking started.

## Decision

**After cloning the public starter vault, Tolaria removes every configured git remote so the vault opens local-only by default.** Users connect a remote later through an explicit Add Remote flow exposed from the `No remote` status-bar chip and the command palette.

**The new `git_add_remote` backend is the only path for attaching a remote to an existing local-only vault.** It adds `origin`, fetches the remote, rejects incompatible or ahead histories, and only starts tracking when the remote is safe for the current local repo.

## Options considered

- **Strip starter-vault remotes and add an explicit connect flow** (chosen): preserves a local-first onboarding experience, matches ADR-0059's local-only model, and prevents accidental coupling to the public template repo. Cons: users who want sync must do one extra explicit step.
- **Keep the starter repo's remote attached**: simplest implementation, but it makes the template repo look like the user's real sync target and increases the risk of accidental pushes or confusing remote state.
- **Force remote replacement during onboarding**: guarantees a personal remote up front, but adds too much setup friction to the Getting Started path and weakens Tolaria's offline/local-first story.

## Consequences

- Fresh Getting Started vaults now behave like any other local-only vault: commit locally first, then opt into sync later.
- The app gains a dedicated Add Remote UX (`AddRemoteModal`) plus a backend connection path (`git_add_remote`) instead of overloading clone or commit flows.
- Remote attachment is safer: Tolaria can reject unrelated or incompatible histories before the vault starts tracking a remote.
- The starter repo remains a distribution source only, not an ongoing sync destination.
- Re-evaluate if Tolaria later needs a faster "publish this local starter vault to my own repo" flow that should prefill or streamline the Add Remote step.
