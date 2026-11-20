---
type: Note
_organized: true
---

# Calendar layout (TOL-381)

Calendar is the second non-list layout after Kanban. Any note list (type section, All Notes, folder, saved View) can switch to it from the layout menu in the note-list header or from the command palette (**Show Note List as Calendar**). It places each note on the day given by a date property, the way Kanban places notes by its group-by property, and reuses the Kanban shell: it takes over the note-list and editor area, opens notes in the same right-hand editor panel, and writes reschedules through the normal frontmatter path.

## Benchmark

The reference frames below are from [Fantastical's official calendar-view guide](https://flexibits.com/fantastical-ios/help/calendar-views). Notion's official [calendar-view guide](https://www.notion.com/help/calendars) documents its database calendar, weekly view, date-property selection, card-property visibility and drag behavior; Google Calendar's [view guide](https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DDesktop) documents its month/year switcher and navigation.

![Fantastical quarter view](https://flexibits.com/img/help/fantastical-ios/en/f3-ios-full-quarter.png)

![Fantastical year view](https://flexibits.com/img/help/fantastical-ios/en/f3-ios-full-year.png)

### Notion calendar view (database layout)

- **Adopt:** a calendar is just another layout of the same database, picked from the layout menu; "Show calendar by" picks the date property; Month/Week toggle; "Today" plus `‹ ›` arrows in a toolbar above the grid; title "November 2026"; the card shows the page icon and the properties chosen for the layout; drag a card to another day to change the date; `+` on hover in a day to add a page with that date; a "No date" panel that lists pages without a date and lets you drag them onto a day; weekends can be hidden; date ranges render as one bar.
- **Skip:** the separate "Open pages in" setting (Tolaria always uses the right-hand panel, same as Kanban); Notion's full-page date-range editor on drag edges (resizing a range is out of scope; moving a range keeps its length).

### Notion Calendar (Cron)

- **Adopt:** modifier-free keyboard navigation (`T` today, `←`/`→` to move, `M`/`W` to switch view; Notion Calendar also binds `J`/`K`, which we skip to keep the set small); the shortcut letter in each control's tooltip; calm, low-contrast grid lines with a filled circle on today's date; week start from the locale.
- **Skip:** hour grid, time zones, event colours per calendar, and the command bar (out of scope: no time-of-day granularity).

### Google Calendar (month and year views)

- **Adopt:** a compact year overview to find date clusters across the year; the toolbar keeps the same forward/back and Today actions.
- **Skip:** event details in year view; compact month grids mark scheduled days and open the selected month when clicked.

### Fantastical (quarter and year views)

- **Adopt:** quarter and year as navigational zoom levels for date-oriented work, with the same calendar controls.
- **Skip:** time-of-day scheduling and event-specific controls; Tolaria notes only carry day-level dates.

### Google Calendar (month view)

- **Adopt:** multi-day events as continuous bars that wrap at the end of a week row and continue on the next row (flat edge on the side that continues); a fixed number of rows per day with a `+N more` link that opens a popover listing every event of that day (cells never grow); days of the previous and next month shown muted to fill the first and last week; the first day of a month labelled "Nov 1"; the toolbar title follows the view ("November 2026", "Nov 16 – 22, 2026").
- **Skip:** single-click on an empty day to create (it would clash with Tolaria's click-outside-to-close-the-panel); we use a `+` button that appears on a day when hovered or focused instead (a keyboard-reachable control rather than a click handler on the cell).

### Linear / Trello calendar power-ups

- **Adopt:** Trello-quality drag: a lifted preview card under the pointer, the target day (or the full target range) tinted while hovering, optimistic placement on drop, and a snap back if the write is not confirmed. Linear's dark-mode layering: recessed board, raised cells, items with a stronger edge than the cell.
- **Skip:** Trello's per-card date badges inside the item (the date is already the day it sits on).

## Decisions

| Topic | Decision |
|---|---|
| Choosing the date property | Header menu (calendar-dots icon, next to the layout menu like Kanban's group-by): **Date property** (frontmatter properties holding a date in at least one note, plus read-only **Created** and **Modified**), **End date** (None or another date property) and **Show weekends**. |
| Default | When nothing is saved, the first date property the list has, preferring `date`, `due`, `start`, `scheduled`, then alphabetical. Nothing is written until the user changes a setting. |
| No date property | An empty state explains why (no note has a date property, or none has the chosen one), offers each available date property, Created, Modified, and "Show as List". Never a blank grid. |
| Month, week, quarter, year | Segmented control (shadcn Tabs) in the calendar toolbar. Week is seven all-day columns; quarter/year are compact date overviews with no property chips. Shortcuts are M/W/Q/Y. |
| Note icons | Persisted Show note icons checkbox in the calendar menu; enabled by default. |
| Card fields | In month/week, the note-list visible-properties control edits card fields; values wrap instead of clipping. Compact quarter/year omit properties. |
| Navigation | Toolbar: title, **Today**, `‹` `›`. Keys: `←`/`→` previous/next, `T` today, `M`/`W` month/week. Ignored while typing in a field, inside the editor panel, or in an open menu or dialog, and with any modifier, so nothing clashes with existing shortcuts. |
| Today / outside days / weekends | Today's number in a filled primary circle. Days outside the shown month muted. Weekend columns tinted. Week starts on Sunday for en-US, pt-BR, pt-PT, zh-TW, ja-JP, ko-KR and id-ID (CLDR), Monday for every other app locale. Month, weekday names and ranges come from `Intl` for the app locale. |
| Multi-day items | With an end date set, an item spans start…end as one bar per week row; the side that continues is drawn flat. An end before the start, or an invalid end, shows as a single day. |
| Overflow | Each row fits as many lanes as its measured height allows; a day that overflows gives its last lane to `+N more`, which opens a popover with every note of that day. No layout jump: cells never resize. |
| Drag to reschedule | dnd-kit, like Kanban. Dragging a range moves both dates by the same number of days (offset from the day it was picked up on), so the duration is kept. Writes go through `handleUpdateFrontmatter` (undoable, live in the open note and other lists); start first, then end. Time-of-day suffixes on ISO values are kept. Created/Modified are read-only: no drag, no create. |
| Click-to-create | The `+` that appears on a hovered or focused day creates a note in this list (its type or folder) with the date property set to that day, and opens it in the right panel. |
| Unscheduled tray | Right-side "No date" tray with a count, open by default, toggled from the toolbar. Notes with no value and notes whose value is not a date (with a "Not a date: …" hint) are listed; drag one onto a day to schedule it. |
| Card fields | The note-list visible-properties control edits the card fields, as in Kanban. Items show the note icon (list icon component) before the title, a subtle type-colour edge, and the chosen fields below the title. Titles and property chips wrap; item lanes grow to fit. |
| Hidden weekends | Weekend columns disappear; an item that falls only on a weekend is not shown in that week (same as Notion). |
| Persistence | `presentation: { type: calendar, dateProperty, endDateProperty, view, showWeekends, properties }` in `views/*.yml` for saved Views; the same keys in `layouts/*.yml` for type, folder and built-in lists. The visible month/week is not persisted; the calendar opens on today. |

## Out of scope

Hour grid, day view, time slots, recurring events, reminders, external calendar sync, agenda view, resizing a range by dragging its edge, and mobile (keeps List).
