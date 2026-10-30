# Mobile UI Parity

Tolaria mobile UI work starts from fixture-driven desktop parity for note content and note identity. Navigation and other mobile chrome follow iOS or Android conventions. The goal is to keep documents and note types consistent across platforms while making the app shell feel native.

## Copy-First Rule

Desktop Tolaria remains the visual source of truth for note content and type identity. React Native navigation, controls, sheets, menus, alerts, settings, sidebar chrome, and chrome typography follow the host platform: Liquid Glass on iOS and Material 3 on Android. Tablet split-pane layout and existing tablet contracts remain unless a later card changes them.

The contract boundaries are:

| Exception | Rule |
| --- | --- |
| Native layout engine limits | Preserve document and note-type semantics; use platform-native chrome measurements. |
| Touch targets | Follow platform accessibility targets for native controls. |
| Tablet panel navigation | Existing split-pane contracts remain until a later card changes them. |
| Platform chrome | iOS and Android navigation and controls intentionally follow their platform design systems. |

A deviation in note content or note identity is a parity bug. Chrome follows ADR 0299.

## Content and Type-Icon Parity Contract

Mobile desktop-derived constants live in:

```text
apps/mobile/src/ui/desktopParity.ts
```

The visible iPad component coverage map lives in:

```text
apps/mobile/src/ui/mobileParityInventory.ts
```

`mobileParityInventory.test.ts` fails when a visible iPad implementation component has no documented contract. Desktop sources and parity assertions apply to note content and note-type identity; native chrome may instead cite its platform contract.

That file records the source values for the current iPad surface:

| Contract | Desktop source | Mobile users |
| --- | --- | --- |
| `desktopSidebarParity` | Note/type identity only; chrome follows ADR 0299 | `MobileWorkspaceSidebar` |
| `desktopNoteItemParity` | `NoteItem` content and type identity; chrome follows ADR 0299 | `MobileListRow`, `MobileNoteListPanel` |
| `desktopPropertyParity` | `propertyPanelLayout`, `propertyChipStyles`, `RelationshipsPanel` content semantics; chrome follows ADR 0299 | `MobilePropertyRow`, `MobileChip`, `MobilePropertiesPanel` |
| `desktopEditorParity` | `theme.json`, `EditorTheme.css` | `TabletEditorPanel` |
| `desktopPanelParity` | desktop split-pane widths; chrome follows ADR 0299 | tablet sidebar, note list, editor, properties |

The mobile snapshot also carries Type-note schema metadata into `MobileTypeDefinition.properties` and `MobileTypeDefinition.relationships`. `MobilePropertiesPanel` uses that schema to render the same missing type-derived property and relationship slots that the desktop inspector derives from Type entries, followed by the desktop suggested slots (`Status`, `Date`, `URL`, `belongs_to`, `related_to`, `has`). Placeholder rows must open the normal add-property or add-relationship sheet with the key prefilled; they must not create a separate mobile-only editing path.

## Fast QA Loop

Routine mobile UI work on `mobile-ui-foundation` uses the scoped checks:

```bash
pnpm mobile:lint
pnpm mobile:typecheck
pnpm mobile:test
pnpm mobile:qa:screenshots
pnpm mobile:qa:ios-layout
pnpm mobile:qa:ios-simulator
```

`pnpm mobile:qa:screenshots` exports the Expo web bundle, serves it locally, drives the UI lab with Playwright, and writes screenshots plus a manifest to:

```text
/tmp/tolaria-mobile-ui-screenshots
```

The screenshot suite contains objective parity assertions for tablet landscape. Desktop-parity checks for content and type identity remain. The native-UI follow-up cards update only the chrome assertions they change; until those cards land, the existing suite may still encode the previous chrome baseline. Content/type regressions include:

- invented primary-blue note selection when desktop uses the note type color
- editor H1, paragraph, quote, and table primitives drifting from `theme.json`
- note-type colors and note-type Phosphor icons diverging from desktop

The same Playwright suite compares the primary tablet-landscape screen against a committed baseline. Follow-up chrome cards update that baseline with the relevant native design while retaining checks that mobile content and note-type identity match desktop `src/index.css` and `src/theme.json`.

`pnpm mobile:qa:ios-layout` opens the native Expo Go deep link with `layoutProbe=1` and reads `TOLARIA_MOBILE_LAYOUT_METRIC` lines from iPad Simulator logs. Use it to verify native rendering and any remaining desktop-derived content/type metrics; platform chrome is evaluated against its iOS/Android contract, not desktop dimensions.

`pnpm mobile:qa:ios-workspace-persistence` and `pnpm mobile:qa:ios-phone-workspace-persistence` exercise reducer write plans through the native Expo filesystem repository. The proof must cover note create/save/move/rename/delete/restore, title-driven filename retargeting, bulk note edits, text-file save, typed property writes, relationship add/remove and target creation, folder writes including restore, saved-view create/update/delete/reorder/restore writes, Type definition create/update/delete/rename/reorder/restore changes, wikilink rewrites, note metadata, default note width, All Notes file visibility, primary note-list config, and property display-mode hydration.

