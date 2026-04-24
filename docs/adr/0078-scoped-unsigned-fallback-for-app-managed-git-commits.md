---
type: ADR
id: "0078"
title: "Scoped unsigned fallback for app-managed git commits"
status: active
date: 2026-04-24
---

## Context

ADR-0021, ADR-0059, and ADR-0070 all assume Tolaria can create and advance a local git-backed vault without asking users to debug git internals first. In practice, inherited `commit.gpgsign` settings were breaking that promise: a missing or misconfigured GPG/SSH signing helper could block the initial `Initial vault setup` commit during onboarding and could also strand later app-triggered commits behind opaque signing failures.

Tolaria needed a policy that kept signed workflows intact when the user's signing setup actually works, while still ensuring app-managed git operations do not become unusable just because a desktop environment cannot reach the signing helper.

## Decision

**Tolaria uses a scoped unsigned fallback for app-managed commits instead of requiring signing to succeed unconditionally.**

- The onboarding/setup commit (`Initial vault setup`) always runs with `commit.gpgsign=false` for that single git invocation.
- Normal app-managed `git_commit` calls still honor the user's existing git signing configuration first.
- If a commit fails and Git's error matches a signing-helper failure, Tolaria retries that same app-managed commit once with signing disabled.
- Tolaria does not rewrite the user's git config and does not broaden the retry to unrelated commit failures.

## Options considered

- **Scoped unsigned fallback for app-managed commits** (chosen): keeps onboarding and local commit flows resilient while still preserving signed commits when the user's environment supports them. Cons: some Tolaria-created commits may be unsigned on machines with broken signing setups.
- **Require signing to succeed for every commit**: simplest policy, but it turns missing desktop GPG/SSH helpers into app-breaking failures during onboarding and normal use.
- **Disable signing for all Tolaria-triggered commits**: maximally robust, but it would silently bypass working signing setups and weaken users' expected git security posture.

## Consequences

- New vault creation is no longer blocked by inherited signing settings that only fail in Tolaria's app context.
- Users with healthy signing setups still get signed Tolaria commits after the first normal attempt succeeds.
- Signing-failure detection must stay narrow so Tolaria does not mask unrelated git errors behind an unsigned retry.
- Tolaria's git integration now explicitly prefers "complete the app-managed commit safely" over "preserve signing at all costs" when the signing helper is unavailable.
- Re-evaluate if Tolaria later exposes per-vault git policy controls or needs a richer user-facing explanation for when a fallback unsigned commit was used.
