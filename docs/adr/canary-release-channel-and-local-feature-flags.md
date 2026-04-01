---
type: ADR
id: "0017"
title: "Canary release channel and local feature flags"
status: active
date: 2026-03-25
---
## Context

Shipping new features directly to all users is risky. A mechanism was needed to let early adopters test pre-release builds and to gate experimental features behind flags that can be toggled without a new release.

[[Keyboard-first design principle]]

## Decision

**Add a canary release channel alongside stable, with builds from the&#x20;**`canary`**&#x20;branch. Feature flags are localStorage-based (**`ff_<name>`**) with compile-time defaults, checked via&#x20;**`useFeatureFlag(flag)`**&#x20;hook. The update channel is configurable in Settings.**

## Options considered

* **Option A** (chosen): Canary branch + localStorage feature flags — simple, no server infrastructure, users opt in via Settings. Downside: no remote flag management, no gradual rollout percentages.
* **Option B**: Server-side feature flags (LaunchDarkly, Unleash) — gradual rollouts, A/B testing. Downside: external dependency, requires server infrastructure, adds latency.
* **Option C**: Single release channel with only feature flags — simpler CI. Downside: no way to test full pre-release builds.

## Consequences

* `release.yml` builds stable from `main`; `release-canary.yml` builds canary from `canary` branch.
* Canary releases produce `latest-canary.json` on GitHub Pages, marked as prerelease.
* `useUpdater(channel)` checks the appropriate update manifest.
* `useFeatureFlag(flag)` checks localStorage override, then compile-time default. Type-safe via `FeatureFlagName` union.
* `update_channel` stored in Settings as `"stable"` or `"canary"`.
* Re-evaluation trigger: if user base grows enough to warrant server-side gradual rollouts.
