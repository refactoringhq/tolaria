# CLAUDE.md — Laputa App

## ⛔ BEFORE EVERY COMMIT — Non-negotiable checklist

Run all of these. If any fails, fix before committing. No exceptions.

```bash
pnpm lint && npx tsc --noEmit       # lint + types
pnpm test                           # unit tests
pnpm test:coverage                  # frontend ≥70% coverage
cargo test                          # Rust tests
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
pre_commit_code_health_safeguard    # CodeScene ≥9.2 — if it fails, fix structurally (see below)
```

**CI is a safety net, not a discovery tool.** If CI catches something you didn't catch locally, that's a process failure. All these tools are available locally — use them while you code, not just at the end.

## ⛔ BEFORE FIRING laputa-task-done — Two-phase QA (mandatory)

### Phase 1: Playwright browser QA (headless, you do this yourself)

Test every acceptance criterion using Playwright against the dev server **before** marking done. This catches 80% of bugs before Brian sees them.

```bash
# 1. Start the dev server (use your worktree port)
pnpm dev --port <N> &
DEV_PID=$!
sleep 3  # wait for vite to be ready

# 2. Run Playwright smoke test for this task
BASE_URL="http://localhost:<N>" npx playwright test tests/smoke/<slug>.spec.ts

# 3. Or run all smoke tests
BASE_URL="http://localhost:<N>" pnpm playwright:smoke

kill $DEV_PID
```

**You must write a new Playwright test for this task** in `tests/smoke/<slug>.spec.ts` that covers every acceptance criterion. Do not rely only on existing smoke tests — they test the app in general, not your specific feature.

**What to cover in your Playwright test:**
- Every acceptance criterion from the task spec → one `test()` block per criterion
- Every command palette entry → open `Cmd+K`, type the command name, verify it appears and executes
- Every keyboard shortcut → send keydown events, verify UI state changes
- Every UI element described in the spec → verify it renders, is focusable, responds to Tab
- Edge cases: empty state, long text, rapid keypresses
- **The happy path end-to-end**: simulate exactly what a user would do to use this feature

**The test must fail before your fix and pass after.** If you can't write a test that demonstrates the bug is fixed, your test doesn't cover the right thing.

**Playwright is non-negotiable even if unit tests pass.** Unit tests verify code; Playwright verifies the user experience in the real browser. Both are required.

> **⚠️ Browser dev server limits**: the dev server uses mock Tauri handlers (`src/mock-tauri.ts`) — file system operations, git commands, and native dialogs are mocked. **If your task touches the filesystem, AI context pipeline, MCP server, git integration, or any Tauri command that reads/writes real files, Playwright alone is not enough.** You must also do Phase 1b.

### Phase 1b: Tauri dev QA (you do this for filesystem/native tasks)

If your task touches **any of the following**, you must also test with `pnpm tauri dev` against the real vault before firing done:
- File read/write (notes, cache, vault config)
- AI chat context (what the AI actually receives as input)
- MCP server / subprocess communication
- Git integration (commit, push, history, diff)
- Native dialogs or OS-level features

```bash
# Start Tauri dev app from your worktree
pnpm tauri dev --port <N> &
sleep 10  # wait for Tauri + Vite to boot

# Then test using osascript keyboard events (NO mouse/cliclick)
# Example:
osascript -e 'tell application "laputa" to activate'
osascript -e 'tell application "System Events" to keystroke "k" using command down'
# ...simulate the full user flow from the acceptance criteria
```

**What to verify in Phase 1b:**
- Open the feature on a real note in `~/Laputa` (not the demo vault)
- Walk through every acceptance criterion step by step using keyboard only
- Verify file changes with `git -C ~/Laputa diff` if the task writes files
- Verify AI responses actually contain note content (not empty) if the task touches AI context

**⚠️ Claude Code runs headless — you cannot see the screen.** Use `screencapture /tmp/qa-check.png` and then read/describe what you see if you need visual verification. Or rely on DOM state checks via osascript accessibility API.

### Phase 2: Native Tauri QA (Brian does this after you push)

Brian installs the release build and runs keyboard-only QA on the native app. You don't do Phase 2 — but Phase 1 must pass before you fire the done signal, or Brian's QA will fail and the task goes back to To Rework.