`pnpm mobile:qa:ios-simulator` opens the native Expo Go deep link with `layoutProbe=1`, sets the currently booted iPad Simulator to landscape, and captures it into:

```text
/tmp/tolaria-mobile-ui-simulator/ipad-landscape.png
```

Use it after launching Expo on iOS with `pnpm mobile:ios`. The command refreshes Expo Go before capture, so the artifact matches the native app surface rather than Mobile Safari, the Expo web build, or a stale foreground Simulator app. The native QA scripts reject `http://` and `https://` open URLs because those launch Mobile Safari; automated native acceptance must use `exp://`, `exps://`, or `tolaria://` deep links.

`pnpm mobile:qa:ios-panel-gestures` validates the installed development build's adaptive tablet chrome in landscape. It launches the fixture workspace, performs real drags through the visible Simulator window, and asserts the accessibility tree after hiding and revealing the left chrome and Properties panel. The test maps React Native layout coordinates onto the rotated Simulator window before injecting the drag; direct framebuffer coordinates are not reliable when the iPad simulator is rotated.

For native interaction QA, click React Native controls by their exact `testID` before capturing the next screen:

```bash
pnpm mobile:qa:ios-click -- --test-id note-list-create-action
```

The command reads the native accessibility frame, maps it into the visible Simulator display surface, and clicks the real Simulator window. Use this path for landscape iPad QA instead of accepting a successful AXe/xcodebuildmcp tap result on its own: the lower-level driver can report success while tapping untransformed portrait coordinates when the app is rendered in landscape. Refresh the native accessibility snapshot after navigation or layout changes.

If Expo Go is not already focused, open the running native bundle first:

```bash
pnpm mobile:ios
pnpm mobile:qa:ios-simulator
```

For tablet UI review, treat the native metric gate and simulator artifact as mandatory alongside Playwright screenshots. Playwright catches measurable parity regressions quickly; the simulator screenshot catches native Expo Go rendering differences that browser automation can miss. Use `--open-url` only for native deep links such as `exp://...`; an `http://...` URL opens Mobile Safari and is not an acceptance target for the mobile app.

For padding, margin, row-height, and indentation regressions, do not rely on screenshots alone. Enable the layout probe and compare measured React Native layout numbers against the desktop parity contract:

```bash
EXPO_PUBLIC_TOLARIA_LAYOUT_PROBE=1 pnpm mobile:start
xcrun simctl terminate booted host.exp.Exponent || true
xcrun simctl openurl booted 'exp://<host-ip>:8081'
```

The native app emits `TOLARIA_MOBILE_LAYOUT_METRIC` lines for probed sidebar rows. A healthy sidebar row should report desktop-derived content insets, row heights, and text boxes, for example `sidebar.item.inbox.content.x = 12`, `sidebar.item.inbox.row.height = 32`, `sidebar.item.inbox.label.height = 18`, and nested folder content offsets of `12 + depth * 25`. The browser screenshot lane also runs `enforces measured sidebar row layout invariants` with `?layoutProbe=1`, but native metrics remain required because React Native browser rendering can pass while the iPad simulator is wrong.

The harness also exercises a read-only real-vault path. By default it looks for:

```text
/Users/luca/Laputa
```

Set `MOBILE_QA_VAULT_PATH` to override that path. The loader scans Markdown files read-only, injects a `MobileWorkspaceSnapshot` into local storage, and captures `local-vault` tablet/phone screenshots without touching vault content.

Large-vault QA currently checks:

- local snapshot read/build duration
- initial tablet render from the injected snapshot
- note switching
- type navigation
- folder navigation

The default screenshot matrix is:

| Target | Viewport | Purpose |
| --- | --- | --- |
| Tablet landscape | 1366 x 1024 | First production target and primary quality bar |
| Tablet portrait | 1024 x 1366 | Tablet reflow and panel density |
| Phone portrait | 390 x 844 | Early visibility into phone reduction pressure |

The tablet state matrix currently captures:

| Scenario | Purpose |
| --- | --- |
| `default` | Baseline sidebar, note list, editor, properties, and sync footer |
| `selected-open-source-project` | Note selection state and properties refresh |
| `empty-inbox` | Empty list, no selected note, empty editor, empty properties, pull-required sync |
| `long-title` | Long title pressure across note rows, toolbar, and editor heading |
| `property-heavy` | Multi-tag note, grouped multi-value relationships, and property actions |
| `folder-tree` | Vault folder tree pressure in tablet landscape |
| `local-vault` | Real read-only vault data, large counts, real folders/types, relationships, and markdown pressure |

The phone navigation matrix currently captures:

