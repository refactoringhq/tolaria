# TOL-303 Release Record

## Change

Adds editable per-vault slugs on desktop and mobile, sharing normalization and collision handling. Slugs persist in the managed vault catalog, update copied note links, and resolve incoming `tolaria://` links. Mobile analytics records the `vaultSlug` setting name without the slug value. Updated the architecture note and translated the new tooltip across configured locales.

## Native QA

- Tested a disposable copy of `demo-vault-v2` in an isolated `md.tolaria.mobile.ota-validation` app on the existing Tolaria-iPhone-16-Pro simulator. The focused XCUITest edited `tolaria-demo` to `laputa-notes`, submitted the native settings form, relaunched the app, and verified the value persisted.
- XCUITest result on the final JS change: `/Volumes/Jupiter/Cache/tol303-xctest/TOL303-refactor.xcresult` (1 passed, 0 failed).
- Screenshot on the final JS change: `/Volumes/Jupiter/Cache/tol303-xctest/refactor-attachments/DD9F93F4-262F-4682-90F6-4DABB338720B.png`.
- Simulator catalog readback confirmed `alias: "laputa-notes"`. The fixture app and its container were isolated from the installed development app and user vaults. No simulator was created or deleted.
- The settings screenshot also showed the fixture's unrelated missing-GitHub-credentials state; slug editing and persistence passed. This does not test remote Git authentication.

## Automated Checks

- Root coverage: 6,367 passed, 1 skipped; lines 89.70%, statements 86.19%, branches 77.32%, functions 88.57% (`pnpm test:coverage`).
- Full root `pnpm test`: passed. Root Vitest: 675 files, 6,367 passed, 1 skipped. Server Vitest: 48 files, 1,033 passed, 2 skipped; server line coverage 95.94%. Supporting Node tests: 45 and 4 passed; Pages verification and web-config suite passed.
- Rust: 1,189 passed, 2 ignored; `cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85` passed at 85.67% lines.
- Full mobile suite: 442 files, 2,698 tests passed. Mobile lint/typecheck and root lint/typecheck passed.
- Focused desktop tests: 92 passed across the SettingsPanel and workspace test files. Focused mobile tests: 29 passed across four files.
- Localization translation and validation passed for all 21 catalogs. `git diff --check` passed; demo vaults are clean.
- Root lint/typecheck, mobile lint/typecheck, 27-file Biome check, localization validation, focused desktop/mobile regressions, and `git diff --check` passed.

## Quality And Release

- CodeScene project baseline before edits: hotspot 10.0, average 9.9821528427 (thresholds 10.0/9.98). The CodeScene pre-commit safeguard and `origin/main` change-set analysis both passed: 27/27 files, no degradations. All scorable touched files are 10.0; declaration-only `apps/mobile/src/vite-env.d.ts` has no CodeScene findings.
- Codacy dashboard baseline is `711ae014b004507b255a68e53fc7b7fa2b2879fd`. Enabled JS/TS analyzers are Biome (UUID `934a97f8-835c-42fc-a6d1-02bdfca3bdfa`), ESLint9 (`2a30ab97-477f-4769-8b88-af596ce7a94c`), Lizard (`76348462-84b3-409a-90d3-955e90abfb87`), Opengrep (`6792c561-236d-41b7-ba5e-9d6bee0d548b`), and Trivy (`2fd7fbe0-33f9-4ab3-ab73-e9b62404e2cb`). Local file scans completed all four configured CLI runs (ESLint, Lizard, Opengrep OSS, Trivy) on all 27 changed code paths; findings are zero except `SettingsPanel.test.tsx`, which has one existing file-NLOC finding versus two on the dashboard baseline. The exact-SHA dashboard scan for `3f1514495` reported Lizard NLOC findings in `useMobileVaults.ts` and `WorkspaceSettingsRows.tsx`; a follow-up extraction removes those findings, and final exact-SHA verification is pending.
- First push `3f1514495` passed all local pre-push gates but revealed the two dashboard-only Lizard findings above. The next pushed SHA, CircleCI main-green confirmation, and exact-SHA Codacy verification must all pass before TOL-303 moves to In Review.
- Localization: `settings.workspaces.slugTooltip` translated; `pnpm l10n:translate` and validation passed.
- PostHog: `mobile_setting_changed` with safe setting-name metadata; slug contents are excluded.
- Refactoring: shared alias normalization/collision helpers and catalog validators; split mobile vault selection/refresh state and workspace row heading to address exact-SHA Lizard NLOC findings; no analyzer bypasses.
- ADRs: none. Docs: `docs/ARCHITECTURE.md` updated.
- Demo-vault dirt: none.
