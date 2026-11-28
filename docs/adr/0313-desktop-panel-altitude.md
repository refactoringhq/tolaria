---
type: ADR
id: "0313"
title: "Three levels of desktop workspace panels"
status: active
date: 2026-11-26
Platform: desktop
---

## Context

Color, corners, and shadows communicate which panels contain the document and which provide navigation or tools. Across the desktop workspace, recurring surfaces should use the same cues in light and dark mode.

## Decision

**Assign each desktop workspace panel to one of three levels based on its role.** Use the semantic roles from [ADR 0307](0307-palette-scales-and-semantic-color-roles.md) for both themes.

| Level | Role and examples | Light appearance | Dark appearance |
| --- | --- | --- | --- |
| Lowest | Workspace chrome: navigation sidebar and docked AI panel | Frosted glass on macOS, deeper warm gray elsewhere | Dark-tinted frosted glass on macOS, deepest warm gray elsewhere |
| Intermediate | Browsing and document details: note list and Properties | Light warm gray | Mid-tone warm gray |
| Highest | Document editor and raised note row | White | Lightest of the three warm grays |

macOS uses the native window material for the lowest level. Provide an opaque fallback on other platforms and when reduced transparency is enabled. Expanded AI occupies the editor area at the same level as the docked panel. It hides the editor and leaves the note list above it. Floating AI windows use an opaque surface. Controls inside a panel can use a higher surface when they need separation from the panel, as the AI composer does.

The floating sidebar buttons, note-list footer controls, and AI launcher use the same solid fill, size, and elevation. In dark mode they use the editor’s charcoal tone and a subtle perimeter so they read as raised over both the glass and the document surface.

Where levels meet, the higher panel sits over a continuous lower surface. Use the shared panel radius at the seam and a subtle directional shadow where it helps distinguish the levels. Header dividers on the note list, editor, and Properties fade at both ends. Their header shadows appear as content scrolls under them and fade at the sides.

## Consequences

When adding a panel, decide whether it provides workspace chrome, supports browsing or document details, or contains the primary document. Reuse the matching surface role and check the result beside neighboring panels in light and dark mode. For glass surfaces, check the opaque fallback and macOS against both light and dark backdrops.
