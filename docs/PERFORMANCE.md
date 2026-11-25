# Performance Regression Harness

Tolaria's core performance gate measures milestones a user can perceive in an isolated
Chromium session. It uses deterministic in-memory vault fixtures, one discarded warmup,
five measured samples, median budgets, and p90 diagnostics. The gate never reads or
modifies a real vault.

## Instrumentation audit

| Flow | Existing signal | Automated guard |
|---|---|---|
| Renderer startup | `startupPerformance` phases plus native `record_startup_milestone` traces | User Timing marks for React shell, active-vault usability, and app interactivity |
| Note open | `noteOpen` and editor block resolve/apply traces | Small and 130 KB note scenarios measure visible editor, first/full content, edit frame, and trace durations |
| Note-list navigation | DEV-only keyboard-move trace | A 2,000-row Virtuoso fixture scrolls near the end and waits through the rendered paint |
| Native process startup | `TOLARIA_STARTUP_TRACE=1` native trace | Release/native diagnostic tier; excluded from the per-commit browser gate because host startup varies materially |
| Create-note focus and search | Local timing helpers and focused behavioral tests | Not yet budgeted: their mock/native boundaries dominate browser timing, so a threshold would currently protect test plumbing rather than user latency |

The benchmark opts existing DEV-only note/editor trace logging into the production build
only for pages that set `__TOLARIA_PERFORMANCE_HARNESS__`. Ordinary production sessions
do not emit these logs.

## Commands

```bash
pnpm perf:test
pnpm perf
pnpm perf:editor
pnpm perf:update
```

`pnpm perf` builds the production renderer, starts an isolated preview server, and runs
all scenarios. `pnpm perf:editor` is the faster compatibility subset for small and large
note opens. A machine-readable report is written to
`test-results/performance-summary.json`.

CircleCI runs `pnpm perf:ci` in the dedicated `performance-regression` job. Keeping this
separate from the curated Playwright smoke lane prevents a noisy performance rerun from
blocking functional smoke sharding or consuming its five-minute budget.

## Budgets and baseline changes

`.editor-performance-thresholds.json` stores the observed median, p90 diagnostic, and
maximum median for every metric. Normal runs fail closed if a scenario, budget, or
measurement is missing. A budget is initially the slower of 35% or 25 ms above the
median; edit-frame budgets keep a 16 ms floor. This tolerance absorbs ordinary scheduler
and renderer jitter while still catching regressions large enough to affect interaction.

`pnpm perf:update` records a new baseline but only tightens existing maxima. Do not run it
to make an unexplained failure pass. A reviewer may explicitly change a maximum only
when the measured milestone or representative fixture intentionally changes; document
that semantic rebaseline in the commit.

Review p90 alongside the median. Repeated p90 growth without a median failure is a signal
to investigate variance and tighten the scenario before raising or adding a budget.

## Adding a scenario

1. Add deterministic fixture generation and a scripted user interaction to
   `scripts/editor-performance-benchmark.mjs`.
2. Measure the first point where the result is visible or interactive, not merely when
   an internal function returns.
3. Add the scenario's metric names and concise labels.
4. Cover new aggregation, planning, or threshold behavior in
   `scripts/editor-performance-harness.test.mjs`.
5. Run at least one warmup and five measured samples, then intentionally add the initial
   threshold with `pnpm perf:update`.
6. Verify the normal `pnpm perf` command passes without changing the threshold file.

## Big-vault web bench (TOL-225)

`pnpm bench:web` (after `pnpm build:web`) measures the web app against a generated
6,000-note vault: `apps/server/scripts/seed-test-remote.ts` writes 5,996 filler notes plus
its four hand-written notes into a throwaway git remote under the system temp directory,
a Tolaria server serves it on loopback, and one headless Chromium session drives the static
bundle. It never reads a real vault. CircleCI runs it in the single-container `web-bench`
job, in parallel with `web-gates`; the job fails when any measurement is over its budget.
Every run prints the table in the job log and stores `big-vault.json` and `big-vault.md`
as the `web-bench` artifact (`test-results/web-bench/` locally).

The run, in order: a cold open with no cache, three warm opens from the IndexedDB snapshot
the cold open wrote (TOL-173), five seconds for the background reload, a note opened from
the list, 44 keystrokes typed into it, and a global search for a token that matches one note.
Each budget is a single sample except warm open (median of three) and typing (median and p95).

The cached-mobile startup measurement uses a 390 × 844 CSS-pixel Chromium viewport. It
waits for the full entry snapshot and the service worker's shell precache to finish before
applying the same Fast 4G profile as `apps/web/tests/cache-startup.spec.ts`: 4 Mbit/s down,
3 Mbit/s up, and 20 ms latency. This measures a returning visit with both caches ready.
The test also checks that the first visible row title exists in the cached entry snapshot.

To repeat only the cached startup measurement against a read-only local clone of the
dedicated staging vault (without attaching its note content):

```bash
TOLARIA_BENCH_VAULT_PATH=/path/to/staging-clone \
TOLARIA_BENCH_STARTUP_ONLY=1 \
pnpm exec playwright test --config apps/web/playwright.bench.config.ts --trace off
```

Use `TOLARIA_BENCH_PROOF_DIR=/path/to/proof` with the generated fixture to save its
screenshot and individual warm timings. Do not attach screenshots or traces from a staging
vault that contains curated or personal note content.

| Metric | What is measured | Budget |
|---|---|---|
| Cold open | `tolaria:note_list_painted` mark, empty cache | 2,500 ms |
| Cold open: longest task | Longest `longtask` from navigation until the snapshot is cached | 600 ms |
| Warm open | `tolaria:note_list_painted` mark from the cache, median of 3 | 1,000 ms |
| Warm open: longest task | Longest `longtask` of the last warm open and its background reload | 400 ms |
| Warm open: total blocking time | Sum of `longtask` time over 50 ms in the same window | 600 ms |
| Note open | Click on a list row to the note body visible in the editor | 2,000 ms |
| Typing, median / p95 | `keydown` to the task after the next animation frame | 50 / 100 ms |
| Typing: longest task | Longest `longtask` while typing | 200 ms |
| Search | Query entered to the matching result row visible, 300 ms debounce included | 1,500 ms |
| Memory | JS heap after a forced GC, warm, before opening a note | 80 MB |

Warm open keeps the 1 s cache-first paint budget of `apps/web/tests/cache-startup.spec.ts`.
The other budgets were calibrated on the 8-vCPU agent box (load average 4–9, with the whole
stack also pinned to two cores) and leave roughly 2.5–5× headroom over the slowest local run,
so CircleCI's 4-vCPU Docker `large` runners stay green without hiding a real regression:

| Metric | Local runs (10) |
|---|---|
| Cold open | 545–885 ms |
| Warm open | 267–469 ms |
| Warm open: longest task / blocking | 87–151 ms / 37–154 ms |
| Note open | 560–700 ms |
| Typing median / p95 | 9–13 ms / 17–20 ms |
| Search | 401–481 ms |
| Memory | 27 MB |

Budgets live in `apps/web/bigVaultBudgets.ts`. Change a budget only with a reason recorded
in the commit, and update this table with it.
