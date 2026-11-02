# TOL-265 Release Record

## Implementation

- Added long-press handling for rich-editor links through the existing native WebView bridge. HTTP(S), `mailto:`, and `tel:` links go to the system URL opener; unsupported schemes are ignored.
- Routed wikilinks through the workspace resolver on phone and tablet, including aliases, paths, and `#heading` targets. Back returns to the prior phone note. Unresolved targets show the existing localized “No matching notes” message.
- Link activation does not dispatch editor changes. Analytics records only the link kind, and only under existing consent.
- Regenerated the checked-in editor HTML from source. Two consecutive builds produced identical SHA-256 `78073919da71b86b87d68c973a94de463234348a881b35d5362736372fbac360`.

## Exceptions

- **Approved artifact-only exception:** `apps/mobile/src/components/workspace/MobileWysiwygTentapEditorHtml.ts`, through 2026-10-30 14:30 Europe/Rome. CodeScene reports no scorable code/no findings and Codacy cannot analyze the generated >1 MB bundle. No authored source, test, analyzer, CI, native QA, or release gate is waived. Bundle provenance test and repeat-build hash are compensating checks. Approved by Luca; recorded on TOL-265.

## Validation

- Focused link routing, editor bridge, analytics, unresolved-link, and heading-fragment tests: 5 files, 33 tests passed. The heading-fragment regression was observed failing before the resolver fix.
- `mobile:lint`: passed.
- `mobile:typecheck`: passed.
- Full mobile suite: 440 files, 2,665 tests passed.
- Biome parity check with repository formatter policy: all 16 authored TypeScript files passed `npx biome check --formatter-enabled=false`. The generated artifact is excluded under the approved artifact-only exception.
- Bundle provenance test: passed. `git diff --check`: passed.
- CodeScene before/after: project Hotspot 10.0, Average 9.983628 (floors 10.0 / 9.98). Every touched authored code/test file scored 10.0 after edits; existing files began at 10.0. Pre-commit safeguard passed (17 eligible files); final `origin/main` change-set review passed (17 eligible files).
- Codacy baseline: touched existing source files had zero dashboard issues on analyzed `origin/main` `84df59cc8ab9b21e5829f701b146f253edc8dc3d`. Final local SARIF scans for authored code files: ESLint, Lizard, Opengrep OSS, and Trivy completed with zero findings per file. Biome was checked separately under the standing repository parity procedure. Generated artifact excluded only by the approved exception. Exact pushed-SHA dashboard verification: pending.
- Expo native simulator/device tap: not verified. No native link activation proof is available yet; owner iPhone/iPad acceptance remains required. Android acceptance also remains pending.
- Repository frontend coverage: 6,343 passed, 1 skipped, 89.67% lines. Rust tests: 1,189 passed, 2 ignored, plus 5 integration tests; Rust line coverage 86.06% (>=85%).
- Root lint/typecheck, full root suite (6,343 passed, 1 skipped), frontend coverage (89.67% lines), Rust tests (1,189 unit + 5 integration passed, 2 ignored), Rust coverage (86.06%), and 40 Playwright smoke tests passed in the verified `56e58589a` root-test fix push. That commit fixes the unrelated `Content-Length` test race; no bypass used.
- TOL-265 full pre-push gates and exact pushed-SHA dashboard analysis: pending. OTA receipt: pending.
- Localization: no UI copy added; the existing localized `noteList.empty.noMatching` string is reused.
- PostHog: `mobile_note_link_activated` records only `kind` (`external` or `wikilink`) under consent; no URL, note title, or content is sent.
- Refactoring: none needed. ADRs: none. Architecture and abstractions docs updated. Demo-vault dirt: none.

# TOL-281 Checkpoint Record

## Exception

- **CodeScene-only, no-score exception approved by Luca on 2026-11-01:** the two new iPad-visible component rows in `apps/mobile/src/ui/mobileParityInventory.ts` only. CodeScene returned no score on two attempts because the file is declarative inventory data. The change is limited to registering `MobileNoteListPanelParts.tsx` and `MobileNoteListPanelView.tsx`; no CodeScene finding, other file, analyzer, or gate is waived. Expiry: **2026-11-04 04:50 Europe/Rome**.
- Risk: inventory metadata has no scorable code, so its own maintainability score cannot be measured. Compensating gates: explicit two-path inventory assertion, full mobile suite, Biome, Lizard, Codacy, lint/typecheck, native simulator QA, and normal scoped pre-push checks. Review/remove the exception by expiry.

