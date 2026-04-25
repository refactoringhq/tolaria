---
type: ADR
id: "0079"
title: "Linux window chrome and menu reuse"
status: active
date: 2026-04-24
---

## Context

Tolaria's desktop shell was designed around macOS window chrome. `titleBarStyle: "Overlay"` and `hiddenTitle: true` give the app a clean single-surface titlebar on macOS, but Linux ignores those flags and draws native GTK decorations and a native menu bar on top of the React UI. That creates a double-titlebar effect, mismatched theming, and inconsistent behavior between the main window and detached note windows.

We still need Linux to reuse Tolaria's existing command palette, shortcut manifest, and deterministic menu-command routing instead of inventing a Linux-only command path.

## Decision

**Tolaria uses custom React-rendered window chrome on Linux and routes its menu through the existing shared command IDs.**

- The main Tauri window disables server-side decorations on Linux during app setup.
- Detached note windows set `decorations: false` when Linux chrome is active.
- `LinuxTitlebar` renders the drag region, resize handles, and window controls for Linux windows.
- `LinuxMenuButton` mirrors the app's File/Edit/View/Go/Note/Vault/Window menus, but dispatches the existing command IDs through `trigger_menu_command`.
- The native Tauri menu bar is not mounted on Linux; macOS and other existing desktop targets keep the native menu.
- Shared shortcuts remain defined in `appCommandCatalog.ts`, including `Cmd+Shift+L` on macOS and `Ctrl+Shift+L` on Linux through the same command manifest.

## Options considered

- **React-rendered Linux chrome with shared command IDs** (chosen): keeps Linux visually aligned with Tolaria's existing shell and preserves one command-routing model across keyboard shortcuts, menu clicks, and QA helpers. Cons: Tolaria now owns Linux window chrome behavior directly.
- **Keep native GTK decorations and menu bar on Linux**: cheaper to ship, but it breaks visual consistency and produces overlapping titlebar/menu surfaces that do not match the rest of the app.
- **Introduce Linux-only command wiring for the custom menu**: would allow a Linux-specific implementation, but it would fork the shortcut/menu architecture and weaken deterministic QA.

## Consequences

- Linux main windows and detached note windows now present one consistent titlebar surface controlled by Tolaria.
- Menu commands, command palette actions, and deterministic QA still share the same command IDs, which limits platform-specific drift.
- Linux packaging and CI must install WebKit2GTK 4.1 dependencies and produce Linux bundles explicitly.
- Tolaria now owns Linux resize handles, maximize/minimize/close behavior, and titlebar drag-region behavior in the renderer, so regressions in those surfaces require direct tests.
