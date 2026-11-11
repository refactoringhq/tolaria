# Native Mobile Interaction Tests

## Phone motion-frame harness (TOL-339)

The debug-only motion probe emits `TOLARIA_MOTION_FRAME` samples from Reanimated's
UI frame callback while the phone panel rail or an organize-swipe row is moving.
Records include the monotonic frame timestamp, frame delta, sampled translation,
probe id, and build id; React editor renders log a content fingerprint only, never
note text. List, hamburger, and FAB layout records are emitted at layout time.

Start Metro with the probe enabled and the tested SHA/build label, install or open
the development app against that Metro, then run the native interaction test:

```sh
EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE=1 \
EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID=<tested-sha-or-build-id> \
npx -y pnpm@10.33.0 --dir apps/mobile start --port 8081 2>&1 | tee /tmp/tolaria-motion-metro.log

TOLARIA_MOTION_LOG_PATH=/tmp/tolaria-motion-metro.log \
EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE=1 \
EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID=<tested-sha-or-build-id> \
node apps/mobile/scripts/test-ios-motion-frames.mjs <booted-iphone-udid> /tmp/tolaria-motion-qa
```

Pipe that Metro process output to a file and set `TOLARIA_MOTION_LOG_PATH` to
that file when invoking the runner; React Native debug-console records are
emitted by Metro rather than the simulator unified log. The runner saves the
captured records and XCUITest result bundle, then
reports sample counts, maximum frame gaps, reverse movement, editor fingerprint
changes, and first-list-frame layout evidence. It launches the app through its
registered bundle id (not `exp://`) and analyzes only Metro records appended
after that launch, so earlier runs cannot contaminate measurements. The note-open
check requires exactly one content-bearing editor-body render; repeated renders
with an unchanged fingerprint still fail the check.

Use `TOLARIA_MOTION_CHECK=note-open` to run only the note-open interaction. The
runner preserves the Metro log, analysis JSON, and XCUITest result bundle even
when a native assertion fails, so the measured evidence remains available.

For the large-vault launch check, register and select a disposable 6,000-note
vault under the app container's `Documents/Local Vaults/<lowercase-id>` path,
then run:

```sh
TOLARIA_MOTION_CHECK=launch \
TOLARIA_MOTION_SEARCH='?source=native&layoutProbe=1&phoneState=list&qaRun=tol339-large-vault' \
TOLARIA_MOTION_LOG_PATH=/tmp/tolaria-motion-metro.log \
EXPO_PUBLIC_TOLARIA_MOTION_FRAME_PROBE=1 \
EXPO_PUBLIC_TOLARIA_MOTION_BUILD_ID=<tested-sha-or-build-id> \
node apps/mobile/scripts/test-ios-motion-frames.mjs <booted-iphone-udid> /tmp/tolaria-motion-large-vault
```

The launch mode asserts that a generated note is present and both hamburger and
FAB are hittable; the analyzer checks their layout against the first list frame
and requires the expected build id. A green native test also asserts
the hamburger and FAB are hittable at the first accessible list frame, returns
from an existing note, closes the sidebar, and starts a full row swipe. Treat a
missing log series as a failed harness run, not a zero-motion pass. A simulator
without either a large fixture or a controlled slow-vault-load seam cannot
certify the delayed-load case; record that case as Not tested rather than
inferring it from a normal launch.

`MobileModalEscapeTests` exercises hardware Escape on a focused unsaved workspace
form, Settings, the vault manager and the command palette. Run it on both phone
and tablet simulators with disposable fixtures; cancellation must not create the
draft View or change the underlying pane navigation.

These XCUITest checks drive the **standalone iOS app**, not Safari, Expo web,
or synthetic JavaScript gesture callbacks. They can run without operating the
Mac's Simulator window. They do not unlock the Mac or change its permissions.