| Scenario | Purpose |
| --- | --- |
| `initial` | Full-screen note list |
| `sidebar-open` | Left drawer over the note list, leaving a visible strip of list content on the right |
| `editor-open` | Note editor opened from the right with a back path to the list |
| `long-title-list` | Phone note list pressure with long titles |
| `property-heavy-editor` | Phone editor pressure with the property-heavy selected note |

Run the full desktop/native Tolaria gate only before promotion or when desktop/native production files are intentionally changed:

```bash
TOLARIA_MOBILE_FULL_GATE=1 git push
```

## Surface Parity Map

| Priority | Desktop Source | Mobile Target | Required Fixture States | Acceptance Bar |
| --- | --- | --- | --- | --- |
| P0 | Sidebar navigation | Native sidebar rail/list | all notes, inbox, archive, favorites, types, long counts | Use native platform chrome; preserve type names, note-type colors, Phosphor type icons, and user-chosen icons |
| P0 | Note list | Native note list panel | selected note, favorite note, long title, multi-chip note, empty search | Native row treatment; preserve note content, note-type colors/icons, and desktop document semantics |
| P0 | Editor shell | Native editor container | title, rich text preview, empty note | Preserve desktop editor theme and Markdown/document semantics; native controls follow platform design |
| P0 | Properties panel | Native property rows | type, date, status, relationships, empty values | Use native platform treatment while preserving property values, type colors/icons, and relationship semantics |
| P1 | Search and quick open | Native search overlay/sheet | empty query, results, no results, keyboard focus | Results can be scanned quickly; touch, Enter, Escape, and clamped ArrowUp/ArrowDown selection are deterministic |
| P1 | Create note/type/status/property actions | Native modal/sheet controls | valid input, invalid input, type selection, typed property values, collision | Controls use Tolaria primitives; disabled/loading/error states are visible |
| P2 | Phone shell | Reduced navigation and panels | list-only, editor-only, properties sheet, back stack | Phone may deliberately reduce/reflow surfaces; content and type identity stay consistent while chrome follows the platform |

## Writable Interaction Boundary

The tablet and phone shells route editing actions through reducer-owned write plans and the workspace repository boundary. Fixture and web-host runs may stay process-local for QA isolation, but `source=native` runs persist through the Expo filesystem repository.

| Flow | Current behavior |
| --- | --- |
| Sidebar sections and folders | Filter the note list, select the first visible note, and expose folder create/rename/delete/move actions |
| Note rows | Select the note and refresh editor/properties |
| Search | Opens a desktop-parity sheet, filters the visible note list, and lets touch or keyboard-selected results select a note |
| Create note/type/view | Opens localized forms, applies desktop-compatible defaults, and writes Markdown or view files |
| Add/edit property | Opens typed property controls, updates frontmatter, and persists configured display modes in vault-scoped mobile config |
| Add/remove relationship | Uses note suggestions or creates a target note, then persists wikilink frontmatter |
| Favorite, archive, organize, delete, move, rename | Apply reducer write plans and persist note/frontmatter/file-path changes |
| Editor content | Uses WYSIWYG or source editing over a single Markdown document; no mobile-only title/body split |

Do not wire direct vault writes into presentation components. New mutations should stay behind `MobileWorkspaceEdit` and `MobileWorkspaceWrite`, then prove native persistence through the focused iOS probes when the behavior touches repository writes.

## Mobile Primitive Layer

Mobile UI follows the same ownership model as desktop shadcn/ui. RNR-derived primitives live locally in `apps/mobile/src/components/ui`, and Tolaria-specific wrappers/compositions live in `apps/mobile/src/ui`.

Use the local primitive layer before adding new raw React Native controls. Product-specific surfaces can still use native `View`, `ScrollView`, and `Pressable` where they model Tolaria behavior, but text, buttons, badges/chips, and future shared controls should flow through the local RNR-backed components whenever practical.

## Per-Surface Workflow

1. Identify whether the surface is document/content identity or platform chrome.
2. For content and type identity, reuse the desktop source and values in `desktopParity.ts`; for chrome, follow the iOS/Android platform contract.
3. Add or update fixture data for the relevant states.
4. Compose the screen from `apps/mobile/src/components/ui` primitives and `apps/mobile/src/ui` Tolaria wrappers.
5. Add parity assertions for measurable invariants before relying on screenshot review.
6. Run the fast QA loop and inspect screenshots.
7. Add interaction checks for taps, selection, scrolling, and state transitions.
8. Wire real data only after the fixture surface passes visual and interaction QA.

## Quality Rules

- Tablet landscape is the quality bar until the tablet shell is stable.
- Phone UI is allowed to lag, but screenshots must reveal where reduction is needed.
- Screens must avoid browser-default styling, text overlap, unstable dimensions, and decorative-only surfaces.
- Mobile-specific copy must go through the shared locale catalog when it becomes production UI copy.
- Business logic is not a substitute for visual completeness. A surface is not ready to wire until the fixture state is coherent.