1. Acquire lockfile: `echo $$ > /tmp/laputa-qa.lock && trap "rm -f /tmp/laputa-qa.lock" EXIT`
2. Kill other instances: `pkill -x laputa 2>/dev/null || true; sleep 1`
3. Start app: `pnpm tauri dev` from worktree
4. Switch vault to `~/Laputa` (not demo)
5. Test the feature/fix with real mouse clicks (`cliclick`) on real notes
6. If task touches file save: verify `git -C ~/Laputa diff` shows changes
7. If QA fails → fix and re-run. Do NOT fire the signal until it passes.

**⚠️ QA ≠ tests. QA means using the app as a user.**
- "Tests pass" is NOT QA. Tests verify code, QA verifies the user experience.
- The QA comment must describe what you did as a user: "Opened app → Cmd+K → typed 'Trash' → pressed Enter → note disappeared from list → restarted app → note still not visible"
- Every QA comment must include: the exact keyboard/command palette steps used, what was visible before and after, and any edge case tested.
- If you cannot test a feature using keyboard only (osascript shortcuts + command palette), the feature is not keyboard-first → QA fails.

**⚠️ Phase 1 is YOUR quality gate, not a formality.**
Brian's Phase 2 QA is a *reinforcement* check, not the primary gate. If Brian finds a bug in Phase 2 that you could have caught in Phase 1, that is a Phase 1 failure — not a Phase 2 discovery. Before firing the done signal, ask yourself: "Did I actually verify, in Playwright, that the feature works end-to-end exactly as the spec describes?" If the answer is "I ran the smoke tests and they passed", that is not enough. You must run your task-specific test and verify the acceptance criteria one by one.

**⚠️ Test in a clean environment when the feature depends on state.**
If a feature involves indexing, fresh installs, first-time setup, or anything that only runs once:
- **Do not test in the existing dev vault** — it already has the state you're trying to test.
- **Create a new empty vault** for the test: Cmd+K → "New Vault" (or equivalent), pick a temp folder like `/tmp/test-vault-<slug>`, then test the full first-time flow from scratch.
- This applies to: search indexing, vault init, getting-started setup, any "on first open" logic.
- If you can't reproduce the fresh-install scenario locally, the feature is untestable → do not fire done.

Fire done signal only after QA passes:
```bash
rm -f /tmp/laputa-qa.lock
openclaw system event --text "laputa-task-done:<task_id>:<slug>" --mode now
```

## ⛔ CODE HEALTH — No shortcuts

If `pre_commit_code_health_safeguard` flags a file:
- **Understand why** — use `code_health_review` via CodeScene MCP
- Fix the structural problem (extract hooks, split components, reduce complexity)
- **Never** add a JSDoc comment, `#[allow(...)]`, `// eslint-disable`, or `as any` just to pass the gate
- It's fine to take longer. False quality is worse than no quality.

---

## Project

Tauri v2 + React + TypeScript desktop app. Reads a vault of markdown files with YAML frontmatter.

