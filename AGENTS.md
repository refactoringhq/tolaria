# AGENTS.md — Tolaria App

## 1. Development Process

### Mandatory-rule exception protocol

Use an exception only when a required service or analyzer remains unavailable after one retry, or when satisfying the rule is technically impossible without increasing security or data-loss risk. The repository owner is the sole approver. Before proceeding, record the blocked command, evidence, affected files, risk, compensating check, approver, and an expiry of at most 72 hours in the Linear issue or final handoff; review and remove the exception within seven days. A preference, deadline, or failing quality gate is not sufficient exception criteria.

### Task tracking (Linear)

**Linear is the only live queue (cutover 2026-10-15).** Desktop work lives in team Tolaria (`TOL`), project **Tolaria Desktop**; mobile work in **Tolaria Mobile**; web work in project Tolaria Web. Do not create or move Todoist tasks. The old Todoist Tolaria project is legacy (its Draft section is being triaged separately); a completed Todoist card commented "Moved to Linear: TOL-n" points to its Linear issue.

**Linear** — workspace Refactoring, team Tolaria, issue key `TOL`.

- Workflow: **Backlog** (not ready) → **Open** (ready for an agent) → **To Rework** (review failed: read the latest review comment and fix only that; pick these **before** Open) → **In Progress** (claimed) → **In Review** (pushed, awaiting Luca's QA) → **Done** / **Canceled** / **Duplicate**.
- Claim an issue by moving it to In Progress only when a session actually starts work on it. At most one In Progress card per lane (Mac mini mobile: 1, agent-openai desktop: 1, agent-claude web: 2); release your current card (In Review, or back to Open with its Status line saying why) before claiming another; a card held only by "Waiting for main to go green" doesn't count. Never take another worker's In Progress issue; resume your own only when the card's Status line names your lane (e.g. "Codex (desktop) is working on it"). Re-read the issue after claiming and stop on a conflicting claim. Exception: follow the mandatory-rule exception protocol if Linear remains unavailable after one retry.
- Labels: type `Bug` / `Feature` / `Improvement`; `needs-luca` (only when a human decision or owner action is truly needed, always with a "Needs you" comment); `dubious` and `contributor-pr` (Backlog, awaiting Luca); Source group `Sentry` / `Canny` / `GitHub`. Exception: an unavailable Linear labeling service requires the same owner-approved exception protocol.
- No platform labels and no "blocked" label of any kind (Luca, 2026-10-23): the project decides the lane (Desktop → Codex on agent-openai, including Mac-specific work it can't test on Linux; Web → Claude Code on agent-claude; Mobile → the Mac mini). A stuck card goes back to Open with its Status line saying why and is retried on a later run with backoff; never label it as blocked.
- Reference the issue ID in commit messages, e.g. `fix: keep image width after restart (TOL-123)`.

### Linear comments (Luca, 2026-10-26)

Luca reads the comments, never the code. Each card gets at most three kinds of comment, in plain language:

1. **Status**: one comment per card, edited in place (never a new one). One line, e.g. `**Status:** Codex (desktop) is working on it`, `**Status:** Waiting for main to go green`, `**Status:** Didn't finish: <plain reason>. Retrying after 18:30 (Rome)`. Times are Rome local time.
2. **Ready for QA**: posted once, when the work is on main and all of CI is green. It contains:
   - `**Ready for QA: <short title>**`
   - `**What changed:**` 1–2 sentences, for the user.
   - `**Try it:**` 2–4 steps.
   - `**Proof:**` uploaded inline (see Proof before push).
   - `**Tested:**` one plain line.
   - `**Not tested:**` what wasn't tested, if anything (e.g. the macOS app from a Linux box).
3. **Needs you**: only when Luca has a decision to make. Give the question, the options and your recommendation in a few lines, and add `needs-luca`.

A failed QA, red CI or rework is a reply in the Ready for QA thread: `Didn't pass: <what went wrong>. Next: <what happens>`.

Never post start, claim or resume notices, heartbeats or no-progress checkpoints, retry or backoff counts, run IDs, commit hashes, file paths, log dirs, CodeScene, Codacy or coverage scores, raw logs, or UTC times. The full release record (checklist below) is an attached `release-record.md` file, not comment text.

Uploading: call the Linear `fileUpload` mutation, `PUT` the file to `uploadUrl` with the returned headers, then embed `assetUrl` (`![after](assetUrl)` for images, a link otherwise). On the Linux agent boxes the runner does this from the agent's `ready-for-qa.md`, `proof/` and `release-record.md`.

### Proof before push

No proof, no push. Collect proof before pushing; it goes inline in Ready for QA:

- UI change: before/after screenshots, or a short clip for interactions.
- Editor or serialization change: before/after `.md` round-trip files plus the regression test.
- Bug fix: the regression test's output failing before the fix and passing after.
- CI or infra change: a link to the green CircleCI run.

Risky areas also need a review of the diff by a fresh-context agent (a new session with no shared history) before push, and you fix what it finds. Risky areas are note save/serialization, sync/Git, the updater, and release/CI workflows. Luca never reviews code.

### Done gate (full CI)

Move a card to In Review only when every job in the CircleCI `validation` workflow on main for your commit is green, with none pending (web-gates and publish-mobile-alpha included). The same goes for "no change needed": check the current main. If main is red for another reason, keep the card In Progress with Status "Waiting for main to go green". If your commit broke main, fix it in one push or revert within ~30 min.

### Incidents

Every incident or revert adds a regression test. If it's a pattern, also add one line to this file.

- Web Playwright in WebKit (also the iPhone/iPad projects): the offline service worker can stall every later load of a page (a cancelled worker-served body, TOL-230; a navigation just as the new worker takes over, sharing.spec.ts). A spec that is not about offline read and hits such a stall blocks the worker (`serviceWorkers: "block"`, as sync-pill and sharing do) instead of retrying.

### Start working on a task

**Before writing a single line of code:** inspect the configured CodeScene project's current Hotspot and Average Code Health and compare them with `.codescene-thresholds`. Then capture the file-level Code Health score for every existing code file you intend to edit. If the project is already below the threshold, **stop and refactor first** — find the worst files with the MCP, improve them, commit, then start the task. If the gate cannot be restored, stop and obtain explicit repository-owner direction before starting feature work.

- Read task description and all comments fully
- For To Rework: Luca's latest comment, or the "Didn't pass" reply, tells you exactly what to fix
- Check `docs/adr/` for relevant architecture decisions before structural choices
- Check `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md` for relevant structural information
- For UI tasks: study app visual language and components first. Prioritize reusing existing components, assets, and variables over recreating them.
- If working on a Linear issue, set its Status line (create or edit it in place); never post a start comment

### Commits & pushes

- Local work may happen on `main`, in detached HEAD worktrees, or in other temporary local states. The production path is still direct-to-main: final verified work is pushed to `origin/main`, with no PR branch flow.
- Mobile foundation is integrated into main. New mobile work follows the same direct-to-main path; the historical foundation-branch fast lane is not the current delivery workflow.
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Pre-commit is a lightweight lint gate only. Pre-push runs the full check suite (build + tests + coverage + core Playwright smoke + CodeScene), preferably on three Chunk sidecar lanes for automatic test/coverage work: frontend lint/build/coverage, Rust coverage, and Playwright smoke. The goal is lower wall-clock time than local hooks while keeping each heavy gate isolated; keep local Playwright mainly for authoring, focused reproduction, or sidecar outages.
- CircleCI is the authoritative outer-loop CI/CD system. `.circleci/config.yml` owns validation, native cross-platform release builds, GitHub Release publication, and Pages publication.
- Any workflow or job that publishes GitHub Pages (today `deploy-docs.yml`, `release.yml` and CircleCI `publish-docs`) must build the site with `bash scripts/build-pages-site.sh <dir> [alpha-tag]`, the shared assembly that puts the tolaria.md landing at `/`, the docs, the release pages and the updater manifests (`latest.json`, `latest-canary.json`, `alpha/`, `stable/`) together and then verifies them. Never call `assemble-pages-site.sh` directly or hand-roll a Pages artifact; doing that once dropped the landing and made tolaria.md return 404. `scripts/verify-pages-site.test.sh` enforces this.
- **A task is NOT done until `git push origin main` succeeds.** If the hook blocks: read the error, fix it (clippy, tests, CodeScene, build), commit the fix, push again. If a verified push is impossible, stop and obtain explicit repository-owner direction; do not use `--no-verify` without that recorded approval.

### Mobile coding and release

The general coding, quality, localization, analytics, credentials and completion rules apply unchanged. Read the mobile sections of `docs/ARCHITECTURE.md` and `docs/ABSTRACTIONS.md`; ADRs 0247, 0263 and 0272 define OTA delivery and channel selection.

- Reuse `apps/mobile/src/components/ui` native primitives and `apps/mobile/src/ui` wrappers, not desktop DOM controls. Keep phone/tablet behavior on the shared controller/repository boundary. Run `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:test` and focused mobile regressions as well as the normal main push gates; scoped mobile checks do not replace them.
- Verify affected native behavior separately on iPhone, iPad and Android. Browser checks are not native acceptance. Record task-specific owner delegation of manual QA honestly; it does not waive automated gates. A locked Mac leaves affected checks pending while independent work continues.
- QA is confined to owned disposable vaults/simulators; existing user apps, containers and vault data stay untouched.
- CircleCI publishes mobile-related main pushes to **Alpha** after its required gates; desktop-only changes are excluded from mobile publication. Confirm the actual publication receipt, source SHA, runtime and update ID before claiming delivery. Native/configuration/dependency changes that alter the runtime require a compatible signed binary, not an incompatible OTA.
- Use one external **Tolaria Beta** TestFlight group. Settings defaults to **Stable**, with Alpha opt-in; selected channel and running update identity are distinct. Legacy Alpha-native binaries can launch embedded Alpha before preferences load. Retain runtime matching, safe editor flush/restart and Sentry artifact verification.
- **Stable promotion remains manual**, authorized explicitly by the owner and using the existing exact-tested-Alpha-artifact republish/approval workflow. Never rebuild from moving main or redirect Stable to moving Alpha. Do not submit Apple compliance declarations or grant new credential permissions without explicit owner authorization.

### Hourly mobile queue routine

Keep the scheduled prompt limited to queue orchestration; this file owns coding and release policy.

1. Reuse the routine's attached worktree and inspect current work. Resume its own identified unfinished claim before taking another issue; keep execution serial under the claim protocol above.
2. Otherwise paginate **Tolaria Mobile** To Rework, then Open; order by priority (unspecified last), then oldest creation time. Skip work assigned or delegated to others (including cards assigned to Luca for owner action), unmet dependencies, and cards whose Status line records a failed attempt less than 1 h ago (after a 2nd consecutive failure wait 2 h, after a 3rd 4 h, then 8 h). Do not pull Backlog or In Review into implementation. Follow the claim protocol above.
3. Implement the selected issue under this file's rules, including Linear comments, proof before push and the done gate. On a blocker, failure or session exit, edit the Status line with the plain reason (keep evidence and the checkpoint location in `release-record.md` or the worktree, not in comments; post "Needs you" only for a decision), then move the card back to Open (or to In Review if verified work landed on main) before claiming the next one; never leave a blocked card In Progress. Continue independent eligible work without mixing partial changes or extending exceptions.
4. Put verified implementation In Review with one Ready for QA comment (proof inline, iPhone/iPad/Android screenshots or clips for UI) and `release-record.md` attached, not self-approved Done. Report meaningful milestones or actionable blockers; stay quiet when the queue or status is unchanged. Resume remaining work on the next hourly run. Keep only one active mobile queue routine.

### TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write failing regression test first, then fix. Exception: pure CSS/layout changes.

**Test quality (Kent Beck's Desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests first. Prefer E2E over unit tests for user flows.

### Localization (mandatory for UI copy)

All user-facing UI labels/copy must live in `src/lib/locales/en.json` and be translated into every target listed in `lara.yaml`. Exception: when the localization service remains unavailable after one retry, use the mandatory-rule exception protocol above and do not release untranslated copy without repository-owner approval. When adding or changing interface copy:

```bash
pnpm l10n:translate
```

Use `pnpm l10n:translate:force` only when intentionally regenerating existing translations. Commit `src/lib/locales/*.json`, `lara.yaml`/`lara.lock` changes if produced, and verify placeholders/product names stayed intact.

### Product analytics (mandatory for meaningful features)

New features should emit a PostHog event so we can see whether users actually discover and use them. Skip instrumentation when the change has no meaningful user action or when a dedicated event would create noise; record that reason in the release record. If the correct instrumentation remains unclear, obtain repository-owner direction before release. Use clear, stable event names, avoid PII or note content, and include only safe metadata that helps evaluate adoption and failures.

When adding or changing a meaningful user-facing feature, include the event name(s) in the release record alongside QA, docs, and code health. If intentionally not instrumenting a feature, explain why there.

### Code health (mandatory)

Pre-push compares **Hotspot Code Health** and **Average Code Health** with the exact numeric floors in `.codescene-thresholds` and fails when either score is lower. Pre-commit is lint-only; CodeScene remains mandatory through the file-level review rules below and the pre-push ratchet gate. Thresholds are a **ratchet** — only go up. When pre-push sees improved remote scores, it updates `.codescene-thresholds`, stages it, and stops so you can commit the new floor with normal verified hooks before pushing again. Exception: adding `// eslint-disable`, `#[allow(...)]`, `as any`, or another bypass requires the mandatory-rule exception protocol and repository-owner approval before the edit.

**Release rule:** CodeScene is a before/after gate, not just a final score. Record the starting CodeScene state before edits and the final state after edits. If touched code gets worse, refactor before committing; if the comparison cannot be produced, stop and obtain explicit repository-owner direction.

Do not edit `.codescene-thresholds` to lower the values. If the gate blocks you, improve the code; any proposed exception requires explicit repository-owner approval recorded before the edit.

**CodeScene access order:** use CodeScene MCP tools if available. If MCP is unavailable, use the installed `cs` CLI for file-level review/delta work, and use the CodeScene API (`CODESCENE_PAT` + `CODESCENE_PROJECT_ID`) for project-wide Hotspot/Average threshold checks from `.codescene-thresholds`.

**Before editing any existing code file:** capture its current file-level CodeScene score. After your edits, re-run the same file-level review and verify the score is higher. If the file already starts at `10.0`, it must remain `10.0`. Exception: if the score cannot be obtained after one retry, use the mandatory-rule exception protocol and obtain repository-owner approval before editing.

**New files:** every new **scorable code file** must reach CodeScene score `10.0` before commit. If CodeScene reports `null` / "no scorable code" for a new file, it must still have zero CodeScene findings/warnings. If either requirement cannot be met, stop and obtain explicit repository-owner direction.

**Before every commit:** run CodeScene file-level review on every touched or newly created code file and verify the rule above. Then run `mcp__codescene__pre_commit_code_health_safeguard` for the repository and do not commit unless its quality gates pass. **Boy Scout Rule:** every file you touch must leave with a higher score, unless it was already `10.0`, in which case it must stay `10.0`. If an analyzer or gate is unavailable, stop and obtain explicit repository-owner approval for a documented exception.

**Before the final direct-to-main push:** run `mcp__codescene__analyze_change_set` with `base_ref=origin/main`. This is Tolaria's PR-preflight equivalent: every affected file must be improved or stable, and the overall quality gate must pass. Refactor and repeat if any file is degraded. Exception: if the analysis cannot complete after one retry, use the mandatory-rule exception protocol and obtain repository-owner approval before pushing.

**If CodeScene gate blocks your push:** use `mcp__codescene__code_health_score` to find the worst file, refactor it, commit, push again. Do not wait for laputa-refactor because it is a background loop rather than a substitute for fixing your own regressions; if no in-scope refactor can restore the gate, stop and obtain explicit repository-owner direction.

### Security scan with Codacy (mandatory)

Use Codacy as a security and static-analysis gate before a task is considered releasable.

- **Two required checks:** Codacy's local CLI/MCP analyzes the uncommitted working tree, while the Codacy dashboard also runs server-side tools after a commit is pushed. These are complementary gates. Report each count with its source; if either check is unavailable, stop and obtain explicit repository-owner approval instead of substituting one for the other.
- **What counts as new code:** both a newly created code, test, script, or executable configuration file and any added code in an existing file. Scan the entire containing file, not only the added lines, because Codacy tools can report findings on unchanged lines or at file level after a change.
- **Build the scan manifest:** before each Codacy check, enumerate added and modified tracked paths with `git diff --name-only --diff-filter=ACMR "$(git merge-base HEAD origin/main)" --` and untracked paths with `git ls-files --others --exclude-standard`. Classify every code, test, script, and executable configuration path as new or existing, record the manifest in the task evidence, and scan every path individually. Rebuild the manifest immediately before commit so no late-created file is omitted.
- **Before editing existing code:** run a local file scan and record every finding for each code file you intend to touch. Also record that file's findings on Codacy's currently analyzed `main` commit using `codacy_list_files` to resolve the file and `codacy_get_file_issues` to enumerate all paginated results.
- **Local file scan:** use `mcp__codacy__codacy_cli_analyze` with the repository's absolute `rootPath` and an explicit `file`, one touched/new file at a time. If the MCP is unavailable or fails, run `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 .codacy/cli.sh analyze <path> --format sarif --output /tmp/codacy-<slug>.sarif`. Omit `--tool` so every locally configured analyzer runs. Explicitly inspect every `runs[].results[]` entry in the SARIF output.
- **Analyzer-parity gate:** before creating or modifying code, call `codacy_list_repository_tools` and record the enabled dashboard analyzer name, UUID/generation, configuration mode, and language coverage. Compare that roster with the `runs[].tool.driver` entries produced locally for every language in the scan manifest. Tool names alone are not sufficient: deprecated ESLint/ESLint8 and current ESLint9 are different analyzers, and a local run of Lizard, Opengrep, and Trivy does not prove that dashboard ESLint will be clean. For TypeScript/JavaScript, the passing roster must include the current analyzer that honors `eslint.config.js`, plus every other enabled relevant dashboard tool. If the intended analyzer is disabled, a deprecated analyzer is enabled, or any enabled dashboard analyzer has no equivalent successful local run, analyzer parity fails: stop, correct the Codacy tool configuration, trigger a full reanalysis, and verify parity before code work. A repository-owner-approved exception is required if configuration access is unavailable.
- **Approved analyzer-parity exception (Biome):** Biome is enabled on the Codacy dashboard but missing from the local Codacy CLI. Biome: covered locally by the repo's own Biome (`npx biome check <changed files>`, or the repo's existing Biome run in `pnpm codacy:gate`); approved by Luca 2026-10-10. This is a standing exception recorded here, so it needs no per-task re-approval: record that `npx biome check` run as the local Biome row in the parity and per-file evidence. It covers only the missing local Biome run; any Biome diagnostic on changed files still fails the gate, and every other analyzer must still match.
- **Per-file analyzer evidence:** for every new code file, record one result row per expected analyzer with the exact file path, analyzer identity, completion status, and finding counts split into Critical/High/Medium/Minor/Info/unclassified. Missing rows, a skipped/untracked target, an analyzer crash, or an analyzer that silently omits the language is a failed scan, never a zero. If the CLI requires Git discovery, add the file to the index normally before the final scan; do not rely on a directory scan to discover an untracked file.
- **Fail closed on partial scans:** a zero process exit code is not enough. Confirm the expected relevant tools produced SARIF runs and inspect scan logs for crashes, encoding failures, skipped target files, partial analysis, or missing tool output. If any relevant analyzer did not complete, the scan did not pass.
- **Approved analyzer-coverage exception (unsupported or excluded files):** if Codacy or CodeScene does not support a file type, or excludes the path from analysis (for example test paths, `.husky/*` hook scripts), an agent does not need a pre-edit baseline or a post-edit score from that tool to edit the file. Record "not analyzed by <tool>: <unsupported|excluded>" as that tool's row in the parity/per-file evidence. Likewise, when an enabled dashboard analyzer has no local equivalent for a file type (for example Jackson Linter for `src/lib/locales/*.json`), cover it locally with the repo's own check (`node scripts/validate-locales.mjs` plus a JSON parse for locale catalogs) and record that run. Approved by Luca 2026-10-13; standing, no per-task re-approval. Every other gate still applies: the other tool's baseline and Boy Scout rule where it does analyze the file, zero new findings, tests, coverage, pre-push hooks and post-push verification.
- **Zero-new-findings rule:** added or modified code must introduce no Codacy finding at any severity, including Info/Minor, Warning/Medium, High/Error/Critical, unclassified findings, and findings reported on unchanged lines or at file level because of the change. If this cannot be achieved, stop and obtain explicit repository-owner approval for a documented exception.
- **New code — absolute zero rule:** every new code file and every file containing newly added code must be scanned explicitly after creation or modification and must have exactly zero findings attributable to the new code at every severity. A newly created file must have exactly zero findings in the whole file. For added code in an existing file, any finding on an added line, caused by an added symbol or dependency, or newly appearing at file level fails the gate. `0 Critical + 0 High + 0 Medium + 0 Minor + 0 Info + 0 unclassified` is the only passing result. If a scanner cannot prove this, stop and obtain explicit repository-owner approval before proceeding.
- **Boy Scout Rule for existing files:** after editing, every touched file must have fewer local findings than its recorded baseline; a zero-finding file must stay at zero. Fix every existing Critical/High finding in a touched file; if this cannot be achieved, stop and obtain explicit repository-owner approval for the documented exception.
- **Before every commit:** re-scan every touched/new code file individually and compare the complete SARIF results with its recorded baseline. Do not rely on added-line filtering, repository totals, or `pnpm codacy:gate` alone; if an individual scan cannot complete, stop and obtain explicit repository-owner approval.
- **Post-push dashboard verification:** after `git push origin main`, wait until `codacy_get_repository_with_analysis` reports the exact pushed SHA as `lastAnalysedCommit`. Re-read the enabled-tool roster, paginate `codacy_list_repository_issues` to completion, and filter by each exact manifest path; use file-level MCP queries as supporting detail, not as a substitute for the complete repository issue list because newly created files may not yet resolve through file lookup. Absence from the issue list counts as zero only when the exact SHA is analyzed, the analyzer roster still matches the pre-edit parity record, and the repository reports no analyzer problem. Every new code file must have zero dashboard findings at every severity from every enabled analyzer; every existing touched file must have no new finding and must have fewer findings than its pre-edit dashboard baseline (or remain at zero). If the dashboard reports a finding—even one from a deprecated or misconfigured analyzer—the task remains unfinished until the file is fixed or the analyzer configuration is corrected and a replacement exact SHA is fully reanalyzed. Exception: if verification remains unavailable after one retry, use the mandatory-rule exception protocol and obtain repository-owner approval before release.
- **Repository-wide dashboard counts:** use `codacy_get_repository_with_analysis` for the total and `codacy_list_repository_issues` with full pagination for severity/tool breakdowns. Derive the provider/organization/repository from the Git remote without printing credential-bearing remote URLs; for this repository use `gh` / `refactoringhq` / `tolaria` and branch `main`.
- **Escalation:** if a scanner is unavailable or a finding is demonstrably false, stop and obtain explicit repository-owner approval recorded in the release record. Rule suppression requires that same explicit approval and documentation.
- `pnpm codacy:gate` is a required fail-closed added-line safety net in pre-push and CI; it does not replace the touched-file before/after check.

### Check suite (runs on every push)
```bash
pnpm lint && npx tsc --noEmit && pnpm test && pnpm test:coverage  # frontend ≥71%
cargo test && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

Coverage is a release gate, not a vanity metric:
- Frontend coverage must stay ≥71%. Exception: if coverage cannot be measured after one retry because the coverage service is unavailable, use the mandatory-rule exception protocol and obtain repository-owner approval before release.
- Rust line coverage must stay ≥85%. Exception: if coverage cannot be measured after one retry because the coverage service is unavailable, use the mandatory-rule exception protocol and obtain repository-owner approval before release.
- For bug fixes, add a regression test when practical.
- For new behavior, add targeted coverage close to the changed code; do not rely only on broad E2E coverage.

### UI and native QA

**Phase 1 — Playwright (only for core user flows):**

Write Playwright test in `tests/smoke/<slug>.spec.ts` when the feature touches vault open, note create/save/delete, search, wikilink navigation, git commit/push, or conflict resolution. Tag a test with `@smoke` when it protects one of those core pre-push workflows; keep cosmetic or mock-heavy checks in the full regression lane. Prefer `.chunk/run-playwright-smoke.sh` on a Chunk sidecar for the curated smoke lane because local Playwright is expensive; keep `pnpm playwright:smoke` available for focused local reproduction. The curated smoke suite must stay under **5 minutes** when sharded on sidecars. Exception: if a platform outage prevents the smoke test from running after one retry, use the mandatory-rule exception protocol and obtain repository-owner approval before release.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

**Phase 2 — Native app QA (macOS):**

> On a Linux agent box, skip this Phase 2 block and follow **Linux agent boxes (Hetzner / remote)** below instead.

```bash
pnpm tauri dev &
sleep 10
bash ~/.openclaw/skills/tolaria-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/tolaria-qa/scripts/screenshot.sh /tmp/qa-native.png
```

Use computer-use/browser-control interaction for native UI QA when either tool is present in the current environment: click, hover, drag, select, scroll, and type the way a real user would with the mouse and trackpad. For every UI feature, test the primary mouse-driven path first, then verify each keyboard shortcut or keyboard-first workflow implemented or modified by the task. If neither interaction tool is present, run the scripted focus, screenshot, and shortcut checks and document that limitation.

Use `osascript` for app focus, keyboard shortcuts, and keyboard-specific checks. **⚠️ WKWebView:** if an `osascript keystroke` fails to enter editor text, use computer use for the native editor interaction and rely on Playwright for deterministic text-input coverage. Keep the screenshots as proof for Ready for QA and the details in the release record (or the final handoff when no Linear issue exists).

### Linux agent boxes (Hetzner / remote)

These rules apply when the agent runs on a Linux box (no macOS desktop, no `osascript`, no `~/.openclaw`). The macOS instructions above stay in force for the Mac mini; do not remove or weaken them.

**Mac-specific desktop work is done here too (Luca, 2026-10-23).** Every Tolaria Desktop card goes to the agent-openai box, including macOS/Windows-native surfaces (updater, Homebrew, macOS menus and Cmd/Option shortcut wiring, native dialogs, signing, Windows installers). When part of a change can't be built or tested on Linux, implement it carefully anyway, unit-test the logic you can, and list exactly what was not tested on Linux (and how to check it on a Mac or Windows machine) under Not tested in Ready for QA. That is not a reason to skip or block the card.

**QA on Linux = the Linux Tolaria build with a throwaway vault.** There is no macOS native QA on these boxes. Build the Linux app (`CI=true pnpm tauri build --debug --no-bundle`) and drive it under Xvfb with a throwaway copy of `demo-vault-v2/` — on the agent boxes use the installed `tolaria-qa` CLI (`tolaria-qa help`: `start`, `click`, `key ctrl+…`, `xtype`, `shot`, `smoke`, `stop`). Never open, create, or modify `~/Laputa` or any real user vault. Test the primary mouse path first, then each keyboard shortcut you added or changed (`Ctrl` on Linux where macOS uses `Cmd`). Phase 1 Playwright still applies. Screenshots are proof for Ready for QA; what was clicked or typed goes in the release record.

**Before pushing to main:** the full check suite passes; then `git fetch origin && git rebase origin/main` (stop on conflicts you cannot resolve safely), re-run the checks (including the Linux build and a Linux app smoke) on the rebased HEAD, then `git push origin main` so the pre-push hook runs against the latest `origin/main`. Never `--no-verify` without a recorded repository-owner exception.

### Release-readiness checklist

Before pushing or moving a task to In Review, verify the release gates and write them to `release-record.md`, attached to the Linear issue (never pasted as comment text). When the work has no Linear issue, put the same evidence in the final handoff. The record must include:

- What was implemented (a few lines covering logic and UX/UI).
- QA: what was tested and how (Playwright / native screenshot / osascript on macOS; Linux app driven with a throwaway vault on Linux agent boxes).
- Tests/coverage: commands run and final coverage result.
- CodeScene: before/after touched-file checks, the pre-commit safeguard verdict, the final `origin/main` change-set verdict, plus final Hotspot and Average scores after push; every gate must pass `.codescene-thresholds`, or the record must include explicit repository-owner approval for a documented exception.
- Coverage commands passed (`pnpm test:coverage` and `cargo llvm-cov ... --fail-under-lines 85`) or the change is docs-only.
- Codacy: the final scan manifest; local before/after findings for every touched file; confirmation that every relevant local analyzer completed; and post-push dashboard findings after Codacy analyzed the exact pushed SHA. Confirm fewer findings in existing files (or zero stayed zero), exactly zero local and dashboard findings in every new code file, and zero findings attributable to added code in existing files at every severity.
- Localization: any user-facing copy lives in `src/lib/locales/en.json`, `pnpm l10n:translate` was run, and `pnpm l10n:validate` passes. If no copy changed, say “Localization: no UI copy changes”.
- PostHog: meaningful new user actions/events are instrumented with safe metadata; noisy/minor changes explicitly say “PostHog: no event needed because …”.
- Refactoring: any files refactored to meet the CodeScene gate, or "none needed".
- ADRs: any new/updated ADRs, or "none".
- Docs: any updated docs (`docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, etc.), or "none".
- Proof: what was collected for Ready for QA, and the fresh-context review verdict for risky areas.
- Demo vault dirt checked: `git status --short -- demo-vault demo-vault-v2` is empty unless fixture changes are intentional.

### ADRs & docs

ADRs live in `docs/adr/`. Create one in the same commit as the code. Preserve existing ADRs by creating a new one that supersedes them; editing an existing ADR requires an explicit repository-owner request. Use `/create-adr`. **When:** new dependency, storage strategy, platform target, core abstraction, cross-cutting pattern. **Not for:** bug fixes, styling, refactors.

After any Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit.

---

## 2. Product Rules

### Demo vault hygiene (`demo-vault/`, `demo-vault-v2/`)

Default to `demo-vault-v2/` for testing.

- Treat `demo-vault/` and `demo-vault-v2/` as disposable QA fixtures unless the task explicitly changes demo content.
- If you create untracked notes, attachments, or other temporary files there for testing, delete them before the task is complete.
- If you modify tracked demo-vault files only to test or QA behavior, revert those edits before the final commit.
- Before declaring a task done, make sure `git status --short -- demo-vault demo-vault-v2` is empty unless demo fixture changes are part of the task.
- If a fresh run starts and the only local dirt is inside `demo-vault/` or `demo-vault-v2/`, clean those paths first and continue. That case is recoverable QA residue, not a blocker.

### User vault (`~/Laputa/`)

Default to `demo-vault-v2/`. If you must use `~/Laputa/` for testing:
- Do not commit or push test notes to the remote vault unless the repository owner explicitly identifies that content as an intended deliverable.
- **Delete all test notes from disk** when done — do not leave untitled or temporary notes on the filesystem. Run `cd ~/Laputa && git checkout -- . && git clean -fd` to restore the vault to its last committed state.
- **Rationale:** test notes pollute the local vault over time, making it a collection of nonsensical untitled files. Keep the vault clean on disk as well as on the remote; any intended fixture exception requires explicit repository-owner approval.

### UI components — mandatory rules

Use shadcn/ui components for user-facing interactive elements instead of raw HTML form elements (`<input>`, `<select>`, `<button>`, native `<input type="date">`, etc.). If no suitable shadcn or existing app component exists, stop and obtain explicit repository-owner design approval before introducing a raw control.

| Need | Use |
|---|---|
| Text input | `Input` from shadcn/ui |
| Dropdown/select | `Select` from shadcn/ui |
| Date picker | `Calendar` + `Popover` from shadcn/ui (NOT native `<input type="date">`) |
| Button | `Button` from shadcn/ui |
| Autocomplete/combobox | Reuse existing combobox components from the app (check `src/components/`) |
| Wikilink picker | Reuse the wikilink autocomplete component already used in the editor and Properties panel |
| Emoji picker | Reuse the emoji picker component already used for note/type icons |
| Color picker | Reuse the color swatch picker used for type customization |
| Toggle/switch | `Switch` or `ToggleGroup` from shadcn/ui |
| Dialog/modal | `Dialog` from shadcn/ui |

**Component search trigger:** when the requested interaction does not map to a component in the table above, search `src/components/` by the interaction name and ARIA role before building a component. **Visual language:** new UI must follow Tolaria's existing components and design tokens; a deliberate exception requires explicit repository-owner design approval recorded through the mandatory-rule exception protocol.

---

## 3. Reference

### Release notes

Release notes live in `release-notes/<tag>.md` and are published to GitHub Releases and the public website.

**Format:**
- Every release note must start with frontmatter; exceptions require the mandatory-rule exception protocol:
  ```markdown
  ---
  type: Note
  _organized: true
  ---
  ```
- After frontmatter, write the user-facing content (features, improvements, fixes)
- Use clear headings: `## New Features`, `## Improvements`, `## Stability and Fixes`
- Use emojis and **bold** feature names for scanability
- Write for end users, not developers

**Frontmatter handling:**
- The vault displays release notes as organized `Note` types
- GitHub Release bodies and website copies automatically strip frontmatter via `scripts/strip-frontmatter.mjs`
- Never expose frontmatter in user-facing surfaces

**Creating a new release note:**
```bash
cat > release-notes/<tag>.md << 'EOF'
---
type: Note
_organized: true
---

## New Features

- 🎉 **Feature name** — Description.

## Improvements

- ✨ **Enhancement** — Description.
EOF
```

The frontmatter ensures release notes are already organized when the Tolaria repo is opened as a vault, avoiding inbox clutter.

### macOS / Tauri gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native testing

### QA scripts

```bash
bash ~/.openclaw/skills/tolaria-qa/scripts/focus-app.sh Tolaria
bash ~/.openclaw/skills/tolaria-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/tolaria-qa/scripts/shortcut.sh "command" "s"
```

### Diagrams

Prefer Mermaid (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts.

## Stuck or blocked tasks

Whenever an agent moves a task back to Open or otherwise leaves it stuck, it must ALWAYS update the card's Status line with the plain reason and what happens next. Keep evidence (commands, logs) in the release record or local logs. When only Luca can unblock it, add `needs-luca` and a "Needs you" comment with the decision needed. Never leave a task blocked without saying why. Exception: a Linear outage after one retry requires the identical evidence in the final handoff and repository-owner approval under the mandatory-rule exception protocol.
