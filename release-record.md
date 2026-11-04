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