## Checkpoint

- Work is isolated to `mobile-native-ui`; no main promotion or OTA is authorized. Starting branch commit `f1e67bfa1` includes the local merge of `origin/main`.
- The phone note-list screen was extracted into `PhoneNoteListScreen.tsx`, with separate header, filter, and list-body prop builders. Existing parity rows were divided into UI and workspace modules; the small index retains the two approved iPad-visible component rows.
- Biome: all 20 touched mobile TypeScript files passed. `mobile:typecheck`, `mobile:lint`, and the full `mobile:test` suite passed (449 files, 2,702 tests).
- Codacy local: all four relevant analyzers (ESLint, Lizard, Opengrep OSS, Trivy) completed with zero findings for the 20 changed authored code/test files; no partial-scan warnings. New inventory modules returned CodeScene no-score with empty reviews; the new screen module scored 10.0. `PhoneWorkspaceScreens.tsx` remains 10.0; the inventory index has no score under the approved two-row-only exception. CodeScene pre-commit safeguard passed (20 code files); branch change-set review against `origin/mobile-native-ui` passed (41 code files).
- Native: the earlier disposable iPad simulator build and launch succeeded and showed the workspace. A fresh build after the behavior-preserving module extraction was not repeated because the internal disk has 7.8 GB free, below the 8 GB floor. The disposable simulator was deleted. No main merge, OTA, or TestFlight action was performed.
- Localization: no UI copy changes. PostHog: no event needed because this is visual chrome and does not add a new user action. ADRs/docs: none beyond this release record. Demo-vault dirt: none.

# TOL-282 Checkpoint Record

## Exception

- **CodeScene-only no-score exception approved by Luca on 2026-11-01:** the three new sidebar component rows in `apps/mobile/src/ui/mobileParityInventoryWorkspace.ts` only. CodeScene returned no score and no findings twice for this declarative module. Expiry: **2026-11-04 04:50 Europe/Rome**, matching TOL-281. No CodeScene finding or other file/analyzer/gate is waived.
- Risk: parity metadata is unscorable by CodeScene. Compensating checks: explicit inventory rows and full parity inventory test, mobile suite, lint, typecheck, Biome, Codacy, Lizard, CodeScene on other files, and scoped pre-push. Review and remove by expiry.

## Implementation and Validation

- Reworked the mobile sidebar into small native-adapted sections, item rows, and sync-pill components. iOS uses grouped system surfaces, native selection fills, fixed-section symbols and native long-press menus; type and user-selected icons retain Phosphor rendering. Android uses 56dp rows and pill selection. The vault menu retains remembered vault actions and places workspace management last.
- Full mobile suite: 450 files, 2,707 tests passed. `mobile:lint`, `mobile:typecheck`, `npx biome check` on all 13 changed TypeScript source/test files, and `git diff --check` passed.
- Codacy local per-file scans: all 13 changed/new TypeScript files individually had successful ESLint, Lizard, Opengrep OSS and Trivy runs with zero findings; Biome was checked separately per the standing local analyzer-parity procedure. The Codacy MCP wrapper failed on invocation, so the repository CLI fallback was used and its SARIF and logs were inspected. The workspace inventory baseline also completed with four analyzers and zero findings.
- CodeScene: all scorable touched source/test files remained at 10.0; the type-only module and declarative parity inventory return no numeric score and no findings. The inventory score is covered only by the approved exception above. Pre-commit safeguard and branch change-set review against `origin/mobile-native-ui` passed; normal scoped pre-push remains to be run.
- Native: Debug simulator build succeeded for the existing `Tolaria-iPhone-16-Pro` (iOS 18.3.1), using the external derived-data path `/Volumes/Jupiter/QA/TOL-282-derived` and Metro port 8082. App launch succeeded. Light and dark screenshots were captured at `/private/tmp/TOL-282-loaded-8082.png` and `/private/tmp/TOL-282-dark.png`; both show the note list with the drawer closed, so they do not visually prove the new sidebar. Simulator.app is absent, and Device Hub could not attach this simulator because its device set is configured at `/Volumes/Jupiter/Developer/CoreSimulator/Devices` while this simulator is in the default set. No other simulator was touched. Native drawer opening and menu interaction remain unverified. No main promotion, OTA, or TestFlight action.
- Localization: no UI copy changes. PostHog: no event needed because this adapts existing sidebar navigation/actions without adding a new user action. Docs: `docs/ABSTRACTIONS.md`. ADRs: none. Demo-vault dirt: none.

