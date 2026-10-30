# ADR-0248: Expo React Native Mobile UI Foundation

> Superseded in part by ADR 0299: mobile chrome now follows iOS/Android platform conventions. The React Native foundation, native primitives, and desktop-derived note content/type-icon contracts remain active.

## Status

Accepted

## Context

Tolaria needs a mobile app that can ship first on tablets and later on phones. The previous mobile prototype proved that pure mobile vault, markdown, and sync boundaries are viable, but its UI work drifted into hand-built screens that required too much product steering.

Mobile development needs a deterministic visual feedback loop. Codex should be able to build and verify native UI surfaces from fixture states, screenshots, and Tolaria's existing desktop semantics instead of inventing each screen from scratch.

## Decision

Create a separate Expo React Native workspace app under `apps/mobile`.

The mobile app starts with a fixture-driven UI lab and native Tolaria UI primitives rather than production business logic. The first primitives mirror desktop semantics: buttons, icon buttons, panels, toolbars, list rows, chips, and property rows. Screens compose those primitives instead of directly styling raw React Native controls.

The mobile visual language derives from Tolaria's desktop semantic colors, spacing, panel structure, and Phosphor icon usage, but it is implemented with native React Native surfaces. Desktop React DOM components are reference material, not reusable mobile components.

## Consequences

- Tablet UI quality can be improved through screenshot and interaction QA before vault/editor wiring is added.
- Future mobile screens have a reusable native component vocabulary, which reduces design drift and increases implementation autonomy.
- Expo introduces a separate native runtime and dependency set. Native runtime changes still require simulator/device QA, while JavaScript UI iteration can remain fast.
- Business logic from earlier mobile experiments should be salvaged only after the UI foundation is stable and based on current `main`.
