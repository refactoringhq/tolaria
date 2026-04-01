---
type: ADR
id: "0037"
title: "Language-based markdown syntax highlighting in raw editor"
status: active
date: 2026-04-01
---

## Context

The raw editor (CodeMirror 6, introduced in ADR-0022) initially had a custom `frontmatterHighlight` extension that used regex-based decoration for YAML frontmatter and headings. Markdown body content had no syntax highlighting at all, making the raw editor feel like a plain textarea despite being a full CodeMirror instance.

Extending the custom regex-based approach to cover all markdown syntax (bold, italic, links, lists, blockquotes, code) would have been brittle and hard to maintain.

## Decision

**Replace the custom heading decoration in `frontmatterHighlight.ts` with `@codemirror/lang-markdown` (the official CodeMirror language package). A custom `HighlightStyle` maps CodeMirror highlight tags to visual styles for headings, bold, italic, strikethrough, links, lists, blockquotes, and inline code. The frontmatter YAML plugin is retained for YAML-specific colouring but its heading decoration is removed in favour of the language parser.**

## Options considered

- **Option A** (chosen): `@codemirror/lang-markdown` with custom HighlightStyle — uses the official, maintained language parser; future highlight rules are one CSS declaration. Downside: adds a new npm dependency; the custom frontmatter plugin must be kept separately.
- **Option B**: Extend the custom regex plugin to cover all markdown — no new dependency. Downside: regex-based tokenisation is fragile (e.g., nested formatting), already proving hard to maintain after the heading/frontmatter overlap bug.
- **Option C**: Switch to a markdown-aware editor (e.g., Milkdown, Monaco) — full-featured. Downside: major migration, breaks the dual-editor architecture in ADR-0022, significant scope.

## Consequences

- `@codemirror/lang-markdown` added to `package.json` — this is the only new runtime dependency introduced by this change.
- `frontmatterHighlight.ts` is simplified (heading decoration removed); `markdownHighlight.ts` is the new extension responsible for body highlighting.
- The two extensions are composed in `useCodeMirror.ts` — YAML frontmatter block is still styled by the custom plugin; everything else by the language parser.
- Future syntax highlighting changes (e.g., task lists, tables) can be added by extending the `HighlightStyle` without modifying the parser.
- Re-evaluate if `@codemirror/lang-markdown` conflicts with the custom frontmatter YAML handling as the editor evolves (e.g., if frontmatter block needs to be parsed as a code block rather than decorated text).
