---
name: review-against-card
description: >-
  Use when checking finished agent work against its product card before it moves
  to review or QA: by the coding agent as a self-check, or by a PM as a last
  resort.
---
# Review work against its card

Goal: catch gaps before a human does. The card is the spec; the attached evidence is the proof.

## Steps
1. Re-read the card: outcome, constraints and non-goals, numbered success checks, evidence requested.
2. For each success check, find its evidence. Judge it from the evidence itself, not from the agent's summary. Missing, blurry, wrong build, or wrong viewport counts as FAIL.
3. Check the outcome as a user would: does the end state actually deliver what the card says, or a plausible-looking approximation? Compare against any reference or comparables note on the card.
4. Check non-goals: did anything that must not change, change? Look at the diff's footprint for unrelated edits.
5. Check for regressions the card implies (adjacent flows, other platforms in scope, empty/error states).
6. Verdict:
   - all PASS: move on, noting anything unverified for the owner
   - any FAIL: list each failed point with what's missing, and send it back to work (as the agent: keep working; as a PM: comment and move it back)
7. If a card that passed this review later turns out wrong, note what the card or this review missed, so the card-writing and review steps get fixed, not just the bug.
