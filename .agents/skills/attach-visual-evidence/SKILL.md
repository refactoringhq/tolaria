---
name: attach-visual-evidence
description: >-
  Use when a coding agent finishes a product/UI card and must prove each success
  check with screenshots, recordings, or output before handing it off for
  review.
---
# Attach visual evidence before handoff

Goal: the reviewer can judge every success check from what's attached, without running anything. Any check without evidence counts as FAIL.

## Steps
1. Copy the card's numbered success checks into a checklist. Add any negative cases (what must NOT happen).
2. Capture evidence from a real build, as close to what users run as possible (release build, real simulator or device, the named viewport or zoom level), at the current commit:
   - static state: a screenshot per check, cropped or annotated so the relevant point is obvious
   - motion, gestures, flows: a recording (60 fps when timing matters) plus the key frames: start, midpoint, end state
   - logic/perf: the command and its real output (timings, test results)
3. Identify each artifact with the build or commit it came from.
4. Review your own evidence against each check, point by point, especially the end-state frame. Mark each PASS or FAIL honestly. If something can't be reproduced or staged, say exactly what wasn't verified and why, so the owner can check it on device.
5. If any check FAILs, keep working; don't hand off.
6. Post one comment on the card: the checklist with PASS/FAIL, each item's evidence embedded or linked, the commit, and the list of anything unverified. Then move it to review.
