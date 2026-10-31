# Git Hooks

This repo uses Husky hooks from `.husky/`. Those files are the source of truth.

## Installation

`pnpm install` runs the `prepare` script and installs the hooks into `.git/hooks`.

If you need to reinstall them manually:

```bash
pnpm exec husky
```

The hooks expect `node` and `pnpm` to be available. If they are installed via `nvm`, the hooks will try to load `~/.nvm/nvm.sh` automatically.

## Policy

- Commit on `main` only, except long-lived mobile UI work on `mobile-ui-foundation` or `mobile-native-ui`.
- Push from `main` to `origin/main` only, except `mobile-ui-foundation` to `origin/mobile-ui-foundation` and `mobile-native-ui` to `origin/mobile-native-ui`.
- Never use `--no-verify`.
- `.codescene-thresholds` is a ratchet. It can only move up.
- `mobile-ui-foundation` and `mobile-native-ui` are experimental and use scoped mobile checks unless `TOLARIA_MOBILE_FULL_GATE=1` is set.

## Pre-commit

`.husky/pre-commit` is intentionally the fast local gate:

- docs, workflow, hook, and Markdown-only commits skip application checks
- commits with staged frontend source run `pnpm lint --quiet`
- full type checking, builds, tests, coverage, Playwright, and project-level CodeScene checks run before push

CodeScene's change-aware commit safeguard is agent-side because it is provided through the CodeScene MCP. Before invoking `git commit`, the implementing agent must:

1. compare every touched code file's Code Health with its pre-edit baseline
2. run `pre_commit_code_health_safeguard` for the repository
3. refactor until the safeguard's quality gates pass

## Pre-push

`.husky/pre-push` blocks pushes unless all of the following are true:

- the current checkout is `main` or a detached HEAD pushed directly to `main`
- every pushed branch ref is `refs/heads/main -> refs/heads/main`
- the Codacy differential gate reports no new findings
- TypeScript and the Vite build pass
- frontend coverage passes
- Rust lint and Rust coverage pass when `src-tauri/` changed
- the curated Playwright core smoke lane passes via `pnpm playwright:smoke`
- current CodeScene Hotspot and Average health are both at or above `.codescene-thresholds`

Chunk sidecars are preferred for the portable automatic gates. If the sidecars are unavailable, the hook runs the same checks locally.

On `mobile-ui-foundation` and `mobile-native-ui`, the default pre-push fast lane runs `pnpm mobile:lint`, `pnpm mobile:typecheck`, `pnpm mobile:test`, and `pnpm mobile:qa:screenshots`. Native simulator probes remain an explicit QA step. Set `TOLARIA_MOBILE_FULL_GATE=1` to run the production gate before promotion.

If the remote CodeScene scores are better than the current thresholds, the hook updates `.codescene-thresholds`, stages it, and stops the push. Commit that file normally, then push again. The hook does not auto-commit or bypass itself.

Before the final task push, the implementing agent must also run CodeScene `analyze_change_set` with `base_ref=origin/main`. This is the direct-to-main equivalent of a PR preflight: every affected file must be improved or stable and the overall quality gate must pass.

The local change-aware safeguards and the remote project scores answer different questions. The safeguards review the code about to land; the remote Hotspot and Average scores monitor the repository baseline and ratchet.

## Legacy Files

The legacy `pre-commit` file under `.github/hooks/` is archival only. Do not copy it into `.git/hooks`; use Husky and `.husky/` instead. The old design `post-commit` auto-implementation hook was removed because it depended on obsolete one-off scripts. `install-hooks.sh` remains as a reinstall helper that runs Husky.

## Troubleshooting

If a hook cannot find `node` or `pnpm`:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use node
```

Then retry the commit or push.
