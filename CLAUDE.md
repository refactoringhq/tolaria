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

## ⛔ BEFORE FIRING laputa-task-done — QA on real vault

> **⚠️ TAURI APP ONLY — never test in browser (`pnpm dev` / localhost)**
> The browser dev server has a fake HTTP server (`/api/*` routes, mock handlers) that doesn't exist in the real Tauri app.
> If it works in the browser but crashes in Tauri, it's broken. Always test in `pnpm tauri dev`.

1. Acquire lockfile: `echo $$ > /tmp/laputa-qa.lock && trap "rm -f /tmp/laputa-qa.lock" EXIT`
2. Kill other instances: `pkill -x laputa 2>/dev/null || true; sleep 1`
3. Start app: `pnpm tauri dev` from worktree
4. Switch vault to `~/Laputa` (not demo)
5. Test the feature/fix with real mouse clicks (`cliclick`) on real notes
6. If task touches file save: verify `git -C ~/Laputa diff` shows changes
7. If QA fails → fix and re-run. Do NOT fire the signal until it passes.

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
- **Update docs/** when changing architecture, abstractions, or significant design
- **Test as you go** — write tests alongside code, not after

## Testing

- Unit tests must cover real business logic, not "component renders"
- Every bug fixed manually → add a regression test
- Every new feature → new tests for new behavior paths
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
