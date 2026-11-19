---
type: ADR
id: "0303"
title: "Calendar collection layout and per-layout renderer bindings"
status: active
date: 2026-11-19
Platform: desktop
---

## Context

ADR 0301 registered List and Kanban as collection layouts and ADR 0302 gave non-list layouts the whole workspace with a slide-in editor panel. TOL-381 adds a Calendar layout that places notes on the days of a date property. The renderer props were Kanban-shaped (`groupBy`, `columnOrder`, …), so adding a second layout by overloading those fields would have mixed two layouts' settings in one flat bag.

## Decision

This ADR extends ADRs 0301 and 0302; the shell, the registry and the file formats stay as described there.

- **Renderer props are shared props plus one binding object per layout.** `CollectionLayoutRendererProps` carries what every layout uses (entries, card properties, locale, type map, selected note, `onOpen`) plus `kanban: KanbanLayoutBindings` and `calendar: CalendarLayoutBindings`. A registration renders from the shared props and its own bindings. A registration may also provide `renderMissing` to replace the generic "no notes have this property" state with its own.
- **Calendar is registered like Kanban.** Label key `layout.calendar`, Phosphor `CalendarBlank`, header control `dateProperty`, and `requiredProperties` = the date property and the end-date property when set (the read-only `$created` / `$modified` sources are never required).
- **Calendar settings persist next to the Kanban ones.** `CalendarCollectionPresentationConfig` is `type: calendar` with `dateProperty`, `endDateProperty`, `view` (`month` | `week`), `showWeekends` and `properties`. Saved Views store it under `presentation:` in `views/*.yml`; built-in, type and folder lists store the same keys in `layouts/*.yml`. A View that leaves Kanban keeps its board under `presentation.kanbanConfig`, as it already did for List, and the calendar keys stay in the presentation while it shows another layout, so switching back restores both. Calendar keys are only written once the list has used or configured a calendar. The visible month or week is session state and opens on today.
- **Reschedules and new notes are ordinary frontmatter.** A drop writes the date property (and the end date for a range, moved by the same offset) through the normal frontmatter handler, start first; the item shows on its new day optimistically and snaps back after five seconds if the vault never reports the value. Only plain, single-line keys the list's notes already carry are written (the Kanban key grammar). A day's `+` creates a note through the immediate-create path with the date prefilled (`ImmediateCreateOptions.properties`, which wins over the type's instance defaults).
- **Date math is time-zone free.** Days are `YYYY-MM-DD` keys with UTC day arithmetic; titles, weekday names and ranges come from `Intl` for the app locale; the week starts on the CLDR first day for the app locale (Sunday or Monday).

## Consequences

- Kanban keeps its own props type (`CollectionLayoutSharedProps & KanbanLayoutBindings`) and its tests are unchanged.
- The editor-panel shell and outside-click close from ADR 0302 now apply to every non-list layout; the CSS selectors match Kanban and Calendar.
- A future layout adds a binding object and a registration instead of new optional fields on a shared bag.

## Alternatives

- An hour-grid week view was rejected: notes carry dates, not times, and the card scopes out intraday granularity.
- A calendar-specific editor drawer was rejected for the same reason as in ADR 0302.
