# Architecture

Laputa is a personal knowledge and life management desktop app. It reads a vault of markdown files with YAML frontmatter and presents them in a four-panel UI inspired by Bear Notes.

## Design Principles

### Filesystem as the single source of truth

The vault is a folder of plain markdown files. The app never owns the data — it only reads and writes files. The cache, React state, and any in-memory representation are always derived from the filesystem and must be reconstructible by deleting them. When in doubt, the file on disk wins.

### Convention over configuration

Laputa is opinionated. Standard field names (`type:`, `status:`, `url:`, `Workspace:`, `Belongs to:`, `start_date:`, `end_date:`) have well-defined meanings and trigger specific UI behavior — without any setup. This is not convention *instead of* configuration: users can override defaults via config files in their vault (e.g. `config/relations.md`, `config/semantic-properties.md`). But the defaults work out of the box, and most users never need to touch them.

This principle directly serves AI-readability: the more structure comes from shared conventions rather than per-user custom configurations, the easier it is for an AI agent to understand and navigate the vault correctly — without needing bespoke instructions for every setup.

### Where to store state: vault vs. app settings

When deciding where to persist a piece of data, ask: **"Would the user want this to follow them across all their Laputa installations — other devices, future platforms (tablet, web)?"**

| Follows the vault | Stays with the installation |
|-------------------|-----------------------------|
| Type icon, type color | Editor zoom level |
| Pinned properties per type | API keys (OpenAI, Google) |
| Sidebar label overrides | GitHub token |
| Property display order | Window size / position |
| Any user-visible customization of how content is organized or displayed | Any machine-specific or credential-type setting |

**Rule:** If the information is about *how the content is structured or presented* and the user would expect it to be consistent wherever they open their vault, store it in the vault (frontmatter of the relevant note, using the `_field` underscore convention for system properties). If it's about *this specific installation of the app*, store it in `~/.config/com.laputa.app/settings.json` or localStorage.

