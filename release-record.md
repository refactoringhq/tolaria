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

---

# TOL-317 Release Record

## Change

Reworked the mobile quick-open sheet with a single localized search field, recent searches and recently opened notes for an empty query, quiet no-results state, compact rows with gray type icons and bold query matches, keyboard selection, and immediate Return-to-top-result behavior. The sheet no longer repeats the action title or offers note creation. Search history is session-local and contains no note text in telemetry.

## Verification

- Focused quick-open helper tests: 13 passed.
- Mobile: `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:test`; 443 files and 2,717 tests passed.
- Root: `pnpm lint`, `tsc --noEmit`, `pnpm test`; 676 files passed (6,377 tests, 1 skipped), server 48 files / 1,033 tests passed, Pages/web-config/dev-mock checks passed.
- Coverage: frontend line coverage 89.72%; server line coverage 95.73%; Rust tests passed (1,189 unit + 5 integration tests); Rust line coverage 85.79% passed the 85% threshold.
- Localization: `pnpm l10n:translate` and `pnpm l10n:validate` passed for 21 catalogs / 1,369 English keys. `be-Latn` is not a configured Lara target; its new mobile strings were added manually, and its existing desktop search label was preserved.
- Biome: changed TypeScript and locale catalogs checked clean using the repo's existing two-space/single-quote/semicolon-free style. `MobileWorkspaceActionSheet.tsx` was checked with Biome formatting/assist disabled to avoid rewriting untouched code; Biome lint passed.
- Codacy local CLI: explicit per-file scans for all four changed code files; Trivy, ESLint, Lizard, and Opengrep completed with zero findings on each. The pre-edit `MobileQuickOpenSheet.tsx` had one ESLint hooks finding; it is now zero. Dashboard baseline for the four files was zero. Enabled dashboard roster: Biome and current ESLint9 (deprecated ESLint disabled), plus Lizard, Trivy, and Opengrep; Biome is covered by the repository Biome check.
- CodeScene: all four changed code/test files are 10.0 before/after; pre-commit safeguard and `origin/main` change-set review passed. Initial project Hotspot 10.0 / Average 9.982230364474246, above `.codescene-thresholds` (10.0 / 9.98).
- Demo vaults: no fixture changes.
- PostHog: existing `search_used` event already records quick-open use; no additional event was added because this redesign keeps the same search action. Search terms and note content are not sent.
- ADR/docs: none; this remains within the existing mobile quick-open flow and adds no native integration.

## Device QA Still Needed

The existing iPhone 16 Pro simulator is booted with Device Hub open, and Metro sessions are active in both the mobile-native-ui and mobile-ota-main worktrees. I did not take over the shared simulator or stop either Metro. Please verify on iPhone and iPad:

1. Empty query shows one Search field, Recent searches, and Recently opened notes without a duplicate sheet title.
2. Searching `randy shoup` shows the seeded result, bold matching snippet text, gray leading type icon, no tag chips or heavy separators, and a light selected row.
3. A query with no matches shows the quiet No results state.
4. Return opens the top result; iPad arrow keys move selection; clear and Cancel work; the sheet grows with results without flicker.
5. Repeat empty/query/no-results states at larger Dynamic Type and with Reduce Motion enabled; capture before/after screenshots for both device sizes and a short typing/open/cancel recording.

---

# TOL-315 Release Record

## Change

- Added native pressed feedback to note rows, sidebar/folder rows, relationship rows, and bulk-action controls.
- Memoized the note row and extracted sidebar composition into small internal components.
- Kept multi-selection stable across visible-note updates and syncs, with focused selection regression tests.
- Kept implementation-only sidebar composition modules out of the surface parity inventory; public surfaces remain checked against the inventory.

## Validation

