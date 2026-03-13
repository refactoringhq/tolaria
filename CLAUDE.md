# CLAUDE.md — Laputa App

## ⛔ BEFORE EVERY COMMIT

```bash
pnpm lint && npx tsc --noEmit
pnpm test
pnpm test:coverage                  # frontend ≥70%
cargo test
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85
pre_commit_code_health_safeguard    # CodeScene ≥9.2 hotspot + ≥8.8 average
```

If `pre_commit_code_health_safeguard` fails: extract hooks, split components, reduce complexity. Never add `// eslint-disable`, `#[allow(...)]`, or `as any` to pass the gate.

## ⛔ BEFORE FIRING laputa-task-done — Two-phase QA

### Phase 1: Playwright (you do this)

Write a test in `tests/smoke/<slug>.spec.ts` that covers every acceptance criterion. The test must fail before your fix and pass after. Run it:

```bash
pnpm dev --port <N> &
sleep 3
BASE_URL="http://localhost:<N>" npx playwright test tests/smoke/<slug>.spec.ts
```

**If your task touches filesystem, git, AI, MCP, or any native Tauri command**: also test with `pnpm tauri dev` against `~/Laputa` (not demo vault). Use `osascript` keyboard events — no mouse, no `cliclick`.

### Phase 2: Native QA (Brian does this after push)

Brian installs the release build and runs keyboard-only QA. Phase 1 must pass first or the task goes to To Rework.

Fire done signal only after Phase 1 passes:
```bash
openclaw system event --text "laputa-task-done:<task_id>:<slug>" --mode now
```

## Project

Tauri v2 + React + TypeScript desktop app. Reads a vault of markdown files with YAML frontmatter.

- **Spec**: `docs/PROJECT-SPEC.md` | **Architecture**: `docs/ARCHITECTURE.md` | **Abstractions**: `docs/ABSTRACTIONS.md`
- **Wireframes**: `ui-design.pen` | **Luca's vault**: `~/Laputa/` (~9200 markdown files)
- Stack: Rust backend, React + BlockNote editor, Vitest + Playwright + cargo test, pnpm

## How to Work

- **Push directly to main** — no PRs ever. The pre-push hook runs all checks.
- **⛔ NEVER open a PR** — branches diverge and cause rebase churn.
- **⛔ NEVER use --no-verify**
- Commit every 20–30 min: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

## TDD (mandatory)

Red → Green → Refactor → Commit. One cycle per commit. For bugs: write a failing regression test first, then fix. Exception: pure CSS/layout with no logic.

## ⛔ Docs — Keep docs/ in sync

After adding a Tauri command, new component/hook, data model change, or new integration: update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, and/or `docs/GETTING-STARTED.md` in the same commit. Use Mermaid for diagrams (not ASCII). Exception: spatial wireframe layouts.

## Design File (UI tasks)

1. Open `ui-design.pen` first — study existing frames for visual language.
2. Design in light mode. Create `design/<slug>.pen` for the task.
3. On merge to main: merge frames into `ui-design.pen`, delete `design/<slug>.pen`.

## Vault Retrocompatibility

Every feature that depends on vault files must auto-bootstrap: check if file/folder exists on vault open, create with defaults if missing (silent, idempotent). Register with the central `Cmd+K → "Repair Vault"` command.

## Keyboard-First + Menu Bar (mandatory)

Every feature must be reachable via keyboard. Every new command palette entry must also appear in the macOS menu bar (File / Edit / View / Note / Vault / Window). This is a QA requirement.

## macOS / Tauri Gotchas

- `Option+N` → special chars on macOS. Use `e.code` or `Cmd+N`.
- Tauri menu accelerators: `MenuItemBuilder::new(label).accelerator("CmdOrCtrl+1")`.
- `app.set_menu()` replaces the ENTIRE menu bar — include all submenus.
- `mock-tauri.ts` silently swallows Tauri calls — not a substitute for native app testing.

## QA Scripts

```bash
bash ~/.openclaw/skills/laputa-qa/scripts/focus-app.sh laputa
bash ~/.openclaw/skills/laputa-qa/scripts/screenshot.sh /tmp/out.png
bash ~/.openclaw/skills/laputa-qa/scripts/shortcut.sh "command" "s"
```

## Documentation Diagrams

Prefer Mermaid for all diagrams (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`). ASCII only for spatial wireframe layouts. GitHub renders Mermaid natively.
