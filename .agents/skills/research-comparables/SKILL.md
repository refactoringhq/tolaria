---
name: research-comparables
description: >-
  Use when a coding agent (or PM) starts a product/UI card whose interaction or
  design isn't decided by an attached reference: study best-in-class comparables
  before building.
---
# Research comparables before building

Goal: don't invent interaction design or aesthetics. Ground the choice in how 2-3 current best-in-class products solve the same user problem, then build.

## Steps
1. Restate the user outcome from the card in one sentence. Research that outcome, not the implementation.
2. Pick 2-3 comparables: the ones named on the card first; otherwise the current leaders for this exact job (e.g. for a notes app's Kanban: Notion, Linear, Obsidian Bases; for mobile gestures: Apple's own apps and platform guidelines). Include the platform's design guidelines (Apple HIG, Material) when it's a native surface.
3. For each, note concretely: how the user starts the action, what they see at each step, the end state, edge cases (empty, many items, errors, offline), and motion. Use screenshots, official docs, or recordings; cite links. Don't rely on memory of how an app worked years ago.
4. Pick an approach that fits the product's existing patterns and the card's constraints. Say why in 3-5 lines, including what you deliberately didn't copy.
5. Post a short note on the card: comparables studied (with links or screenshots), the choice, and the reason. Then implement.
6. Time-box it: research is a step, not the deliverable. If comparables disagree on something that changes the product meaningfully, pick the one closest to the product's existing patterns and flag the alternative on the card; don't stop and wait unless the card says to.