`MobileAccessibilityAuditTests` runs Apple's native accessibility audit on the
list, sidebar, editor and inspector (iOS 17+). Every reported issue remains a test
failure; attached diagnostics retain the affected native element. Its relationship
test requires separate 44-point open/remove targets and taps near the remove
button's corner to check that only that value is removed. It uses in-memory
fixtures, not saved user vaults. A skipped audit on an older runtime is not a pass,
and automated audits do not replace physical VoiceOver or keyboard acceptance.

Prerequisites: Xcode, a booted landscape iPad simulator, the current-source
`com.tolaria.mobile.dev` development app installed, Metro on port 8081, and Ruby's
`xcodeproj` gem (already installed alongside CocoaPods on the development host).

```sh
node apps/mobile/scripts/test-ios-panel-gestures.mjs SIMULATOR_UDID /tmp/tolaria-panel-qa
```

The test opens an explicit isolated fixture. It verifies eight transitions:
toolbar properties hide, a long note-list-header drag hiding both left panels, restoring
the list from the editor, restoring the sidebar, properties edge reveal, dismissal
from its surface, and the two toolbar toggles. It also checks that vertical
movement does not collapse the left panels. Native accessibility frames must
match desktop panel widths (260/340/300 points), rather than merely resemble a
screenshot. The result bundle retains a screenshot and Xcode's failure diagnostics.

The runner is reinstalled for every run: unsigned Xcode test bundles were observed
to reuse stale installed test code. This only removes our disposable test runner,
never the Tolaria app, vaults, or account data. Keep the app source stable while
the test runs; Metro Fast Refresh can otherwise invalidate the interaction.

This is an interaction-correctness check, **not** a frame-rate, interruption,
text-selection, physical-device, Android, or large-vault performance certification.
Use the existing layout/persistence probes alongside it, and measure performance
on representative data in a release build before launch.

`TabletKeyboardTests` covers long workspace forms, short folder forms, and native
WYSIWYG formatting with a real software keyboard, including rotation while it
remains open and opening a form from an already-focused WYSIWYG editor. It checks actual screen-coordinate button/keyboard bounds and
hittability, not web layout or a synthetic keyboard inset. Enable the simulator's
software keyboard; a hardware-keyboard accessory bar alone deliberately fails the
test. Forms are cancelled and editor changes stay in the isolated fixture.

For a standalone build with an embedded current-source bundle, Metro is not
required: generate the project with `create-project.rb` and run `xcodebuild test`
against the installed bundle. Retain the `.xcresult`, and identify the tested
source/bundle in the batch evidence. Do not count a browser capture as this test.

`MobileInspectorContextTests` repeats inspector navigation and a single note-row
tap across three cold launches in each editor mode. It does not retry a missed
tap or swipe. For
diagnosis, set `TEST_RUNNER_TOLARIA_QA_GESTURE_TRACE_URL` to an existing loopback
collector before `xcodebuild test`; the test opts into the layout probe and emits
numeric phone gesture recognition/settlement snapshots. No note content is sent.
Run acceptance again without that environment variable: diagnostic success alone
does not establish ordinary native input reliability.

The host `phoneNativeWorkletCapture.test.ts` compiles the real gesture modules
with the production Babel configuration and executes their serialized closure
graph. Its mutation control must reject a broken capture even when ordinary JS
still works. This catches worklet initialization crashes that mocked gesture
callbacks miss; it does not replace actual Reanimated/Hermes or touch-delivery QA.

The generated test runner supports iPad and iPhone. `PhoneNoteSwipeTests` checks
that leftward row drags reveal Favorite/Delete/Archive, the Favorite button
toggles that state, and full swipes archive without deleting. Rightward drags
remain available for sidebar navigation, and archived notes remain reachable.
These checks use a disposable fixture.

`TabletSourceScrollTests` checks the raw editor with fifty inserted lines:
the syntax layer must lay out the entire document and follow real input scrolling.
It also verifies formatting controls stay above the software keyboard through
rotation. Screenshots supplement numeric frame checks to catch clipped text.

