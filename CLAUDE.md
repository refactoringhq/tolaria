# CLAUDE.md — Laputa App

> Quick links: [Project Spec](docs/PROJECT-SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Abstractions](docs/ABSTRACTIONS.md) · [Wireframes](ui-design.pen)

---

## 1. Task Workflow

This is how you pick up and complete a task. Follow this order every time.

### 1a. Pick up a task

Run `/laputa-next-task` — it fetches the next task from Todoist (To Rework first, then Open), moves it to In Progress, and returns the full description.

When starting a task:
- Read the task description and comments fully
- For To Rework: the ❌ QA failed comment tells you exactly what to fix
- Check `docs/adr/` for relevant architecture decisions before making structural choices

### 1b. Implement

- Work on `main` branch — **no branches, no PRs, ever**
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **⛔ NEVER use --no-verify**
- For UI tasks: open `ui-design.pen` first, study the visual language, design in light mode

### 1c. When done — three mandatory steps

**Step 1: Move task to In### 1c. When done

After Phase 1 (Playwright) and Phase 2 (native QA) both pass, run:

```
/laputa-done <task_id>
```

This moves the task to In Review, notifies Brian, and self-dispatches the next task automatically.

nal (steps 1–3 above).

**Phase 1 — Playwright (you):**

Write a smoke test in `tests/smoke/<slug>.spec.ts` covering every acceptance criterion. Must fail before fix, pass after.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

**Phase 2 — Native app QA (also you):**

Run the app in dev mode and test natively — no need to build a release DMG:

```bash
pnpm tauri dev &
sleep 10  # wait for app to start
```

Then use the QA scripts:
```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/qa-native.png
# Analyze screenshot with image tool — verify the feature looks correct
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

Use `osascript` for keyboard interactions. Write the result as a Todoist comment on the task:
- ✅ if native QA passes (describe what you tested and saw)
- ❌ if it fails (describe what's wrong) — fix and repeat from Phase 1

**⚠️ WKWebView limitation:** `osascript keystroke` is blocked inside the editor for text input. For features requiring text input: verify app launches + stability, then rely on Playwright for correctness.

---

## 2. Development Process

### Commits & pushes

- Push directly to `main` — no PRs, no branches
- The pre-push hook runs the full check suite (build + tests + Playwright + CodeScene)
- **⛔ NEVER use --no-verify**
- Commit message format: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

### TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit.
For bugs: write a failing regression test first, then fix.
Exception: pure CSS/layout changes with no logic.

**Test quality (Kent Beck's Desiderata):** Isolated · Deterministic · Fast · Behavioral · Structure-insensitive · Specific · Predictive. Fix flaky tests before adding new ones. Prefer E2E over unit tests for user flows.

### Code health (mandatory)

Pre-commit and pre-push hooks enforce:
- **Hotspot Code Health** ≥ threshold in `.codescene-thresholds`
- **Average Code Health** ≥ threshold in `.codescene-thresholds`

Both gates block commit/push. Thresholds are a **ratchet** — they only go up, auto-updated after each successful push. Never add `// eslint-disable`, `#[allow(...)]`, or `as any` to pass them.

**Before every commit:** run checks via MCP CodeScene:
- `mcp__codescene__code_health_review` — check file before touching it
- `mcp__codescene__code_health_score` — verify score is higher after your changes

**Boy Scout Rule:** every file you touch must leave with a higher score than it had. If Average drops below 9.0, fix regressions before pushing.

### Check suite (runs on every push)
```bash
pnpm lint && npx tsc --noEmit
pnpm test
pnpm test:coverage        # frontend ≥70%
cargo test
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
```

### Architecture Decision Records (ADRs)

ADRs live in `docs/adr/`. Check them before making structural choices.

**When to create one:** storage strategy, new dependency, platform support, core abstraction change, cross-cutting concern. Use `/create-adr` for the template.

**Timing:** create the ADR **in the same commit as the code** — never before, never after.

**Superseding:** never edit an existing ADR — create a new one that supersedes it.

**Don't create ADRs for:** bug fixes, UI styling, refactors, test additions.

### Keep docs/ in sync

After adding a Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit.

---

## 3. Product Rules

### User vault (`~/Laputa/`)

You may use `~/Laputa/` for testing when the demo vault isn't sufficient (e.g. verifying against real git history). But:
- **Never commit changes to `~/Laputa/`** — discard them before finishing
- After any testing that touched the vault, run: `cd ~/Laputa && git checkout -- . && git clean -fd`
- Default to `demo-vault-v2/` whenever possible

### UI design

1. Open `ui-design.pen` first — study existing frames for visual language
2. Design in light mode. Create `design/<slug>.pen` for the task
3. On completion: merge frames into `ui-design.pen`, delete `design/<slug>.pen`

---

## 4. Reference

### macOS / Tauri gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native testing

### QA scripts

```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

### Diagrams

Prefer Mermaid (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts.