Examples:
- ✅ Vault: `_pinned_properties` in a Type note (every device should show the same pinned properties)
- ✅ Vault: `_icon: shapes` in a Type note (icon is part of the type's identity)
- ✅ App settings: `zoom: 1.3` (machine-specific preference)

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
3. **No orphan state updates**: Never call `updateEntry()` before the corresponding `handleUpdateFrontmatter()` or `handleDeleteProperty()` has resolved. The three functions in `useEntryActions` (`handleCustomizeType`, `handleRenameSection`, `handleToggleTypeVisibility`) follow this rule — disk write first, then state update.
4. **Recovery via reload**: If state ever diverges from disk (crash, external edit, race condition), `Reload Vault` (Cmd+K → "Reload Vault") invalidates the cache and does a full filesystem rescan via the `reload_vault` Tauri command, replacing all React state. The `reload_vault_entry` command can re-read a single file.
5. **Cache is disposable**: The `reload_vault` command deletes the cache file before rescanning, guaranteeing fresh data. The cache never contains data that doesn't exist on the filesystem.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop shell | Tauri v2 | 2.10.0 |
| Frontend | React + TypeScript | React 19, TS 5.9 |
| Editor | BlockNote | 0.46.2 |
| Raw editor | CodeMirror 6 | - |
| Styling | Tailwind CSS v4 + CSS variables | 4.1.18 |
| UI primitives | Radix UI + shadcn/ui | - |
| Icons | Phosphor Icons + Lucide | - |
| Build | Vite | 7.3.1 |
| Backend language | Rust (edition 2021) | 1.77.2 |
| Frontmatter parsing | gray_matter | 0.2 |
| AI (agent panel) | Claude CLI subprocess (streaming NDJSON) | - |
| Search | Keyword (walkdir-based file scan) | - |
| MCP | @modelcontextprotocol/sdk | 1.0 |
| Tests | Vitest (unit), Playwright (E2E/smoke), cargo test (Rust) | - |
| Package manager | pnpm | - |

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
            IN["Inspector\n(metadata + relationships)"]
            AIP["AiPanel\n(Claude CLI agent + tools)"]
            SP["SearchPanel\n(keyword search)"]
            ST["StatusBar\n(vault picker + sync + version)"]
            CP["CommandPalette\n(Cmd+K launcher)"]

            App --> WS & SB & NL & ED & SP & ST & CP
            ED --> IN & AIP
        end

        subgraph RB["Rust Backend"]
            LIB["lib.rs → 64 Tauri commands"]
            VAULT["vault/"]
            FM["frontmatter/"]
            GIT["git/"]
            GH["github/"]
            SETTINGS["settings.rs"]
            SEARCH["search.rs"]
            CLI["claude_cli.rs"]
        end

        subgraph EXT["External Services"]
            CCLI["Claude CLI\n(agent subprocess)"]
            MCP["MCP Server\n(ws://9710, 9711)"]
            GHAPI["GitHub API\n(OAuth, repos, clone)"]
        end

        FE -->|"Tauri IPC"| RB
        FE -->|"Vite Proxy / WS"| EXT
    end

    style FE fill:#e8f4fd,stroke:#2196f3,color:#000
    style RB fill:#fff8e1,stroke:#ff9800,color:#000
    style EXT fill:#f3e5f5,stroke:#9c27b0,color:#000
```

## Four-Panel Layout

```
┌────────┬─────────────┬─────────────────────────┬────────────┐
│Sidebar │ Note List   │ Editor                  │ Inspector  │
│(250px) │ (300px)     │ (flex-1)                │ (280px)    │
│        │ OR          │                         │ OR         │
│ All    │ Pulse View  │ [Breadcrumb Bar]        │ AI Chat    │
│ Changes│             │                         │ OR         │
│ Pulse  │ [Search]    │ # My Note               │ AI Agent   │
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

- **Sidebar** (150-400px, resizable): Top-level filters (All Notes, Changes, Pulse) and collapsible type-based section groups. Each type can have a custom icon, color, sort, and visibility set via its type document in `type/`.
- **Note List / Pulse View** (200-500px, resizable): When a section group or filter is selected, shows filtered notes with snippets, modified dates, and status indicators. When Pulse filter is active, shows `PulseView` — a chronological git activity feed grouped by day.
- **Editor** (flex, fills remaining space): Single note open at a time (no tabs — see ADR-0003). Breadcrumb bar with word count, BlockNote rich text editor with wikilink support. Can toggle to diff view (modified files) or raw CodeMirror view. Decomposed into `Editor` (orchestrator), `EditorContent`, `EditorRightPanel`, `SingleEditorView`, with hooks `useDiffMode`, `useEditorFocus`, `useEditorSave`, `useRawMode`. Navigation history (Cmd+[/]) replaces tabs.
- **Inspector / AI Agent** (200-500px or 40px collapsed): Toggles between Inspector (frontmatter, relationships, instances, backlinks, git history) and AI Agent panel (Claude CLI subprocess with tool execution). The Sparkle icon in the breadcrumb bar toggles between them. When viewing a Type note, the Inspector shows an **Instances** section listing all notes of that type (sorted by modified_at desc, capped at 50).

Panels are separated by `ResizeHandle` components that support drag-to-resize.

## Multi-Window (Note Windows)

Notes can be opened in separate Tauri windows for focused editing. Secondary windows show only the editor panel (no sidebar, no note list).

**Triggers:**
- `Cmd+Shift+Click` on any note in the note list or sidebar
- `Cmd+K` → "Open in New Window" (command palette, requires active note)
- `Cmd+Shift+O` keyboard shortcut
- Note → "Open in New Window" menu bar item

**Architecture:**
- `openNoteInNewWindow()` (`src/utils/openNoteWindow.ts`) creates a new `WebviewWindow` via the Tauri v2 JS API with URL query params (`?window=note&path=...&vault=...&title=...`)
- `main.tsx` checks `isNoteWindow()` at boot to route between `App` (main window) and `NoteWindow` (secondary window)
- `NoteWindow` (`src/NoteWindow.tsx`) is a minimal shell that loads vault entries, fetches note content, applies the theme, and renders a single `Editor` instance
- Each window has its own auto-save via `useEditorSaveWithLinks` (same 500ms debounce, same Rust `save_note_content` command)
- Secondary windows are sized 800×700 with overlay title bar
- Capabilities config (`src-tauri/capabilities/default.json`) grants permissions to both `main` and `note-*` window labels

## AI System

### AI Agent (AiPanel)

Full agent mode — spawns Claude CLI as a subprocess with tool access and MCP vault integration.

1. **Frontend** (`AiPanel` + `useAiAgent` hook) — streaming UI with reasoning blocks, tool action cards, and response display
2. **Backend** (`claude_cli.rs`) — spawns `claude` binary with `--output-format stream-json`, parses NDJSON events
3. **MCP Integration** — passes vault MCP config via `--mcp-config` flag so the agent can search, read, and modify vault notes

#### Agent Event Flow

```mermaid
sequenceDiagram
    participant U as User (AiPanel)
    participant FE as useAiAgent (Frontend)
    participant R as claude_cli.rs (Rust)
    participant C as Claude CLI
    participant V as Vault (MCP)

    U->>FE: sendMessage(text, references)
    FE->>FE: buildContextSnapshot(activeNote, linkedNotes, openTabs)
    FE->>R: invoke('stream_claude_agent', {message, systemPrompt, vaultPath})
    R->>C: spawn claude -p <msg> --output-format stream-json --mcp-config <json>

    loop NDJSON stream
        C-->>R: Init | TextDelta | ThinkingDelta | ToolStart | ToolDone | Result | Done
        R-->>FE: emit("claude-agent-stream", event)
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

    C->>V: MCP tool calls (search_notes, read_note, edit_note…)
    V-->>C: tool results
```

#### File Operation Detection

When the agent writes or edits vault files, `useAiAgent` detects this from tool inputs (Write/Edit tool JSON) and calls `onFileCreated` or `onFileModified` callbacks to trigger vault reload.

### Context Building

The agent panel (`ai-context.ts`) builds a structured JSON snapshot from the active note and linked entries:

```json
{
  "activeNote": { "path", "title", "type", "frontmatter", "content" },
  "linkedNotes": [{ "path", "title", "content" }],
  "openTabs": [{ "title", "snippet" }],
  "vaultMetadata": { "noteTypes", "stats", "filter" },
  "references": [{ "title", "path", "type" }]
}
```

Token budget: 60% of 180k context limit (~108k tokens max). Active note gets priority, then linked notes, then truncation.

### Authentication

Claude CLI (agent mode) uses its own authentication — no API key configuration needed in Laputa.

## MCP Server

The MCP server (`mcp-server/`) exposes vault operations as tools for AI assistants (Claude Code, Cursor, or any MCP-compatible client).

### Tool Surface (14 tools)

| Tool | Params | Description |
|------|--------|-------------|
| `open_note` | `path` | Open and read a note by relative path |
| `read_note` | `path` | Read note content (alias for `open_note`) |
| `create_note` | `path, title, [type]` | Create new note with title and optional type frontmatter |
| `search_notes` | `query, [limit]` | Search notes by title or content substring |
| `append_to_note` | `path, text` | Append text to end of existing note |
| `edit_note_frontmatter` | `path, patch` | Merge key-value patch into YAML frontmatter |
| `delete_note` | `path` | Delete a note file from the vault |
| `link_notes` | `source_path, property, target_title` | Add a target to an array property in frontmatter |
| `list_notes` | `[type_filter], [sort]` | List all notes, optionally filtered by type |
| `vault_context` | — | Get vault summary: entity types + 20 recent notes + configFiles |
| `ui_open_note` | `path` | Open a note in the Laputa UI editor |
| `ui_open_tab` | `path` | Open a note in a new UI tab |
| `ui_highlight` | `element, [path]` | Highlight a UI element (editor, tab, properties, notelist) |
| `ui_set_filter` | `type` | Set the sidebar filter to a specific type |

### Transports

- **stdio** — standard MCP transport for Claude Code / Cursor (`node mcp-server/index.js`)
- **WebSocket** — live bridge for Laputa app integration:
  - Port **9710**: Tool bridge — AI/Claude clients call vault tools here
  - Port **9711**: UI bridge — Frontend listens for UI action broadcasts from MCP tools

### Auto-Registration

On app startup, Laputa automatically registers itself as an MCP server in:
- `~/.claude/mcp.json` (Claude Code)
- `~/.cursor/mcp.json` (Cursor)

Registration is non-destructive (additive, preserves other servers) and uses `upsert` semantics. The `useMcpStatus` hook tracks registration state (`checking | installed | not_installed | no_claude_cli`).

### Architecture

```mermaid
flowchart TD
    subgraph MCP["MCP Server (Node.js) — spawned by Tauri on startup"]
        IDX["index.js"]
        VAULT["vault.js\n(findMarkdownFiles, readNote, createNote,\nsearchNotes, appendToNote, editNoteFrontmatter,\ndeleteNote, linkNotes, listNotes, vaultContext)"]
        WSB["ws-bridge.js"]

        IDX -->|"stdio transport"| STDIO["Claude Code / Cursor"]
        IDX --> VAULT
        IDX --> WSB
        WSB -->|"port 9710 — tool bridge"| AI["AI Clients\n(Claude Code, external)"]
        WSB -->|"port 9711 — UI bridge"| FE["Frontend\n(useAiActivity)"]
    end

    TAURI["Tauri (mcp.rs)"] -->|"spawn on startup"| MCP
    TAURI -->|"auto-register"| CFG["~/.claude/mcp.json\n~/.cursor/mcp.json"]
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
| `spawn_ws_bridge(vault_path)` | Spawns `ws-bridge.js` as child process with VAULT_PATH env |
| `register_mcp(vault_path)` | Writes Laputa entry to Claude Code and Cursor MCP configs |
| `upsert_mcp_config(path, entry)` | Atomic config file update (create/merge, preserves others) |

The `WsBridgeChild` state wrapper in `lib.rs` ensures the bridge process is killed on app exit via `RunEvent::Exit` handler.

## Search

Search is keyword-based, using `walkdir` to scan all `.md` files in the vault directory. No external binary or indexing step required.

- Matches query against file titles and content (case-insensitive)
- Scores results: title matches ranked higher than content-only matches
- Extracts contextual snippets around the first match
- Skips hidden files

The `search_vault` Tauri command runs the scan in a blocking Tokio task and returns results sorted by relevance score.

## Vault Cache System

The vault cache (`src-tauri/src/vault/cache.rs`) accelerates vault scanning using git-based incremental updates.

### Cache File

`~/.laputa/cache/<vault-hash>.json` — stored outside the vault directory so it never pollutes the user's git repo. The vault path is hashed (via `DefaultHasher`) to produce a deterministic filename. Stores: vault path, git HEAD commit hash, all VaultEntry objects. Version: v5 (bumped on VaultEntry field changes to force full rescan). Writes are atomic (write to `.tmp` then rename). Legacy `.laputa-cache.json` files inside the vault are auto-migrated and deleted on first run.

### Three Cache Strategies

```mermaid
flowchart TD
    A([scan_vault_cached]) --> B{Cache exists\nand valid?}
    B -->|No / Corrupt| C["🔴 Full Scan\nwalkdir all .md files\n→ full parse"]
    B -->|Yes| D{Git HEAD\nmatches cache?}
    D -->|Same commit| E["🟢 Cache Hit\ngit status --porcelain\n→ re-parse only uncommitted changes"]
    D -->|Different commit| F["🟡 Incremental Update\ngit diff old..new --name-only\n→ selective re-parse of changed files"]

    C --> G[Write cache atomically\n.tmp → rename]
    E --> G
    F --> G
    G --> H([VaultEntry list ready])
```

## Styling

The app uses a single light theme with no user-configurable theming (see [ADR-0013](adr/0013-remove-theming-system.md)).

1. **Global CSS variables** (`src/index.css`): App-wide colors, borders, backgrounds. Bridged to Tailwind v4 via `@theme inline`.
2. **Editor theme** (`src/theme.json`): BlockNote-specific typography. Flattened to CSS vars by `useEditorTheme`.

## Vault Management

### Vault List

Persisted at `~/.config/com.laputa.app/vaults.json`:
```json
{
  "vaults": [{ "label": "My Vault", "path": "/path/to/vault" }],
  "active_vault": "/path/to/vault",
  "hidden_defaults": []
}
```

Managed by `useVaultSwitcher` hook. Switching vaults resets sidebar and clears the active note.

### Vault Config

Per-vault UI settings stored locally per vault path (currently in browser/Tauri localStorage, not synced via git):
- `zoom`: Float zoom level (0.8–1.5)
- `view_mode`: "all" | "editor-list" | "editor-only"
- `editor_mode`: "raw" | "preview" (persists across note switches and sessions)
- `tag_colors`, `status_colors`: Custom color overrides
- `property_display_modes`: Property display preferences
- `inbox.noteListProperties`: Optional Inbox-only property chip override for the note list

### Getting Started Vault

On first launch, `useOnboarding` checks if the default vault exists. If not, shows `WelcomeScreen` with two options:
- **Create Getting Started vault** → calls `create_getting_started_vault()` Tauri command
- **Open an existing folder** → system file picker

### GitHub OAuth Integration

Implements GitHub Device Authorization Flow for cloning/creating GitHub-backed vaults.

**Flow:**
1. User clicks "Login with GitHub" in Settings panel
2. `github_device_flow_start()` returns a user code + verification URL
3. User authorizes at `github.com/login/device`
4. App polls `github_device_flow_poll()` until authorized
5. Token stored in `~/.config/com.laputa.app/settings.json`

**Vault operations:**
- `GitHubVaultModal`: Clone existing repo or create new private/public repo
- `clone_repo()`: Clones with token-injected HTTPS URL
- Token persists for future git push/pull operations

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

    T->>T: run_startup_tasks()<br/>(register MCP)
    T->>MCP: spawn_ws_bridge() — ports 9710 + 9711
    T->>A: App mounts

    A->>A: useOnboarding — vault exists?
    alt Vault missing
        A-->>U: WelcomeScreen
    else Vault found
        A->>VL: useVaultLoader fires
        VL->>T: invoke('list_vault') → scan_vault_cached()
        T-->>VL: VaultEntry[]
        VL->>T: invoke('get_modified_files')
        VL->>T: useMcpStatus — register if needed
        VL-->>A: entries ready
    end

    U->>A: clicks note in NoteList
    A->>T: invoke('get_note_content')
    T-->>A: raw markdown
    A->>A: splitFrontmatter → [yaml, body]
    A->>A: preProcessWikilinks(body)
    A->>A: tryParseMarkdownToBlocks()
    A->>A: injectWikilinks(blocks)
    A-->>U: Editor renders note
```

### Auto-Save Flow

```mermaid
flowchart LR
    A["✏️ Editor content changes"] --> B["useEditorSave\n(debounced)"]
    B --> C["blocksToMarkdownLossy()"]
    C --> D["postProcessWikilinks()\n→ restore [[target]] syntax"]
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
    PC -->|Fast-forward| RV["reload vault"]
    PC -->|Up to date| DONE["idle"]

    MAN["Manual commit\n(CommitDialog)"] --> GC["invoke('git_commit', message)"]
    GC --> GP["invoke('git_push')"]
    GP --> PR{Push result?}
    PR -->|ok| RM["Reload modified files"]
    PR -->|rejected| DIV["syncStatus = pull_required"]
    DIV -->|User clicks badge| PAP["pullAndPush()"]
    PAP --> PULL2["invoke('git_pull')"]
    PULL2 --> GP2["invoke('git_push')"]
    GP2 --> RM

    CMD["Cmd+K → Pull\nor Menu → Pull"] --> PULL
    STATUS["Click sync badge"] --> POPUP["GitStatusPopup\n(branch, ahead/behind)"]
```

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
| `rename.rs` | `rename_note` — renames files, updates `title` frontmatter, and updates wikilinks across the vault |
| `image.rs` | `save_image` — saves base64-encoded attachments with sanitized filenames |
| `migration.rs` | `flatten_vault`, `vault_health_check`, `migrate_is_a_to_type` |
| `config_seed.rs` | Seeds `config/` folder, migrates `AGENTS.md`, repairs missing config files |
| `getting_started.rs` | Creates the Getting Started demo vault |

## Rust Backend Modules

| Module | Purpose |
|--------|---------|
| `vault/` | Vault scanning, caching, parsing, rename, image, migration |
| `frontmatter/` | YAML frontmatter read/write (`mod.rs`, `yaml.rs`, `ops.rs`) |
| `git/` | Git operations (`commit.rs`, `status.rs`, `history.rs`, `conflict.rs`, `remote.rs`, `pulse.rs`) |
| `github/` | GitHub OAuth + API (`auth.rs`, `api.rs`, `clone.rs`) |
| `search.rs` | Keyword search — walkdir-based vault file scan |
| `claude_cli.rs` | Claude CLI subprocess spawning + NDJSON stream parsing |
| `mcp.rs` | MCP server spawning + config registration |
| `commands/` | Tauri command handlers (split into submodules) |
| `settings.rs` | App settings persistence |
| `vault_config.rs` | Per-vault UI config |
| `vault_list.rs` | Vault list persistence |
| `menu.rs` | Native macOS menu bar |

## Tauri IPC Commands (65 total)

### Vault Operations

| Command | Description |
|---------|-------------|
| `list_vault` | Scan vault (cached) → `Vec<VaultEntry>` |
| `get_note_content` | Read note file content |
| `save_note_content` | Write note content to disk |
| `delete_note` | Permanently delete note from disk (with confirm dialog) |
| `rename_note` | Rename note + update `title` frontmatter + cross-vault wikilinks |
| `sync_note_title` | Legacy helper: rewrite `title` frontmatter from filename → `bool` (modified); not used by the normal note-open flow |
| `batch_archive_notes` | Archive multiple notes |
| `batch_delete_notes` | Permanently delete notes from disk |
| `reload_vault` | Invalidate cache and full rescan from filesystem → `Vec<VaultEntry>` |
| `reload_vault_entry` | Re-read a single file from disk → `VaultEntry` |
| `check_vault_exists` | Check if vault path exists |
| `create_getting_started_vault` | Bootstrap demo vault |

### Frontmatter

| Command | Description |
|---------|-------------|
| `update_frontmatter` | Update a frontmatter property |
| `delete_frontmatter_property` | Remove a frontmatter property |

### Git

| Command | Description |
|---------|-------------|
| `git_commit` | Stage all + commit |
| `git_pull` | Pull from remote |
| `git_push` | Push to remote |
| `git_remote_status` | Get branch name + ahead/behind counts |
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

### GitHub

| Command | Description |
|---------|-------------|
| `github_device_flow_start` | Begin OAuth device flow |
| `github_device_flow_poll` | Poll for authorization |
| `github_get_user` | Get authenticated user info |
| `github_list_repos` | List user's repos |
| `github_create_repo` | Create new repo |
| `clone_repo` | Clone repo with token auth |

### Search

| Command | Description |
|---------|-------------|
| `search_vault` | Keyword search across vault files |

### Vault Maintenance

| Command | Description |
|---------|-------------|
| `get_vault_settings` | Read `.laputa/settings.json` |
| `save_vault_settings` | Write vault settings |
| `repair_vault` | Flatten vault structure, migrate legacy frontmatter, restore config |

### AI & MCP

| Command | Description |
|---------|-------------|
| `stream_claude_chat` | Claude CLI chat mode (streaming) |
| `stream_claude_agent` | Claude CLI agent mode (streaming + tools) |
| `check_claude_cli` | Check if Claude CLI is available |
| `register_mcp_tools` | Register MCP in Claude/Cursor config |
| `check_mcp_status` | Check MCP registration state |

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
| `save_image` | Save base64 image to vault |
| `copy_image_to_vault` | Copy image file to vault |
| `update_menu_state` | Update native menu checkmarks and enabled/disabled state for selection-dependent actions |

## Mock Layer

When running outside Tauri (browser at `localhost:5173`), `src/mock-tauri.ts` provides a transparent mock layer:

```typescript
if (isTauri()) {
  result = await invoke<T>('command_name', { args })
} else {
  result = await mockInvoke<T>('command_name', { args })
}
```

The mock layer includes sample entries across all entity types, full markdown content with realistic frontmatter, mock git history, mock AI responses, and mock pulse commits.

## State Management

No Redux or global context. State lives in the root `App.tsx` and custom hooks:

| State owner | State | Purpose |
|-------------|-------|---------|
| `App.tsx` | `selection`, panel widths, dialog visibility, toast, view mode | UI state |
| `useVaultLoader` | `entries`, `allContent`, `modifiedFiles` | Vault data |
| `useNoteActions` | `tabs`, `activeTabPath` | Composes `useNoteCreation` + `useNoteRename` + `frontmatterOps` |
| `useNoteCreation` | — | Note/type/daily-note creation with optimistic persistence |
| `useNoteRename` | — | Note renaming with wikilink update |
| `frontmatterOps` | — (pure functions) | Frontmatter CRUD: key→VaultEntry mapping, mock/Tauri dispatch |
| `useTabManagement` | Navigation history, note switching | Note navigation lifecycle |
| `useVaultSwitcher` | `vaultPath`, `extraVaults` | Vault switching |
| `useTheme` | Editor theme CSS vars | Editor typography theme |
| `useAiAgent` | `messages`, `status`, tool actions | AI agent conversation |
| `useAutoSync` | Sync interval, pull/push state | Git auto-sync |
| `useUnifiedSearch` | Query, results, loading state | Keyword search |
| `useSettings` | App settings (API keys, GitHub token) | Persistent settings |
| `useVaultConfig` | Per-vault UI preferences | Vault-specific config |

Data flows unidirectionally: `App` passes data and callbacks as props to child components. No child-to-child communication — everything goes through `App`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Open command palette |
| Cmd+P | Open quick open palette |
| Cmd+N | Create new note |
| Cmd+S | Save current note |
| Cmd+[ / Cmd+] | Navigate back / forward (replaces tabs) |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Cmd+1–9 | Switch to tab N |
| Cmd+[ / Cmd+] | Navigate back / forward |
| `[[` in editor | Open wikilink suggestion menu |

Selection-dependent note actions are wired through both the command palette and the native Note menu. For example, a deleted file opened from Changes view becomes a read-only diff preview, and that state enables the "Restore Deleted Note" menu/command while normal note mutation actions stay disabled.

## Auto-Release & In-App Updates

### Release Pipeline

Every push to `main` triggers `.github/workflows/release.yml`:

```
push to main
  → version job: compute 0.YYYYMMDD.RUN_NUMBER
  → build job (matrix: aarch64 + x86_64):
      → pnpm install, stamp version, pnpm build, tauri build --target <arch>
      → upload .app, .tar.gz + .sig, .dmg as artifacts
  → release job:
      → download both arch artifacts
      → lipo aarch64 + x86_64 → universal binary
      → create universal .dmg + signed updater tarball
      → generate latest.json (per-arch + universal platform entries)
      → publish GitHub Release with all assets + auto-generated notes
  → pages job:
      → build static HTML release history page
      → deploy to gh-pages
```

### Versioning

Format: `0.YYYYMMDD.GITHUB_RUN_NUMBER` (e.g. `0.20260223.42`). Stamped into `tauri.conf.json` and `Cargo.toml` dynamically.

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
        Settings->>Sentry: init(DSN, anonymous_id)
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

**Architecture:**
- **Rust:** `sentry` crate initialized in `lib.rs::setup()` via `telemetry::init_sentry_from_settings()`
- **JS:** `@sentry/react` + `posthog-js` initialized lazily by `useTelemetry` hook
- **Settings:** `telemetry_consent`, `crash_reporting_enabled`, `analytics_enabled`, `anonymous_id` in `Settings` struct
- **Consent:** `TelemetryConsentDialog` shown when `telemetry_consent === null`

### Updates

Laputa uses the Tauri updater plugin for automatic updates:

- Builds from `main` branch are published as GitHub Releases
- `latest.json` is published to GitHub Pages for the updater plugin
- `useUpdater()` hook checks for updates automatically and supports download + install

### Feature Flags (PostHog + Release Channels)

Feature flags are backed by PostHog and evaluated per release channel:

- **Alpha**: all features always enabled (no PostHog lookup)
- **Beta**: sees features where the PostHog flag targets `release_channel = beta`
- **Stable** (default): sees features where the flag targets `release_channel = stable`

```typescript
import { useFeatureFlag } from './hooks/useFeatureFlag'

const enabled = useFeatureFlag('example_flag') // boolean
```

**Resolution order:**
1. `localStorage` override: key `ff_<name>` with value `"true"` or `"false"`
2. `isFeatureEnabled(flag)` in `telemetry.ts` → checks release channel, then PostHog, then hardcoded defaults

**How to add a new flag:**
1. Add the flag name to the `FeatureFlagName` union type in `src/hooks/useFeatureFlag.ts`
2. Create the flag on PostHog dashboard with rollout rules per channel
3. Use `useFeatureFlag('your_flag')` in components

Release channel is selectable in Settings (alpha / beta / stable) and passed to PostHog as a person property via `identify()`. See ADR-0042.

## Platform Support — iOS / iPadOS (Prototype)

Tauri v2 supports iOS as a beta target. The Rust backend cross-compiles to `aarch64-apple-ios-sim` (simulator) and `aarch64-apple-ios` (device) with zero code changes to vault/frontmatter/search logic.

**Conditional compilation strategy:**

```
#[cfg(desktop)]  — git CLI, menu bar, MCP server, Claude CLI, updater
#[cfg(mobile)]   — stub commands returning graceful errors or empty results
```

Desktop-only modules gated at the crate level:
- `pub mod menu` — macOS menu bar (entire module)

Desktop-only features gated at the function level in `commands/`:
- Git operations (commit, pull, push, status, history, diff, conflicts)
- GitHub operations (clone, list repos, device flow auth)
- Claude CLI streaming (check, chat, agent)
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
