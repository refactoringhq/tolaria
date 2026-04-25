---
type: ADR
id: "0081"
title: "Internal light and dark theme runtime"
status: active
date: 2026-04-24
supersedes: "0013"
---

## Context

ADR-0013 removed the vault-authored theming system and made Tolaria light-only. That kept the app simpler, but dark mode has become a product requirement for long writing sessions and accessibility.

The previous theming system should not return in its old form: vault notes, live user-authored themes, and broad runtime editing created too much maintenance burden. Tolaria still needs a small app-owned theme architecture because the UI spans Tailwind/shadcn variables, BlockNote/Mantine surfaces, CodeMirror raw editing, syntax highlighting, and product-specific states such as selected rows, badges, warnings, and diff lines.

## Decision

**Tolaria will support internal app-owned light and dark themes through a semantic CSS-variable contract, with the user's theme mode persisted as installation-local app settings.**

The v1 theme runtime is deliberately smaller than a general theming system:

- Themes are defined by the app, not by vault-authored notes.
- CSS custom properties remain the public runtime contract for product components, Tailwind v4, and shadcn/ui.
- Typed TypeScript helpers may derive values for consumers that cannot read CSS variables directly, such as CodeMirror extensions.
- Existing CSS variables stay available as compatibility aliases while the UI migrates toward semantic names.
- The first persisted choices are `light` and `dark`; system-follow, high-contrast variants, custom themes, and per-vault themes are deferred.

## Options considered

- **Internal light/dark runtime with semantic tokens** (chosen): ships dark mode while keeping the product-owned theme surface small, testable, and compatible with existing CSS-variable usage.
- **Reintroduce vault-authored theme notes**: flexible, but repeats the complexity removed by ADR-0013 and makes dark mode dependent on user-editable data.
- **Ad hoc `.dark` overrides in components**: fastest initially, but would scatter color logic across the app and make future theme variants expensive.
- **Single TypeScript theme object as source of truth**: attractive for validation, but the current app already relies on CSS variables for Tailwind, shadcn/ui, BlockNote CSS overrides, and many product components.

## Consequences

- `src/index.css` owns the stable CSS custom-property contract for app chrome and shared states.
- `src/theme.json` continues to describe editor typography, but editor-facing colors should resolve through the same semantic CSS variables used by the app shell.
- `useTheme` remains responsible for editor theme flattening and can grow into the bridge between app theme mode and editor consumers.
- App settings, not vault frontmatter, store the selected theme mode because it is an installation-local comfort preference.
- Startup must avoid a light-mode flash when dark mode is selected, so the runtime needs a pre-React localStorage mirror and a minimal `index.html` prepaint style in addition to persisted Tauri settings.
- Domain tokens should be introduced only when a surface needs a role that generic semantic tokens cannot express clearly.
- Re-evaluate if Tolaria decides to support user-authored custom themes, per-vault themes, or system-synchronized mode as a first-class product requirement.