# TOL-283 Checkpoint Record

## Implementation

- Replaced the iOS settings body with an inset-grouped Expo UI SwiftUI Form. It groups workspaces, GitHub, sync, appearance, update channel/diagnostics, privacy, and About; existing workspace and account actions remain hosted from their shared React Native components.
- Added an Android Compose settings layout using ListItem, Switch, and segmented controls, with a full-screen presentation and back-arrow toolbar. The iOS sheet keeps its Done button and swipe dismissal.
- Moved Auto Git into the Sync section and hid the duplicate toggle in the embedded Git controls while retaining manual commit controls only when Auto Git is disabled. Theme, channel, analytics, crash-reporting and Auto Git continue through the existing persisted settings controller.

## Validation

- `mobile:lint`, `mobile:typecheck`, `mobile:test` (450 files / 2,708 tests), Biome on all seven changed source/test files, `l10n:validate` (21 catalogs / 1,367 keys), and `git diff --check`: passed.
- iOS Debug simulator build succeeded for the existing Tolaria-iPhone-16-Pro using Metro port 8082 and external derived data `/Volumes/Jupiter/QA/TOL-283-derived`; reinstall and app launch succeeded. Screenshot `/private/tmp/TOL-283-postbuild.png` confirms launch only; Settings interactions and a Settings-screen screenshot were not verified because Simulator.app and the AXe UI bridge are unavailable in this Xcode install. Android native build and interaction QA were not run.
- CodeScene: all seven touched/new source and test files score 10.0; pre-commit safeguard passed (7 files). Change-set analysis against `origin/mobile-native-ui` passed (10 changed files, including the earlier main merge).
- Codacy local manifest: `MobileGitControls.tsx`, `MobileVaultManager.tsx`, `MobileSettingsSheet.tsx`, `mobileSettingsController.test.ts`, `MobileNativeSettingsForm.ios.tsx`, `MobileNativeSettingsForm.android.tsx`, and `MobileNativeSettingsForm.tsx`. ESLint, Lizard, Opengrep OSS, and Trivy completed per file with zero findings after two Lizard refactors. Biome passed separately; no partial scan. Codacy MCP wrapper failed, so the repository CLI fallback was used. Dashboard exact-branch analysis remains pending after push.
- No local full desktop/root coverage or Android build was run; this is native-branch work, and the scoped branch push hook remains required. No OTA, TestFlight, or main merge.
- Localization: no UI copy changes; existing localized strings reused. PostHog: existing preference/theme events retained; no new event needed because no new user action was introduced. Refactoring: extracted Git controls and iOS About section to satisfy Lizard. ADRs/docs: none. Demo-vault dirt: none.

# TOL-284 Checkpoint Record

## Implementation

- Added an iOS native long-press context menu for note rows with Favorite, Archive/Unarchive, Move, destructive Delete, and Select when bulk selection is available. Actions route through existing note-list callbacks; Android long-press selection and swipe gestures are unchanged.
- Remaining TOL-284 scope: replace formatting dropdowns and convert the remaining workspace action sheets to native platform sheets/dialogs; remove the dropdown dependency only after its final use is gone.

## Validation

- Focused menu model tests: 2 passed. Full mobile suite: 451 files, 2,710 tests passed. `mobile:lint`, `mobile:typecheck`, `mobile:export:web`, Biome on all four touched source/test files, and `git diff --check` passed.
- Codacy local SARIF: ESLint, Lizard, Opengrep OSS, and Trivy completed per file with zero findings for all four touched/new code files. Existing `MobileNoteListItems.tsx` and `MobileSwipeableNoteRow.tsx` had zero local findings at baseline and remain zero; new model and test files have zero findings. Dashboard baseline on analyzed main was zero issues for both existing files.
- CodeScene: all four changed/new code files score 10.0; pre-commit safeguard and branch change-set review against `origin/mobile-native-ui` passed. No new inventory file was added; the existing note-list parity entry covers the row surface.
- No native simulator interaction was run for this checkpoint; menu presentation/action behavior remains unverified in the simulator. No dependency removed, native build changed, main merge, OTA, or TestFlight action.
- Localization: no new copy; existing localized menu strings reused. PostHog: no separate event needed because these invoke existing note actions. ADRs/docs: none. Demo-vault dirt: none.

## TOL-284 Follow-up Checkpoint (2026-11-02)