- **Spec**: `docs/PROJECT-SPEC.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Abstractions**: `docs/ABSTRACTIONS.md`
- **Wireframes**: `ui-design.pen`
- **Luca's vault**: `~/Laputa/` (~9200 markdown files)

## Tech Stack

- Desktop: Tauri v2 (Rust backend)
- Frontend: React 18 + TypeScript + BlockNote editor
- Tests: Vitest (unit), Playwright (E2E), `cargo test` (Rust)
- Package manager: pnpm

## Architecture

- `src-tauri/src/` — Rust backend (file I/O, git, frontmatter parsing)
- `src/` — React frontend
- `src/mock-tauri.ts` — Mock layer for browser/test env (silently swallows Tauri calls — **not a substitute for native app testing**)
- `src/types.ts` — Shared TypeScript types

## How to Work

- **Never develop on `main`** — always on `task/<slug>` branch
- **Commit every 20–30 min** — atomic commits, one concern per commit (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- **Update docs/** when changing architecture, abstractions, or significant design (mandatory — see rule below)

## ⛔ DOCS — Keep docs/ in sync with code (mandatory)

After any significant feature change, update the relevant `docs/` files **in the same commit**:

- **`docs/ARCHITECTURE.md`** — stack, system overview, component structure, Tauri commands, data flow, backend modules
- **`docs/ABSTRACTIONS.md`** — domain models, VaultEntry fields, entity types, key abstractions, integration patterns
- **`docs/GETTING-STARTED.md`** — directory structure, key files, common tasks, test commands, onboarding

**What counts as "significant":**
- Adding a new Tauri command or backend module
- Adding a new major component, hook, or feature (not a bugfix)
- Changing the data model (VaultEntry fields, new types, new config files)
- Adding a new integration (API, service, transport)
- Changing the architecture (new panels, new state management, new build steps)

**How to update:**
1. Read the relevant doc section before making changes
2. After your code changes, update the doc to reflect the new state
3. Commit doc changes together with the code — not in a separate follow-up commit

If unsure whether a change is "significant", err on the side of updating. Stale docs are worse than slightly verbose docs.

## TDD — Red/Green/Refactor (mandatory)

**Always use test-driven development.** No production code without a failing test first.

The loop:
1. **Red** — write a failing test that describes the behavior you want. Run it, confirm it fails for the right reason.
2. **Green** — write the minimum code to make the test pass. No more, no less.
3. **Refactor** — clean up the code (extract, rename, simplify) while keeping tests green.
4. **Commit** — one red/green/refactor cycle = one atomic commit.
5. Repeat.

**Why this matters:**
- Forces you to think about behavior before implementation
- Produces only code that's actually needed (no speculative abstractions)
- Tests written first are always behavioral and structure-insensitive by construction
- Tiny cycles = fast feedback, smaller diffs, easier to review

**For bug fixes:**
1. Write a failing test that reproduces the bug (this is the regression test)
2. Fix the bug until the test passes
3. Commit both together: `fix: [bug] — regression test added`

**For Rust:**
```bash
cargo watch -x test   # run tests on every save
```

**For frontend:**
```bash
pnpm test --watch     # run tests on every save
```

**When to deviate:** Pure UI layout/styling work with no logic is the only exception. Everything else — hooks, utilities, Rust commands, state management — must be TDD.

## Testing (quality bar)

- Unit tests must cover real business logic, not "component renders"
- Tests test **behavior** (what the code does), not **structure** (how it does it)
- Every bug fixed → regression test that would have caught it
- Every new feature → TDD from the start (see above)
- `pnpm test:coverage` and `cargo llvm-cov` must pass before committing

## Design File (every UI task)

Every task with UI changes needs a design file. Follow this process:

1. **Open `ui-design.pen` first** — study existing frames to understand the visual language, spacing, and component style before designing anything new.
2. **Design in light mode** — all existing designs use light mode. New frames must match. Never use dark mode for designs.
3. **Create `design/<slug>.pen`** for the new feature — additive only, NOT a copy of ui-design.pen.
4. **When merging to main** — merge your frames into `ui-design.pen` with proper layout:
   - Place frames in a logical area (group by feature area, not stacked on top of each other)
   - Leave at least 100px spacing between frames
   - **Delete `design/<slug>.pen`** after merging — the frames now live in `ui-design.pen`

```bash
mkdir -p design
# Study schema first:
node -e "const f=JSON.parse(require('fs').readFileSync('ui-design.pen','utf8')); console.log(JSON.stringify(f.children[0],null,2))"
# Start fresh:
echo '{"children":[],"variables":{}}' > design/<slug>.pen
```

## Vault File Retrocompatibility (mandatory for every feature that adds vault files)

Laputa vaults are long-lived. New app versions must work on existing vaults that were created before a feature existed.

**Rule: never assume a vault file exists. Always auto-create if missing.**

Every feature that depends on a vault file or folder must:
1. **Auto-bootstrap on vault open** — check if the required file/folder exists; if not, create it with defaults. This must be silent and non-blocking.
2. **Be idempotent** — creating defaults must be safe to run multiple times (never overwrite user data).
3. **Expose a repair command** — add a `Cmd+K` command like "Restore Default Themes" or "Repair Vault Config" that explicitly re-creates missing files. Users can run this if something is broken.

**General "Repair Vault" command** — when adding a new vault file dependency, register it with the central repair system so that `Cmd+K → "Repair Vault"` fixes everything in one shot.

**Pattern:**
```
on vault open:
  if file X does not exist → create X with defaults  ← silent auto-repair
  if file X exists but is malformed → log warning, use defaults (don't crash)

on "Repair Vault" command:
  for each known vault file/folder:
    if missing → create with defaults
    if present → leave untouched (idempotent)
```

This principle applies to: themes, config files, type files, any `.laputa/` subfolder, or any file Laputa expects to find in a vault.

## macOS / Tauri Gotchas

- `Option+N` on macOS → special chars (`¡`, `™`), not `key:'N'`. Use `e.code` or `Cmd+N`.
- Tauri menu accelerators: use `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")` — decorative text in labels doesn't register shortcuts.
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus.

## QA Scripts

```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
bash ~/.openclaw/skills/laputa-qa/scripts/click.sh 400 300   # logical coords
```

## Menu Bar Discoverability (mandatory for every new command)

The command palette is powerful but not discoverable — users must already know a command exists to find it. The macOS menu bar is where users discover what an app can do.

**Rule: every significant command palette entry must also appear in the menu bar.**

When adding a new command to the palette:
1. **Identify the right menu bar group** — File, Edit, View, Note, Vault, or create a new group if needed
2. **Add a menu item** with the same label as the palette command
3. **Show the keyboard shortcut** next to the menu item (if one exists)
4. **If no direct shortcut exists**, still add the menu item — it's discoverable and triggers the same action

The menu bar should be organized around what Laputa does:
- **File** — new note, open vault, switch vault, close
- **Edit** — undo, redo, find, note actions (rename, trash, duplicate)
- **View** — view modes, zoom, sidebar, panels
- **Note** — note-specific actions (move to trash, archive, properties)
- **Vault** — vault management (themes, config, repair, sync)
- **Window / Help** — standard macOS items

**This is a QA requirement:** before marking any task done, verify that every new command palette entry has a corresponding menu bar item.

## Keyboard-First Principle (mandatory for every new feature)

Every feature must be reachable via keyboard. This is both a UX requirement and a QA requirement — Brian tests the native app using keyboard only (osascript key events, no mouse).

**Before marking any task done:**
- Can the feature be triggered/used without touching the mouse?
- If it requires clicking a button, add a command palette entry or keyboard shortcut
- Document the shortcut in the command palette or menu bar

**If you add UI that is only reachable by mouse**, you must also add a keyboard path (command palette entry, shortcut, or Tab-navigable focus). No exceptions.

## Push Workflow (IMPORTANT — changed Feb 27, 2026)

**Push directly to main** — no PRs, no branches, no CI queue.

The pre-push hook runs all checks locally before the push goes through. This replaces remote CI.

```bash
# After QA passes and you're ready to ship:
git push origin main    # pre-push hook runs automatically
```

### ⛔ NEVER open a Pull Request
PRs on separate branches diverge from main with every merge, requiring continuous rebases and creating unnecessary conflicts. Always push directly to main. If the push fails (disk full, test failure, etc.) — fix the problem, then push again. There is no scenario where opening a PR is the right fallback.

### ⛔ NEVER use --no-verify
```bash
# FORBIDDEN — will be caught and rejected:
git push --no-verify
git commit --no-verify   # also forbidden for pre-push bypass
```

The hook runs: tsc, Vite build, frontend tests, frontend coverage, Rust coverage, Clippy, rustfmt, CodeScene. Fix any failures before pushing — do not skip.

If a check fails, fix the issue and push again. The hook is the gate — not remote CI.

## Documentation Diagrams

**Prefer Mermaid for all diagrams in `docs/`.** Use ASCII art only when the diagram is inherently spatial (e.g. the four-panel UI wireframe). For everything else — architecture, flows, sequences, data models — use Mermaid:

```markdown
# Architecture diagrams
flowchart TD / LR / BT

# Sequence diagrams (multi-actor interactions)
sequenceDiagram

# Data models
classDiagram

# State machines
stateDiagram-v2
```

When updating existing docs, convert ASCII diagrams to Mermaid. When adding new diagrams, always use Mermaid. GitHub renders Mermaid natively in markdown.