- Targeted parity inventory regression: 2 tests passed; initial run reproduced 4 unregistered internal sidebar modules.
- `mobile:lint`, `mobile:typecheck`, and `mobile:test`: passed; 447 files / 2,729 tests.
- Biome check on all 16 changed TypeScript files: passed.
- Codacy local per-file scans on all 16 source/test files: Trivy, ESLint, Lizard, and Opengrep OSS completed with zero findings. Codacy Cloud dashboard baseline on `6957e835d`: 0 on every touched file except `MobileWorkspaceSidebarFolderTree.tsx` had 2 Lizard findings; local result is now 0 for that file. Enabled dashboard roster confirmed Biome and ESLint9 enabled, deprecated ESLint disabled, with Lizard and Trivy enabled.
- CodeScene: all 16 touched files scored 10.0 after changes; new files scored 10.0. Pre-commit safeguard and `origin/main` change-set review passed for all 16 files.
- Root lint/typecheck/test, coverage, Rust gates, Playwright smoke, CircleCI, and Codacy analysis on `fe9b657c7` passed. The exact-SHA dashboard issue list nevertheless exposed two Lizard findings on the folder-tree renderer (also present on baseline) and one Lizard finding on the bulk-action renderer; this follow-up extracts the JSX render paths to bring the dashboard-scored methods under the configured limit. Follow-up exact-SHA dashboard confirmation is pending.
- Localization: no UI copy changes. PostHog: no event needed because this change adds feedback/performance behavior to existing actions without introducing a new user action. ADRs/docs: none. Demo vaults: clean.

## Device QA Still Needed

- Record iPhone and iPad proof that each row type shows pressed feedback.
- Verify scrolling a 2,000+ note vault with the perf monitor and capture dropped-frame evidence.
- Verify multi-selection survives an actual background sync.

## Follow-up: dashboard Lizard findings

- Exact-SHA Codacy analysis of `fe9b657c7` reported `FolderTree` at 262 NLOC / CCN 25 and `BulkActionButtons` at 63 NLOC, although the local CLI had reported zero Lizard findings. The folder-tree root renderer and row-content/style/action helpers are now separated, and bulk actions are split into primary and secondary renderers. Local per-file Codacy scans for both refactored files now complete all configured analyzers with zero findings; CodeScene remains 10.0 for both files. New exact-SHA dashboard verification is pending.

---

# TOL-319 Release Record

## Change

- Active selections now derive their effective deep-link slug from the latest saved-vault catalog entry instead of keeping the alias captured when the vault was selected.
- The selected note, vault root, and Git selection are preserved; collision-safe slug generation continues to use the shared alias helper.
- Added a hook regression covering a selected Git-backed vault whose catalog slug changes while the selection override is active.

## Validation

- Focused catalog-selection and deep-link suites: 26 tests passed.
- `mobile:lint`, `mobile:typecheck`, and `mobile:test`: passed; 447 files / 2,730 tests.
- Biome lint/assist check on both changed TypeScript files passed (`biome check --formatter-enabled=false`; repo formatter defaults conflict with the established mobile formatting).
- Codacy local per-file scans: ESLint, Lizard, Opengrep OSS, and Trivy completed on both changed files with zero findings. Initial Lizard CCN 9 on the hook was refactored into `currentCatalogSelection`; rescans are clean. Dashboard baseline on main (`68e3244a3`) was zero issues on both paths; enabled roster includes Biome, ESLint9, Lizard, Opengrep, and Trivy; deprecated ESLint is disabled. Biome was checked separately.
- CodeScene before/after: both changed files 10.0. Project Hotspot 10.0 / Average 9.982230364474246, meeting `.codescene-thresholds` (10.0 / 9.98). Pre-commit safeguard and `origin/main` change-set safeguard passed.
- Localization: no UI copy changes. PostHog: no event needed; this is an internal correction to existing vault alias state, not a new user action. ADRs/docs: none. Demo vaults: clean.

## Device QA Still Needed

- On iPhone, reproduce restore A, select B, edit B's slug, copy a note link and open an incoming link with the new slug.
- Confirm the destination note opens while B's root, index, selected note, and Git connection remain intact, including a collision-safe slug case.