- Replaced the workspace action overlay with Expo UI `BottomSheet` and moved Android single-field prompts to Compose `AlertDialog` / `OutlinedTextField`; retained the existing callback and validation paths. Moved implementation-only action components into a nested folder so the iPad parity inventory continues to enumerate only visible workspace components.
- Validation: `mobile:lint`, `mobile:typecheck`, full `mobile:test` (452 files / 2,714 tests), web export, Biome on the 10 touched TypeScript files, and explicit per-file Codacy CLI scans passed with zero findings from ESLint, Lizard, Opengrep OSS, and Trivy. CodeScene file scores are 10.0 for all 10 touched/new code files; pre-commit safeguard and branch change-set review against `origin/mobile-native-ui` passed.
- Native QA: simulator build was interrupted when internal free space reached 7.8 GB, below the 8 GB floor. No simulator build/launch proof. Existing Tolaria-iPhone-16-Pro was not deleted or reset. Resume after disk is restored above the floor.
- Localization: no UI copy changes. PostHog: no event needed; existing workspace actions only changed presentation. No main merge, OTA, or TestFlight.

- Retry 2026-11-02: `xcodebuild -workspace apps/mobile/ios/Tolaria.xcworkspace -scheme Tolaria -configuration Debug -destination id=BA1280F0-6F2D-470B-9F08-B385E762E777 -derivedDataPath /private/tmp/tol284-resume-derived CODE_SIGNING_ALLOWED=NO build` succeeded with `SENTRY_DISABLE_AUTO_UPLOAD=true`. Disk ended at 9.5 GB free; the 8.5 GB guard remained active. No simulator app install/launch, app-container access, or vault change was performed. Metro on port 8082 was left untouched. Native interaction/screenshot acceptance remains pending.

- Retry 2026-11-02 (5 GB floor): rebuilt the iOS Debug app successfully with signing enabled for the existing Tolaria-iPhone-16-Pro, using the isolated QA Metro on port 8083; the existing Metro on 8082 was not modified. Installed and launched the app with `source=fixture`; native Create View sheet and form rendered. Screenshot: `/private/tmp/tol284-native-qa/launch-with-port.plist.png`. A 7-case XCUITest run started but Xcode stalled finalizing simulator diagnostics (no result bundle completion); stopped that run with 5.5 GB free. This is not recorded as a passing test run. No simulator was created, deleted, or reset; no main merge, OTA, or TestFlight action.

- Retry 2026-11-02 (5 GB floor): Device Hub was restarted and selected the existing Tolaria-iPhone-16-Pro, but starting/attaching still fails with `No matching device (BA1280F0-6F2D-470B-9F08-B385E762E777) in set at /Volumes/Jupiter/Developer/CoreSimulator/Devices` (404). No further interaction proof was possible; no simulator was created/deleted/reset. Shared Linear agent context was unavailable (`get_agent_context` not found); existing checked-in docs and TOL-284 notes were used. Work remains uncommitted on `mobile-native-ui`; no main/OTA/TestFlight action.

- Retry 2026-11-02 after CoreSimulatorService restart: fresh Device Hub attached to the existing Tolaria-iPhone-16-Pro from the default device set. The initial focused XCUITest opened the native menu but used the wrong XCUI element type for its menu item; its screenshot confirmed the native menu was visible. Updated only the ignored local test harness to query `editor-format-heading-2`, then reran with `-collect-test-diagnostics never`: 1 test passed, selecting Heading 2 and confirming the menu dismissed. Result bundle: `/Volumes/Jupiter/Cache/tol284-native-qa-20261102/tol284-ui-retry2.xcresult`; menu screenshot: `/tmp/tol284-ui-retry2/E831FAE6-5122-4217-822F-A816B517D6C6.png`. No simulator was created, deleted, or reset; app/source changes remain only on `mobile-native-ui`.
- After merging `origin/main` at `6b8f36c8a`, reran the same focused XCUITest on Tolaria-iPhone-16-Pro with `-collect-test-diagnostics never`: 1 passed, 0 failed. Result bundle: `/Volumes/Jupiter/Cache/tol284-native-qa-20261102/tol284-ui-merged.xcresult`; screenshot attached to TOL-284. The branch pre-push lane passed `mobile:lint`, `mobile:typecheck`, all 452 mobile test files / 2,719 tests, web export, and CodeScene (Hotspot 10.0 / Average 9.98215). The origin/main status was green across CircleCI jobs when checked. Branch push: `72a860670` plus main merge `e5fcc7518`, pushed to `origin/mobile-native-ui`; no main merge of native work, OTA, or TestFlight.
