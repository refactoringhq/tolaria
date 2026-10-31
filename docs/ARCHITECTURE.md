# Architecture

## Scripted AI Streams in Browser Mock Mode

The browser mock backend installs `window.__mockAiStream` in Vite development builds. It accepts a sequence of text, thinking, tool, error, and done chunks and releases them with `next()` or `releaseUntil(count)`. The browser AI-agent stream forwards released chunks through the same callbacks as provider events; native Tauri streams do not consult this hook. Production builds remove the hook path.

## Desktop Note Save Transport

`persistContent` sends native desktop saves through `save_note_content_bytes`
for notes over 256 Ki characters, using raw UTF-8 content and a base64 UTF-8 `x-tolaria-note-path` header. The
command rejects malformed requests and delegates to `save_note_content`, retaining
active-vault path validation and the existing off-thread atomic writer. This
bounds the JSON note payload and avoids a full JSON copy of embedded image payloads; memory remains proportional
to note length. Browser fixtures retain their JSON save API. See ADR 0278.

Tolaria is a personal knowledge and life management desktop app. It reads a vault of markdown files with YAML frontmatter and presents them in a four-panel UI inspired by Bear Notes.

## Design Principles

### Filesystem as the single source of truth

The vault is a folder of plain markdown files. The app never owns the data — it only reads and writes files. The cache, React state, and any in-memory representation are always derived from the filesystem and must be reconstructible by deleting them. When in doubt, the file on disk wins.

### Convention over configuration

Tolaria is opinionated. Standard field names (`type:`, `status:`, `url:`, `Workspace:`, `belongs_to:`, `related_to:`, `has:`, `start_date:`, `end_date:`) have well-defined meanings and trigger specific UI behavior — without any setup. Relationship defaults are stored in snake_case on disk and humanized in the UI. This is not convention *instead of* configuration: users can override defaults via config files in their vault (e.g. `config/relations.md`, `config/semantic-properties.md`). But the defaults work out of the box, and most users never need to touch them.

This principle directly serves AI-readability: the more structure comes from shared conventions rather than per-user custom configurations, the easier it is for an AI agent to understand and navigate the vault correctly — without needing bespoke instructions for every setup.

### Where to store state: vault vs. app settings

When deciding where to persist a piece of data, ask: **"Would the user want this to follow them across all their Tolaria installations — other devices, future platforms (tablet, web)?"**

| Follows the vault | Stays with the installation |
|-------------------|-----------------------------|
| Type icon, type color | Editor zoom level |
| Pinned properties per type | API keys (OpenAI, Google) |
| Sidebar label overrides | Auto-sync interval |
| Property display order | Window size / position |
| Per-note `_width` rich-editor width override | Default rich-editor note width |
| Applicable vault or parent-repository `.gitignore` patterns | Whether this installation hides Gitignored files |
| N/A | Whether this installation shows Git features |
| N/A | Git executable provider (`native` vs WSL2 distribution) |
| Per-vault All Notes note-list column overrides | All Notes PDF/image/unsupported file visibility |
| N/A | Per-vault Git setup prompt opt-out |
| Type `_sidebar_label` overrides | Whether this installation auto-pluralizes type labels |
| N/A | Registered workspace labels, aliases, mount state, and default new-note destination |
| N/A | Mobile AutoGit, appearance, interface scale and analytics consent |
| Any user-visible customization of how content is organized or displayed | Any machine-specific or credential-type setting |

**Rule:** If the information is about *how the content is structured or presented* and the user would expect it to be consistent wherever they open their vault, store it in the vault (frontmatter of the relevant note, using the `_field` underscore convention for system properties). If it's about *this specific installation of the app*, store it in app config JSON under `$XDG_CONFIG_HOME/com.tolaria.app/` (defaulting to `$HOME/.config/com.tolaria.app/` on Unix platforms), or in localStorage for renderer-only transient layout state. The native resolver keeps XDG as the preferred root when the current user can write the target; if that root is not writable, it uses the platform config root instead and reads that writable fallback before stale XDG files. See [ADR-0177](./adr/0177-writable-fallback-for-app-config.md).

Mobile installation preferences use the app-owned document configuration
directory with validated pending-file publication and backup recovery (ADR 0212).
Managed Git vaults retain the existing save/operation queues. Manual sync requires
an explicit local commit; opt-in AutoGit schedules foreground idle checkpoints
and synchronization without promising background execution.

Mobile Git merges validate synthesized frontmatter and saved-view/configuration
blobs before publishing the proposed tree (ADR 0220). Invalid metadata leaves
HEAD, index and working files untouched for explicit conflict resolution.
Git sync has an independent operation mutex and uses short editor/write barriers
around checkpoints and incoming checkout, not HTTP waits (ADR 0221). Temporary
failures retry with bounded backoff, with Expo network reconnection as a retry
hint. Authentication and conflict failures require attention.
Installation-local sync history is keyed by managed vault ID and published with
backup recovery (ADR 0222). It records successful remote/provider operations
separately from local commits and pending edits, without storing user content.
The same ledger keeps installation-local, revisioned paths for pending note dots
(ADR 0271). A successful checkpoint acknowledges only the captured revisions;
edits made while transport is running remain pending. These hints never replace
fresh Git/content comparisons or authorize checkout.
Native conflict review shares local/remote/keep-both choices across Git and linked
folders (ADR 0223). Git retains both parents; coordinated folder publication
retains private original snapshots and an interruption journal. Comparisons are
version-checked again before applying any choices.

Mobile WYSIWYG links use a long-press context-menu gesture so ordinary taps remain
available for caret placement. The editor WebView sends a typed link action over
the existing TenTap bridge; native routing resolves `tolaria://wikilink/` targets
through the workspace resolver and opens supported URL schemes through the
existing attachment-link opener. Phone link navigation keeps a source-note back
stack; this path does not edit or serialize either note.

New iOS folder selections retain a Files-provider bookmark alongside an offline
working copy (ADR 0217). Native, coordinated three-way reconciliation writes
local edits back and imports external changes; divergent versions stop for
resolution. This is independent of Git. Provider delivery, including iCloud's
cross-device upload, remains the provider's responsibility. Existing copy-only
vaults are never silently attached to an original folder.

