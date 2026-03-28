# Create Architecture Decision Record

Use this command when you need to document an architectural decision made during a task.

## When to use this

Create an ADR when your work involves any of these:
- Choosing a storage strategy (vault vs app settings vs database)
- Adding or removing a major dependency
- Supporting a new platform or target
- Introducing or removing a core abstraction
- Making a cross-cutting decision that affects how future code should be written

Do NOT create ADRs for: bug fixes, UI styling, refactors that preserve behavior, or test additions.

## Steps

### 1. Find the next available ID

```bash
ls docs/adr/*.md | grep -oP '\d{4}' | sort | tail -1
```

Increment by 1. If no files exist, start at `0001`.

### 2. Create the file

Filename: `docs/adr/NNNN-short-kebab-title.md`

Use this template exactly:

```markdown
---
type: ADR
id: "NNNN"
title: "Short decision title"
status: active
date: YYYY-MM-DD
---

## Context
What situation led to this decision? What forces and constraints are at play?

## Decision
**What was decided.** State it clearly in one or two sentences — bold so it stands out.

## Options considered
- **Option A** (chosen): brief description — pros / cons
- **Option B**: brief description — pros / cons
- **Option C**: brief description — pros / cons

## Consequences
What becomes easier or harder as a result?
What are the positive and negative ramifications?
What would trigger re-evaluation of this decision?

## Advice
*(optional)* Input received before making this decision.
Omit this section if the decision was made without external input.
```

### 3. Update the index

Add a row to the table in `docs/adr/README.md`:

```markdown
| [NNNN](NNNN-short-kebab-title.md) | Title | active |
```

### 4. Commit in the same commit as the feature

Include the ADR in the same commit as the code it documents:

```bash
git add docs/adr/NNNN-short-kebab-title.md docs/adr/README.md
# include in the feature commit, not a separate one
```

## Superseding an existing ADR

If your decision replaces an existing one:

1. Edit the existing ADR — add `superseded_by: "NNNN"` to frontmatter and change `status: superseded`
2. Create the new ADR with the updated decision
3. Update the README index (change old status to `superseded`, add new row)

**Never edit the content of an active ADR** — only its status metadata.

## Best practices

- Write the **Decision** section first — if you can't state it in 1-2 sentences, the decision is too vague
- Be honest about **Options considered** — document the alternatives you actually thought about, not hypothetical ones
- **Consequences** should include both positive and negative — a one-sided ADR is a red flag
- Date = today's date in `YYYY-MM-DD` format
- If you're unsure whether something warrants an ADR, err on the side of creating one — it's cheaper to have an unnecessary ADR than to lose context
