---
type: ADR
id: "0299"
title: "Mobile chrome follows native platform conventions while note content and type icons retain desktop parity"
status: active
date: 2026-10-30
Platform: mobile
---

## Context

Tolaria Mobile's existing parity guidance treats desktop as the visual source of truth for nearly every surface. That is appropriate for note content and note-type identity, but it prevents the phone and tablet shells from using familiar, accessible platform navigation and controls. The approved native-UI plan adopts platform conventions for chrome without changing document semantics or note identity.

## Decision

**Mobile navigation, headers, floating controls, sheets, menus, alerts, settings, sidebar chrome, system controls, chrome typography, and haptics follow their platform: Liquid Glass on iOS and Material 3 on Android. Note content and note-type identity retain desktop parity.** Tablet split-pane layout and existing tablet contracts remain unchanged unless a later card explicitly changes them.

- Note content and editor rendering retain desktop behavior: TenTap/editor CSS, document semantics, and Markdown behavior.
- Note-type colors, note-type icons, and user-chosen note icons remain identical to desktop. Note-type icons remain Phosphor.
- **Icon rule:** SF Symbols (iOS) and Material Symbols (Android) are used only for fixed sections and controls, such as Inbox, Notes, Archive, Favorites, back, menu, compose, search, share, settings and close. They are never used for Types sections or any type/note icon.
- ADR 0248 is superseded only for the mobile chrome visual-language rule; its React Native foundation and primitive-layer decisions remain active.
- The mobile parity guide limits desktop copy-first requirements to content and type icons. Follow-up UI cards own updates to affected chrome assertions; content and type-icon parity checks remain.

## Options considered

- **Platform-native chrome with desktop-parity content and type icons** (chosen): familiar navigation and controls without changing note semantics or user-recognizable type identity.
- **Copy desktop chrome everywhere:** preserves visual consistency, but leaves mobile navigation and system controls unlike the host platform.
- **Use platform symbols for every icon:** increases platform fit, but breaks type-icon consistency across mobile and desktop.

## Consequences

- Phone chrome can use native presentation and interaction patterns, while note content and note-type identity remain predictable across platforms.
- Android and iOS chrome may differ intentionally; those differences are not parity regressions.
- Tablet split-pane behavior remains stable until a dedicated follow-up card changes it.
- Follow-up cards update only chrome tests their changes invalidate and retain tests for content and note-type icon parity.

## Advice

Luca approved the native-UI plan on 2026-10-30 (recorded in TOL-274):

> Okay, so I agree with everything, and you can go ahead with the whole plan and start working on these right now. the only thing I'm not sure I understood correctly is that you also proposed to move to SF symbols icons, and that's something maybe we can do for the fixed sections like inboxes or notes and so on, but we can't do that for the types sections because those icons need to stay the same both on mobile and desktop.
