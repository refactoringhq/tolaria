---
type: Note
_organized: true
---

@AGENTS.md

This file is only a Claude Code compatibility shim. Keep shared agent instructions in `AGENTS.md`.

<!-- verity-memory:start -->
## Project Memory

This project has a knowledge graph maintained at `.verity/memory/`. Before starting
non-trivial work, scan `.verity/memory/index.md` for decisions, gotchas, and patterns
that may apply to the change you are about to make. Open specific node files via
the Read tool when the title or scope suggests relevance.

The graph is auto-maintained by Verity. Files at `.verity/memory/_archive/` are
superseded — ignore them unless investigating history.

Knowledge the organization's other repositories learned is mirrored outside the
repo at `~/.verity/orgs/<host>/<owner>/memory/` (`verity memory org` lists it).
Each claim says where it came from; one that is wrong here is demoted for
everyone with `verity memory demote <id> --reason "…"`.

## Quality gate: accepted risks

When the Verity pre-commit/pre-push gate FAILs, fix the findings — that is the
default. Use `verity waive <pattern-id> --file <path> --reason "…"` ONLY to relay
a risk a human has explicitly accepted: a named code-review finding, an ADR, or
the user saying so in this conversation. The --reason must cite that source.

Never waive on your own judgment, to get past a block, or pre-emptively. A waive
binds to the file's current bytes and voids automatically when the file changes,
and every waive is recorded in the run ledger. For a pattern-level false positive
use `verity feedback finding <run-id> <pattern-id> false_positive` instead.

## Post-task reflection

When a task is complete (you've created a PR, the user says "done" or "ship it",
or the work is clearly finished), **draft the reflection yourself** — 1–3
concrete things worth remembering (a decision, a gotcha, or a pattern), each
cited with the files / PR / commands / error-signatures it came from. Skip
entirely if nothing non-obvious happened — that judgement is the ONLY filter,
because nothing reviews the reflection before it lands.

Then record it straight away. There is no confirm step, in any environment:

```bash
verity reflect --user-input - --kind <kind> <<'VERITY_EOF_<random>'
<your draft>
VERITY_EOF_<random>
```

The draft goes through the quoted heredoc, never inside `"…"` on the command
line, where a `"` or `$(…)` in it would run in the shell. Replace `<random>`
with 8 random letters and digits that you pick for this call, the same at both
ends. Text written before you picked them cannot end the heredoc early.

Add `--confirmed` ONLY when the user authored or dictated the words. Without
it the node is stored as `source: agent` — Verity thought this, nobody checked
it. With it, `source: user` at full confidence — a person stands behind this.
Never claim the second for your own draft, however good it is.

**Name the files in the text.** Verity scopes the reflection to the paths it
cites, and a reflection that names no file in this repo is never retrieved for
a later review — it is recorded and then invisible. The command says so when it
happens; `--file-globs '<path or glob>'` is the fix when the prose cannot carry
the paths.

Then tell the user, in one line, what you recorded and where: the command
prints the node id, the path under `.verity/memory/`, and a dashboard link.
They did not agree to it in advance, so say it happened — editing or deleting
that file is how they correct it.

> Durable, hand-curated guidance goes in the preserve region below (it survives
> regeneration) or anywhere OUTSIDE these markers. Everything else between the
> markers is tool-owned and overwritten on each run.

## Housekeeping Turns

When a turn will be pure housekeeping — pulling, installing dependencies,
rebasing, a formatting sweep you are not authoring — declare it BEFORE doing it:

```bash
verity ignore --turn --agent --reason "pulling latest before starting"
```

This skips the review for that turn, which saves the turn Verity would
otherwise spend saying it had nothing to say. Use `--for 30m` instead of
`--turn` when a single piece of housekeeping spans several turns.

**It is a claim about the turn, not a way to silence review.** The declaration
is checked against what the turn actually did: if anything is authored — by you,
by a subagent, or by a shell command that can write files — it voids, the review
runs anyway, and the broken declaration is reported. So declare housekeeping you
are about to do, never work you have already done, and never as a way to get past
a finding. Declarations are budgeted per session and every one is recorded with
its reason.

<!-- verity-memory:preserve -->
<!-- Add binding, hand-curated guidance here; it survives Verity regeneration. -->
Verity is set up only on some machines (currently the agent-claude box). If the `verity` CLI or
`.verity/memory/` is missing, skip the Verity steps above; `AGENTS.md` stays the source of truth.
<!-- /verity-memory:preserve -->
<!-- verity-memory:end -->
