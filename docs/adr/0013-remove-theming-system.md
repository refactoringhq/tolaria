---
type: ADR
id: "0013"
title: "Remove vault-based theming system"
status: superseded
date: 2026-03-23
superseded_by: "0081"
---

## Context

Laputa had a vault-based theming system where themes were markdown notes in `theme/` with `type: Theme` frontmatter. Each property became a CSS variable. This included a `ThemeManager` hook, theme property editor, dark mode detection, live preview on save, and three built-in themes. The system was complex (spanning Rust seed/create/defaults modules, TypeScript hooks, and CSS variable bridging) and added significant maintenance burden for a feature that most users never customized beyond the defaults.

## Decision

**Remove the vault-based theming system entirely. The app uses a single, hardcoded light theme defined in CSS variables (`src/index.css`) and editor theme (`src/theme.json`).** The `theme/` folder, `ThemeManager` hook, theme Rust modules, theme property editor, and dark mode support were all deleted.

## Options considered

- **Option A** (chosen): Remove theming, ship a single polished light theme — drastically reduced complexity, fewer files to maintain, no theme-related bugs. Downside: no user customization, no dark mode.
- **Option B**: Keep theming but simplify — reduce to light/dark toggle only. Downside: still requires theme loading, CSS variable bridging, and live preview infrastructure.
- **Option C**: Keep the full theming system — maximum flexibility. Downside: high maintenance cost for a rarely-used feature, frequent source of bugs (WKWebView reflow issues, CSS var sync).

## Consequences

- Deleted: `src-tauri/src/theme/`, `src/hooks/useThemeManager.ts`, `ThemePropertyEditor.tsx`, theme-related commands, `_themes/` legacy support.
- Single theme defined in `src/index.css` (CSS variables) and `src/theme.json` (editor typography).
- No dark mode support — the app is light-only.
- Protected folders reduced: `theme/` is no longer scanned by `scan_vault`.
- Re-evaluation trigger: if dark mode becomes a hard requirement for accessibility or user demand.