---

# TOL-75 Release Record — 33c6d8b60

## Change

- Removed the redundant clean-worktree scan immediately after `checkpointLocal` has verified a clean tree under the local-access lock. Sync uses the verified-clean integration path; standalone integration retains its own dirty-tree guard.
- Added a regression test that confirms integration applies remote file changes without a second Git walk after the verified checkpoint. Updated `docs/ABSTRACTIONS.md` with the checkpoint-lock invariant.
- This is a bounded Git-cost reduction. It does not claim measured device latency improvement or resolve the remaining large-pack/checkout costs.

## Validation

- TDD: regression failed before the verified-clean API existed, then passed. Focused Git suite: 4 files, 33 tests passed. Full mobile suite: 451 files, 2,741 tests passed; mobile lint and typecheck passed.
- `npx biome check` on the 3 touched code files passed. Explicit local Codacy per-file scans completed for all 3 paths; ESLint, Lizard, Opengrep OSS, and Trivy each returned 0 findings, and Biome passed separately. Codacy differential pre-push gate passed.
- Pre-commit used pnpm 10.33.0 and passed. Full normal pre-push passed: frontend lint/build, frontend coverage 89.72% lines, Rust tests and coverage 86.81% lines, 40 Playwright smoke tests, Codacy differential, and CodeScene thresholds.
- CodeScene: all 3 code files remained 10.0; pre-commit safeguard passed; final `origin/main` change-set review passed (3 code files, no issues). Project Hotspot 10.0 / Average 9.981977855021611, meeting 10.0 / 9.98 floors.
- Codacy Cloud: exact SHA `33c6d8b60f8393f1f20119bdedf92c9c7d95b207` analyzed with no analyzer problems. Dashboard roster is 37 tools / 21 enabled, including Biome, ESLint9, Lizard, Opengrep, and Trivy; deprecated ESLint remains disabled. Fully paginated main issue list: 972 total; 0 findings on the 3 touched code paths.
- CircleCI exact-SHA checks all green, including `mobile-ota-quality`, `frontend-coverage`, `playwright-smoke`, `frontend-lint-build`, `web-build`, `static-gates`, and `publish-mobile-alpha`. The OTA publish job succeeded; no separate update ID/receipt was captured.
- Native/device QA and device performance profiling were not run. Specifically unverified: 9,000-note sync timing/stall impact of this reduction, physical provider/iCloud delivery, iPad automatic-sync UI, and final signed-binary acceptance. No simulator or vault data was touched.
- Localization: no UI copy changes. PostHog: no event needed because this is an internal sync-cost correction to an existing action. Refactoring: `gitVault.ts` and `gitRemote.ts` integration path. ADRs: none. Docs: `docs/ABSTRACTIONS.md`. Demo-vault dirt: none.

---

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
- Retry 2026-11-02: Debug simulator build succeeded with external derived data `/private/tmp/tol284-resume-derived`; no app install/launch or vault change. Metro on port 8082 was untouched.
- Retry 2026-11-02: XCUITest on existing Tolaria-iPhone-16-Pro initially stalled while collecting diagnostics; rerun with `-collect-test-diagnostics never` passed one test selecting Heading 2 and confirming the menu dismissed. Result bundle: `/Volumes/Jupiter/Cache/tol284-native-qa-20261102/tol284-ui-retry2.xcresult`; screenshot: `/tmp/tol284-ui-retry2/E831FAE6-5122-4217-822F-A816B517D6C6.png`. No simulator created, deleted, or reset.
- After the earlier merge of `origin/main`, the focused XCUITest passed again (1 passed, 0 failed). Result bundle: `/Volumes/Jupiter/Cache/tol284-native-qa-20261102/tol284-ui-merged.xcresult`. Branch push `72a860670` plus merge `e5fcc7518` was to `origin/mobile-native-ui`; no main merge, OTA, or TestFlight.