`TabletNoteActionGroupTests` checks Note/Edit/File switching, actual 44-point
touch targets, Undo through the Edit group, and the tablet's direct outline
button. On iPhone, run the group and Undo tests only; the outline remains in Edit
to avoid crowding the phone toolbar. All edits use the disposable fixture.

`PhoneNoteCreationTests` runs on iPhone and checks that the plus button opens a
new note directly, without a title dialog, and retains typed content and default
frontmatter after returning to the list. Browser coverage also exercises Cmd+N
and the command palette; it does not substitute for native typing/navigation.

`MobileCreatedNoteFocusTests` runs on both iPhone and iPad. It creates a note,
requires the software keyboard without tapping the editor, types directly into
the empty H1 and body, and checks focus survives a pause. The raw source must
retain the heading, body and frontmatter. Opening an existing note must not show
the keyboard. All edits stay in an isolated in-memory fixture.

`MobileSourceFocusTests` creates a note while source mode is selected, types into
the H1 and body without another tap, and checks that the keyboard stays visible.
Switching to rich mode must not replay the consumed creation-focus request. Run
on iPhone and iPad using the in-memory fixture. Automatic-sync deferral is covered
by the source draft hook tests; this fixture is not an end-to-end AutoGit check.

`TabletVaultBacklinkTests` requires an isolated on-disk vault with `review.md`
and `codex-prepared-action-qa.md`, titled `Codex Prepared Action QA`, containing
`[[review]]` and `Original full body for native Undo.`. It measures the backlink
row and icon alignment, then follows the reference to its source. Restore the
previous simulator vault configuration after testing; never seed the user vault.

`TabletCommandPaletteKeyboardTests` checks the palette's full bounds against the
software keyboard in both orientations, preserves its 540-point tablet width,
and types and selects a real navigation command after rotation. A continuous
result-list drag must scroll without executing a command or closing the keyboard.
Target existing
test IDs when asserting native labels; iOS may flatten intermediate view ancestry.

`TabletPortraitNavigationTests` verifies sidebar reveal by button and native
touch drag, section selection, header dismissal, and properties access. The
sidebar remains 260 points wide while the editor starts at x=340 and retains at
least 520 points, entirely inside the screen. `TabletPanelGestureTests` explicitly
sets landscape rather than depending on whichever orientation a prior test left.

`TabletVaultManagerTests` opens Sidebar Settings and vault management on both
iPhone and iPad using the disposable workspace fixture. It cancels the system
folder picker twice, rejects an invalid repository URL without contacting a
remote, and fails if credential restoration reports a Keychain access error.
It never selects a folder, clones a repository or changes the saved vault list.
The app (unlike the disposable test runner) must be built with normal simulator
signing enabled. `CODE_SIGNING_ALLOWED=NO` drops the simulator app identity and
can produce Keychain error -34018 even when all filesystem probes pass. Use
`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- ONLY_ACTIVE_ARCH=YES` with the
simulator destination. Let Xcode generate simulator identity entitlements; do not
copy those identities into production app configuration. The optional
`TOLARIA_QA` compilation flag is for local optimized probes only (ADR 0208).

