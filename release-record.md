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
