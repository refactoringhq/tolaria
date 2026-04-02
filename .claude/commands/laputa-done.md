# /laputa-done <task_id>

Mark a Laputa task as done: add completion comment, move to In Review, then self-dispatch the next task.

Run this after Phase 1 (Playwright) and Phase 2 (native app QA) both pass **and `git push origin main` has succeeded**.

⚠️ A task is NOT done until the push succeeds. If the push is blocked by the pre-push hook (clippy, tests, CodeScene, build):
- Read the error
- Fix it (never use `--no-verify`)
- Commit the fix and push again
- Repeat until push exits with code 0

## Steps

**1. Add completion comment to the task**

Summarize what was done — this is the context Luca and Brian will read in Todoist:

```bash
curl -s -X POST "https://api.todoist.com/api/v1/comments" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "$ARGUMENTS",
    "content": "✅ Implementation complete.\n\n**What changed:** [brief summary of the implementation]\n**ADR:** [if an ADR was created, reference it here; otherwise omit]\n**Playwright:** all tests pass\n**Native QA:** tested with pnpm tauri dev — [describe what was tested and what was observed]"
  }'
```

**2. Move task to In Review**

```bash
curl -s -X POST "https://api.todoist.com/api/v1/tasks/$ARGUMENTS/move" \
  -H "Authorization: Bearer $TODOIST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"section_id": "6g3XjX33FF4Vj86M"}'
```

**3. Pick the next task**

Run `/laputa-next-task` to get the next task and start working on it immediately.

If `/laputa-next-task` returns `NO_TASKS` → exit cleanly. The hourly watchdog will restart you when new tasks arrive.
