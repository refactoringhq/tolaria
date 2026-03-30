# CLAUDE.md — Laputa App

> Quick links: [Project Spec](docs/PROJECT-SPEC.md) · [Architecture](docs/ARCHITECTURE.md) · [Abstractions](docs/ABSTRACTIONS.md) · [Wireframes](ui-design.pen)

---

## 1. Task Workflow

This is how you pick up and complete a task. Follow this order every time.

### 1a. Pick up a task

Tasks come from Todoist (project `6g3XjQFwv9V8Pxfv`). Priority order:
1. **To Rework** (`6g6QqvR9rRpvJWvv`) — fix failed tasks before starting new ones
2. **Open** (`6g3XjWR832hVHhCM`) — sorted by Todoist priority (p1 → p4)

When starting a task:
- Read the task description fully
- For To Rework: read the ❌ QA failed comment — it tells you exactly what to fix
- Check `docs/adr/` for relevant architecture decisions before making structural choices

### 1b. Implement

- Work on `main` branch — **no branches, no PRs, ever**
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **⛔ NEVER use --no-verify**
- For UI tasks: open `ui-design.pen` first, study the visual language, design in light mode

### 1c. When done — three mandatory steps

**Step 1: Move task to In Review**
```bash
curl -s -X POST "https://api.todoist.com/api/v1/tasks/<task_id>/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjX33FF4Vj86M"}'
```

**Step 2: Notify Brian**
```bash
openclaw system event --text "laputa-task-done:<task_id>" --mode now
```

**Step 3: Self-dispatch — pick the next task**

Check Todoist for the next task (To Rework first, then Open, sorted by priority). Skip To Rework tasks whose last comment is ❌ with no follow-up human feedback. If a task is available, move it to In Progress (`6g3XjWjfmJFcGgHM`) and start immediately. If nothing is available, exit — the watchdog will restart you.

```python
# Todoist section IDs:
# To Rework: 6g6QqvR9rRpvJWvv | Open: 6g3XjWR832hVHhCM | In Progress: 6g3XjWjfmJFcGgHM
import os, json, urllib.request, sys

token = os.environ["TODOIST_API_KEY"]

def get_tasks(section_id):
    req = urllib.request.Request(
        f"https://api.todoist.com/api/v1/tasks?project_id=6g3XjQFwv9V8Pxfv&section_id={section_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    return data if isinstance(data, list) else data.get("results", [])

def get_comments(task_id):
    req = urllib.request.Request(
        f"https://api.todoist.com/api/v1/comments?task_id={task_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    return data if isinstance(data, list) else data.get("results", [])

for section_id in ["6g6QqvR9rRpvJWvv", "6g3XjWR832hVHhCM"]:
    tasks = sorted(get_tasks(section_id), key=lambda t: t.get("priority", 4), reverse=True)
    for task in tasks:
        req = urllib.request.Request(
            f"https://api.todoist.com/api/v1/tasks/{task['id']}/move",
            data=json.dumps({"section_id": "6g3XjWjfmJFcGgHM"}).encode(),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req) as r:
            t = json.load(r)
        print(f"Next task: {t['content']} ({t['id']})")
        sys.exit(0)

print("NO_TASKS — exiting")
```

### 1d. QA phases

Both phases run **before** you fire the done signal (steps 1–3 above).

**Phase 1 — Playwright (you):**

Write a smoke test in `tests/smoke/<slug>.spec.ts` covering every acceptance criterion. Must fail before fix, pass after.

```bash
pnpm dev --port 5201 &
sleep 3
BASE_URL="http://localhost:5201" npx playwright test tests/smoke/<slug>.spec.ts
```

**Phase 2 — Native app QA (also you):**

Install the latest release build and test on the real app before marking done. This catches visual/layout issues that Playwright misses.

```bash
# Download and install latest release
gh release download --repo refactoringhq/laputa-app \
  --pattern "*aarch64.dmg" --dir /tmp/ --clobber
osascript -e 'quit app "laputa"' 2>/dev/null; sleep 2
trash /Applications/laputa.app 2>/dev/null || true
hdiutil attach /tmp/*.dmg -nobrowse -quiet
cp -R /Volumes/laputa/laputa.app /Applications/
hdiutil detach /Volumes/laputa -quiet
open /Applications/laputa.app; sleep 5
```

Then use the QA scripts to test:
```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/qa-native.png
# Analyze screenshot with image tool — verify the feature looks correct
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

Use `osascript` for keyboard interactions. Write the result as a comment on the Todoist task:
- ✅ if native QA passes (describe what you tested and saw)
- ❌ if it fails (describe what's wrong) — fix and repeat from Phase 1

**⚠️ WKWebView limitation:** `osascript keystroke` is blocked inside the editor for text input. For features requiring text input: verify app launches + stability, then rely on Playwright for correctness.

**Phase 3 — Brian's review (after push):**

Brian installs the release build and does a final visual check. You've already done the hard part — this is a sanity check. Tasks that pass your Phase 2 rarely fail here.

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
- **Hotspot Code Health ≥ 9.5** (most-edited files)
- **Average Code Health ≥ 9.31** (project-wide)

Both gates block commit/push. Never add `// eslint-disable`, `#[allow(...)]`, or `as any` to pass them.

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

### Keyboard-first (mandatory)

Every feature must be reachable via keyboard. Every new command palette entry must also appear in the macOS menu bar (File / Edit / View / Note / Vault / Window). This is a QA requirement.

### Never modify the user vault for testing

`~/Laputa/` is Luca's real vault. Never create, edit, or delete notes there for any reason.

Use `demo-vault-v2/` for all testing. If a test genuinely needs real vault data (e.g. git history), read only — never write. Any commit that touches `~/Laputa/` content is a bug.

### Vault retrocompatibility

Every feature that depends on vault files must auto-bootstrap: check if file/folder exists on vault open, create with defaults if missing (silent, idempotent). Register with `Cmd+K → "Repair Vault"`.

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
