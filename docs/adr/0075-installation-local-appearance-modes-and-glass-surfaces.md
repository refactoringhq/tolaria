---
type: ADR
id: "0075"
title: "Installation-local appearance modes and glass surfaces"
status: active
date: 2026-04-22
supersedes:
  - "0013"
---

## Context

ADR-0013 intentionally removed Tolaria's vault-backed theming system and standardized the app on a single hardcoded light theme. That simplification paid down maintenance debt, but it also removed dark mode entirely and left no structured path for modern surface treatments. The new product requirement is narrower than the old theming system: Tolaria needs a readable curated theme catalog, dark-first glass surfaces, and a small native-feeling picker in Settings, without returning to vault-authored theme notes, live frontmatter syncing, or per-vault theme customization.

## Decision

**Tolaria uses installation-local appearance preferences with a curated theme catalog and a separate surface mode (`glass` or `solid`).** The theme catalog is centralized in `src/lib/appThemes.ts`, the selected `themeId` is stored locally on the machine, and the resolved tokens are applied to the document root before React mounts. Each theme declares semantic tokens for backgrounds, glass fills, strokes, typography, accents, selection, focus, and corner radii so the UI can stay consistent without scattering raw color literals across views.

The appearance system deliberately does **not** revive the deleted vault-based theming pipeline:

- No theme notes in the vault
- No Rust theme-loading or CSS-variable bridging from markdown
- No per-vault theme authoring UI
- No user-defined arbitrary theme values

Instead, Tolaria keeps a curated design system with:

1. A centralized named theme catalog with semantic tokens
2. A shared glass/solid material switch for chrome and overlays
3. A lightweight settings surface for choosing themes and surfaces
4. Explicit editor parity so BlockNote and CodeMirror match the app-level appearance

## Options considered

- **Option A** (chosen): installation-local curated themes plus curated glass styling. This restores accessibility and visual polish while keeping the system bounded and maintainable.
- **Option B**: keep the single light theme from ADR-0013. This preserves simplicity, but it no longer meets user demand for dark mode and modernized chrome.
- **Option C**: restore the full vault-driven theming architecture. This would maximize flexibility, but it would reintroduce the complexity ADR-0013 explicitly removed.

## Consequences

- Tolaria regains dark mode and adds a bounded curated theme system without reopening vault-scoped theming.
- Appearance preferences live alongside other installation-local UI preferences rather than in vault content.
- `src/lib/appThemes.ts` becomes the authoritative source for theme definitions, while `src/index.css` remains the bridge that maps semantic theme tokens onto app-wide CSS variables and shadcn roles.
- Editor surfaces must stay in sync with the resolved appearance mode; raw editor and rich editor regressions are now part of appearance QA.
- Future visual changes should extend the curated token system instead of reintroducing arbitrary user-authored themes unless a new ADR explicitly reverses this decision.
