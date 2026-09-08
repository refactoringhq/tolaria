---
type: ADR
id: "0181"
title: "Shared cross-runtime inline-markdown stripping contract"
status: active
date: 2026-09-08
---

## Context

Rust vault parsing strips inline Markdown when it derives indexed note titles and snippets. The renderer performs the same presentation cleanup for Table of Contents headings and wikilink labels. These paths previously carried parallel behavior without a shared contract, so fixes for formatting delimiters, Markdown links, wikilinks, escapes, and identifier underscores could land in one runtime while the other continued to produce different text.

Executing one runtime from the other would centralize the implementation, but title and snippet extraction belongs to native vault parsing while renderer display cleanup must remain synchronous and browser-testable. A shared executable module would therefore add an IPC or WebAssembly boundary to a small text transformation.

## Decision

**`src/shared/inlineMarkdownContract.json` is the canonical behavioral contract for inline-Markdown stripping across Rust vault metadata and renderer display surfaces. Each runtime keeps a local adapter and must assert the same golden fixtures.**

The shared fixtures cover link and wikilink unwrapping, strikethrough, inline code, formatting delimiters, escaped literals, malformed wikilinks, and underscores inside identifiers. Both adapters unwrap the supported link-like constructs before applying their runtime-local formatting cleanup. Renderer consumers use `src/utils/inlineMarkdown.ts` instead of adding surface-specific stripping logic; Rust title and snippet parsing remains in `src-tauri/src/vault/parsing.rs`.

## Alternatives considered

- **Shared golden fixtures with local adapters** (chosen): preserves synchronous runtime-native execution while making observable behavior drift fail in both test suites.
- **Call Rust from the renderer through IPC**: creates one executable implementation, but adds request ordering, native availability, and latency concerns to ordinary display formatting.
- **Compile a shared implementation to WebAssembly**: avoids IPC, but adds build and packaging complexity disproportionate to the transformation.
- **Keep independent implementations and copied tests**: requires no shared asset, but allows the copies and their edge-case expectations to diverge again.

## Consequences

- Any observable stripping change must begin by updating the shared fixture matrix and must pass in both runtimes.
- Rust and TypeScript may use different implementation mechanics, but neither may define an independent behavior contract.
- Renderer TOC and wikilink display surfaces share one adapter, reducing intra-renderer drift as well as cross-runtime drift.
- The contract is limited to presentation-oriented inline-Markdown stripping. It does not replace the rendered-markup sanitization and user-regex security boundary in ADR-0108.
- Re-evaluate if Tolaria adopts an existing shared text-processing runtime that can replace both adapters without adding a new runtime boundary solely for this operation.
