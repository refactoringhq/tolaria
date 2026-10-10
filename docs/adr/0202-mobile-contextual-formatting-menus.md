# ADR 0202: Contextual formatting menus on native tablets

Date: 2026-10-10

Status: Accepted

## Context

The native WYSIWYG surface exposed every formatting command in one horizontally
scrolling row of desktop-sized buttons. That preserved command coverage but made
touch discovery and accurate selection unnecessarily difficult. Desktop remains
the source for icons, colors, typography, document semantics, and command behavior.

## Decision

Keep bold, italic, link, and wikilink directly accessible. Group headings, lists,
insertion, and less frequent formatting into menus. Show table mutation commands
only while the editor selection is in a table. Derive active state from TenTap's
bridge rather than maintaining an independent selection model.

Use the RNR dropdown composition with `@rn-primitives/dropdown-menu` and
`@rn-primitives/portal`, pinned to 1.4.0. Thin local wrappers apply Tolaria tokens
and explicit native layout styles. The primitive owns anchoring, dismissal, and
interaction; do not implement a separate menu positioning engine. A root portal
host keeps menus above the workspace without changing native modal ownership.

Native toolbar controls and menu items have non-overlapping 44-point touch
targets. Icons retain desktop scale. This is an explicit touch adaptation, not a
change to the desktop parity contract. Update native numeric probes accordingly.
The raw/source toolbar remains unchanged in this batch.

## Consequences

- The command model remains shared with existing toolbar/keyboard dispatch.
- Cursor state rerenders the small toolbar subscriber rather than editor content.
- Pure tests protect command coverage and contextual visibility. Native XCUITest
  protects real menu taps, selection, dismissal, and minimum measured target size.
- No new native module or generated editor bundle is required.
- Keyboard/VoiceOver navigation and Android rendering still require device QA;
  adopting a primitive does not establish those results automatically.