Examples:
- ✅ Vault: `_pinned_properties` in a Type note (every device should show the same pinned properties)
- ✅ Vault: `_icon: shapes` in a Type note (icon is part of the type's identity)
- ✅ Vault: `_width: wide` in a note that already has frontmatter (per-note reading/editing preference)
- ✅ App settings: `zoom: 1.3` (machine-specific preference)
- ✅ App settings: `ui_language: "zh-CN"` (installation-specific UI language)
- ✅ App settings: `note_width_mode: "wide"` (installation-specific default for notes without an override)
- ✅ App settings: `date_display_format: "friendly"` (installation-specific date rendering preference)
- ✅ App settings: `sidebar_type_pluralization_enabled: false` (installation-specific sidebar label preference)
- ✅ App settings: `all_notes_show_images: true` (installation-specific All Notes file-category visibility)
- ✅ App settings: `git_provider: "wsl"` plus `git_wsl_distro: "Ubuntu"` (machine-specific Git executable location)

### No hardcoded exceptions

No field names, folder paths, or vault-specific values should be hardcoded in the application source code. What can be a convention should be a convention. What needs to be configurable should live in a file. Relationship fields are detected dynamically by checking whether values contain `[[wikilinks]]` — no hardcoded field name lists.

### AI-first knowledge graph

Notes are not just documents — they are nodes in a structured graph of people, projects, events, responsibilities, and ideas. Every design decision should ask: "Does this make the knowledge graph easier for a human *and* an AI to navigate?" Conventions that are legible to both are better than conventions that are legible only to one.

### Three representations, one authority

Vault data exists in three forms simultaneously:
1. **Filesystem** — the `.md` files on disk. This is the single source of truth.
2. **Cache** — `~/.laputa/cache/<hash>.json`, an index for fast startup. Always reconstructible from the filesystem.
3. **React state** — the in-memory `VaultEntry[]` during a session. Always derived from the cache or filesystem.

These must never diverge permanently. If they do, the filesystem wins and the cache/state are rebuilt.

```mermaid
flowchart LR
    FS["🗂️ Filesystem\n.md files on disk\n(source of truth)"]
    Cache["⚡ Cache\n~/.laputa/cache/\n(fast startup index)"]
    RS["⚛️ React State\nVaultEntry[]\n(in-memory session)"]

    FS -->|"scan_vault_cached()"| Cache
    Cache -->|"useVaultLoader on load"| RS
    FS -->|"reload_vault (full rescan)"| RS
    RS -.->|"write via Tauri IPC first"| FS

    style FS fill:#d4edda,stroke:#28a745,color:#000
    style Cache fill:#fff3cd,stroke:#ffc107,color:#000
    style RS fill:#cce5ff,stroke:#004085,color:#000
```

#### Ownership rules

| Layer | Owner | Writes to | Reads from |
|-------|-------|-----------|------------|
| Filesystem | Tauri Rust commands (`save_note_content`, `update_frontmatter`, etc.) | Disk | — |
| Cache | `scan_vault_cached()` in `vault/cache.rs` | `~/.laputa/cache/` | Filesystem + git diff |
| React state | `useVaultLoader` + `useEntryActions` + `useNoteActions` | In-memory `entries` | Cache (on load), filesystem (on reload) |

#### Invariants

1. **Disk-first writes**: All functions that change vault data must write to disk (via Tauri IPC) *before* updating React state. This ensures that if the disk write fails, React state remains consistent with what's actually on disk.
2. **Optimistic UI with rollback**: Where responsiveness matters (e.g. `persistOptimistic` in `useNoteCreation`), state may update before disk confirmation — but a failure callback must revert the optimistic state.
3. **No orphan state updates**: Never call `updateEntry()` before the corresponding `handleUpdateFrontmatter()` or `handleDeleteProperty()` has resolved. Type metadata actions in `useEntryActions` follow this rule — create the missing type document if needed, write frontmatter first, then update state. If missing type creation collides with an existing note filename, the action stops after the existing creation toast instead of applying orphaned state.
4. **Recovery via reload**: If state ever diverges from disk (crash, external edit, race condition), `Reload Vault` (Cmd+K → "Reload Vault") does a full filesystem rescan via the `reload_vault` Tauri command, atomically replacing the cache and all React state. The `reload_vault_entry` command can re-read a single file.
5. **Cache is disposable and crash-safe**: A full reload keeps the last valid snapshot readable while it builds a replacement, then swaps the new cache into place only after the scan completes. A crash during refresh therefore cannot turn the next startup into a cache-miss scan. The cache remains derived from the filesystem and can always be deleted and rebuilt.
6. **Visibility filters are command-boundary concerns**: Gitignored-content visibility is applied after scanning/caching, before entries, folders, or search results reach React. The cache remains complete so toggling the setting can show ignored content again without rebuilding a different cache shape. Large folder filtering runs on the blocking Tokio pool and drains `git check-ignore` output while feeding stdin so broad ignore matches cannot freeze the native UI thread.

#### External Change Detection

Every full App window registers its active vault roots through `start_vault_watcher` / `stop_vault_watcher` (`src-tauri/src/vault_watcher.rs`, backed by Rust `notify`). The backend reuses one native watcher per shared root, tracks owning window labels, and removes a watcher only after its final owner unregisters. Watchers emit `vault-changed` events for content paths and ignore churn from `.git/`, `node_modules/`, temp files, and `.tolaria-rename-txn`. `useVaultWatcher` batches those events and suppresses recent app-owned saves. The main window sends remaining paths through `refreshPulledVaultState()` so folders, saved views, note-list state, and clean active-editor content refresh under the ADR-0135 unsaved-edit rules. Secondary note windows reload known changed entries individually, preserving the full graph while avoiding full scans; deleted, moved, unknown, or otherwise non-reloadable paths fall back to the shared full reconciler. A same-path replacement keeps the active tab mounted, and a frontmatter-only replacement keeps the current BlockNote document, caret, focus, and scroll position. Content changes still replace the clean editor document, while a true move or deletion clears the obsolete tab; when a document replacement starts from a focused editor, the app dispatches a post-replacement editor focus request. `useVaultLoader.isReloading` drives the status-bar reload spinner for both manual and full watcher-triggered reloads.

Window focus also requests Git-based external rename detection for the active vault. The shared `commands::blocking` boundary schedules synchronous command work on Tokio's blocking pool and converts join failures to string errors, retaining contextual labels where needed. The `detect_renames` Tauri command uses this boundary for its filesystem and Git subprocess work so a slow repository cannot stall the native event loop while the user resumes typing.

#### Progressive Vault Loading

Vault opening waits for the persisted vault registry before selecting a path, so it never scans the legacy default vault on the way to the active workspace. On a warm start, `read_vault_snapshot` deserializes a version- and path-valid active-vault cache without Git, per-entry filesystem checks, sorting, or cache replacement; command-boundary visibility filtering can remove Gitignored entries without discarding that snapshot. React installs the provisional graph and clears `isLoading`, then `list_vault` reconciles Git changes and missing files in the background. Invalid or missing snapshots and forced reloads use the authoritative scan path. Clean same-commit reconciliation avoids both the full Git-date scan and an identical cache rewrite. Folders and saved views load independently; secondary workspaces start only after the active graph is usable and hydrate one at a time. Nested mounts derive their entries from a loaded ancestor instead of scanning the same subtree again. BlockNote and editor-only styles remain outside the initial shell chunk and prewarm after its first commit; selecting a note requests them immediately.

Startup performance is measured end to end with ordered, path-free milestones spanning renderer initialization, persisted settings, vault selection, snapshot hydration, interactivity, editor loading, and background reconciliation. Each milestone records both renderer-relative and native-process elapsed time; `TOLARIA_STARTUP_TRACE=1` writes the same JSON events to stderr for repeatable native measurements without adding UI. Git repository probing runs on the blocking Tokio pool, and missing Git-related environment variables are resolved with one login-shell invocation rather than one process per variable. See [ADR-0166](./adr/0166-snapshot-first-progressive-vault-startup.md) and [ADR-0170](./adr/0170-measurable-crash-safe-startup.md).

Large-vault reproduction and keyboard QA steps live in [LARGE-VAULT-LOADING-QA.md](./LARGE-VAULT-LOADING-QA.md).

#### Mounted Workspaces

The registered vault list can act as a mounted-workspace set. `useVaultSwitcher` persists each workspace's installation-local identity (`label`, stable `alias`, color, mount flag) and the default destination for newly created notes in `vaults.json` under Tolaria's app config directory (`$XDG_CONFIG_HOME/com.tolaria.app/`, defaulting to `$HOME/.config/com.tolaria.app/` on Unix platforms). If the native app cannot write that XDG target, it falls back to the platform config directory for both the write and the first subsequent read. `useVaultLoader` scans every available mounted workspace and annotates each `VaultEntry` with provenance before React consumes the combined graph. The default workspace is the write target for new notes and Type documents; it is not the only active vault when multiple workspaces are enabled.

External MCP clients share that registry boundary. `attach_vault` registers an existing canonical directory without initializing Git, while `clone_vault` uses non-interactive system Git in a temporary sibling and publishes the destination only after clone success. Both preserve the current active vault, add the new root to the calling MCP process immediately, and broadcast a registry-change intent so running renderers reload mounted-workspace metadata without relaunching or switching focus. See [ADR-0175](./adr/0175-mcp-vault-lifecycle-uses-app-registry.md).

The status-bar vault menu can open a registered vault as an independent desktop application instance. `VaultMenu` owns rendering, while `vaultMenuInteractions`, `vaultMenuActions`, and `vaultMenuTrigger` isolate mounted-workspace behavior, action construction, and trigger styling. Ordinary launches still register the single-instance plugin, while an explicit vault-instance launch bypasses it and scopes that process's active vault without changing the shared registry's ordinary startup selection. Packaged macOS builds use Launch Services `open -n` so each vault receives its own Dock tile and Command-Tab entry. `src/shared/workspaceColorContract.json` is the cross-runtime source for renderer picker keys, launch validation, persisted vault-color normalization, and light/dark native icon tints. Each process's AppKit icon is generated from the bundled Tolaria icon by recoloring its droplet with the launched or active vault's declared native tint; renderer-only `pink` and `gray` colors explicitly fall back to the contract's default blue tint. See [ADR-0171](./adr/0171-separate-vault-application-instances.md).

Vault item deep links use the registered vault list as their resolver namespace. `src/utils/deepLinks.ts` builds `tolaria://<vault-slug>/<relative-path-with-extension>` URLs from workspace aliases, labels, and paths, appending a short stable hash when generated slugs would collide. `useDeepLinks` validates incoming links, broadcasts cross-window route requests so an already-open matching vault instance can claim and focus the link, then falls back to switching the receiving process's vault when no matching window answers. The owning window reloads the vault index once for recently changed files and opens the matching `VaultEntry` through the normal note-selection path.

Saved Views participate in that mounted graph as source-scoped chrome. `useVaultLoader` loads view definitions from every mounted vault, annotates each `ViewFile` with its owning `rootPath` and workspace identity, and keeps sidebar selection/persistence keyed by `(rootPath, filename)` so same-named view files from different vaults stay independent.

Git surfaces resolve repository paths explicitly. `useGitRepositories` derives the active repository set from the mounted available workspaces, keeps separate selected repositories for Changes, Pulse/history, and manual commits, and exposes the combined modified-file count for status/commands. Native Git capability checks treat a mounted workspace as Git-backed when it is inside any Git work tree, so included vault folders can reuse a parent repository without creating embedded `.git` directories. Rust resolves each vault to a `GitWorkspace` (`vault_root`, provider-discovered `git_root`, and repository-relative `vault_pathspec`). Vault-scoped status, diff, history, dates, pulse, conflict, and commit commands execute at the Git root with that pathspec, then map Git output back to vault-relative note paths. Branches, remotes, fetch, pull, push, merge, and rebase remain repository-wide; the settings row exposes the resolved root and parent-repository sync feedback identifies that wider scope. App-created commits use path-limited staging plus `git commit --only` so sibling staged and unstaged work is preserved. Mounted folders outside Git return no changes/no remote for aggregate probes instead of failing workspace-wide sync. AutoGit checkpoints iterate that repository set, while manual commit, history, diff, and discard operations use the selected surface or the note's workspace provenance. See [ADR-0161](./adr/0161-parent-git-workspace-context.md).

Git command launch is also installation-local. The Rust Git module resolves a `GitLaunchConfig` from app settings before spawning Git, defaulting to native `git` while allowing Windows installations to explicitly select WSL2 Git and a distribution. WSL-selected launches go through `wsl.exe --exec git` and translate Windows/WSL UNC vault paths before passing repository paths across the command boundary; Tolaria never silently switches providers based on detection alone.

Renderer git file workflows stay behind `useGitFileWorkflows`. The hook resolves per-note repository paths, queues editor diff requests, opens Pulse history entries including deleted-file previews, and keeps discard/reload handling close to the selected Git surface while `App.tsx` only wires the resulting callbacks into `NoteList`, `PulseView`, and `Editor`. `useInitialPulseLoad` separately owns cancellable Pulse initial, refresh-key, and retry requests; pagination remains in `PulseView`. Note history reloads only when its note, visibility, or explicit refresh generation changes; changing renderer callback identities during an editor-state update does not rerun `git log`, and the native history command executes that blocking process on Tokio's blocking pool.

Cross-workspace note reads and writes keep the disk-first invariant. When an absolute note path is saved or read without an explicit `vaultPath`, the Tauri boundary resolves the deepest registered vault root that contains the path and validates against that root before touching disk. This lets an editor tab opened from a mounted workspace save back to its source repository while preserving the same path-escape protections as active-vault operations.

#### Note Opening Fast Path

Note opening uses bounded in-memory fast paths for raw content and parsed editor blocks. `useTabManagement` owns the markdown/text prefetch cache and treats every cached value as a performance hint only: identity-matched entries (`modifiedAt` + `fileSize`) can be reused immediately, while identity-missing or identity-mismatched cached text is checked with `validate_note_content`, which compares the cached text with the current file bytes inside the validated vault boundary. If validation fails, Tolaria discards the cached entry and reads fresh disk content before swapping the editor.

The note list opportunistically preloads visible and adjacent markdown/text entries after a short delay. When a large warmed Markdown note resolves, `useEditorTabSwap` may parse it into a bounded parsed-block cache only after foreground editor work has been idle and the rich editor is mounted. On foreground open, block resolution checks the hot tab cache, exact-source parsed-block cache, blank/H1 fast path, and a direct Markdown-to-block parser for large common Markdown before falling back to BlockNote's parser. The direct parser runs in a module worker when available and falls back synchronously only for tests or runtimes without workers. It is conservative: unsupported Markdown constructs return to the BlockNote path rather than changing semantics. Large resolved block sets mount progressively: the editor is locked, the first chunk is applied immediately, remaining chunks append across animation frames, and the same generation/source-content token can abort the partial mount before it is committed. Progressive chunk boundaries expand through contiguous numbered-list items so BlockNote receives each ordered-list run in one mutation and preserves continuous numbering. Every programmatic document replacement, including progressive chunks and fallback recovery, is excluded from ProseMirror history so note navigation cannot retain previous document graphs or displace user typing from undo. Ordinary BlockNote block wrappers stay fully measurable after mount so hover side menus, slash dialogs, and document-end interactions do not inherit browser lazy-height scroll jumps. Parsed blocks are keyed by vault, path, and exact source content; every async swap carries a generation/source-content token so stale conversion results cannot overwrite newer file content or dirty editor state. The editor never renders a preview surface that later morphs into BlockNote. Development builds log `editorBlockResolve`, `editorBlockApply`, and `parsedBlockPreload` timings for large or slow note opens. See [ADR-0105](./adr/0105-editor-correctness-and-responsiveness-contract.md).

Rich-editor Markdown boundaries stay on the editor fast path while keeping one owner for import, installation, and export. `src/utils/richEditorMarkdown.ts` installs the direct serializer on real BlockNote editors, preprocesses Markdown before parsing, injects Tolaria schema blocks after parsing, and serializes body/document Markdown for saves, raw-mode entry, tab swaps, and position snapshots. Its lower-level direct serializer (`src/utils/blockNoteDirectMarkdown.ts`) serializes common Tolaria block shapes to Markdown with a per-editor weak cache keyed by stable block object identity and list context. Durable Markdown bridges for wikilinks, linked inline-code labels, math, highlights, files, Mermaid, tldraw, sandboxed HTML, blockquote callouts, and literal path-template backslashes stay behind `richEditorMarkdown.ts`; linked code and vulnerable literal backslashes are protected by Markdown-inert placeholders during import and restored before editing, while the direct serializer keeps safe identifier underscores, Windows-style separators, and line-ending-adjacent formatting delimiters stable. The bridge helpers preserve unchanged block objects so repeated debounced saves can reuse direct Markdown projections. Highlights use portable Bear-compatible prefixes for custom colors (`==🔴red==`, `==🔵blue==`, `==🟣purple==`, and `==🟢green==`) while the prefix-free `==text==` form remains the default yellow. Callouts keep marker metadata in block props but retain their body as editable inline content, and their mixed serializer restores portable `> [!type]` syntax. Stable active-tab rerenders trust the exact-source block cache before doing any full-document Markdown comparison, so unrelated React state changes do not serialize large notes. Unsupported block shapes fall back to BlockNote's lossy serializer, and development builds log `richEditorSerialize` timing/cache/fallback metrics plus rare `editorStabilityCheck` fallback comparisons for large or slow serializations.

Rich-editor typing keeps BlockNote's per-transaction work minimal. Tolaria creates BlockNote with animation bookkeeping disabled so the `previousBlockType` extension, which scans the old and new ProseMirror documents on every edit, is not installed. Collapsed-heading rendering attaches its mutation observer and `editor.onChange` subscription only while at least one heading/list section is collapsed, then detaches when the final section expands. Heading folds follow the document outline through divider blocks and stop at the next same-or-higher heading. Development builds wrap ProseMirror dispatch once per editor view and log `richEditorDispatch` timings for large or slow transactions, giving QA a direct signal for edit-time stutter instead of only note-open speed. The pinned `prosemirror-view` dependency normalizes a stale child boundary to the live parent end during DOM-selection synchronization so editor teardown or remount cannot dereference a child removed mid-scan; see [ADR-0183](./adr/0183-normalize-stale-prosemirror-selection-boundaries.md).

Core perceived latency is protected by a synthetic production-browser benchmark. `pnpm perf` injects deterministic 500-entry startup/note fixtures and a 2,000-entry virtualized-list fixture, discards a warmup, then aggregates five measured runs. Startup phases publish standard `tolaria:<phase>` User Timing marks; note scenarios combine visible editor/content milestones with opt-in note/editor trace durations; list scrolling waits through the destination paint. `.editor-performance-thresholds.json` stores ratcheted median budgets and p90 diagnostics. CircleCI runs the gate in a dedicated browser job, while native `TOLARIA_STARTUP_TRACE=1` remains the richer host-level diagnostic tier. See `docs/PERFORMANCE.md` for the instrumentation audit and baseline policy.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop shell | Tauri v2 | 2.10.0 |
| Frontend | React + TypeScript | React 19, TS 5.9 |
| Mobile shell | Expo React Native | Expo 54, React Native 0.81 |
| Editor | BlockNote | 0.46.2 |
| Editor render extensions | @tiptap/pm | ProseMirror decorations for rich-editor node presentation |
| Code block highlighting | @blocknote/code-block | 0.46.2 |
| Additional code grammars | @shikijs/langs | 3.23.0 |
| Diagram rendering | Mermaid | 11.14.0 |
| Whiteboard rendering | tldraw | 4.5.10 |
| Raw editor | CodeMirror 6 + official language packages | Markdown, standalone/fenced HTML, YAML, JSON, Python, SQL, JS/TS |
| Spreadsheet editor | IronCalc workbook + WASM | 0.5.x |
| Styling | Tailwind CSS v4 + CSS variables | 4.1.18 |
| UI primitives | Radix UI + shadcn/ui | - |
| Mobile UI primitives | Nativewind + React Native Reusables via Tolaria-owned wrappers | Nativewind 4, RNR registry primitives |
| Icons | Phosphor Icons | Full catalog; per-icon modules load on demand |
| Build | Vite | 7.3.1 |
| Backend language | Rust (edition 2021) | 1.77.2 |
| Frontmatter parsing | gray_matter | 0.2 |
| Filesystem watcher | notify | 6.1 |
| AI (workspace) | CLI agent adapters (Claude Code + Codex + GitHub Copilot + OpenCode + Pi + Antigravity + Kiro + Hermes Agent) plus configured local/API model targets | - |
| Search | Keyword (walkdir-based file scan) | - |
| Localization | App-owned runtime + JSON catalogs (`src/lib/i18n.ts`, `src/lib/locales/*.json`, `lara.yaml`) | English fallback + Lara CLI sync |
| MCP | @modelcontextprotocol/sdk | 1.0 |
| Tests | Vitest (unit), Playwright (E2E/smoke), cargo test (Rust) | - |
| Package manager | pnpm | - |

The icon registry derives its stable kebab-case catalog from the Phosphor CSR
module filenames at build time. Each icon remains a separate Vite dynamic
import, so resolving an uncommon vault icon loads only that SVG component.
The type customization grid renders the catalog in progressive batches while
preserving search across every registered icon. See [ADR-0174](./adr/0174-lazy-full-phosphor-icon-catalog.md).

### Mobile App Foundation

Standalone iOS editor text saves use the existing workspace module's asynchronous
atomic writer (ADR 0203). A private, versioned recovery record is published before
replacement; restart recovery precedes indexing, reads, and Git synchronization.
Unexpected destination changes retain the pending draft and fail closed. This
protects published text saves, not unsent keystrokes. Structural entry operations
use the same recovery boundary: exclusive rename for moves, private quarantine
before deletion cleanup, and UUID completion receipts for safe queue retries
(ADR 0204). Text and entry retries consult completion receipts before capturing
new preconditions, so replay cannot overwrite later edits or delete recreated
entries (ADR 0206). A move plus its subsequent backlink rewrites is not yet one transaction.
Expo Go and Android still require their own equivalent persistence implementation.

The native text engine also supports a version-two journal containing an entire
text-only batch (ADR 0207). It preflights all prior digests and retains the plan
when an external edit prevents replay. Single-save journals and receipts remain
backward readable. The repository routes entirely text-based multi-write plans
through the native batch capability, coalescing repeated paths to their final
content. Single saves, mixed structural plans, and runtimes without that
capability retain their existing individual-operation queue boundaries.

The same iOS module exposes an optional, single-call Git metadata reader anchored
to the app sandbox. It returns fresh stat fields without caching file state;
Expo continues to own byte IO. Rapid-edit staging and checkout recovery remain
unchanged (ADR 0205).

Mobile saved-view loading uses `mobileViewYaml.ts` and the `yaml` parser with
bounded input, alias expansion and filter depth (ADR 0210). Valid desktop YAML
indentation and flow collections retain their filters; malformed definitions are
rejected instead of becoming all-note views. Evaluation and serialization remain
in `mobileSavedViews.ts`. Sidebar type discovery has no arbitrary count cap and
uses the desktop pluralization helper, while explicit type labels take priority.

`MobilePanelSafeArea` owns each tablet pane's top inset, background and divider.
There is no workspace footer: Settings lives at the sidebar bottom. The phone
shell colors its top inset from the active panel. Panes and their dividers reach
the bottom edge; bottom controls and scrollable inspector content own their
home-indicator clearance without leaving a separate band below the workspace.
Pull-to-sync on mobile lists and editor scroll surfaces uses the native refresh
control and existing vault sync action; AutoGit and editor save barriers remain
owned by the vault controller.
`MobileGitHubRepositories` uses a bounded, searchable FlatList picker, and
`MobileDeviceCode` copies authorization codes without routing secrets through the
diagnostic clipboard helper. Inspector relationship groups expose their own add
action, and native option rows use explicit styles on the RNR button primitive.

The vault catalog remembers local imports alongside Git working copies (ADR
0216). Each new local import has its own app-owned directory; the old single
import is registered in place once. One mutually exclusive active pointer is
restored before workspace loading. Forgetting changes only the catalog, never
the vault's files. Settings reuses the vault manager's GitHub account controller
and hands off vault operations through the existing editor-save barrier.

Lazy note hydration reparses only the loaded target, resolves its relationships
against the full note pool, and retains unrelated note object identities. It
does not emit filesystem writes or change modified timestamps. The native
read-only benchmark measures hydration separately from initial indexing and
type filtering; these are data-path timings, not screen-transition timings.

Mobile note reads remain ordered with writes and recovery, except during the
native linked-folder merge. That merge atomically replaces files in the
app-managed copy, so an individual async note read can proceed without waiting
on the full-vault sync lock; writes remain queued until sync completes (ADR
0295).

Storage verification can also run against an optimized local binary using the
explicit `TOLARIA_QA` Swift condition (ADR 0208). A read-only native capability
enables the existing loopback-only probes without Metro or development JavaScript.
Ordinary Release excludes that native API. Git QA records JavaScript timer delay
separately from clone/push/pull duration; neither measure represents native frame
rate or a physical-device performance budget.

Phone layout uses `useMobileDeviceLayout` instead of an orientation-sensitive
window-width breakpoint. Its actual panels occupy fixed slots on one retained
rail; `usePhonePanelRail` drives that rail through RNGH and Reanimated on the UI
thread. Incoming panes are not duplicate previews, and settling does not reset
the offset or start a second entrance animation. `usePhoneViewportWidth` accounts
for the outer safe area once, so landscape panes and edge gestures use the real
content viewport. Inactive content is excluded from input and accessibility;
the editor is created on its first visit and retained thereafter. See ADR-0224
and ADR-0244. Native acceptance covers cancellation, draft/focus continuity,
scroll position, rotation, note-row actions and corresponding iPad behavior.

The mobile app lives in `apps/mobile` as a separate Expo React Native workspace package. It is intentionally not a port of the desktop React DOM component tree. Desktop components, CSS variables, and panel semantics are treated as the reference contract, while mobile uses native primitives and fixture-driven screens. Distribution builds use Expo SDK 57 with the supported `expo-build-properties` scene-lifecycle opt-in for Xcode 27/iOS 27 compatibility (ADR 0246). Prebuild generates Expo's scene manifest and window owner; the temporary Expo Go 54 preview constraint is superseded. Native dependencies and scene support require a new signed build and OTA fingerprint, not a JavaScript-only update.

The first mobile surface is a UI lab with real workspace semantics behind a fast fixture default. `apps/mobile/src/components/ui` owns RNR-derived shadcn-style primitives such as text, buttons, and badges, while `apps/mobile/src/ui` owns Tolaria-specific wrappers such as icon buttons, panels, toolbars, list rows, chips, and property rows. Workspace components live under `apps/mobile/src/components/workspace` and consume `MobileWorkspaceSnapshot` from `apps/mobile/src/workspace/mobileWorkspaceModel.ts`. Tablet panel gestures use one workspace-level horizontal responder and Reanimated offsets. The sidebar and note list remain mounted as one strip with desktop-token snap points at 0, -260, and -600 pixels, so a drag begun anywhere in workspace content can directly hide or reveal both panels without lifting. Only a hidden Properties panel reserves a 32-pixel right-edge reveal gesture; the editor toolbar exposes the equivalent explicit toggle. The native panel-gesture QA maps React Native accessibility frames onto the rotated Simulator window, injects sampled real drags from content and the screen edge, and verifies each settled panel state through stable test identifiers. The default repository remains fixture-backed for screenshot speed, while the Playwright QA harness can inject a real read-only local-vault snapshot through `tolaria:mobile-workspace-snapshot` when `MOBILE_QA_VAULT_PATH` is set. Explicit `source=native-vault` mode uses `expo-file-system` through `apps/mobile/src/workspace/expoWorkspaceFileSystem.ts`, reads an Expo-accessible vault directory, and persists reducer write plans back to markdown files and directories. On iOS, selecting a vault imports it atomically into the app-managed `Documents/Tolaria Vault` directory because document-picker access to arbitrary external folders cannot be reacquired after process termination; the custom `TolariaWorkspaceAccess` Expo module restores that managed local copy on cold launch and the app exposes Documents through Files. For launch performance, that module enumerates the managed vault off the JavaScript thread and returns one serialized file index to the existing pure snapshot builder, avoiding thousands of per-file React Native bridge calls; editor hydration and reducer write plans continue to use the filesystem repository rather than treating the launch index as a second persistence model. `apps/mobile/src/workspace/localVaultSnapshot.ts` keeps scanning as a pure files-plus-folder-paths transform: it parses Tolaria frontmatter conventions, preserves explicit empty folder paths for the sidebar, derives type colors from Type documents, caps rendered note rows for fast UI work, and is shared by host-vault QA and native-vault mode.

Tablet editing is reducer-owned and repository-persisted. `apps/mobile/src/workspace/mobileWorkspaceEditing.ts` applies note creation, title/body edits, frontmatter scalar property changes, relationship add/remove, archive, favorite, folder create/rename/delete, saved-view definition changes, primary note-list display-property config changes, and Type definition actions against the current `MobileWorkspaceSnapshot`. Note folder moves and explicit filename renames emit `moveNote` file-write plans plus only the `saveNote` writes needed for backlink rewrites, while folder edits update explicit folder paths, retarget notes in renamed subtrees, rewrite affected path-based wikilinks, and emit directory write plans instead of modeling folder renames as note delete/save loops. Saved-view edits persist desktop YAML fields including filters, `order`, and `listPropertiesDisplay`, so mobile view ordering and saved-view note-list column choices use the same file contract as desktop. Primary All Notes and Inbox display-property choices emit `saveVaultConfig` plans and are stored outside the vault file list by the repository adapter, matching the desktop vault-path-local config contract. Type document create/delete/update/reorder logic lives in `apps/mobile/src/workspace/mobileWorkspaceTypeEditing.ts` and persists the Type markdown document frontmatter for sidebar label, visibility, color, sort, note-list display properties, and instance schema/default fields through `apps/mobile/src/workspace/mobileTypeDefinitions.ts`; `apps/mobile/src/workspace/mobileTypeDefinitionSchema.ts` owns the form conversion between custom scalar properties, wikilink relationship fields, and blank built-in relationship placeholders. `apps/mobile/src/screens/tabletWorkspaceHistory.ts` records the mobile command history at the snapshot boundary: content/frontmatter edits replay as content writes, structural note, folder, saved-view, and Type-definition changes replay through exact restore edits, and `apps/mobile/src/screens/tabletWorkspacePathHistory.ts` routes note moves, note filename renames, and folder subtree renames back through inverse reducer commands so undo/redo preserves filenames, ordering, raw Markdown, backlink rewrites, and persisted write paths. `apps/mobile/src/workspace/mobileNeighborhood.ts` mirrors the desktop Neighborhood note-list contract for mobile snapshots by pinning the source note, grouping Type instances, direct relationships, inverse relationships, and Backlinks with the same desktop group labels, and preserving duplicate notes across groups. The reducer preserves frontmatter while the markdown editor edits body content, derives snippets/blocks/link targets back from Markdown, resolves wikilink relationship targets against the snapshot, and returns write plans. The source editor and web WYSIWYG fallback keep keystrokes in a local draft and flush through that reducer after a short idle window or when editing unmounts, matching the desktop edit-buffer boundary instead of rebuilding the workspace graph for every character. Mobile note snapshots preserve frontmatter aliases so wikilink resolution and editor autocomplete can match desktop identity candidates. The repository boundary decides whether those writes are no-ops for fixtures, host-injected QA logs, installation-local config writes, or native Expo filesystem writes. Visual components do not import filesystem APIs directly.

The native mobile WYSIWYG editor is wrapped behind `MobileWysiwygMarkdownEditor`. It registers Tolaria-owned TenTap bridge extensions only at that boundary and passes a generated Tolaria TenTap WebView source through `customSource`, so custom Tiptap nodes exist inside the editor WebView instead of only in React Native. `MobileWysiwygContentBridge.ts` hydrates programmatic document content without emitting user-edit updates, and the React Native lifecycle keeps persistence gated until an explicit touch reaches the editor surface; lazy note hydration therefore cannot be mistaken for a user edit, while the first intentional keystroke still saves normally. `MobileWysiwygMathBridge.ts` adds the `mathInline` and `mathBlock` nodes required for desktop math parity and renders both through the mobile KaTeX MathML helper. `MobileWysiwygTentapWebEditor.tsx` plus `apps/mobile/scripts/build-wysiwyg-editor-html.mjs` own the rebuildable WebView bundle. `mobileInlineMath.ts`, `mobileDisplayMath.ts`, `mobileDocumentContent.ts`, and `mobileWysiwygInputTransforms.ts` keep parsing, hydration, structural input transforms, and Markdown serialization pure and testable. Native WYSIWYG QA probes live beside the mobile editor boundary and are opened through Expo deep links; external links now have a dedicated simulator proof that applies and removes a TenTap link command, then verifies the serialized Markdown output rather than relying only on model tests.

Mobile slash commands and inline Find/Replace use that same TenTap boundary. Their ProseMirror plugins own query matching, decorations, keyboard selection and undoable document changes inside the WebView; narrow bridge messages expose state and actions to native RNR controls. Find uses the desktop's pure matching and safe-regex helpers without importing desktop UI. The mounted editor registers Find/Replace with the existing editor-command registry, so keyboard shortcuts and overflow actions reach the inline bar instead of a workspace modal. Source-mode Find uses the same bar and overlays its active match in the existing Markdown syntax layer, retaining YAML frontmatter. Tests mount the actual TenTap web runtime to avoid mixing incompatible ProseMirror instances, and native XCTest checks touch targets, inline placement and serialized Markdown.

Mobile note deep-link copy mirrors the desktop URL contract without importing desktop React DOM modules. `apps/mobile/src/workspace/mobileDeepLinks.ts` builds `tolaria://<vault-slug>/<relative-path-with-extension>` URLs from the mobile snapshot source and selected note path, while `apps/mobile/src/workspace/mobileClipboard.ts` writes through Expo Clipboard. The action is exposed through the tablet controller/action-sheet callback boundary so visual rows remain platform-agnostic.

Mobile note PDF export follows that same boundary. `apps/mobile/src/workspace/mobilePdfExport.ts` strips YAML frontmatter through the mobile document-content helper, renders the note body to Tolaria-styled HTML, and uses `expo-print` plus `expo-sharing` only when running in the native Expo app. Browser-based UI lab checks record deterministic export attempts instead of opening a print dialog, and the generated PDF is treated as a temporary share artifact rather than a new vault file.

Mobile attachment import and opening also follow the controller/editor callback boundary. `apps/mobile/src/workspace/mobileAttachmentImport.native.ts` uses `expo-document-picker` plus the Expo FileSystem object API to copy selected files into the active vault's `attachments/` directory, while `mobileAttachments.ts` owns safe filenames and portable Markdown image/link serialization. `apps/mobile/src/workspace/mobileAttachmentUris.ts` is the native-boundary adapter that resolves portable `attachments/...` Markdown targets to Expo file URIs for TenTap/link opening, then converts vault-local file URIs back to portable Markdown before save. Source and WYSIWYG editor surfaces receive importer/open-link callbacks and attachment payloads instead of importing native picker, sharing, or filesystem modules directly.

The mobile command palette mirrors the desktop command boundary without importing desktop React hooks. `apps/mobile/src/workspace/mobileCommandPalette.ts` builds enabled mobile command rows from existing workspace callbacks, preserving shared IDs from `src/shared/appCommandManifest.json` when a command is manifest-backed and using desktop dynamic command-palette IDs for rows such as note retargeting, file utility actions, and note-width changes. Selection-sensitive editor actions such as paste-without-formatting are registered by the mounted source or native WYSIWYG editor through `apps/mobile/src/workspace/mobileEditorCommands.ts`, so tablet and phone palettes can dispatch the active editor command without importing editor internals. `apps/mobile/src/components/workspace/MobileCommandPalette.tsx` owns only the native searchable/grouped surface; create/search/navigation/note/file/view/settings execution remains in the reducer/controller callbacks. Hardware keyboard commands are exposed through the tracked `TolariaKeyCommands` Expo module: its React delegate handler supplies the root UIKit controller and registers priority `UIKeyCommand`s, then forwards normalized events to the same JavaScript router used by DOM keyboard QA. The root controller accepts first-responder status when no text input owns focus. JavaScript retains one subscription across renders and reads current handlers through a ref. Cmd+1/2/3 and Cmd+Shift+I use the existing tablet panel controller. Unmodified arrows belong to the focused native text input, the open command palette, or the visible note list, in that order; modal/hidden lists cannot consume them. The palette explicitly registers its lifetime with the native module, receives arrows/Escape there, and uses the input's submit event for Return. Native XCTest exercises modifier shortcuts across one workspace session; `assert-ios-keyboard-navigation.mjs` uses AXe HID events and actual accessibility results for arrows/Return/Escape, which XCTest on iOS 18.3 cannot reliably synthesize. Neither harness treats bridge-event logs alone as a successful interaction.

The mobile launcher name is `Tolaria`; the existing package and bundle identifiers
remain unchanged so native updates retain their application data.
The Expo launcher icon uses opaque 1024px light/dark variants in
`apps/mobile/assets/icon-light.png` and `icon-dark.png`. They preserve the desktop
droplet paths and gradients from `src-tauri/icons/icon-source-dark.svg`, replacing
only its macOS rounded tile, shadow and transparent outer margin with full-bleed
light/dark backgrounds. iOS owns the launcher mask, avoiding an inset white tile.
Expo supplies the native sizes and appearance catalog. Desktop assets remain
unchanged. Rebuild the native app after changing these assets or configuration.

The Expo dynamic configuration keeps development on `com.tolaria.mobile.dev`.
`TOLARIA_BUILD_PROFILE=testflight` selects `md.tolaria.mobile` and the Refactoring
ETS signing team, requires `TOLARIA_IOS_BUILD_NUMBER` (1-9999), and validates
`EXPO_PUBLIC_DISTRIBUTION=testflight` / `EXPO_PUBLIC_RELEASE_CHANNEL=alpha`.
Run prebuild and archive with the same environment; existing native projects do
not change merely because environment variables changed. Build-number ordering
against App Store Connect is a release preflight responsibility. This separation
does not migrate or remove development vaults (ADR 0227).

## System Overview

```mermaid
flowchart TD
    subgraph TW["Tauri v2 Window"]
        subgraph FE["React Frontend"]
            App["App.tsx (orchestrator)"]
            WS["WelcomeScreen\n(onboarding)"]
            SB["Sidebar\n(navigation + filters + types)"]
            NL["NoteList / PulseView\n(filtered list / activity)"]
            ED["Editor\n(BlockNote + diff + raw)"]
            IN["Right Panel\n(Inspector + TOC)"]
            AIW["AiWorkspace\n(docked or native window)"]
            AIP["AiPanel\n(transcript + composer)"]
            SP["SearchPanel\n(keyword search)"]
            ST["StatusBar\n(vault picker + sync + version)"]
            CP["CommandPalette\n(Cmd+K launcher)"]

            App --> WS & SB & NL & ED & AIW & SP & ST & CP
            ED --> IN
            AIW --> AIP
        end

        subgraph RB["Rust Backend"]
            LIB["lib.rs → Tauri commands"]
            VAULT["vault/"]
            FM["frontmatter/"]
            GIT["git/\n(commit, sync, clone)"]
            SETTINGS["settings.rs"]
            SEARCH["search.rs"]
            CLI["ai_agents.rs\n+ CLI adapters"]
        end

        subgraph EXT["External Services"]
            CCLI["Claude / Codex / Copilot / OpenCode / Pi / Antigravity / Kiro / Hermes CLI\n(agent subprocesses)"]
            MCP["MCP Server\n(ws://9710, 9711)"]
            GCLI["git CLI\n(native or selected WSL2 executable)"]
            REMOTE["Git remotes\n(GitHub/GitLab/Gitea/etc.)"]
        end

        FE -->|"Tauri IPC"| RB
        CLI -->|"spawn subprocess"| CCLI
        LIB -->|"register / monitor"| MCP
        GIT -->|"clone / fetch / push / pull via GitLaunchConfig"| GCLI
        GCLI -->|"network auth via user config"| REMOTE
    end

    style FE fill:#e8f4fd,stroke:#2196f3,color:#000
    style RB fill:#fff8e1,stroke:#ff9800,color:#000
    style EXT fill:#f3e5f5,stroke:#9c27b0,color:#000
```

## Four-Panel Layout

```
┌────────┬─────────────┬─────────────────────────┬────────────┐
│Sidebar │ Note List   │ Editor                  │ Right Panel│
│(250px) │ (300px)     │ (flex-1)                │ (280px)    │
│        │ OR          │                         │ OR         │
│ All    │ Pulse View  │ [Breadcrumb Bar]        │ TOC        │
│ Changes│             │                         │ OR         │
│ Pulse  │ [Search]    │ # My Note               │ Properties │
│ Inbox  │ [Sort/Filt] │                         │            │
│        │             │                         │ Context    │
│Projects│ Note 1      │ Content here...         │ Messages   │
│Experim.│ Note 2      │ (BlockNote or Raw)      │ Actions    │
│Respons.│ Note 3      │                         │ Input      │
│People  │ ...         │                         │            │
│Events  │             │                         │            │
│Topics  │             │                         │            │
├────────┴─────────────┴─────────────────────────┴────────────┤
│ StatusBar: v0.4.2 │ main │ Synced 2m ago │ Vault: ~/Laputa │
└──────────────────────────────────────────────────────────────┘
```

- **Sidebar** (220-400px, resizable): Top-level filters (All Notes, Changes, Pulse), saved Views, collapsible type-based section groups, and a dedicated folder tree. The folder tree starts with a vault-root row labeled from the opened vault path, shows root-level files when selected, and nests user-created folders plus default vault folders such as `attachments/` and `views/` underneath it; only the dedicated `type/` directory stays hidden because note types already have their own sidebar section. Saved Views persist a top-level YAML `order` field in each view file and use the same ordered-list mental model as Types for single-vault lists: pointer users can drag the existing view row, double-click to rename it, or right-click for edit/rename/appearance/delete actions, while keyboard users can use the row context key for the same menu and command-palette move actions for ordering. In multiple-vault mode, saved View rows are keyed by source vault plus filename so duplicate filenames do not collide, and edits/deletes route to the owning vault. The folder tree supports inline folder creation and rename, exposes a right-click menu for rename/delete plus filesystem reveal/copy-path actions on mutable folders, and auto-expands ancestor folders when the current selection or rename target is nested. Folder creation sends the selected folder's vault-relative path and mounted root to `create_vault_folder`, so a new folder is created under the focused parent instead of defaulting to the active vault root. Type sections and folder rows also act as note drop targets: stable `data-note-drop-*` attributes identify the rows, and a delegated sidebar listener owns hover feedback plus the single mutation dispatch. Dropping a note on a type updates its `type:` frontmatter, while dropping it on a folder runs the same crash-safe move path as the command palette flow. Each type can have a custom icon, color, sort, and visibility set via its `type: Type` document; new type documents created by Tolaria are written at the vault root. In mounted multi-vault graphs, duplicate type names still render as one sidebar section, but the visibility picker becomes a workspace matrix and writes visibility to the specific vault's Type document, so hidden type definitions suppress only notes of that type from the same workspace.
- **Note List / Pulse View** (220-500px, resizable): When a section group, filter, folder, saved view, or Neighborhood selection is active, the renderer first adapts that navigation state into a Collection (`src/collections/collectionFromSelection.ts`) and then resolves visible entries or relationship groups through `src/collections/resolveCollectionEntries.ts`. The only active collection presentation is currently `list`, so the pane still shows filtered notes with snippets, modified dates, status indicators, and per-context note-list controls. When `selection.kind === 'entity'`, the same pane enters **Neighborhood** mode: the source note is pinned at the top as a normal active row, outgoing relationship groups render first, inverse/backlink groups follow, empty groups stay visible with `0`, and duplicates across groups are allowed when multiple relationships are true. Plain click / `Enter` open the focused note without replacing the current Neighborhood, while Cmd/Ctrl-click and Cmd/Ctrl-`Enter` pivot the pane into the clicked note's Neighborhood. Inbox organization auto-advance is coordinated by `useInboxOrganizeAdvance`, which only opens the next visible Inbox note when the organized note is still the active requested tab after the write finishes. Folder-backed lists also show non-Markdown files: previewable media and PDF binaries get file indicators and open in the editor pane, standalone HTML/HTM files open in the editor pane's sandboxed HTML preview with raw-source editing available from the breadcrumb or `Cmd/Ctrl+\`, and unsupported binaries remain muted instead of auto-launching an external app. Saved views reuse the same sort and visible-column controls as the built-in lists, and those changes persist back into the view `.yml` definition (`sort`, `listPropertiesDisplay`). Frontend and Rust evaluators hide archived entries by default, then admit them into evaluation when any nested condition explicitly references the built-in `archived` field; both runtimes execute the golden cases in `src/shared/viewFilterArchivedContract.json` so this policy cannot drift. The renderer normalizes legacy list fields into `presentation: { type: "list" }` in memory so future saved-view presentation settings can share the same collection model without changing existing YAML. When Pulse filter is active, shows `PulseView` — a chronological git activity feed grouped by day. On macOS, the visible sidebar title bar, collapsed note-list/Pulse headers, and editor-only breadcrumb read the shared `--tolaria-macos-traffic-light-padding` CSS variable so native fullscreen can remove traffic-light whitespace without remounting the panes.
- **Editor** (flex, fills remaining space): Single note open at a time (no tabs — see ADR-0003). Breadcrumb bar with filename controls, read-only legacy display-title context when a no-H1 note's title differs from its filename, word count, rich-editor width toggle, and the secondary-overflow Table of Contents action, BlockNote rich text editor with wikilink support, Markdown-compatible inline/display math rendering, editable Obsidian/GFM-style blockquote callouts, first-class Mermaid diagram blocks, sandboxed fenced HTML blocks, markdown-safe formatting controls, and schema-backed fenced code block highlighting via `@blocknote/code-block` plus lazy direct `@shikijs/langs` registrations for missing common grammars. Persisted and live word counts share `src/shared/wordCountContract.json`; Rust owns the indexed value, dirty editor content refreshes it through the deferred metadata pass, and clean editor/Inspector surfaces reuse `VaultEntry.wordCount` instead of recounting. Rust vault title/snippet parsing and renderer TOC heading parsing share golden behavior fixtures in `src/shared/inlineMarkdownContract.json`. Tolaria overlays BlockNote's native code-language selector with a block-ID-keyed shadcn picker so transient read-only mounts cannot leave a code block's visible selector disabled. `TolariaFilePanel` guards BlockNote's file/image upload panel with a live block lookup, so an untitled-note rename or other reload can remove a pending attachment block without leaving the panel to dereference stale editor state. BlockNote image-name edits, including undo and redo, pass through `useEditorImageRenameSync`; the native `rename_attachment` transaction preserves the original extension, normalizes portable filenames, resolves collisions, moves the global attachment, and rewrites matching references across the vault before the editor adopts the returned asset URL without adding a second history step. Removing an attachment reference is handled at the save boundary by `src/hooks/attachmentCleanup.ts`: after a note is persisted, `attachments/...` targets that disappeared from it wait out a short grace period, then `remove_unreferenced_attachment` scans every visible text file in the vault for the filename (raw or percent-encoded) and only moves the file out of `attachments/` when nothing references it. Removed files go to a per-session backup in the OS temp folder, so an undo, paste or later save that references the same path again calls `restore_removed_attachment` and puts the file back. The highlight control is split: its primary action applies default yellow, its caret opens the localized color menu, and a highlighter button appears beside the active highlight boundary for in-place recoloring. Callout bodies retain rich inline marks and links, known aliases use semantic app colors, unknown types use neutral styling, and unsupported `+`/`-` fold markers remain ordinary blockquotes as defined by ADR-0167. Sandboxed HTML blocks resolve renderer-owned `{{...}}` vault expressions against current-note properties, external note scalar properties, single sheet cells, raw body-line references, and `json(...)` structured-data helpers before the sanitizer/iframe boundary. Scripts are blocked unless the fence explicitly declares `scripts="sandboxed"`; installed builds serve that sanitized document through the private `tolaria-html-block` Tauri protocol so it receives a dedicated response-header CSP without weakening the app window policy. The sandbox grants only opaque-origin inline script execution while keeping same-origin, network, workers, forms, nested frames, parent DOM access, Tauri IPC, and top navigation unavailable. Can toggle to diff view (modified files), raw CodeMirror view, or a wide rich-editor reading surface with preserved side margins; raw CodeMirror remains full-width and unaffected by note width mode. Standalone HTML/HTM files use the same editor surface for an opaque-origin `HtmlFilePreview`: active content and remote passive loads are removed, vault-contained local resource paths are rewritten to Tauri asset URLs, and the existing breadcrumb source action or `Cmd/Ctrl+\` opens CodeMirror for direct editing. Their breadcrumb keeps file/source/export actions while suppressing Markdown-only favorite, organized, neighborhood, width, table-of-contents, and archive controls. Raw CodeMirror chooses syntax highlighting from the file extension for Markdown, YAML, JSON, Python, SQL, JavaScript, and TypeScript files, highlights HTML inside fenced `html` blocks, and keeps unknown text files plain. Inline rich-editor images open in a localized shadcn lightbox on double-click while normal single-click BlockNote selection remains untouched, and tiny tracking-style images are ignored. Binary image, audio, video, and PDF files render through `FilePreview` as ordinary vault files using Tauri asset URLs; editor-embedded audio and video use the same scoped asset sources through the CSP `media-src` allow-list, while `PdfFilePreview` uses bundled PDF.js and a same-origin worker to render vault-scoped PDF assets to canvases on every desktop runtime. It paints the first page eagerly, lazily renders later pages near the viewport, and releases page/document resources when the preview closes or switches. Linux AppImage builds ask the native runtime whether audio/video should fall back to external-open controls before mounting webview media elements. External-open actions call `open_vault_file_external` so the target is validated against the active vault before the native default app opens it. Unsupported/broken binaries show explicit fallback states and keyboard focus returns to the note list on `Escape`. Decomposed into `Editor` (orchestrator), `EditorContent`, `HtmlFilePreview`, `FilePreview`, `PdfFilePreview`, `EditorRightPanel`, `TableOfContentsPanel`, `SingleEditorView`, with hooks `useDiffMode`, `useEditorFocus`, and `useEditorSave`, plus the `useRawMode`/`RawEditorView` pair for raw source editing. Rich BlockNote input and raw CodeMirror input both route typed `->`, `<-`, and `<->` through the shared `src/utils/arrowLigatures.ts` resolver so arrow ligatures stay consistent across mode switches while escaped ASCII sequences remain literal. Rich-editor Markdown input transforms for arrows, inline math, and `==highlight==`/`==🔴highlight==` share one capture-phase `beforeinput` execution path in `src/components/richEditorInputTransform.ts` and are composed by `src/components/richEditorInputTransformExtension.ts`. Navigation history (Cmd+[/]) replaces tabs.
  Wikilink activation is keyboard-accessible and resolves through the note-actions boundary. The `[[` autocomplete shows existing notes from the empty trigger and one-character queries, then appends a localized create-note action after non-empty partial suggestions whenever no exact note resolves. Standard Markdown note links resolve their relative path against the source note's workspace root before entering that same navigation boundary, so Windows drive-letter paths and mounted workspaces never leak host-absolute prefixes into link targets. An unresolved target is created beside its source note unless it carries an explicit vault-relative folder or mounted workspace alias; the existing named-note persistence path writes and opens it while ordinary active-note history keeps the source reachable with Back.
  Callouts cover every default Obsidian type and alias, keep Tolaria's semantic palette, use distinct Phosphor icons on borderless tinted surfaces, and can be inserted from a right-opening type submenu under the `/` command. Multiline callout serialization keeps raw quote lines free of generated trailing hard-break backslashes.
  Rich code blocks wrap long lines, render CSS-labeled ProseMirror widgets at each logical line start so the gutter shares the code's layout and copy-safe document positions, scope Cmd/Ctrl+A to their source, and support Enter-after-fence plus Cmd/Ctrl+Shift+Backquote creation paths through `richEditorCodeBlockShortcutExtension.ts`. Plain vertical arrows use `richEditorCodeBlockArrowNavigationExtension.ts` to move by logical source line and cross into only the immediately adjacent block at the first or last boundary, avoiding browser selection jumps caused by highlighted code DOM.
  Rich-editor Markdown input/output is routed through `src/utils/richEditorMarkdown.ts`, which owns parser preprocessing, schema-block injection, direct serializer installation, durable-token restoration, raw-mode/tab-swap serialization, and fallback to BlockNote's Markdown exporter for unsupported shapes. Table cell newlines serialize as `<br>` and use a table-scoped import placeholder restored by `tableCellBreakMarkdown.ts`, including for worker-parsed tables. Raw-mode entry also compares the active path with the shared editor's published ownership path, so non-BlockNote surfaces such as sheets retain their own source instead of serializing stale rich-editor content.
  Rich-editor copy uses BlockNote's external HTML serializer for selected note content so tables, lists, checklists, and inline formatting paste richly into other apps, with Tolaria keeping fenced-code selections as raw code text and normalized plain text on the clipboard. Rich-editor paste sends plain or explicit Markdown containing linked inline-code labels through the same protected import bridge as note loading, then inserts the restored code-styled link at the current selection; pinned TipTap and BlockNote patches allow the marks to coexist and keep their ProseMirror ordering canonical, while unrelated rich HTML stays on BlockNote's native path. A plain HTTP(S) URL pasted over selected rich-editor text applies BlockNote's link mark without replacing the label or its existing inline formatting; internal BlockNote clips, rich HTML, explicit Markdown, and ordinary text remain on their established paste paths. `Cmd/Ctrl+K` remains the global command-palette shortcut except while a non-empty rich-editor text selection is active, when the editor's advertised Create link action owns the keystroke. Web paste remains synchronous while `src/utils/remoteImagePaste.ts` discovers unique remote HTML/Markdown image references and imports them in the background: rich mode rewrites matching BlockNote image blocks after each successful native download, and raw mode inserts a Markdown representation immediately before conditionally rewriting the untouched inserted range. Failed downloads keep their original remote links and surface one localized message. On the web with a Tolaria remote (ADR 0283), pasted or dropped image files are uploaded to `attachments/` on the server, pasted remote images are downloaded by the server (`POST /v1/attachments/imports`, public hosts only), notes link the portable `attachments/...` path the desktop app reads after a pull, and BlockNote's `resolveFileUrl` shows those images through object URLs fetched with the session token; desktop gets no resolver and keeps its asset URLs.
  Rich-editor block selection keeps ProseMirror plugin state, decorations, and key dispatch in `src/components/richEditorBlockSelectionExtension.ts`, while document traversal/collapsed-content operation IDs live in `src/components/richEditorBlockSelectionDocument.ts` and block clipboard serialization/parsing lives in `src/components/richEditorBlockSelectionClipboard.ts`.
  Tolaria's BlockNote side menu keeps UI composition in `tolariaBlockNoteSideMenu.tsx`, while collapsed-section rendering and ellipsis hit-testing live in `tolariaCollapsedSections.ts`, pointer block reordering lives in `tolariaBlockReorder.ts`, measured side-menu positioning lives in `tolariaSideMenuAlignment.ts`, and stale-block lookup helpers live in `tolariaSideMenuBlocks.ts`.
  Note PDF export stays renderer-owned for layout: `useEditorPdfExport` exits diff/raw views, applies a print-only stylesheet to the rendered Markdown or standalone HTML root, and checks the native PDF capability before choosing a platform path. On macOS, the renderer asks for a filesystem PDF destination before the Tauri `export_current_webview_pdf` command saves the current `WKWebView` print operation directly; on Windows/Linux Tauri builds and in browser mode, the same export action falls back to the native/browser print dialog. Markdown export reuses rendered BlockNote output so frontmatter is omitted, while standalone HTML export reuses the sanitized preview iframe; source files are never modified. Markdown notes expose the export action from Cmd+K, the native Note menu, the breadcrumb overflow menu, and each Markdown row's note-list context menu; standalone HTML exposes it from its breadcrumb overflow menu.
- **Right side panels** (200-500px or hidden): Properties and Table of Contents are mutually exclusive panels mounted by `EditorRightPanel` and coordinated by `useRightPanelExclusion`. Properties shows frontmatter, relationships, instances, backlinks, and git history; tags-mode custom fields build field-scoped vault suggestions from both scalar and array values so a one-value field remains discoverable. Table of Contents is lazy-mounted only while open, derives a title-rooted H1/H2/H3 hierarchy through a debounced Web Worker per ADR-0109, and reuses folder-tree indentation/guide geometry with heading icons while resolving live BlockNote block IDs at click time for navigation. The breadcrumb bar toggles Table of Contents and Properties actions. Per-note `icon` is a suggested Properties field and the command palette's "Set Note Icon" action opens that field directly. When viewing a Type note, Properties shows an **Instances** section listing all notes of that type (sorted by modified_at desc, capped at 50).

- **AI workspace** (docked panel or native window): `AiWorkspace` owns the multi-chat orchestration, sidebar tabs, combined agent/model target picker, permission-mode picker, and dock/pop-out controls. Header/guidance chrome lives in `AiWorkspaceChrome`, edge-resize handles in `AiWorkspaceResizeHandles`, conversation metadata/settings persistence in `aiWorkspaceConversations`, and sizing/class/style helpers in `aiWorkspaceSizing`. `AiTargetModelPicker` groups each installed agent with adapter capabilities from `useAiAgentModelCatalog`, followed by separate direct local/API model target groups. It stores an installation-local preference per agent and keeps each conversation's explicit model selection independent; removed catalog entries visibly fall back to Agent default before another prompt runs. The status-bar AI affordance opens this workspace instead of changing the default target inline. Side mode defaults to 360 px, clamps legacy and resized widths to a 320 px minimum, and keeps the combined selector, permission control, and settings action visible on one composer row. Pop-out mode opens a dedicated undecorated transparent Tauri webview window labeled `ai-workspace` and boots the lightweight `AiWorkspaceWindowApp` route instead of the full vault shell. The chat header and sidebar header are draggable in native-window mode; closing the pop-out only closes that window, while the dock control emits a dock request back to the main window before closing the pop-out. Chat sessions reuse `AiPanelView` for transcript/composer rendering with the old panel header disabled; target, model, and permission controls live in the composer toolbar so there is one workspace header per active chat. AI workspace cross-window localStorage, BroadcastChannel, storage-event, and subscriber-set plumbing is owned by `createCrossWindowPersistedStore`; domain stores keep only sanitization, mutation, and native persistence behavior. Transcript localStorage writes and cross-window broadcasts are coalesced to one per second while updates remain immediate in memory, with the latest snapshot flushed on window close or reload.

Panels are separated by `ResizeHandle` components that support drag-to-resize. `useLayoutPanels` clamps the sidebar, note-list, and inspector widths before applying them, keeps the side panes from flex-shrinking below their protected widths, and persists the last chosen widths in installation-local localStorage under `tolaria:layout-panels`. The main window also restores the Properties panel's last open/closed state from `tolaria:right-panel-collapsed`; auxiliary note windows keep their collapsed override without replacing that main-window preference. Once the startup vault graph is ready, `useLastActiveNote` reopens the last available note recorded under `tolaria:last-active-note-path`; missing notes clear the stale value, and auxiliary windows neither restore nor replace it.

The main Tauri window derives its minimum width from the visible panes instead of a single fixed floor. `useMainWindowSizeConstraints` treats the editor-only shell as the 480px baseline, adds the current sidebar / note-list / expanded-inspector widths on top with minimum floors, and calls the native `update_current_window_min_size` command whenever view mode, inspector visibility, or restored pane widths change. That same native command can grow the current window back out when a wider pane combination is restored, but Windows keeps grow-to-fit disabled and skips min-size mutation while fullscreen or maximized so navigation/sidebar interactions do not unfullscreen or reposition the main window. Note windows skip this path and keep their dedicated 800×700 initial sizing.

The main Tauri window also persists its last normal size and screen position in the app config directory as `window-state.json`. The state stores logical window points, while `window_state.rs` migrates older physical-pixel state on read so Retina and non-Retina launches restore the same user-facing bounds. On startup, the restored frame applies only to the main window and clamps to the currently available monitor work areas, so stale coordinates from a disconnected display fall back to a visible placement. Maximized, fullscreen, minimized, and detached note-window frames are not written as the restore baseline.

Tauri setup keeps launch-time filesystem and subprocess work off the window creation critical path. Legacy `~/Laputa` housekeeping and the initial persisted-vault MCP bridge sync run on named background threads, so large legacy vaults, stale active-vault paths, or slow process startup cannot beachball the macOS app before React mounts. React still resyncs the bridge from `useVaultSwitcher` after the persisted selection loads, and no selected vault stops the bridge. AI-agent CLI availability probing is also off the first-paint path: the renderer defers `get_ai_agents_status` until an idle/timeout tick, skips it for disabled AI surfaces and secondary windows, falls back to missing-agent onboarding state if the status IPC does not settle promptly, and the Rust command fans per-agent CLI checks across Tokio's blocking pool with per-agent timeouts. The HTML bootstrap ships a static, non-interactive app-shell skeleton inside `#root` so the WebView paints Tolaria chrome before the React module graph and lazy app route finish loading. React keeps that same captured shell visible through the initial vault hydration, avoiding a second skeleton during startup; the mounted app's detailed pane skeletons remain available for later vault switches and reloads. The bootstrap also installs a Tauri-only one-shot watchdog: React reports readiness from an effect after the root commits, and if that readiness signal never arrives the WebView reloads once instead of leaving macOS users in an inert rendered shell.

The startup document has no external font or stylesheet requests. Vite packages Inter, IBM Plex Mono, and JetBrains Mono from Fontsource with the renderer bundle so offline and firewalled launches cannot block first paint, while online and offline sessions retain identical typography.

Desktop startup registers `tauri-plugin-deep-link` and `tauri-plugin-single-instance` before setup so `tolaria://` links can focus the existing main window and deliver URL events to the renderer. `tauri.conf.json` declares the `tolaria` scheme for bundled desktop builds; Windows and Linux also run `register_all()` as a runtime repair path, while macOS relies on bundle registration.

Linux and Windows use custom React-rendered window chrome instead of the native Tauri menu bar. `setup_custom_window_chrome()` drops server-side decorations on the main window, `openNoteInNewWindow()` does the same for detached note windows, and `LinuxTitlebar`/`LinuxMenuButton` route both window controls and menu actions back through the same shared command pipeline that the desktop native menus use. The native app menu is macOS-only so Services/Hide/Quit, the reserved `WINDOW_SUBMENU_ID`, and its predefined `Cmd+Ctrl+F` fullscreen item keep behaving like normal NSApp menu items, while cross-platform custom items such as Check for Updates emit Tolaria command IDs with visible updater feedback from the renderer menu. An audited local AppKit key monitor consumes physical Escape only while the main window is fullscreen and the renderer has registered a visible dismissable surface, then redispatches Escape into the webview so the surface closes before native fullscreen handles the next bare Escape.
On Linux, `run()` applies WebKitGTK startup safeguards before Tauri creates the webview. Native Wayland launches and AppImage launches inject `WEBKIT_DISABLE_DMABUF_RENDERER=1` and `WEBKIT_DISABLE_COMPOSITING_MODE=1` independently unless the user already set either variable, covering compositor-specific WebKit crashes without changing native X11 launches. AppImage launches keep the additional AppImage-only safeguards: on Wayland sessions Tolaria re-execs once with the first architecture-matching system `libwayland-client.so` in `LD_PRELOAD` when the user has not provided their own preload. The candidate order prefers Fedora-style `lib64` and Debian-style `x86_64-linux-gnu` paths before generic `/usr/lib`, and the ELF header is checked so a 64-bit Tolaria process does not retry with a 32-bit Wayland client library. Runtime startup writes a mount-path-specific `GTK_IM_MODULE_FILE` cache when fcitx is configured via `GTK_IM_MODULE=fcitx` or common fcitx environment hints; release packaging currently uses Tauri's stock linuxdeploy AppImage output plugin instead of Tolaria's experimental output-plugin shim. If the user has not already chosen `GTK_IM_MODULE`, Tolaria sets `GTK_IM_MODULE=fcitx` before WebKit starts. The same AppImage path checks whether `fc-match` resolves the default emoji font to `Noto-COLRv1.ttf`; when the user has not provided `FONTCONFIG_FILE` or `FONTCONFIG_PATH`, Tolaria writes a cache-local fontconfig file that rejects only that matched font file and exports it before WebKit starts. The rendering overrides keep WebViews from blanking or crashing after accelerated compositing/DMA-BUF failures, the re-exec addresses AppImage library-order failures that can surface as `Could not create default EGL display: EGL_BAD_PARAMETER`, and the fontconfig guard avoids known WebKit crashes in COLRv1 emoji font rendering while leaving other emoji fonts available.

## Multi-Window (Note Windows)

Notes can be opened in separate Tauri windows for focused editing. Secondary windows boot the same `App` shell and load the same active workspace graph as the main window, but they start in the editor-only view mode with side panels collapsed.

The AI workspace can also open in a separate Tauri window through `openAiWorkspaceWindow()`. That window uses `?window=ai-workspace` to boot the lightweight `AiWorkspaceWindowApp` route, receives the active vault context through URL params, opts out of main-window size constraints and startup AI onboarding, and redocks by emitting `tolaria:ai-workspace-dock-requested` to the main window. Its webview is transparent so the rounded workspace shell defines the visible floating-window corners across desktop platforms.

**Triggers:**
- `Cmd+Shift+Click` on any note in the note list or sidebar
- `Cmd+K` → "Open in New Window" (command palette, requires active note)
- `Cmd+Shift+O` keyboard shortcut
- Note → "Open in New Window" menu bar item

**Architecture:**
- `openNoteInNewWindow()` (`src/utils/openNoteWindow.ts`) creates a new `WebviewWindow` via the Tauri v2 JS API with URL query params (`?window=note&path=...&vault=...&title=...`)
- `main.tsx` always mounts `App`; `App` checks `isNoteWindow()` at startup, keeps normal vault/workspace loading active, and `useNoteWindowLifecycle` opens the requested note after the app graph is ready
- Each window has its own auto-save via `useEditorSaveWithLinks` (same 1.5s low-end-safe idle debounce, same Rust `save_note_content` command), and raw-editor typing also derives frontmatter-backed `VaultEntry` state in the renderer so Inspector and note-list surfaces react immediately without waiting for a full reload. Raw CodeMirror flushes its shorter UI debounce when focus leaves the editor; type-document template metadata is published synchronously, and mouse-driven note creation defers one task when it originated in CodeMirror so the new note reads the just-edited template rather than stale vault state.
- Automatic Git repository/status probes, AutoSync, and AutoGit remain main-window responsibilities. Note windows preserve manual Git actions without starting duplicate background loops.
- Shared vault roots have one native watcher with window-label ownership. Known changes in note windows reload affected entries only; exceptional paths retain the full external-refresh fallback.
- Secondary windows are sized 800×700; macOS keeps the overlay title bar, while Linux mounts the shared React titlebar on undecorated windows
- Capabilities config (`src-tauri/capabilities/default.json`) grants permissions to both `main` and `note-*` window labels

## AI System

### AI Agent (AiPanel)

Full agent mode — spawns the selected local CLI agent as a subprocess with tool access and MCP vault integration.

1. **Frontend** (`AiPanel` + `useCliAiAgent` + `aiAgentSession.ts` + `aiAgents.ts` + `aiTargets.ts`) — one normalized session lifecycle for message state, reasoning blocks, tool action cards, response display, onboarding, default-target selection, bundled-docs prompt injection, and the per-vault Safe / Power User permission mode shown in the panel header for coding agents
2. **Backend orchestration** (`ai_agents.rs`) — normalizes agent availability, streaming, and the request permission mode before dispatching to per-agent adapters
3. **Shared runtime scaffold** (`cli_agent_runtime.rs` and submodules) — owns the common request shape, prompt wrapping, JSON-line and line-oriented subprocess lifecycle, stdout/stderr/stdin plumbing, normalized error/done handling, version probing, Tolaria stdio MCP server entry generation, and MCP server path resolution used by app-managed CLI agents
4. **Agent adapters** — Shared prompts are mode-aware on every turn, including turns with note context snapshots: Vault Safe tells agents not to use or advertise shell, while Power User tells shell-capable agents to keep local commands scoped to the active vault. Claude Code still uses `claude_cli.rs` with `acceptEdits`, strict Tolaria MCP config, and a scoped tool list: Safe enables file/search/edit tools and `Skill`, while Power User adds Bash to the available tools and pre-approves Bash with `--allowedTools` without using dangerous permission-bypass flags. Codex runtime specifics live in `codex_cli.rs`; Safe runs `codex --sandbox read-only --ask-for-approval on-request exec --json -`, while Power User runs `codex --sandbox workspace-write --ask-for-approval never exec --json -` so shell execution stays enabled across repeated turns. Both modes write prompt content through stdin, keeping generated context out of the Windows process command line. GitHub Copilot runs through `copilot -p <prompt> -s --no-ask-user` from the active vault, streams line-oriented stdout, passes Tolaria MCP through `--additional-mcp-config`, uses Safe mode with only write and Tolaria MCP tools preapproved, and maps Power User to `--allow-all-tools` without `--allow-all`, `--yolo`, or global path/URL bypasses. OpenCode runs through `opencode run --format json` with transient permissions: Safe denies bash and external directories, while Power User allows bash but still denies external directories. Pi runs through `pi --mode json --no-session` with `npm:pi-mcp-adapter`; Tolaria injects the adapter extension only when neither the seeded global settings nor the vault's project settings already load that package, preventing duplicate MCP tool registration. Both modes currently share the same transient MCP config and the prompt does not promise shell for Pi Power User. Antigravity runs through `agy --input-format text --add-dir <vault>`, receives the prompt through stdin, streams line-oriented stdout, and writes Tolaria MCP into the active vault's `.agents/mcp_config.json`; Safe uses the boolean `--sandbox` flag, while Power User uses `--dangerously-skip-permissions` because current Antigravity CLI builds no longer define `--toolPermission` or accept `--sandbox=<value>`. Kiro runs through `kiro-cli chat --no-interactive --trust-all-tools`, streams line-oriented stdout, drains stderr concurrently, and writes prompt content through stdin to avoid OS argument length limits. Hermes Agent runs through `hermes chat --quiet --source tolaria -q`, streams line-oriented stdout, and uses the user's existing Hermes profile/configuration without mutating `~/.hermes/config.yaml`; setup errors point users to `hermes setup`, `hermes model`, and `hermes doctor`. Codex, GitHub Copilot, OpenCode, Pi, Antigravity, Kiro, and Hermes all launch from the active vault cwd; Codex, GitHub Copilot, OpenCode, Pi, Antigravity, and Kiro receive transient Tolaria MCP config. Pi seeds its transient agent directory from the user's Pi agent directory before merging Tolaria MCP, so app-managed runs keep standalone Pi provider/auth settings. All app-launched paths use hidden Windows launches; dangerous permission-bypass flags remain avoided except for Antigravity Power User, whose CLI exposes that bypass for non-sandboxed autonomy (ADR-0159).
5. **MCP Integration** — Claude receives the generated MCP config file path, Codex receives the same Tolaria MCP server via transient `-c mcp_servers.tolaria.*` config overrides using Tolaria's resolved Node path plus `VAULT_PATH` and `WS_UI_PORT`, GitHub Copilot receives an inline session MCP config through `--additional-mcp-config`, OpenCode receives it through `OPENCODE_CONFIG_CONTENT`, Pi receives it through a temporary `PI_CODING_AGENT_DIR/mcp.json` consumed by `pi-mcp-adapter` after copying and merging the user's Pi agent config, Antigravity receives it through `.agents/mcp_config.json` in the active vault, and Kiro receives it through `.kiro/settings/mcp.json` in the active vault. Hermes uses the user's own Hermes MCP/profile configuration; Tolaria does not rewrite third-party Hermes config files.

Model capabilities are adapter-owned (ADR-0163). `get_ai_agent_model_catalog` uses Codex's machine-readable debug catalog and Claude Code's stable aliases; Codex discovery resolves both the standalone Codex.app resource and the Codex binary bundled with ChatGPT.app on macOS. Adapters without a verified interface remain default-only, and discovery failure never blocks the workspace. An explicit selection travels through the shared request shape before the chosen adapter adds its own single CLI model flag. Agent default omits the flag entirely.

Each `stream_ai_agent` call also receives a request-scoped `ai-agent-stream-*` event name. Desktop runs bind that scoped name to any spawned CLI child through `ai_agent_processes.rs`, and `abort_ai_agent_stream` validates the same scoped name before killing the registered child. Renderer stop controls therefore cancel the local subprocess instead of only ignoring stale events, while natural completion and repeated stop requests remain no-ops.

CLI-agent availability intentionally does not depend only on the desktop app's inherited `PATH`. The detectors check the current process path, the user's login shell, and supported local/toolchain install locations such as native `~/.local/bin`, local `~/.claude/local`, Mise/asdf shims, nvm-managed Node installs, npm-global, Homebrew, Windows `%APPDATA%\npm`/pnpm/Scoop shims, Kiro's official `%ProgramFiles%\Kiro-Cli` MSI install, Windows `.exe` launchers, and the macOS Codex app resource path so first-run onboarding works on fresh macOS and Windows installs. OpenCode discovery also reads the current registered Windows machine/user PATH through hidden `reg.exe` probes, covering custom npm prefixes added after the GUI process started without treating the Desktop application as a CLI. App-managed CLI spawns expand the active vault path before using it as the subprocess working directory, then extend the child process `PATH` with the resolved binary directory plus those common toolchain directories, which lets GUI-launched sessions run npm shims and their `node`-backed MCP subprocesses even when the desktop environment did not inherit a terminal shell path. Claude Code launches copy a narrow set of exported provider/auth environment variables from the app process or the user's zsh/bash startup files, including Anthropic API/base URL values. OpenCode launches do the same for common provider variables and any `{env:NAME}` placeholders found in OpenCode config files, so company proxy and API-key setups that work in Terminal also work when Tolaria is opened from Finder or Dock. Windows PATH lookup ignores extensionless npm wrappers when a launchable `.cmd`/`.exe` result follows, and npm or Volta `.cmd` shims are not spawned directly; the shared CLI runtime resolves npm shims to their quoted Node script or native executable target and routes Volta shims through `volta run <tool>` so prompt arguments do not hit batch-file argument validation.

CLI-agent system prompts also include a local Tolaria docs orientation when the bundled docs resource is present. `scripts/build-agent-docs.mjs` generates `src-tauri/resources/agent-docs/` from the public VitePress Markdown sources, including `index.md`, `AGENTS.md`, per-section bundles, `all.md`, `search-index.json`, and generated per-page files. Tauri bundles that folder as `agent-docs/`; `get_agent_docs_path` resolves the installed resource path, with a repository fallback for development, and `getAgentDocsPath()` caches it before each agent run. Agents are instructed to read the active vault's `AGENTS.md` for local conventions and search the bundled docs for Tolaria product behavior.

Renderer-facing CLI setup errors can carry a `tolaria:i18n-error:` JSON marker with a translation key and primitive interpolation values. `localizedStreamError.ts` resolves that marker through the active app locale before the AI panel appends stream failure text, so native adapters such as Pi can keep CLI diagnostics in Rust while user-facing setup copy remains in the JSON catalogs.

#### Agent Event Flow

```mermaid
sequenceDiagram
    participant U as User (AiPanel)
    participant FE as useCliAiAgent (Frontend)
    participant R as ai_agents.rs (Rust)
    participant C as Selected CLI Agent
    participant V as Vault (MCP)

    U->>FE: sendMessage(text, references)
    FE->>FE: buildContextSnapshot(activeNote, linkedNotes, openTabs)
    FE->>R: invoke('stream_ai_agent', {agent, message, systemPrompt, vaultPath, permissionMode, eventName})
    R->>R: pick adapter for claude_code, codex, opencode, pi, antigravity, kiro, or hermes
    R->>C: spawn agent with MCP-enabled config
    R->>R: register child under scoped eventName

    loop Normalized stream
        C-->>R: Claude NDJSON, Codex JSONL, Copilot text, OpenCode JSON, Pi JSON, Antigravity text, Kiro text, or Hermes text events
        R-->>FE: emit(eventName, event)
        alt TextDelta
            FE->>FE: accumulate response (revealed on Done)
        else ThinkingDelta
            FE->>FE: show reasoning block (collapses on first text)
        else ToolStart
            FE->>FE: add AiActionCard with spinner
        else ToolDone
            FE->>FE: update card with output
        else Done
            FE->>FE: reveal full response
            FE->>FE: detect file operations → reload vault if needed
        end
    end

    opt User stops response
        U->>FE: click stop
        FE->>R: invoke('abort_ai_agent_stream', {eventName})
        R->>C: kill registered child if still running
        FE->>FE: mark response stopped and return composer to idle
    end

    C->>V: MCP tool calls (search_notes, read_note, edit_note…)
    V-->>C: tool results
```

#### File Operation Detection

When the agent writes or edits vault files, `aiAgentFileOperations.ts` detects this from normalized tool inputs and calls `onFileCreated` or `onFileModified` callbacks to trigger vault reload. Unrecognized write-like operations fall back to a full vault refresh.

### Context Building

The agent panel (`ai-context.ts`) builds a structured JSON snapshot from the active note and linked entries:

```json
{
  "activeNote": { "path", "title", "type", "frontmatter", "body", "wordCount", "bodyTruncated?" },
  "openTabs": [{ "path", "title", "type", "frontmatter" }],
  "noteList": [{ "path", "title", "type" }],
  "vault": { "types", "totalNotes" },
  "referencedNotes": [{ "title", "path", "type" }]
}
```

Large active notes are compacted into a head/tail body snapshot before they enter the CLI prompt. The snapshot records `bodyTruncated` metadata and instructs agents to call `get_note(path)` before content-sensitive edits or summaries, keeping lower-context OpenCode providers from failing on oversized active-note context while preserving access to the full note through MCP.

### Direct Model Targets

Tolaria also supports direct model targets for local servers and API providers. These targets are stored as app-level provider metadata and can be selected in Settings or the status bar alongside coding agents. `src/shared/aiModelProviderCatalog.json` is the shared source for provider defaults, local/API grouping, API-key environment placeholders, and runtime fallback base URLs; the renderer imports it through `aiTargets.ts`, and Tauri includes the same JSON in `ai_models.rs`. Direct model targets run in Chat mode: they receive the same note-context snapshot and conversation history, but they do not receive shell access. OpenAI-compatible direct targets can use Tolaria's narrow native `create_note` tool when an active vault is loaded; the tool calls the same create-only, active-vault-bounded note write command as the UI and emits tool events so the renderer refreshes and opens the created note. The backend `stream_ai_model` command supports OpenAI-compatible chat completions and Anthropic Messages-compatible calls, including Ollama, LM Studio, OpenRouter, OpenAI, Anthropic, Gemini, and custom compatible endpoints.

Provider secrets are not written to `settings.json`. Hosted API targets can use Tolaria's local app-data secrets file (`ai-provider-secrets.json`, outside vaults/worktrees and owner-only on Unix) or reference an environment variable name. Env-backed provider keys are resolved from the app process first, then from exported values in the user's zsh/bash startup files on Unix so GUI-launched sessions can still use shell-managed secrets. Local endpoints can omit authentication.

### Authentication

Each CLI agent authenticates itself outside Tolaria. Claude Code uses its existing CLI login or user-managed Anthropic/provider environment variables; Codex surfaces a friendly prompt to run `codex login` when needed; GitHub Copilot surfaces a friendly prompt to run `copilot login`, open `copilot` in the vault, and trust the directory when needed; OpenCode surfaces a friendly prompt to run `opencode auth login` or configure a provider when needed; Pi surfaces a friendly prompt to run `pi /login` or configure a provider API key when needed. Tolaria does not store model-provider API keys in app settings; direct provider secrets stay in local app data or user-managed environment variables. App-managed Pi sessions copy that local Pi agent config into a per-run temporary directory before adding Tolaria MCP, so Tolaria does not overwrite global Pi files and does not drop a working standalone Pi setup.

## MCP Server

The MCP server (`mcp-server/`) exposes vault operations as tools for AI assistants (Claude Code, Antigravity CLI, Cursor, or any MCP-compatible client).
The stdio entrypoint and desktop WebSocket bridge share `mcp-server/tool-service.js` for mounted-vault resolution, note lookup/search, note creation defaults, vault listing, and UI action intents; `index.js` and `ws-bridge.js` only adapt those semantics to their transport-specific request and response shapes. New-note instance defaults use the same dependency-free policy module, `src/utils/typeInstanceDefaults.mjs`, as desktop creation so system/display exclusions and valued-field rules cannot drift between the two paths.

### Tool Surface

| Tool | Params | Description |
|------|--------|-------------|
| `search_notes` | `query, [limit]` | Search notes by title or content substring |
| `vault_context` / `get_vault_context` | `[vaultPath]` | Get mounted-vault summary: entity types, folders, recent notes, and root `AGENTS.md` instructions |
| `list_vaults` | - | List active mounted vaults and whether each has root `AGENTS.md` instructions |
| `get_note` / `read_note` | `path, [vaultPath]` | Read parsed frontmatter, markdown body content, and `mtimeMs` for conflict-guarded edits |
| `create_note` | `path, content, [title], [type], [vaultPath]` | Create a new markdown note inside an active vault without overwriting existing files |
| `update_note` | `path, content, [expectedMtime], [vaultPath]` | Replace an existing note's full markdown content, optionally failing if `mtimeMs` changed since `get_note` |
| `append_to_note` | `path, content, [vaultPath]` | Append markdown verbatim to the end of an existing note |
| `open_note` / `ui_open_tab` | `path, [vaultPath]` | Open a note in a new Tolaria UI tab |
| `ui_open_note` | `path, [vaultPath]` | Open a note in the Tolaria UI editor |
| `highlight_editor` / `ui_highlight` | `element, [path]` | Highlight a UI element (editor, tab, properties, notelist) |
| `ui_set_filter` | `type` | Set the sidebar filter to a specific type |
| `refresh_vault` | `[path], [vaultPath]` | Trigger a vault rescan after a file change |

### Transports

- **stdio** — standard MCP transport for Claude Code / Cursor (`node mcp-server/index.js`)
- **WebSocket** — live bridge for Tolaria app integration:
  - Port **9710**: Tool bridge — AI/Claude clients call vault tools here
  - Port **9711**: UI bridge — Frontend listens for UI action broadcasts from MCP tools

### Explicit External Tool Setup

Tolaria can register itself as an MCP server in:
- `~/.claude.json` and `~/.claude/mcp.json` (Claude Code compatibility across current CLI and legacy MCP-file setups)
- `~/.gemini/config/mcp_config.json` (Antigravity CLI)
- `~/.cursor/mcp.json` (Cursor)
- `~/.config/mcp/mcp.json` (generic MCP-compatible clients)
- `~/.config/opencode/opencode.json` (OpenCode, using its `mcp` config key)

That setup is user-initiated through the status bar / command palette flow, not a startup side effect. Registration is non-destructive (additive, preserves other servers and Antigravity/OpenCode settings), uses `upsert` semantics, and can be reversed by removing Tolaria's entry again. Tolaria resolves an MCP runtime (Node.js 18+ preferred, Bun 1+ as fallback) before writing config so external clients are not left pointing at a missing binary, writes a vault-neutral `type: "stdio"` entry for standard MCP clients, writes OpenCode's vault-neutral `type: "local"` entry, and sets `WS_UI_PORT=9711` so UI actions route back to the desktop app. Durable and transient client-facing MCP entries convert Windows `mcp-server/index.js` paths from Rust's extended-length `\\?\` spelling back to normal drive or UNC spelling before passing the script argument to Node. Durable external MCP processes resolve active workspaces at tool-call time: explicit `VAULT_PATH`/`VAULT_PATHS` env still wins for app-owned and legacy launches, otherwise the MCP server reads Tolaria's `vaults.json`, expands bare `~`, `~/`, and `~\\` registry paths against the current home directory, uses `active_vault` first, and includes every workspace not marked `mounted: false`. Vault context checks each active workspace root for `AGENTS.md` and includes those instructions in the returned context. The generated standard entry is exposed as an `mcpServers` manual JSON snippet, while OpenCode gets a separate top-level `mcp` snippet with a `command` array through `get_opencode_mcp_config_snippet`; both appear in the MCP setup dialog and copy through the native clipboard path. In the desktop app, `useMcpStatus` copies those snippets through the native `copy_text_to_clipboard` command instead of the Web Clipboard API so macOS WKWebView permission policy cannot block setup. Packaged builds resolve `mcp-server/` from Tauri's trusted installed resource directory before falling back to launcher-provided and Linux package roots such as `/usr/local/Tolaria`, `/usr/lib/tolaria`, `/usr/lib/tolaria/resources`, and AppImage paths. Linux AppImage startup extracts the bundled `mcp-server/` to `~/.local/share/tolaria/mcp-server/` with a `.tolaria-version` marker, so durable external registrations use a stable path instead of the changing AppImage mount point. The `useMcpStatus` hook tracks whether Tolaria's durable MCP entry is connected (`checking | installed | not_installed`) and owns connect, disconnect, exact-snippet load, and copy-to-clipboard actions. Antigravity CLI still owns its own install and sign-in; Tolaria writes the durable external MCP entry only on explicit setup, while app-managed Antigravity sessions use workspace MCP config and optional vault guidance. The desktop WebSocket bridge is started only when a persisted active vault exists and is resynced from React state on vault changes; no selected vault stops the bridge instead of falling back to `~/Laputa`. Stdio MCP server processes are owned by the external client that launched them: when that client closes stdin, Tolaria cancels UI-bridge reconnect timers, closes any UI WebSocket, and exits the runtime process instead of keeping it alive in the background.

### MCP Server Architecture

```mermaid
flowchart TD
    subgraph MCP["MCP Server (Node.js or Bun) — mounted-workspace scoped"]
        IDX["index.js"]
        SVC["tool-service.js\n(vault resolution, note operations,\nUI action intents)"]
        VAULT["vault.js\n(findMarkdownFiles, readNote, createNote,\nsearchNotes, appendToNote, editNoteFrontmatter,\ndeleteNote, linkNotes, listNotes, vaultContext)"]
        WSB["ws-bridge.js"]

        IDX -->|"stdio transport"| STDIO["Claude Code / Cursor / Antigravity / OpenCode"]
        IDX --> SVC
        SVC --> VAULT
        IDX -.->|"UI action WebSocket client"| WSB
        WSB --> SVC
        WSB -->|"port 9710 — tool bridge"| AI["AI Clients\n(Claude Code, external)"]
        WSB -->|"port 9711 — UI bridge"| FE["Frontend\n(useAiActivity)"]
    end

    TAURI["Tauri bridge lifecycle"] -->|"start/stop/restart with VAULT_PATHS"| MCP
    UI["Status bar / Command Palette"] -->|"explicit setup or disconnect"| CFG["~/.claude.json\n~/.claude/mcp.json\n~/.cursor/mcp.json\n~/.config/mcp/mcp.json\n~/.config/opencode/opencode.json"]
```

### WebSocket Bridge

```mermaid
flowchart LR
    FE["Frontend\n(useMcpBridge)"] <-->|"ws://localhost:9710"| WSB["ws-bridge.js"]
    WSB <--> VAULT["vault.js"]
    STDIO["MCP stdio tools"] <-->|"ws://localhost:9711"| FE2["Frontend UI actions\n(useAiActivity)"]
```

**Tool bridge protocol** (port 9710):
- Request: `{ "id": "req-1", "tool": "search_notes", "args": { "query": "test" } }`
- Response: `{ "id": "req-1", "result": { ... } }`

**UI bridge protocol** (port 9711):
- Broadcast: `{ "type": "ui_action", "action": "open_note", "path": "..." }`
- `useAiActivity` hook receives these and applies them (highlight with 800ms feedback, open note, set filter, etc.)

### Rust MCP Module

`src-tauri/src/mcp.rs` manages the MCP server lifecycle:

| Function | Purpose |
|----------|---------|
| `spawn_ws_bridge(vault_path)` | Spawns `ws-bridge.js` as child process with `VAULT_PATH`/`VAULT_PATHS` env |
| `sync_mcp_bridge_vault(vault_path?)` | Starts, restarts, or stops the desktop WebSocket bridge as the selected vault changes |
| `extract_mcp_server_to_stable_dir(app_version)` | On Linux AppImage launches, copies bundled MCP files to `~/.local/share/tolaria/mcp-server/` with version-gated replacement so external clients can keep a stable `index.js` path |
| `register_mcp(vault_path)` | Resolves an MCP runtime (Node.js 18+ preferred, Bun 1+ fallback), resolves the packaged or stable extracted `mcp-server/`, and writes Tolaria's vault-neutral entry to Claude Code, Antigravity CLI, Cursor, OpenCode, and generic MCP configs on user request |
| `mcp_config_snippet(vault_path)` | Builds the exact vault-neutral `mcpServers.tolaria` JSON users can copy into any compatible client without writing third-party config files |
| `remove_mcp()` | Removes Tolaria's MCP entry from Claude Code, Antigravity CLI, Cursor, OpenCode, and generic MCP configs |
| `upsert_mcp_config(path, entry)` | Atomic config file update (create/merge, preserves others) |

The `WsBridgeChild` state wrapper in `lib.rs` ensures the bridge process is replaced on vault switches, stopped when no active vault is selected, and killed plus waited on app exit via the `RunEvent::Exit` handler. The same desktop layer keeps Tauri asset protocol access limited to vault roots loaded during the current app session; command calls remain active-vault scoped for reads, writes, and external opens.

## Search

Search is keyword-based, using `walkdir` to scan all `.md` files in the vault directory. No external binary or indexing step required.

- Matches query against file titles and content (case-insensitive)
- Scores results: title matches ranked higher than content-only matches
- Extracts contextual snippets around the first match
- Skips hidden files

The `search_vault` Tauri command runs the scan in a blocking Tokio task and returns results sorted by relevance score.

The note-list search field combines client-side scoped filtering with that same command: title, snippet, and visible-property matches resolve immediately, while backend body-content hits use `search_vault` with frontmatter excluded before adding matching paths for the currently visible workspace roots without displaying matched body text in the note row.

## Vault Cache System

The vault cache (`src-tauri/src/vault/cache.rs`) accelerates vault scanning using git-based incremental updates.

Each cached scan resolves its `GitWorkspace` once, then reuses that context for HEAD, status, untracked-file, commit-diff, and Git-date queries. This keeps root-level and nested vault reloads from repeating provider probes and path canonicalization on the startup path.

### Cache File

`~/.laputa/cache/<vault-hash>.json` — stored outside the vault directory so it never pollutes the user's git repo. The vault path is normalized through `vault/path_identity.rs` before hashing, so macOS `/tmp` aliases and separator variants share the same cache identity. Stores: vault path, git HEAD commit hash, all VaultEntry objects. Version: v14 (bumped on VaultEntry field changes to force full rescan). Cache replacement is best-effort: Tolaria writes a temp file, fsyncs it, and renames it into place only after a short-lived writer lock plus an on-disk fingerprint check confirm another window/process has not already refreshed the cache. Failures are logged and the app falls back to rebuilding from the filesystem.

`<vault>/.tolaria-rename-txn/` — hidden, scan-ignored staging directory for crash-safe note renames. Tolaria stores temporary backup files plus one manifest per in-flight rename here. On the next vault scan, unfinished transactions are recovered before entries are listed so users do not see a missing note or a visible duplicate after a crash.

### Three Cache Strategies

```mermaid
flowchart TD
    S([read_vault_snapshot]) --> T{Version and path valid?}
    T -->|Yes| U[Return provisional entries\nwithout Git or file stats]
    T -->|No| A
    U --> A([background scan_vault_cached])
    A --> B{Cache exists\nand valid?}
    B -->|No / Corrupt| C["🔴 Full Scan\nwalkdir all .md files\n→ full parse"]
    B -->|Yes| D{Git HEAD\nmatches cache?}
    D -->|Same commit| E["🟢 Cache Hit\ngit status --porcelain\n→ re-parse only uncommitted changes"]
    D -->|Different commit| F["🟡 Incremental Update\ngit diff old..new --name-only\n→ selective re-parse of changed files"]

    C --> G[Replace cache if unchanged\nwriter lock + temp file → rename]
    E --> I{Entries changed or pruned?}
    I -->|No| H
    I -->|Yes| G
    F --> G
    G --> H([VaultEntry list ready])
```

## Styling

The app uses internal app-owned light and dark themes with an optional System preference (see [ADR-0081](adr/0081-internal-light-dark-theme-runtime.md) and [ADR-0112](adr/0112-system-theme-mode.md)). This is not the old vault-authored theming system from ADR-0013: users choose a mode, but themes are owned by the app.

1. **Global CSS variables** (`src/index.css`): Semantic app colors, borders, surfaces, and interaction states. Bridged to Tailwind v4 via `@theme inline`.
2. **Editor theme** (`src/theme.json`): BlockNote-specific typography. Flattened to CSS vars by `useEditorTheme`; editor colors resolve through the same semantic app variables.
3. **Theme runtime**: Applies resolved `light` / `dark` values to `data-theme` and the shadcn-compatible `.dark` class before React consumers render, with a localStorage mirror to avoid startup flash when dark mode or System-on-dark is selected. Settings and command-palette theme actions both write the same installation-local `settings.theme_mode` value; `system` subscribes to `prefers-color-scheme` changes at runtime while explicit Light/Dark remain overrides.

Hybrid keeps the document theme light and scopes the existing dark theme tokens plus `.dark` utilities to `.app__sidebar`. UI overlays are rendered outside that subtree and follow the content theme, including popovers and context menus opened from the sidebar. The native window background follows the selected appearance so the transparent macOS title bar blends into the dark sidebar in Hybrid.

The Settings panel keeps its dialog frame and scroll container mounted while persisted settings updates flow back from `useSettings`. Incoming settings refresh the draft in place, so immediately persisted controls reflect stored values without resetting the panel position.

## Localization

Tolaria's app chrome uses an app-owned localization runtime in `src/lib/i18n.ts`, backed by flat JSON catalogs in `src/lib/locales/` and Lara CLI synchronization through `lara.yaml` (see [ADR-0087](adr/0087-json-catalogs-and-lara-cli-localization.md)). `en.json` is the canonical source catalog, locale files are one file per locale, and English remains the fallback for any missing locale file or key. The installation-local `ui_language` setting stores an explicit locale when the user chooses one; `null` means "follow the system language when Tolaria supports it, otherwise English." Legacy stored values such as `zh-Hans` are normalized to canonical locale codes like `zh-CN`.

`App.tsx` derives the effective locale from settings and browser/system language hints, then passes it down to localized surfaces. Settings exposes a keyboard-accessible shadcn `Select`, and the command palette includes actions to open language settings or switch directly to a supported language.

`App.tsx` also publishes the resolved UI locale and installation-local date display format from `settings.date_display_format` through `AppPreferencesProvider` in `src/hooks/useAppPreferences.ts`. Embedded editor blocks such as untitled callouts consume the shared locale without schema-level prop forwarding. Note rows, note-list property chips, inspector property cells, note info, table-of-contents metadata, and search result subtitles read the shared date preference and render dates through `src/utils/dateDisplay.ts` so the visible style stays consistent. Date picker text entry remains ISO (`YYYY-MM-DD`) to preserve predictable manual input and frontmatter storage.

## Vault Management

### Vault List

Persisted at `~/.config/com.tolaria.app/vaults.json` (reads legacy `com.laputa.app` on upgrade):
```json
{
  "vaults": [{ "label": "My Vault", "path": "/path/to/vault" }],
  "active_vault": "/path/to/vault",
  "hidden_defaults": []
}
```

Managed by `useVaultSwitcher` hook. Switching vaults resets sidebar and clears the active note. `open_vault_in_new_window` starts an explicitly scoped auxiliary application process; that process loads the requested vault as active while preserving the shared registry's ordinary startup selection when it saves.

`hidden_defaults` belongs only to this vault registry and stores hidden default-vault paths. It is not a sidebar-visibility setting; settings loading removes a misplaced `hidden_defaults` key from app-level `settings.json` while preserving unrelated unknown keys for forward compatibility.

### Vault Config

Per-vault UI settings stored locally per vault path (currently in browser/Tauri localStorage, not synced via git):
- `zoom`: Float zoom level (0.8–1.5)
- `view_mode`: "all" | "editor-list" | "editor-only"
- `editor_mode`: "raw" | "preview" (persists across note switches and sessions)
- `note_layout`: "centered" | "left" (wide-screen note column alignment for rich and raw editors)
- `tag_colors`, `status_colors`: Custom color overrides
- `property_display_modes`: Property display preferences
- `inbox.noteListProperties`: Optional Inbox-only property chip override for the note list
- `allNotes.noteListProperties`: Optional All Notes-only property chip override for the note list
- `inbox.explicitOrganization`: When `false`, hide Inbox and the organized toggle so the vault behaves like a plain note collection
- `git_setup_preference`: `"never"` when the user has opted out of future automatic Git setup prompts for that vault

### Getting Started Vault

On first launch, `useOnboarding` checks if the default vault exists. If not, it shows `WelcomeScreen` with three options:
- **Create a new vault** → creates an empty git repo in a folder the user chooses
- **Open an existing folder** → system file picker; plain Markdown folders without `.git` open immediately in supported non-git mode
- **Get started with a template** → pick a parent folder, then call `create_getting_started_vault()` with the derived `.../Getting Started` child path so the cloned vault opens into the populated repo root immediately

If the selected vault disappears after startup, `useVaultLoader` re-checks `check_vault_exists` when reloads or vault-derived surfaces fail. A confirmed missing path clears cached entries, folders, views, modified-file state, and prefetched note content, then `App` reuses the `vault-missing` `WelcomeScreen` state so note and view actions cannot keep targeting the stale active vault.

When an opened folder is not yet a git repo, Tolaria can show a Git setup dialog with Initialize, Not now, and Never for this vault actions. The Never choice stores a local per-vault `git_setup_preference` so the automatic dialog does not return for that vault, while manual initialization remains reachable from Git commands when global Git features are enabled. Markdown scanning, note browsing, note editing, and search continue normally in plain folders. Git-dependent surfaces (history, changes, commit, sync, conflict resolution, remotes, AutoGit, and auto-sync) stay unavailable until the user explicitly initializes Git.

When the user enables Git later, `init_git_repo` runs `git init`, ensures Tolaria's default `.gitignore`, stages the vault, and writes the initial `Initial vault setup` commit. Before app-managed setup, remote-connection, manual/automatic, and conflict-resolution commits, Tolaria ensures Git can resolve an author identity without overriding one the user configured: it heals the legacy repo-local `vault@tolaria.md` email earlier versions wrote, respects identities resolvable from local, global, or system scope, skips the legacy email wherever it resolves, and only when nothing resolves writes a repo-local `Tolaria <vault@tolaria.default>` fallback. That app-managed setup commit explicitly disables commit signing for the single command so inherited global or local `commit.gpgsign` preferences cannot strand onboarding when GPG is missing or misconfigured. Later `git_commit` calls honor the user's signing configuration first, then retry the same app-managed commit once with `commit.gpgsign=false` only when Git reports a signing-helper failure, so working GPG/SSH signing setups continue to sign while broken GPG setups do not create repeated opaque commit failures.

Once a vault is ready, `useAiAgentsOnboarding` can show a one-time `AiAgentsOnboardingPrompt`. That prompt reads `useAiAgentsStatus` so first launch surfaces whether Claude Code, Codex, GitHub Copilot, OpenCode, Pi, Antigravity, Kiro, and Hermes Agent CLI are installed, offers per-agent install links when they are missing, and stores local dismissal so the prompt does not repeat on every launch.

`useGettingStartedClone` reuses the same parent-folder semantics for the status-bar / command-palette clone action, and `Toast` is rendered through the AI-agents onboarding gate so the resolved destination path stays visible right after a successful clone.

The starter content no longer lives in the app repo. `src-tauri/src/vault/getting_started.rs` holds the public starter repo URL (`refactoringhq/tolaria-getting-started`), delegates the clone to the git backend, then normalizes Tolaria-managed root guidance and type scaffolding (`AGENTS.md`, `CLAUDE.md`, `type.md`, `note.md`) so fresh starter vaults pick up the current defaults even when the remote starter repo still carries a legacy copy or an older pre-`type:` `is_a`-era template. `AGENTS.md` stays the canonical vault guidance file; `CLAUDE.md` is a compatibility shim that imports it for Claude Code without duplicating the instructions, and Tolaria seeds it as an organized `Note` so it stays out of the way in a fresh vault. Optional `GEMINI.md` guidance is created only by the explicit AI guidance restore action. Once a user edits a usable `AGENTS.md`, including changing its frontmatter `type`, the status command treats it as custom guidance instead of broken; repair remains reserved for missing, empty, frontmatter-only, unreadable, or exact replaceable managed templates/stubs. The clone helper still accepts the legacy `LAPUTA_GETTING_STARTED_REPO_URL` environment override so older automation can continue to redirect the starter source during the transition.

After the clone completes, Tolaria removes every configured git remote from the new starter vault. Getting Started vaults therefore open as local-only by default, and users opt into a remote later with the explicit Add Remote flow.

### Remote Clone & Auth Model

Tolaria no longer implements provider-specific OAuth or remote-repository APIs. All remote git work goes through the user's existing system git configuration. Git subprocesses first honor an installation-local `git_path` in `settings.json` when it points at an existing executable. On macOS, they then prefer the user's login-shell `git` and `PATH`, fall back to standard Apple/Homebrew locations such as `/opt/homebrew/bin/git`, `/usr/local/bin/git`, and `/usr/bin/git`, and only then use the inherited `PATH`. This keeps Homebrew/Xcode Git, Git Credential Manager, and `git-credential-osxkeychain` resolving the same way they do in Terminal even when Tolaria is launched from Finder, Dock, or Homebrew Cask. Settings mounts the Git provider controls eagerly, so its native Git and WSL availability probes also use the shared hidden-process launcher; opening Settings on Windows therefore cannot flash a transient console window.

**Flow:**
1. User opens `CloneVaultModal` from onboarding or the vault menu
2. User pastes a supported remote URL (`https://`, `http://`, `ssh://`, or `git@host:path`) and chooses a local destination
3. The `clone_git_repo()` Tauri command validates that URL, then runs `git clone -- <url> <destination>` inside a blocking Tokio task so the Tauri window stays responsive during slow or failing clones
4. Linux AppImage builds strip AppImage loader variables from system-git and MCP Node subprocesses before spawning them, keeping `git-remote-https` and system `node` on the host library stack
5. `git_push()` / `git_pull()` continue to use the same system git path
6. On macOS, `git_add_remote()` asks Git's credential helper for HTTPS credentials before the first fetch so Keychain can grant access to the same saved credential item the shell uses
7. Every app-managed git subprocess disables the `ext::` transport, keeps file transport at Git's user-initiated policy, disables repo-configured fsmonitor hooks, ignores repo-configured SSH command overrides, and preserves quoted path output
8. Clone commands disable interactive terminal / askpass prompts and surface the git failure back to the UI instead of freezing the app waiting for input

**Auth model:**
- SSH keys, Git Credential Manager, macOS Keychain helpers, `gh auth`, and other git helpers all work without app-specific setup
- No provider tokens are stored in Tolaria settings
- The same flow works for GitHub, GitLab, Bitbucket, Gitea, and self-hosted remotes over HTTPS or SSH

## Pulse View

`PulseView` is a git activity feed that replaces the NoteList when the Pulse filter is selected.

- Groups commits by day ("Today", "Yesterday", or full date)
- Shows commit message, short hash, timestamp, and changed files
- Files have status icons (added/modified/deleted) and are clickable to open in editor
- Links to GitHub commits when `githubUrl` is available
- Infinite scroll pagination (20 commits per page) via Intersection Observer

Backend: `get_vault_pulse` Tauri command parses `git log` with `--name-status`.

## Data Flow

### Startup Sequence

```mermaid
sequenceDiagram
    participant T as Tauri (Rust)
    participant A as App.tsx
    participant VL as useVaultLoader
    participant MCP as MCP Server
    participant U as User

    T->>T: apply Linux WebKit env safeguards<br/>(Wayland/AppImage)
    T->>T: start background legacy vault housekeeping<br/>(does not block setup)
    T->>MCP: start background initial ws-bridge sync<br/>(if active vault exists)
    T->>A: App mounts

    A->>A: useOnboarding — vault exists?
    alt Vault missing
        A-->>U: WelcomeScreen
    else Vault found
        A->>VL: useVaultLoader fires
        VL->>T: invoke('reload_vault') → allow requested vault roots in asset scope + scan_vault_cached()
        T-->>VL: VaultEntry[]
        VL->>T: invoke('get_modified_files')
        alt Runtime vault path disappears
            VL->>T: invoke('check_vault_exists')
            VL-->>A: unavailable vault path + cleared stale state
            A-->>U: WelcomeScreen (vault missing)
        end
        A->>T: useMcpStatus — check explicit MCP setup state
        A->>T: sync_mcp_bridge_vault(selected path)
        VL-->>A: entries ready
    end

    U->>A: clicks note in NoteList
    A->>T: invoke('get_note_content')
    T-->>A: raw markdown
    A->>A: resolveBlocksForTarget(path, raw markdown)
    alt tab cache or parsed-block cache hit
        A->>A: reuse exact-source BlockNote blocks
    else large common Markdown
        A->>A: direct Markdown-to-block parser
    else unsupported Markdown or cold small note
        A->>A: tryParseMarkdownToBlocks()
    end
    A->>A: inject wikilinks, math, and durable schema blocks
    A-->>U: Editor renders note
```

### Auto-Save Flow

```mermaid
flowchart LR
    A["✏️ Editor content changes"] --> B["useEditorSave\n(debounced)"]
    B --> C["restore durable Markdown tokens"]
    C --> D["direct block Markdown serializer\nor BlockNote fallback"]
    D --> E["invoke('save_note_content')"]
    E --> F["💾 Disk write"]
    F --> G["Update tab status indicator"]
```

### Git Sync Flow

```mermaid
flowchart TD
    AS["useAutoSync\n(configurable interval)"] --> PULL["invoke('git_pull')"]
    PULL --> PC{Result?}
    PC -->|Conflicts| CM["ConflictResolverModal\nor ConflictNoteBanner"]
    PC -->|Fast-forward| RV["reload vault + folders/views"]
    RV --> TAB{"clean active tab?"}
    TAB -->|Yes| RT["replace active tab\nwith fresh disk content"]
    TAB -->|No| DONE["idle"]
    RT --> RF["restore editor focus\nwhen previously focused"]
    RF --> DONE
    PC -->|Manual up to date| RV
    PC -->|Auto up to date| DONE["idle"]

    MAN["Manual commit\n(CommitDialog)"] --> RS["useGitRemoteStatus\n(commit-time check)"]
    RS --> RCHK["invoke('git_remote_status')"]
    RCHK --> RMODE{Remote configured?}
    RMODE -->|No| GC["invoke('git_commit', message)"]
    GC --> LOCAL["Local commit only\nNo remote chip + local toast"]
    RMODE -->|Yes| GC2["invoke('git_commit', message)"]
    GC2 --> GP["invoke('git_push')"]
    GP --> PR{Push result?}
    PR -->|ok| RM["Reload modified files"]
    PR -->|rejected| DIV["syncStatus = pull_required"]
    DIV -->|User clicks badge| PAP["pullAndPush()"]
    PAP --> PULL2["invoke('git_pull')"]
    PULL2 --> GP2["invoke('git_push')"]
    GP2 --> RM

    CMD["Cmd+K → Pull\nor Menu → Pull"] --> PULL
    STATUS["Click sync badge"] --> POPUP["GitStatusPopup\n(branch, upstream, ahead/behind)"]
```

Manual Sync resolves the current branch's configured upstream and pulls that remote/branch explicitly, so non-`main` vault branches and local branches that track differently named remote branches follow normal Git tracking configuration instead of assuming `origin/main`. Missing upstreams and detached HEAD states return actionable sync errors while leaving branch creation, checkout, and tracking setup to external Git tooling. Manual Sync still forces a visible-state refresh even when `git_pull` reports `up_to_date`, because the working tree may have already changed through another process while the app still holds stale vault and History state. Updated pulls refresh the vault index, folders, saved views, clean active-editor content, and Git history surfaces; manual up-to-date pulls refresh the vault/sidebar surfaces with unknown changed files and bump the History refresh key without showing a "Pulled 0 updates" toast. Automatic mount/focus/interval up-to-date checks stay cheap and do not reload the vault.

`useGitRemoteStatus` re-checks `git_remote_status` for the default repository, and `useCommitFlow` can resolve remote status for an explicit selected repository when the commit dialog opens and again right before submit. Internally, `useCommitFlow` composes focused state, dialog, checkpoint, and generated-message hooks while preserving one public commit-flow API. If `hasRemote` is false, Tolaria keeps that repository's flow local-only: the status bar shows a neutral `No remote` chip for the default repository, the dialog copy switches from "Commit & Push" to "Commit", and no `git_push` call is attempted.

Unknown thrown values are normalized through `src/utils/vaultErrors.ts`. Its shared message extractor handles native `Error` objects, strings, bridge objects with a string `message`, and explicit caller fallbacks; domain guards keep ownership of their marker strings while reusing that extraction boundary.

The manual commit dialog can also draft an editable commit message before submit. `useCommitFlow.generateCommitMessageForDialog()` saves pending edits, reloads the selected repository with `get_modified_files(includeStats: true)`, and fills the textarea without invoking `git_commit`. When the active AI target is a configured direct model and AI features are enabled, Tolaria sends bounded path/status/line-count metadata plus bounded `get_file_diff` excerpts so the model can produce semantic summaries instead of filename-only labels; agent targets, unavailable/offline AI, large omitted paths, and model failures fall back to the deterministic changed-file summary. The command palette action "Generate Commit Message from Diff" opens the same dialog and focuses the generated message field for keyboard editing.

If the current vault is not a Git repository, Tolaria treats Git as unavailable instead of degraded. With global Git features enabled, the status bar replaces changes, commit, sync, remote, conflict, and history controls with a `Git disabled` warning that reopens Git setup unless the user has chosen not to be prompted automatically for that vault. Command registration follows the same state: only `Initialize Git for Current Vault` is available in the Git group, while pull, commit, changes, conflict, and remote commands are hidden. `useAutoSync` is disabled for non-git vaults so the app does not run background Git commands against plain folders.

The installation-local `git_enabled` setting is a broader visibility switch. When it is `false`, Tolaria hides Git status-bar entries and Git command-palette actions completely, disables AutoGit controls in Settings, and prevents background Git refresh/sync work even for repositories that are otherwise Git-backed. Settings remains the re-enable path.

The same local-only state enables the explicit Add Remote flow. `AddRemoteModal` is reachable from the `No remote` chip and the command palette. The backend `git_add_remote` command validates the pasted remote URL, ensures the local author identity, adds `origin`, fetches it, refuses incompatible histories, and only enables tracking after a safe push or fast-forward-compatible check succeeds.

`useCommitFlow` also exposes `runAutomaticCheckpoint()`, a dialog-free commit path shared by AutoGit and the bottom-bar Commit button. `useAutoGit` watches the last editor activity plus app focus/visibility state, and when the default vault is git-backed, all saves are flushed, and no unsaved edits remain, it checkpoints after the configured idle or inactive thresholds. AutoGit normally uses the deterministic `Updated N note(s)` / `Updated N file(s)` commit message path; the installation-local `autogit_use_ai_commit_messages` setting opts automatic checkpoints into the same bounded AI draft path as the manual dialog, falling back to deterministic labels whenever AI is unavailable. In multiple-workspace mode, that checkpoint reads, commits, and pushes every active repository independently; one failed or rejected repository does not prevent the remaining repositories from being attempted. The manual commit dialog remains single-repository and requires the user to choose the target repository when more than one is active.

#### Sync States

| State | Indicator | Color | Trigger |
|-------|-----------|-------|---------|
| `idle` | Synced / Synced Xm ago | green | Successful sync |
| `syncing` | Syncing... | blue | Pull/push in progress |
| `pull_required` | Pull required | orange | Push rejected (divergence) |
| `conflict` | Conflict | orange | Merge conflicts detected |
| `error` | Sync failed | grey | Network/auth error |

## Vault Module Structure

The vault backend (`src-tauri/src/vault/`) is split into focused submodules:

| File | Purpose |
|------|---------|
| `mod.rs` | Core types (`VaultEntry`, `Frontmatter`), `parse_md_file`, `scan_vault`, relationship/link extraction |
| `parsing.rs` | Text processing: snippet extraction, markdown stripping, ISO date parsing, `extract_title` (H1 → legacy frontmatter → filename), `slug_to_title` |
| `title_sync.rs` | Legacy filename → `title` frontmatter sync helper; no longer used by the normal note-open flow |
| `cache.rs` | Git-based incremental vault caching (`scan_vault_cached`), git helpers |
| `ignored.rs` | Gitignored-content visibility filtering via batched, pipe-safe `git check-ignore` |
| `filename_rules.rs` | Cross-platform validation for note filenames, folder names, and custom view filenames |
| `rename.rs` | `rename_note` / `rename_note_filename` / `move_note_to_folder` — stage crash-safe file moves, update `title` frontmatter when needed, recover unfinished rename transactions, and report backlink rewrite failures |
| `image.rs` | `save_image` / `copy_image_to_vault` — save editor image attachments with sanitized filenames and a shared unique attachment-path owner |
| `attachment_rename.rs` | Portable, collision-safe attachment moves and vault-wide Markdown reference rewrites |
| `attachment_cleanup.rs` | Vault-wide reference scan before removing an unreferenced attachment, plus temp-folder backup and restore |
| `remote_image.rs` | Public-network-only remote image download with redirect, MIME, timeout, and 15 MiB size enforcement |
| `migration.rs` | `flatten_vault`, `vault_health_check`, `migrate_is_a_to_type` |
| `config_seed.rs` | Maintains vault AI guidance (`AGENTS.md`, `CLAUDE.md`, and optional `GEMINI.md` shims), migrates legacy `config/agents.md`, and repairs missing root type scaffolding such as `type.md` and `note.md` |
| `getting_started.rs` | Clones and normalizes the public Getting Started starter vault |

## Rust Backend Modules

| Module | Purpose |
|--------|---------|
| `vault/` | Vault scanning, caching, parsing, rename, image, migration |
| `frontmatter/` | YAML frontmatter read/write (`mod.rs`, `yaml.rs`, `ops.rs`) |
| `git/` | Git operations and shared system-git helpers (`command.rs`, `remote_config.rs`, `commit.rs`, `status.rs`, `history.rs`, `conflict.rs`, `remote.rs`, `pulse.rs`, `clone.rs`, `connect.rs`) |
| `search.rs` | Keyword search — walkdir-based vault file scan with Gitignored-content visibility filtering |
| `ai_agents.rs` | CLI-agent request normalization and adapter dispatch |
| `cli_agent_runtime.rs` | Shared CLI-agent request, prompt, subprocess, version, and MCP path helpers |
| `claude_cli.rs`, `codex_cli.rs`, `copilot_cli.rs`, `opencode_cli.rs`, `pi_cli.rs`, `antigravity_cli.rs` | CLI-agent command/config/event adapters |
| `pi_cli.rs`, `pi_config.rs`, `pi_discovery.rs`, `pi_events.rs` | Pi subprocess launch, user-config-seeded transient MCP adapter config, discovery, and JSON stream parsing |
| `mcp.rs` | MCP server spawning + explicit config registration/removal |
| `commands/` | Tauri command handlers (split into submodules) |
| `settings.rs` | App settings persistence |
| `vault_config.rs` | Per-vault UI config |
| `vault_list.rs` | Vault list persistence |
| `menu.rs` | Native desktop menu definitions and command IDs (not mounted on Linux) |

## Tauri IPC Commands

### Vault Operations

| Command | Description |
|---------|-------------|
| `list_vault` | Scan vault (cached), then apply Gitignored-content visibility → `Vec<VaultEntry>` |
| `read_vault_snapshot` | Return a valid provisional cache without Git/file reconciliation; returns no snapshot when Gitignored hiding requires authoritative filtering |
| `get_note_content` | Read note file content |
| `save_note_content` | Write note content to disk |
| `delete_note` | Permanently delete note from disk (with confirm dialog) |
| `rename_note` | Crash-safe note rename + `title` frontmatter update + cross-vault wikilinks + failed backlink counts |
| `move_note_to_folder` | Crash-safe folder move that preserves the filename, reloads the moved note, and rewrites path-based wikilinks |
| `create_vault_folder` | Create a folder relative to the active vault root |
| `list_vault_folders` | Build the folder tree on the blocking Tokio pool, then apply Gitignored-content visibility → `Vec<FolderNode>` |
| `rename_vault_folder` | Rename a folder relative to the active vault root and return old/new relative paths |
| `delete_vault_folder` | Permanently delete a folder subtree relative to the active vault root |
| `sync_note_title` | Legacy helper: rewrite `title` frontmatter from filename → `bool` (modified); not used by the normal note-open flow |
| `batch_archive_notes` | Archive multiple notes |
| `batch_delete_notes` | Permanently delete notes from disk |
| `reload_vault` | Allow the requested vault roots in the runtime asset scope, invalidate cache, full rescan from filesystem, then apply Gitignored-content visibility → `Vec<VaultEntry>` |
| `reload_vault_entry` | Re-read a single file from disk → `VaultEntry` |
| `open_vault_file_external` | Validate an existing file against the active vault boundary, then open it with the system default app |
| `start_vault_watcher` / `stop_vault_watcher` | Start or stop native active-vault filesystem change events |
| `check_vault_exists` | Check if vault path exists |
| `create_empty_vault` | Create a git-backed vault, then seed root `AGENTS.md`, `CLAUDE.md`, `type.md`, and `note.md` defaults |
| `create_getting_started_vault` | Clone the public Getting Started vault, refresh Tolaria-managed guidance/config defaults, and keep the cloned repo clean |
| `get_vault_ai_guidance_status` | Report whether `AGENTS.md`, `CLAUDE.md`, and optional `GEMINI.md` guidance are managed, missing, broken, or custom |
| `restore_vault_ai_guidance` | Restore any missing/broken Tolaria-managed guidance files without overwriting custom ones |

### Frontmatter

| Command | Description |
|---------|-------------|
| `update_frontmatter` | Update a frontmatter property |
| `delete_frontmatter_property` | Remove a frontmatter property |

### Git

| Command | Description |
|---------|-------------|
| `init_git_repo` | Initialize a local repo, add default `.gitignore`, and create the unsigned setup commit |
| `git_commit` | Stage all + commit |
| `git_pull` | Pull from remote |
| `git_push` | Push to remote |
| `git_remote_status` | Get branch name + ahead/behind counts |
| `git_file_url` | Build a remote-backed browser/git URL for a vault file |
| `git_add_remote` | Connect a local-only vault to a compatible remote and start tracking it |
| `git_resolve_conflict` | Resolve a merge conflict |
| `git_commit_conflict_resolution` | Commit conflict resolution |
| `get_file_history` | Last N commits for a file |
| `get_modified_files` | `git status` filtered to .md |
| `get_file_diff` | Unified diff for a file |
| `get_file_diff_at_commit` | Diff at a specific commit |
| `get_conflict_files` | List conflicted files |
| `get_conflict_mode` | Get conflict resolution mode |
| `get_vault_pulse` | Git activity feed (paginated) |
| `get_last_commit_info` | Latest commit metadata |
| `clone_repo` | Clone a remote repository into a local folder using system git |

### Vault Search Commands

| Command | Description |
|---------|-------------|
| `search_vault` | Keyword search across vault files |

### Vault Maintenance

| Command | Description |
|---------|-------------|
| `get_vault_settings` | Read `.laputa/settings.json` |
| `save_vault_settings` | Write vault settings |
| `repair_vault` | Flatten vault structure, migrate legacy frontmatter, restore root config/type defaults including `note.md` |

### AI & MCP

| Command | Description |
|---------|-------------|
| `stream_claude_chat` | Claude CLI chat mode (streaming) |
| `check_claude_cli` | Check if Claude CLI is available |
| `get_ai_agents_status` | Check Claude Code + Codex + GitHub Copilot + OpenCode + Pi + Antigravity + Kiro + Hermes Agent availability |
| `get_ai_agent_model_catalog` | Discover verified per-agent model capabilities; failures degrade to agent defaults |
| `get_agent_docs_path` | Resolve the bundled local Tolaria docs folder used in AI-agent system prompts |
| `stream_ai_agent` | Stream Claude Code, Codex, GitHub Copilot, OpenCode, Pi, Antigravity, Kiro, or Hermes Agent through the normalized agent event layer |
| `abort_ai_agent_stream` | Stop an active app-managed CLI agent stream by its validated request-scoped event name |
| `register_mcp_tools` | Register vault-neutral MCP in Claude/Antigravity/Cursor/OpenCode/generic config |
| `remove_mcp_tools` | Remove Tolaria's MCP entry from Claude/Antigravity/Cursor/OpenCode/generic config |
| `check_mcp_status` | Check whether Tolaria's durable MCP entry is registered in Claude/Antigravity/Cursor/OpenCode/generic config |
| `get_mcp_config_snippet` | Return the exact manual MCP JSON snippet for the active vault |
| `copy_text_to_clipboard` | Copy text through the native desktop clipboard path; macOS forces a UTF-8 locale for `pbcopy` so non-ASCII paths and snippets survive GUI launches |
| `read_text_from_clipboard` | Read current desktop clipboard text for command-driven plain-text paste; macOS forces the matching UTF-8 `pbpaste` locale |
| `sync_mcp_bridge_vault` | Sync the desktop WebSocket bridge process to the selected vault, or stop it when no vault is selected |

The desktop MCP WebSocket bridge is intentionally local-only. `mcp-server/ws-bridge.js` binds both bridge ports to loopback, rejects non-loopback clients, accepts browser/Tauri origins only on the UI bridge, and rejects browser-origin requests on the tool bridge so remote pages cannot drive vault tools directly.

### Settings & Config

| Command | Description |
|---------|-------------|
| `get_settings` | Load app settings |
| `save_settings` | Save app settings |
| `load_vault_list` | Load vault list |
| `save_vault_list` | Save vault list |
| `get_vault_config` | Load per-vault UI config |
| `save_vault_config` | Save per-vault UI config |
| `get_default_vault_path` | Get default vault path |
| `get_build_number` | Get app build number |
| `save_image` | Save base64 image to `attachments/` and ensure the vault root is in the runtime asset scope |
| `copy_image_to_vault` | Copy image file to `attachments/` and ensure the vault root is in the runtime asset scope |
| `rename_attachment` | Rename an existing global attachment and update every matching visible Markdown reference |
| `remove_unreferenced_attachment` | Move a vault-relative `attachments/...` file to a temp backup when no visible vault file still references it |
| `restore_removed_attachment` | Move a backed-up attachment back to its vault-relative path when a note references it again |
| `download_remote_image_to_vault` | Download a public HTTP(S) raster image on the blocking pool, validate every redirect and response, then save it under `attachments/` |
| `update_menu_state` | Update native menu checkmarks and enabled/disabled state for selection-dependent actions |
| `trigger_menu_command` | Emit a native menu command ID for deterministic shortcut QA |
| `update_current_window_min_size` | Update the active Tauri window's minimum size and optionally grow it to fit restored panes |

`get_build_number` feeds the bottom status bar label. It preserves legacy `bNNN` date-build labels, renders local `0.1.0` / `0.0.0` builds as `dev`, formats calendar alpha builds as `Alpha YYYY.M.D.N`, strips any calendar `-stable.N` suffix back to `YYYY.M.D`, and keeps legacy semver releases readable instead of falling back to `?`.

## Mock Layer

When running outside Tauri (browser at `localhost:5173`), `src/mock-tauri.ts` provides a transparent mock layer:

```typescript
if (isTauri()) {
  result = await invoke<T>('command_name', { args })
} else {
  result = await mockInvoke<T>('command_name', { args })
}
```

The mock layer includes sample entries across all entity types, full markdown content with realistic frontmatter, mock git history, mock AI responses, and mock pulse commits. It also tracks per-vault remote state so browser-mode Getting Started and empty-vault flows now behave like the desktop app: local-only until `git_add_remote` succeeds.

The optional Vite dev vault API is implemented in `scripts/vault-api-plugin.ts` (HTTP route table), `scripts/vault-api-commands.ts` (command dispatch, mutations, and shared wikilink updates), and `scripts/vault-api-data.ts` (filesystem reads, frontmatter parsing, and search). `vite.config.ts` only installs the plugin. `pnpm test:dev-mock` checks the HTTP contract against temporary vaults; it also runs as part of `pnpm test`. These modules are development middleware and are not bundled into the app.

Browser smoke tests can also override `window.__mockHandlers` before the app boots. The AutoGit smoke bridge uses that path directly for seeded saves so the mocked git dirty-state stays synchronized even when the optional browser vault API is serving note content.

### VaultBackend seam and the web target

`src/lib/vaultBackend/` defines `VaultBackend`, the storage seam a remote vault plugs into (ADR 0185). It has two paths: `files` (list, read, write with a base revision, rename, delete, search, attachments) and `collab` (`openDoc(path)` returning the live document an editor binds to; `null` on desktop and in the mock). `createCommandVaultBackend` implements the file path over both the Tauri `invoke` and `mockInvoke`, absorbing their argument differences. `createVaultBackend(vaultPath?)` (`src/lib/vaultBackend/index.ts`) is the only place that picks Tauri, remote or mock: note content reads (`noteContentCache`, `useNoteRename`'s `loadNoteContent`) and the browser's property edits (`frontmatterOps`) go through its `files` (TOL-218). Without a vault path, desktop reads send none and Rust finds the note's registered vault. Title and filename renames go through it too (TOL-22), and so do moves to another folder (`files.rename({ path, folderPath })`) and folder renames (`files.renameFolder`, TOL-227): on the desktop they are still `move_note_to_folder` and `rename_vault_folder` with the same payloads; on a Tolaria remote a move is `POST /v1/rename` with `rewriteLinks` and a folder rename is `POST /v1/folders/rename` (protocol 1.7), each one commit with the links rewritten. The remote's `chrome.listFolders` builds the folder tree from the tracked files (`packages/collab-client/src/remoteFolders.ts`), hiding dot folders and `type/` like the desktop. Creating and deleting a folder go through it as well (`files.createFolder`, `files.deleteFolder`, TOL-233): `create_vault_folder` and `delete_vault_folder` with the same payloads on the desktop, `POST /v1/folders` and `POST /v1/folders/delete` (protocol 1.8) on a remote, one commit each. Git keeps no empty folder, so the server gives a new folder an empty `.keep` file; the remote's entry list leaves dot files out, as the desktop's scan does. Another tab of the same remote follows a folder create or delete without a reload: `src/lib/remoteFolderChanges.ts` tells it over a `BroadcastChannel`, and `useFolderActions` reloads the folder tree or closes the deleted folder's notes. File and folder names Windows cannot hold are refused on the web with the desktop's messages (`src/utils/portableName.ts`, the port of `filename_rules.rs`). Other callers still use direct `isTauri()` branches (workspace moves, `validate_note_content`, the desktop frontmatter commands); they migrate incrementally.

`apps/web/` is the Tolaria Web build target. `pnpm build:web` builds the same `index.html` and `src/` into `apps/web/dist` with no Tauri runtime, and `pnpm preview:web` serves it on loopback. Until the remote backend exists it runs on this mock layer. `pnpm build` and the Tauri bundle are unaffected. See `docs/web/s1-tauri-inventory.md` for the command inventory, migration path and server surface.

### Tolaria remote (`apps/server`, `packages/protocol`)

`apps/server` is the Tolaria remote: a Node service that owns a git working clone of one vault and serves the versioned file protocol in `docs/web/protocol.md` (ADR 0186). Each save is one commit between a pull and a push; a write based on an outdated revision becomes a conflict copy. `packages/protocol` holds the wire types the server and the web client share. Both are plain directories of the root package, like `apps/web`: the shell does not import them, `pnpm build` only typechecks them, and the desktop bundle and the lockfile are unchanged. `pnpm test:server` runs their tests against real git repositories in temporary directories. Each account (the token) has a request token bucket and caps on open websockets, per account and per document, enforced in process (ADR 0292, "Limits" in the protocol). Sharing is enforced here too (ADR 0296, protocol 1.9): a front end that holds the token sends signed, short-lived access tickets instead, each giving one user `viewer`, `editor` or `owner` on the vault or on single notes; every route checks or filters by them, the websocket admits and closes by them, and `POST /v1/access/revocations` cuts a user's open connections. Since protocol 1.10 a ticket may carry its user's git identity, and the commits a collaborator's changes cause, REST or live, name them in `Co-authored-by` trailers; the owner's commits are unchanged (ADR 0297). Share records and the API that manages them live in the private front end (`tolaria-cloud`), which only speaks this protocol. The server runs with `pnpm run server`, which bundles the entry point first because it shares the markdown pipeline in `src/`.

### Collaboration (`packages/markdown-yjs`, `apps/server/src/collab`, `packages/collab-client`)

A note can be co-edited as a Y.Doc while its markdown file stays canonical (ADR 0187, `docs/web/s4-spike-report.md`). `packages/markdown-yjs` converts between markdown and the `tolaria.blocknote/1` document with the editor's own parse and serialize steps on an unmounted BlockNote editor. `apps/server/src/collab` serves one room per `docId` on `/v1/collab/docs/<docId>` (y-protocols over `ws`), flushes edited documents to the vault on a cadence, and reconciles commits pulled from git into live documents: changes on other lines merge, and a change to the same lines leaves the document's edits in the note and commits the incoming version as a conflict copy named in `meta.conflictCopy` (ADR 0290). The web shell shows that copy in `ConflictCopyNotice` next to the sync pill, reloads the note list through the `tolaria:vault-entries-stale` event (`src/lib/vaultEntriesStale.ts`), and marks conflict copies with `ConflictCopyBadge`. `packages/collab-client` holds the websocket provider and the `remote` `VaultBackend`; `apps/web/src/collab` is the collaborative note page of the web build (`apps/web/collab.html`). In the shell, the web build with a remote server (`perNoteEditors`) binds the rich editor to the note's live document: `Editor` opens it through `useCollabEditorBinding` (`src/components/collabEditorBinding.ts`), shows nothing until the first sync, then creates a new BlockNote editor bound to the shared fragment. While a note is bound, the tab-swap content load and `onContentChange` saves are switched off, so the document is the only writer and the server flushes it to the file. Raw mode on a bound note opens on the live document and writes its edits back into it (`src/components/useLiveRawContentSource.ts`, `src/lib/liveNoteMarkdown.ts`), so raw edits take the same path to the file. Sheets, binary files, desktop and the mock browser build keep the markdown path. On remote web builds the shell's git status UI is hidden (`platformCapabilities.git`), because git runs on the server. Notes are created, renamed and deleted on the server too (`src/lib/remoteNotes.ts`): a new note gets a vault-relative path and is written with `If-None-Match: *`, so a note another device created at the same path first is kept and this one opens as its conflict copy; the remote backend's `openDoc` waits for a create still in flight. A bound editor reports its first H1 through `src/lib/liveNoteTitle.ts`, `useAppSave` schedules the same debounced untitled rename as the desktop, and the remote backend renames through `POST /v1/rename` to the desktop's `<slug>.md`, `<slug>-2.md`, … candidates. Title and filename renames from the UI (`useNoteRename`) take the same path through `createVaultBackend(...).files.rename`. The server makes each rename one commit that also rewrites the wikilinks to the note in every other note, as `rename.rs` does, and patches the live documents of those notes in place (ADR 0289, `apps/server/src/renameTransaction.ts`, `apps/server/src/collab/liveLinks.ts`). The open live document follows the rename (the server keeps its `docId`), and the bound editor is keyed by its document, so the editor, caret and focus survive the rename. Deletes go through `DELETE /v1/files` at the revision just read. Everyone in the open live note shows as an avatar in the note's breadcrumb bar and as a named caret in the editor (ADR 0291): each window announces itself by browser and device through the document's awareness, withdraws while offline, and drops peers that stop renewing their state, so a window that leaves is gone from the others within about 5 s.

Properties edits on the web are frontmatter transactions (TOL-203). `runFrontmatterAndApply` sends them to `editRemoteFrontmatter` when a Tolaria remote serves the vault: the active, bound note gets the edit as a minimal change to its document's `frontmatter` Y.Text, which merges with concurrent body edits and reaches the file on the server's next flush; any other note is read, edited and written back through `/v1/files` with `If-Match`. Both paths compute the new frontmatter with `src/lib/frontmatterText`, a port of the desktop's `update_frontmatter_content` checked against shared golden fixtures, so a property edited on the web changes the same lines, with the same bytes, as on the desktop.

Offline read on the web (ADR 0282): the web build ships `service-worker.js`, registered after first paint and only with a remote server. It serves the shell from a versioned cache, and serves `GET /v1/entries` and `GET /v1/files/*` network-first with a fallback to a cache of the account that sent them, keyed by a hash of the server and the credential. With the network gone, the app opens the last vault from the ADR 0281 snapshot and these caches. The editors are read-only, vault writes and property edits are refused before any local change, no live document is opened, and the sync pill reads "Offline · read-only". Signing out or deleting the account clears every cache. Desktop builds never register the worker, and the `offlineRead` capability is false there.

URL routing on the web (ADR 0284): the web build keeps its location in the query of `/`, as `/?vault=<slug>&note=<vault-relative path>&view=<view file>`. `useActiveNoteLocation` reads the opening URL once; its note wins over the last open note in `useLastActiveNote`, so it opens at the same moment, after the cached entries and never before first paint. `useWebRouting` then replaces the opening history entry with the restored location, pushes one entry per note or saved view opened, and on `popstate` opens what the URL names without pushing again. A query rather than a path keeps every route on the service worker's one cached shell. Desktop builds, including the browser dev build, and note windows never route.

Phone layout on the web (ADR 0286): at `(max-width: 640px)` the web build shows one pane, the note list or the note. `usePhoneNoteStack` (inside `useActiveNoteLocation`) holds which and marks `<html>` with `data-phone-pane` before the first paint; `App.css` hides the other pane with `visibility: hidden` so it stays mounted. While the list is shown `useWebRouting` routes no note, so opening a note pushes its URL and browser back, or the in-app back control, returns to the list. The back bar (`PhoneNoteBackBar`, rendered by `LazyEditor`) and the note list's opener read the stack from `phoneNoteStackStore`; the back bar calls `history.back()` when the entry beneath is the list. `useKeyboardAwareViewport` sizes the shell to `visualViewport` through CSS variables and scrolls the caret back above the on-screen keyboard. Wider layouts and the desktop app are untouched.

Tablet layout on the web (ADR 0287): at `(min-width: 641px) and (max-width: 1366px) and (pointer: coarse)` the web build shows the note list and the note. `useTabletSidebar` (inside `useAppWindowControls`) keeps the sidebar collapsed until a view mode asks for it, for the session only, and marks `<html>` with `data-tablet-layout`; in portrait `App.css` floats the open sidebar over the list and a tap beside it closes it. In the web build `findShortcutCommandIdForEvent` and `getAppCommandShortcutDisplay` go through `webShortcuts`: browser-owned shortcuts are left to the browser and new note, quick open and the view modes move to ⌥⌘ (Ctrl+Alt elsewhere).

Touch input on the web (ADR 0288): `main.tsx` calls `installTouchInput` (`src/lib/touchInput.ts`) for the web build before the first render. While the primary pointer is coarse it marks `<html>` with `data-touch-input`, from which `App.css` sizes key targets to 44 px, and it turns a touch long press in the sidebar or the note list into a `contextmenu` event at the finger, so the existing right-click menus open unchanged. `EditorLayout` shows `TouchEmptyState` instead of the keyboard hints when `useTouchInput` is true.

Sharing on the web (ADR 0298, TOL-237): the owner shares from the note bar's Share button (`ShareNoteButton`, next to the presence avatars) or from "Share my vault" in the status bar. Both open `ShareDialog`, which invites by email or GitHub username as "Can edit" or "Can view", to the note or the whole vault, and lists the people with access, with their role and a revoke. The status bar's sharing entry (`SharingStatusButton`) opens "Shared with me" (`SharedWithMeDialog`). It says the role in a shared vault, and shows `AccessRevokedDialog` when the share is taken away. Share records come from the hosted front end's `/api/shares*` (`src/lib/sharing/sharesApi.ts`), read shortly after startup into `sharingStore`. Without that API nothing is shown. A shared vault opens at `/vaults/<id>/`: `remoteVaultConfig()` adds the prefix to the remote's base URL, and the entries snapshot is keyed per vault. `vaultAccess` reads `GET /v1/vault` `access` there and keeps the vault read only until it is known. It then drives the read-only editor, `SharedReadOnlyBanner`, the read tickets of `useCollabDocument` and `assertVaultWritable`. A live document refused with `4403` or a 401/403/404 ticket stops (`CollabProvider` `onDenied`) and makes the shell re-read its access.

```mermaid
flowchart LR
  B1[Browser: BlockNote + CollabProvider] <-->|sync, awareness| R[Room per docId]
  B2[Browser] <--> R
  R -->|flush: source-preserving markdown| V[Vault: pull, commit, push]
  V -->|onChange: reconcile| R
  V <--> G[(git remote)]
  D[Desktop app] <--> G
  R --> S[(BlobStore: snapshots)]
```

## State Management

No Redux or global context. State lives in the root `App.tsx` and custom hooks:

| State owner | State | Purpose |
|-------------|-------|---------|
| `App.tsx` | `selection`, panel widths, dialog visibility, toast, view mode | UI state |
| `useVaultLoader` | `entries`, `allContent`, `modifiedFiles` | Vault data |
| `useNoteActions` | `tabs`, `activeTabPath` | Composes `useNoteCreation` + `useNoteRename` + `frontmatterOps` |
| `useNoteWindowLifecycle` | note-window open/title side effects | Opens `tauri://` note windows without full vault scans and keeps the native title current |
| `useVaultRefreshHandlers` | pull/watcher vault refresh callbacks | Routes pulled and watcher-changed paths through `refreshPulledVaultState()` in the main window and `refreshNoteWindowVaultChanges()` in note windows, comparing the active tab with disk first |
| `useStartupScreenState` | startup visibility booleans | Keeps onboarding, telemetry-consent, missing-vault, and initial indexing decisions out of `App.tsx` |
| `useAppWindowControls` | view mode, panel visibility, command refs, zoom/build labels | Keeps main-window sizing and editor command ref plumbing out of `App.tsx` |
| `useAppViewActions` | saved-view/type creation and saved-view mutation callbacks | Keeps saved-view persistence and Type auto-creation orchestration out of `App.tsx` |
| `useAiWorkspacePublishedContext` | AI workspace note-list snapshot and BroadcastChannel context publishing | Coalesces editor bursts with a cancellable 300 ms publication delay |
| `useMcpSetupDialogController` | MCP setup dialog state/actions | Keeps MCP status, manual config, and connect/disconnect dialog flow out of `App.tsx` |
| `useAiWorkspaceWindowBridgeEvents` | native AI workspace event subscriptions | Owns Tauri listener setup/cleanup for popped-out workspace window bridge events |
| `useGitFileWorkflows` | git diff/history/discard callbacks | Resolves note-scoped repository paths and owns deleted-file preview and queued diff side effects |
| `useVaultRenameDetection` | detected rename banner state | Detects external Git renames on focus and owns the wikilink update callback |
| `useNoteCreation` | — | Note/type creation with optimistic persistence |
| `useNoteRename` | — | Note renaming and folder moves with wikilink update |
| `useNoteRetargeting` | — | Shared note retargeting logic for drag/drop and command-palette actions |
| `useSidebarNoteDropTargets` | — | Delegated sidebar hover and drop routing for note-to-Type and note-to-Folder retargeting |
| `useDeepLinks` | Deep-link listener and copy actions | Resolves `tolaria://` links into known vault navigation and clipboard URLs |
| `useTauriDragDropEvent` | — | Shared native window drag/drop event subscription and cleanup |
| `useNativePathDrop` | — | Tauri-native file/folder path drops for AI and command text inputs |
| `frontmatterOps` | — (pure functions) | Frontmatter CRUD: key→VaultEntry mapping, mock/Tauri dispatch |
| `useTabManagement` | Navigation history, note switching | Note navigation lifecycle |
| `useVaultSwitcher` | `vaultPath`, `extraVaults` | Vault switching |
| `useTheme` | Editor theme CSS vars and theme-mode bridge | Editor typography and app theme runtime |
| `useCliAiAgent` | `messages`, `status`, tool actions | Selected AI agent conversation backed by the shared session pipeline and vault permission mode |
| `useAutoSync` | Sync interval, pull/push state | Git auto-sync |
| `useAutoGit` | Last activity timestamp, idle/inactive checkpoint triggers | Automatic commit/push checkpoints |
| `useCommitFlow` | Commit dialog state, generated commit-message drafts, shared manual/automatic checkpoint runner | Git commit/push orchestration |
| `useGitRemoteStatus` | `remoteStatus`, `refreshRemoteStatus()` | On-demand remote detection for commit UI |
| `useUnifiedSearch` | Query, results, loading state | Keyword search |
| `useSettings` | App settings (telemetry, release channel, theme mode, UI language, date display format, auto-sync interval, Git visibility, AutoGit thresholds, default AI agent, Gitignored-content visibility, All Notes file visibility) | Persistent settings |
| `useVaultConfig` | Per-vault UI preferences, Git setup prompt preference, AI permission mode | Vault-specific config |
| `appCommandDispatcher` | Manifest-backed shortcut/menu command IDs | Shared execution path for renderer and native menu commands |

Data flows unidirectionally: `App` passes data and callbacks as props to child components. No child-to-child communication — everything goes through `App`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Open command palette |
| Cmd+P / Cmd+O | Open quick open palette |
| Cmd+N | Create new note |
| Cmd+S | Save current note |
| Cmd+F | Find in current note when the editor is focused; otherwise note-list search can claim it |
| Cmd+Shift+F | Find in vault |
| Cmd+Shift+V | Paste without Formatting into the active supported editing surface |
| Cmd+Shift+M | Toggle Markdown highlight on selected rich-editor text |
| Cmd+[ / Cmd+] | Navigate back / forward (replaces tabs) |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Cmd+1–9 | Switch to tab N |
| Cmd+[ / Cmd+] | Navigate back / forward |
| `[[` in editor | Open wikilink suggestion menu |

`QuickOpenPalette` mounts its stateful content only while the palette is open. Closing it therefore removes keyboard and backdrop listeners, while reopening creates a fresh query, selection, and focus lifecycle without effect-driven state resets.

Selection-dependent actions are wired through the command palette and the native menus. For example, a deleted file opened from Changes view becomes a read-only diff preview, and that state enables the "Restore Deleted Note" menu/command while normal note mutation actions stay disabled. Folder selection follows the same pattern: when `selection.kind === 'folder'`, the command palette exposes "Reveal Folder in Finder", "Copy Folder Path", "Rename Folder", and "Delete Folder", and the sidebar row can launch the same flows directly through inline rename or the folder context menu. Active files also expose "Reveal in Finder" and "Copy File Path" through the command palette; reveal calls `reveal_path_in_file_manager`, which preserves file selection and opens Windows directories directly so nested folders can be shown without shell-selection errors. Non-Markdown file tabs additionally expose "Open in Default App", matching the `FilePreview` header controls. Markdown notes expose "Export note as PDF" from Cmd+K, the native Note menu, the breadcrumb overflow menu, and the note-list context menu, all routed through the same editor export hook. Remote-backed notes expose "Copy git URL" from the breadcrumb overflow and note-list context menu; the renderer gates the action per note workspace via `git_remote_status`, then asks `git_file_url` to build the copied URL from the primary remote, current branch, and vault-relative path. Active notes now follow the same shared-action model for retargeting: Cmd+K can open "Change Note Type…" and "Move Note to Folder…", and the sidebar drop targets call the same hook-backed implementations instead of maintaining separate mutation paths.

Shortcut routing is explicit:

- `src/shared/appCommandManifest.json` is the shared command/menu metadata source for command IDs, menu labels, accelerators, native-menu enablement groups, and deterministic QA flags
- `appCommandCatalog.ts` derives renderer command IDs, shortcut lookup maps, Linux menu sections, and QA metadata from that manifest
- `formatShortcutDisplay()` derives platform-accurate visible shortcut labels (`⌘` on macOS, `Ctrl` on Windows/Linux) from that same manifest so menus, tooltips, and command-palette copy stay aligned with real accelerators
- macOS shortcuts may declare exact `macosAlternateEvents` for layout-produced characters; this keeps the canonical native accelerator and label while allowing the renderer to recognize modifier chords such as Scandinavian `Cmd+Option+Shift+7` producing `\`
- `useAppKeyboard` is the primary execution path for real shortcut keypresses, including Tauri runs
- macOS browser-reserved chords such as `Cmd+O`, `Cmd+F`, and `Cmd+Shift+L` are unblocked at webview init via `tauri-plugin-prevent-default`, then continue through the same renderer-first command path
- `Cmd+Shift+V` uses the same command path for "Paste without Formatting"; `plainTextPaste.ts` reads text through the native clipboard command in Tauri and inserts it through the active rich/raw editor target or the focused browser text control
- `Cmd+F` is surface-aware: editor focus opens current-note find/replace in raw CodeMirror, note-list focus preserves note-list search, and native menu enablement follows focus availability events so only one `Cmd+F` menu item is active
- Rich-editor inline formatting and focused-block shortcuts that are owned by BlockNote or editor extensions stay local to the editor surface; `createMarkdownHighlightShortcutExtension()` handles Cmd/Ctrl+Shift+M and toggles the durable `==highlight==` style, while `createTodoBlockShortcutExtension()` handles Cmd/Ctrl+T paragraph/checklist toggles. These editor-local shortcuts do not enter the app-command manifest because they must not fire from sidebar, modal, or shell focus.
- `menu.rs`, `useMenuEvents`, and the custom titlebar `LinuxMenuButton` emit the same manifest-derived command IDs for native menu clicks, accelerators, and custom titlebar menu actions
- `appCommandDispatcher.ts` suppresses the paired native-menu/renderer echo from a single shortcut so the command runs once
- Deterministic QA uses two explicit proof paths from the shared manifest:
  - renderer shortcut-event proof through `window.__laputaTest.triggerShortcutCommand()`
  - native menu-command proof through `trigger_menu_command`
- The browser harness is only a deterministic desktop command bridge; exact native accelerator delivery still requires real Tauri QA for commands flagged as manual-native-critical

## Auto-Release & In-App Updates

### Release Pipeline

Every qualifying push to `main` triggers the `alpha-release` workflow in `.circleci/config.yml`:

A push does not qualify when its head commit only changes paths that never ship in the desktop app: `site/`, `.circleci/`, `.github/workflows/README.md`, and the Tolaria Web lane (`apps/`, `packages/`, `docs/web/`). `shouldSkipAlphaRelease` in `scripts/release-version.mjs` owns that list and emits `SKIP_RELEASE=true`, which halts every alpha build job.

```
push to main
  → version job: compute calendar alpha version YYYY.M.D-alpha.N
    and a GitHub-sorted tag alpha-vYYYY.M.D-alpha.NNNN
      → use today's UTC date unless the latest stable-vYYYY.M.D tag already uses today
      → if stable already uses today, advance alpha to the next calendar day so semver still increases
      → ignore future stable dates for normal numbering
      → if historical future tags poisoned semver ordering, publish one recovery bridge before
        returning the next qualifying main push to the real UTC calendar series; the bridge and
        corrected release are intentionally separate publications so updater ordering remains monotonic
  → four parameterized CircleCI build jobs fan out in parallel:
      → pnpm install, stamp version, pnpm build, tauri build --target aarch64-apple-darwin --bundles app
      → pnpm install, stamp version, pnpm build, tauri build --target x86_64-apple-darwin --bundles app
      → upload signed Apple Silicon and Intel .app.tar.gz + .sig updater artifacts named Tolaria_<version>_macOS_Silicon and Tolaria_<version>_macOS_Intel
      → pnpm install, stamp version
      → export the host-owned AppImage library exclusion policy
      → tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm,appimage
      → inspect the sealed AppImage library inventory and verify installer + updater-signature artifacts
      → upload .deb, .rpm, .AppImage, and signed Linux updater bundles
      → pnpm install, stamp version, optionally import the Windows code-signing certificate
      → tauri build --target x86_64-pc-windows-msvc --bundles nsis, with Authenticode signing config only when certificate secrets are present
      → verify Windows app executable and installer Authenticode signatures when Authenticode signing ran
      → upload NSIS installer, optional MSI artifacts, and signed Windows updater bundles
  → release job:
      → generate alpha-latest.json with darwin-aarch64, darwin-x86_64, Linux, and Windows updater URLs
      → publish GitHub prerelease alpha-vYYYY.M.D-alpha.NNNN named Tolaria Alpha YYYY.M.D.N
  → publish-main-docs job:
      → build the site with scripts/build-pages-site.sh: tolaria.md landing at /, VitePress docs, then the release pages and updater manifests, then verify-pages-site.sh
      → build static HTML release history page at /releases/
      → publish alpha/latest.json
      → refresh latest.json + latest-canary.json as compatibility aliases to alpha
      → preserve stable/latest.json
      → commit the generated site to `gh-pages` for GitHub's managed Pages deployment
```

Stable promotions trigger the `stable-release` workflow in `.circleci/config.yml`:

```
push vYYYY-MM-DD or stable-vYYYY.M.D tag
  → version job: validate the tag date and reject dates later than the current UTC day
  → four parameterized CircleCI build jobs fan out in parallel:
      → pnpm install, stamp version, pnpm build, tauri build --target aarch64-apple-darwin
      → pnpm install, stamp version, pnpm build, tauri build --target x86_64-apple-darwin
      → upload signed Apple Silicon and Intel .app.tar.gz + .sig and .dmg artifacts named Tolaria_<version>_macOS_Silicon and Tolaria_<version>_macOS_Intel
      → pnpm install, stamp version
      → export the host-owned AppImage library exclusion policy
      → tauri build --target x86_64-unknown-linux-gnu --bundles deb,rpm,appimage
      → inspect the sealed AppImage library inventory and verify installer + updater-signature artifacts
      → upload .deb, .rpm, .AppImage, and signed Linux updater bundles
      → pnpm install, stamp version, optionally import the Windows code-signing certificate
      → tauri build --target x86_64-pc-windows-msvc --bundles nsis, with Authenticode signing config only when certificate secrets are present
      → verify Windows app executable and installer Authenticode signatures when Authenticode signing ran
      → upload NSIS installer, optional MSI artifacts, and signed Windows updater bundles
  → release job:
      → generate stable-latest.json with macOS Apple Silicon, macOS Intel, Linux, and Windows updater URLs plus platform-specific manual download URLs
      → publish GitHub release Tolaria YYYY.M.D
  → publish-stable-docs job:
      → build the site with scripts/build-pages-site.sh: tolaria.md landing at /, VitePress docs, then the release pages and updater manifests, then verify-pages-site.sh
      → build static HTML release history page at /releases/
      → publish stable/latest.json
      → publish stable/download/ and download/ as permanent download pages that keep the browser page visible while the platform installer starts, default Linux visitors to AppImage, require an explicit Windows installer click with managed-device guidance, and expose RPM as a manual Linux option when the stable release includes one
      → preserve alpha/latest.json
      → commit the generated site to `gh-pages` for GitHub's managed Pages deployment
```

GitHub Pages is served from GitHub Actions deployments (`deploy-docs.yml` on docs/landing pushes and the `pages` job of `release.yml` after each Alpha). Every Pages publisher, including the CircleCI jobs above, builds through `scripts/build-pages-site.sh`, which lays the landing over the docs and runs `assemble-pages-site.sh` last so the updater manifests always win; `scripts/verify-pages-site.test.sh` fails if a publisher bypasses it.

Linux AppImage release jobs pin Tauri CLI 2.12.1 or newer so packaging uses the updated stock linuxdeploy and GTK plugins. `scripts/appimage-launcher-tools.mjs` owns the explicit host-library boundary: the CircleCI release job and the reusable GitHub Actions artifact workflow (`.github/workflows/release-build-artifacts.yml`) both export its linuxdeploy exclusion list for systemd/udev, D-Bus, Wayland, epoxy, and nghttp2 as `LINUXDEPLOY_EXCLUDED_LIBRARIES`, then run `validate-appimage-libraries`, which extracts every sealed AppImage and fails if any excluded family is present. The stricter `validate-appimages` command additionally requires the symlink-safe AppRun and fcitx payload that only the experimental output-plugin shim produces, so it is not a release gate for stock packaging. GTK and GLib remain bundled as one coherent application stack for older distributions. The experimental output-plugin shim remains available for local investigation, but release packaging does not pre-seed it because that path previously exited before sealing the AppImage. See [ADR-0184](./adr/0184-host-compatible-appimage-library-boundary.md).

### Versioning

- Stable promotions use git tags in the form `stable-vYYYY.M.D` and stamp the technical version `YYYY.M.D`.
- Alpha builds stamp the technical version `YYYY.M.D-alpha.N` and display it as `Alpha YYYY.M.D.N`. The GitHub release tag zero-pads the sequence as `alpha-vYYYY.M.D-alpha.NNNN` so GitHub release ordering remains chronological.
- If the latest stable tag already uses today's date, alpha advances to the next calendar day before assigning `-alpha.N` so Alpha remains semver-newer than Stable across channel switches.
- Stable tags dated after the current UTC day fail before builds start. If an older workflow already accepted one, alpha emits one future technical bridge with a current-date `.0` display label, then returns to the real calendar series on the following publication.
- The workflows stamp the computed version into `tauri.conf.json` and `Cargo.toml` at build time.
- This keeps display strings clean while preserving semver monotonicity when a user switches between Stable and Alpha.

### In-App Updates

```
App startup (3s delay)
  → useUpdater.check()
    → idle (no update) → no UI
    → available → UpdateBanner with release notes + "Update Now"
      → downloading → progress bar
        → ready → "Restart to apply" + Restart Now
    → network error → fail silently
```

Alpha metadata discovery follows GitHub publication time rather than the highest embedded calendar
version. This lets a corrected release supersede a future-dated recovery bridge. Normal updater
checks still require a semver increase; the only exception lets an installed calendar version
beyond tomorrow accept a candidate dated today or tomorrow, which is the bounded recovery path
defined by ADR-0173. The one-shot operator bridge `v2027-08-28` is permitted only on 2026-08-28,
and any installed `2027.*` calendar build can accept a `2026` candidate from `2026.8.19` through
tomorrow; this keeps the poisoned cohort recoverable without accepting older or arbitrarily
future-dated metadata.

### Telemetry (Opt-in)

Anonymous crash reporting (Sentry) and usage analytics (PostHog), both **opt-in only**.

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Settings
    participant Sentry
    participant PostHog

    Note over App: First launch or upgrade
    App->>User: TelemetryConsentDialog
    alt Accept
        User->>Settings: telemetry_consent=true, anonymous_id=UUID
        Settings->>Sentry: init(DSN, release, anonymous_id)
        Settings->>PostHog: init(key, anonymous_id)
    else Decline
        User->>Settings: telemetry_consent=false
        Note over Sentry,PostHog: Zero network requests
    end

    Note over App: Settings panel toggle change
    User->>Settings: crash_reporting_enabled=false
    Settings->>Sentry: teardown()
    Settings->>App: reinit_telemetry (Tauri cmd)
```

**Privacy guarantees:**
- No vault content, note titles, or file paths in payloads (regex scrubber in `beforeSend`)
- `anonymous_id` is a locally-generated UUID, never tied to identity
- `send_default_pii: false` on both SDKs
- PostHog: `autocapture: false`, `persistence: 'memory'`, no cookies
- Product events use categorical metadata only: file preview kind/action, AI agent id/permission mode/counts/status, update-check preference state, and All Notes visibility category/enabled state.

**Architecture:**
- **Rust:** `sentry` crate initialized in `lib.rs::setup()` via `telemetry::init_sentry_from_settings()`
- **JS:** `@sentry/react` + `posthog-js` initialized lazily by `useTelemetry` hook; the React root also wires `onCaughtError`, `onUncaughtError`, and `onRecoverableError` through `Sentry.reactErrorHandler()` so production React invariants include component stack context when crash reporting is enabled.
- **Release grouping:** packaged release workflows pass `VITE_SENTRY_RELEASE` from the computed build version, but the app only assigns Sentry's `release` field for stable calendar builds (`YYYY.M.D`). Alpha/prerelease/internal builds omit `release` so they do not create normal Sentry Releases entries, while both frontend and Rust Sentry scopes tag `tolaria.build_version` and `tolaria.release_kind` for diagnostics.
- **Settings:** `telemetry_consent`, `crash_reporting_enabled`, `analytics_enabled`, `anonymous_id` in `Settings` struct
- **Consent:** `TelemetryConsentDialog` shown when `telemetry_consent === null`

### Updates

Tolaria uses the Tauri updater plugin for automatic updates:

- `src-tauri/tauri.conf.json` points the default desktop feed at `stable/latest.json`
- `useUpdater(releaseChannel, automaticChecksEnabled)` waits 3 seconds after launch when automatic checks are enabled, then calls Rust commands instead of hard-coding one updater endpoint in the frontend
- `automatic_update_checks_enabled` is an installation-local Settings flag that defaults to enabled; disabling it skips only the startup/background probe, not manual status-bar update checks
- `src-tauri/src/app_updater.rs` maps the selected channel to `alpha/latest.json` or `stable/latest.json`
- `download_and_install_app_update` streams progress events back into `UpdateBanner`

### Feature Flags (PostHog + Release Channels)

Feature flags are backed by PostHog and evaluated per release channel:

- **Alpha**: all features always enabled (no PostHog lookup)
- **Stable** (default): PostHog rules decide which features are enabled
- **Beta cohorts**: modeled in PostHog as tags or person-property targeting, not as a separate updater build or Settings option

```typescript
import { useFeatureFlag } from './hooks/useFeatureFlag'

const enabled = useFeatureFlag('example_flag') // boolean
```

**Resolution order:**
1. `localStorage` override: key `ff_<name>` with value `"true"` or `"false"`
2. `isFeatureEnabled(flag)` in `telemetry.ts` → Alpha short-circuit, then PostHog, then hardcoded defaults

**How to add a new flag:**
1. Add the flag name to the `FeatureFlagName` union type in `src/hooks/useFeatureFlag.ts`
2. Create the flag on PostHog with Stable rollout rules and any optional beta-cohort targeting
3. Use `useFeatureFlag('your_flag')` in components

Release channel is selectable in Settings as `alpha` or `stable` and passed to PostHog as a person property via `identify()`. Beta targeting is managed in PostHog, not in the updater settings. See ADR-0057.

## Platform Support — iOS / iPadOS (Prototype)

Tauri v2 supports iOS as a beta target. The Rust backend cross-compiles to `aarch64-apple-ios-sim` (simulator) and `aarch64-apple-ios` (device) with zero code changes to vault/frontmatter/search logic.

**Conditional compilation strategy:**

```
#[cfg(desktop)]  — git CLI, menu bar, MCP server, CLI AI agents, updater
#[cfg(mobile)]   — stub commands returning graceful errors or empty results
```

Desktop-only modules gated at the crate level:
- `pub mod menu` — macOS menu bar (entire module)

Desktop-only features gated at the function level in `commands/`:
- Git operations (commit, pull, push, status, history, diff, conflicts)
- Clone-by-URL via system git (`clone_repo`)
- CLI AI agent streaming (Claude, Codex, GitHub Copilot, OpenCode, Pi, Antigravity, Kiro)
- MCP registration and status
- Menu state updates

Features that work on both platforms without changes:
- Vault scan, note read/write, rename, delete, archive
- Frontmatter read/write/delete
- AI chat (Anthropic API via `reqwest`)
- Search (pure Rust in-memory)
- Settings persistence
- Vault list management

**Capabilities:** `src-tauri/capabilities/default.json` targets desktop; `mobile.json` targets iOS/Android with a minimal permission set.

**Detailed feasibility report:** `docs/IPAD-PROTOTYPE.md`

### React 19 update-depth compatibility

The shared Radix primitives require `radix-ui` 1.6.1 or newer for stable composed refs in Slot, Popper, and overlay layers. Earlier versions detach and reattach state-setting refs during ordinary sidebar action rerenders, which can feed React update-depth loops. The virtualized note list requires `react-virtuoso` 4.18.5 or newer so React 19 uses `useSyncExternalStore` instead of the legacy state/layout-effect subscription. Keep these compatibility floors when updating dependencies. The trigger-ref regression and the real-Virtuoso title-update test complement the create/edit smoke flow; the general unit-test setup otherwise mocks Virtuoso.

Inline `/File` PDF attachments use `TolariaFileBlock` through `tolariaFileBlockSpec`, sharing `PdfFilePreview` with standalone file tabs. The BlockNote file wrapper retains upload, caption, and filename fallback controls; failed rendering emits `file_preview_failed` with only the PDF category. The existing file schema and external HTML/Markdown serialization stay unchanged. Image blocks keep their existing renderer. The durable Markdown preprocessing pipeline resolves portable attachment URLs against the active vault before rebuilding file blocks, so previews also load after an app restart.
