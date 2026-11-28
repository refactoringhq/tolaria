---
type: ADR
id: "0314"
title: "Fast, local motion for the desktop workspace"
status: proposed
date: 2026-11-27
Platform: desktop
---

## Context

The workspace uses three surface levels ([ADR 0313](0313-desktop-panel-altitude.md)). Motion can clarify how those surfaces relate. Commands, reading, and editing should still feel immediate because panes and controls are used repeatedly throughout the day.

## Decision

**Use short, local transitions with shared timing and direction.** Move a pane a few pixels toward or away from its docking edge. Change fill, border, and elevation in place for controls and selections. Scroll and drag gestures drive their own motion directly.

| Interaction | Starting timing | Behavior |
| --- | --- | --- |
| Hover and press | 90–110 ms | Fade fill, border, or shadow. Press and keyboard focus get immediate feedback. |
| Selection | 120–140 ms | Blend the sidebar selection in place. Move a segmented control's active pill within its track. |
| Docked panes | 120 ms in, 90 ms out | Sidebar and note list move from the left. Properties and AI move from the right. Shift up to 8 px with a short fade and commit the layout once. |
| Small overlays | 100–120 ms | Fade and move a few pixels from the trigger. Restore focus on dismissal. |
| Drag, resize, and scroll | Immediate while tracking, 150–180 ms to settle when useful | Kanban stacks, Calendar scrolling, and note bookmarks follow their inputs. Keep text size and scroll position stable. |

Use ease-out for entrances and settling, ease-in for exits, and a short symmetric curve for selection. Keep related changes on the same beat. Avoid staggered list reveals and decorative motion during repeated navigation.

Reduced Motion and unavailable animation support get the immediate layout. A repeat command may skip an in-flight transition. The visual layer cannot receive input or keep a closed pane in the focus order.

## Implementation

The Tauri dev trial applies docked-pane motion to the sidebar, note list, Properties, and side AI panel. The shared helper uses named View Transition snapshots for the panes affected by a command. It leaves the editor out of the snapshot and commits the new layout in one update. The existing resize handlers continue to apply changes directly. macOS window glass and traffic-light positioning stay platform-specific. Windows and Linux keep the opaque surface palette and their desktop window controls. Each webview opts into pane motion through runtime feature detection.

## Options considered

- **Short pane snapshots.** Animate just the entering or exiting surface, with an immediate fallback on unsupported webviews.
- **Continuous width or grid animation.** This can visually connect the panes but repeatedly reflows the editor and note list during common commands.
- **A full-window transition.** This can preserve more visual continuity but makes a small workspace change move unrelated content.

## Consequences

New interactions should reuse the closest pattern in this ADR. Check quick reversals, keyboard commands, focus, scroll preservation, light and dark themes, and Reduce Motion in Tauri dev before extending these rules to more surfaces.
