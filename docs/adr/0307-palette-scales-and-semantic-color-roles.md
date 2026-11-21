---
type: ADR
id: "0307"
title: "Color system: one warm gray and a 50–950 scale per hue, with semantic roles and a color lint"
status: active
date: 2026-11-21
Platform: desktop
---

## Context

Tolaria Desktop's colors grew one value at a time. Light mode used Notion-like warm grays for surfaces but a cool slate (`#718096`) for the gray accent; dark mode had its own hand-picked hex values; tinted fills were invented with `color-mix(… 10%, transparent)` or Tailwind opacity modifiers (`bg-primary/10`, `text-muted-foreground/40`). Chip labels reused the icon color on its own tint, so yellow, orange and the default status chip fell below 4.5:1, and dark mode drew dark text on a pale blue primary button. TOL-406 asks for one coherent system: a warm gray, a 50–950 scale per hue, readable chips and white text on primary and destructive buttons, in light and dark. Luca approved a warm tint, Tailwind-style naming and a full system; blue stays the brand primary.

## Decision

- **Palette** (`src/styles/palette.css`) is the only place raw colors live: `--white`, `--gray-50…950` (warm, OKLCH hue 85) and `--red/orange/yellow/green/blue/purple/teal/pink-50…950`. Every hue uses the same OKLCH lightness ladder, so step N has the same contrast relationships in every hue. Blue 600 is the brand `#155DFF`. Shadows and scrims use warm `--ink-*` strengths of gray 950.
- **Semantic roles** (`src/index.css`) map onto palette steps per theme. Per hue: `--accent-<hue>` (icons, accents: 600 light / 400 dark), `--accent-<hue>-light` (tinted fill: 100 / 900) and `--accent-<hue>-text` (label on that fill: 700 / 300). `--fill-primary`, `--fill-destructive` and `--fill-success` are the 600 steps in both themes with `--text-on-fill` white. Count pills use `--count-pill-*`: the idle pill equals the row hover fill and a hovered row lifts it one step. Opacity-derived Tailwind colors are replaced by registered roles (`ring-focus-halo`, `bg-primary-hover`, `text-text-muted`, `bg-inverse-subtle`, …).
- **Type, status and tag colors** keep their hue assignments. `ACCENT_COLORS` gains `cssText`; status and tag chips use it as the label color, unmapped statuses (e.g. Scheduled) get the gray chip. Custom vault colors that are not a palette key snap to the nearest palette hue (`nearestPaletteHue`), so every vault color renders with the same steps.
- **Syntax highlighting and git-diff colors** stay outside the system in `src/styles/syntax-colors.css` (out of scope for TOL-406).
- **Gate:** `pnpm lint:colors` (`scripts/check-color-system.ts`, part of `pnpm lint`) fails on raw hex, raw color functions, `color-mix()`, Tailwind opacity modifiers on color utilities and Tailwind palette classes anywhere in `src/` outside an explicit allowlist with reasons (palette, syntax colors, the public website release pages, IronCalc and native-window hex boundaries, color parsing). It also builds a contrast report from the tokens and fails when a promised pairing misses its floor (text 4.5:1, icons and input borders 3:1, white on primary/destructive 4.5:1). The same checks run as unit tests.

This ADR supersedes the color values in ADR-0081; its runtime (data-theme, `.dark`, Hybrid scoping) is unchanged.

## Consequences

- New UI color needs go through a semantic role in `src/index.css`; a raw color or an opacity-invented tint fails lint.
- Dark surfaces moved one step lighter (app `#25231F`) so the 800 step can serve hover, borders and buttons.
- A custom Type color like `#22d3ee` now renders as Teal; named CSS colors snap the same way when the webview can parse them.
- `index.html` startup colors and the native window background mirror palette values by hand (they load before CSS).