Tests that depend on prepared on-disk data or an authenticated remote skip by
default, before launching the app. Enable only the relevant variable in the
test runner environment (the Xcode scheme's Test action) and select that test:

- `TOLARIA_QA_SOURCE_FIND=1`: `TabletSourceFindTests`, with an isolated active
  vault containing a long source note and `QA_UNIQUE_END_TOKEN` at its end.
  It replaces that marker, so never run it against the user's vault.
- `TOLARIA_QA_VAULT_CATALOG=1`: `TabletVaultCatalogTests`, with disposable
  `local-qa-alpha` and `local-qa-beta` entries and their matching note titles.
- `TOLARIA_QA_AUTHENTICATED_CLONE=1`: `TabletAuthenticatedRepositoryTests`, with
  an existing authorized GitHub session and explicit permission to clone Laputa.
  It does not enable AutoGit or push, but can download a large repository.
- `TOLARIA_QA_PUBLIC_CLONE=1`: `MobileCloneProgressTests`, only on a disposable
  simulator. Downloads part of the public isomorphic-git repository, displays
  actual counts, and cancels. Verify the saved catalog and existing vault files
  are unchanged and the incomplete clone directory has been removed.
- `TOLARIA_QA_RECOVERY=conflict`: `MobileVaultRecoveryTests` background case,
  with a disposable linked folder whose cached and provider versions both differ
  from their recorded baseline. The test waits for real automatic reconciliation,
  requires a non-modal notice, and follows its explicit Manage vaults action.
  It closes the manager and types into a new disposable note to prove the editor
  lock was released. Verify both original versions remain unchanged afterward.
- `TOLARIA_QA_RECOVERY=catalog`: `MobileVaultRecoveryTests` catalog case, only
  after backing up the disposable simulator's primary/backup catalog. Corrupt
  both copies deliberately; require the recovery screen, Retry, no automatically
  opened modal, and no note-creation UI. Restore the byte-identical metadata after
  checking that retry did not overwrite the unreadable catalog.
- `TOLARIA_QA_PENDING_CATALOG=valid` or `corrupt`: `MobilePendingCatalogTests`,
  with only a pending catalog in a disposable simulator. The valid fixture names
  a local vault containing `# Pending Catalog QA`; the test opens its source and
  relaunches to verify restoration. The corrupt fixture must show recovery and
  Retry, not an empty workspace. Check the pending file and note bytes are
  unchanged, then restore the original metadata. Run both cases on iPhone/iPad.
- `TOLARIA_QA_LINKED_FOCUS=1`: `MobileEditorFocusTests` linked-folder case, with
  an isolated active folder imported through Files. The source and app-owned
  working copy must both be disposable. The test creates a note, types across
  an eight-second pause, and backgrounds the app to flush. Verify the resulting
  Markdown in both copies, including its frontmatter, before cleaning up. Run
  on both iPhone and iPad. The fixture-only case needs no on-disk vault.

Back up the simulator catalog before preparing these fixtures, restore it after
the test, and remove only the disposable copies created for that run. Retain
before/after file hashes for any existing user vault. A skipped integration test
is not a passing integration check.

## Default Note Type

`MobileDefaultNoteTypeTests` requires `TOLARIA_QA_DEFAULT_NOTE_TYPE=1` and an
empty, disposable local vault selected in a backed-up catalog. Set the generated
scheme Test action's `shouldUseLaunchSchemeArgsEnv` to `NO` when supplying its own
environment variables. The test creates a note through the native UI and checks
its H1, body and frontmatter after relaunch. Verify the filesystem contains the
new note and exactly one root `note.md` with `type: Type` and `# Note`, then restore
the original catalog and remove the disposable vault. Run on both device sizes.

## Bottom Note Creation

`MobileCreateNoteButtonTests` runs against the disposable in-memory fixture on
both phone and tablet. It checks the round action's native frame, separation from
the filter controls, and direct creation into a focused H1 without a title dialog.
It never opens or modifies an existing vault.

## Bundled First Launch

`MobileStarterVaultTests` requires `TOLARIA_QA_FRESH_STARTER=1` in the generated
scheme Test action and a fresh, disposable simulator installation. It opens the
bundled guide, creates an additive test note, and checks that note after relaunch.
Run on iPhone and iPad using the standalone Release QA app, without Metro. Verify
all 47 template files against the bundled SHA-256 manifest and confirm the catalog
selects a local vault with no Git remote. Remove only the additive test note after
checking persistence. Never reset an existing user's catalog for this test.
Embedded-asset checks do not by themselves prove network-disabled operation;
record network conditions separately when claiming offline native QA.
