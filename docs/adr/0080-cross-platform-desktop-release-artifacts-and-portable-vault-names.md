---
type: ADR
id: "0080"
title: "Cross-platform desktop release artifacts and portable vault names"
status: active
date: 2026-04-24
---

## Context

Tolaria's release pipeline and file validation rules were still biased toward macOS. Alpha/stable releases only produced first-class macOS artifacts, stable download redirects assumed a DMG-only world, and vault file/folder validation allowed names that work on macOS/Linux but break on Windows clones and sync targets.

Shipping Windows as a supported desktop target requires both distribution and data portability to become explicit. A Windows installer is not enough if shared vault content can still produce invalid filenames on that platform, and cross-platform updater manifests must keep Tauri's signed updater artifact separate from the user-facing installer download.

## Decision

**Tolaria ships first-class macOS, Windows x64, and Linux x64 desktop artifacts, and its vault-facing filename rules are portable across those platforms by default.**

- Alpha and stable release workflows build and publish macOS, Windows x64, and Linux x64 artifacts from the same release tag/version computation.
- `latest.json` manifests continue to point Tauri updater clients at signed updater artifacts through `url`, while manual installer/download links are exposed separately via platform-specific fields such as `dmg_url` and `download_url`.
- The stable download page resolves the best current platform download from that manifest plus release assets, instead of assuming macOS-only DMG delivery.
- Note filename renames, folder creation/rename flows, and custom view filenames all share one portable validation rule set that rejects Windows reserved device names, invalid characters, and trailing dot/space suffixes.
- Shortcut labels shown in the UI are derived from the shared command manifest so non-macOS builds display `Ctrl`-style accelerators instead of macOS glyphs.

## Options considered

- **Cross-platform artifacts + portable filename rules** (chosen): makes Windows support real instead of nominal, keeps updater behavior compatible with Tauri, and prevents cross-OS vault breakage at the point of write. Cons: more CI matrix surface area and more platform-specific packaging constraints.
- **Ship Windows installers but keep existing filename validation**: lowers immediate implementation cost, but Windows users would still hit invalid vault content created elsewhere and trust in sync portability would stay weak.
- **Keep macOS-first updater/download metadata and infer other platforms from release assets only**: cheaper in the short term, but it weakens in-app update guarantees and makes the public download page depend on ad hoc asset naming rather than an explicit manifest contract.

## Consequences

- Tolaria's release CI now owns packaging and artifact validation on three desktop platforms instead of one.
- The public stable download page can redirect Windows/Linux users to real installers without special-case manual curation.
- Vault content created through Tolaria stays portable across macOS, Linux, and Windows, which reduces sync-time surprises and broken clones.
- Any future platform addition now needs both a release-artifact contract and an explicit portable-filename review instead of piggybacking on macOS assumptions.
