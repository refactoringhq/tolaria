# Getting Started

How to navigate the codebase, run the app, and find what you need.

## Prerequisites

- **Node.js** 18+ and **pnpm**
- **Rust** 1.77.2+ (for the Tauri backend)
- **git** CLI (required by the git integration features)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run in browser (no Rust needed — uses mock data)
pnpm dev
# Open http://localhost:5173

# Run with Tauri (full app, requires Rust)
pnpm tauri dev

# Run tests
pnpm test          # Vitest unit tests
cargo test         # Rust tests (from src-tauri/)
pnpm playwright:smoke  # Curated Playwright core smoke lane (~5 min)
pnpm playwright:regression  # Full Playwright regression suite
```

## Directory Structure

```
laputa-app/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point (renders <App />)
│   ├── App.tsx                   # Root component — orchestrates layout + state
│   ├── App.css                   # App shell layout styles
│   ├── types.ts                  # Shared TS types (VaultEntry, Settings, etc.)
│   ├── mock-tauri.ts             # Mock Tauri layer for browser testing
│   ├── theme.json                # Editor theme configuration
│   ├── index.css                 # Global CSS variables + Tailwind setup
│   │
│   ├── components/               # UI components (~98 files)
│   │   ├── Sidebar.tsx           # Left panel: filters + type groups
│   │   ├── SidebarParts.tsx      # Sidebar subcomponents
│   │   ├── NoteList.tsx          # Second panel: filtered note list
│   │   ├── NoteItem.tsx          # Individual note item
│   │   ├── PulseView.tsx         # Git activity feed (replaces NoteList)
│   │   ├── Editor.tsx            # Third panel: editor orchestration
│   │   ├── EditorContent.tsx     # Editor content area
│   │   ├── EditorRightPanel.tsx  # Right panel toggle
│   │   ├── editorSchema.tsx      # BlockNote schema + wikilink type
│   │   ├── RawEditorView.tsx     # CodeMirror raw editor
│   │   ├── Inspector.tsx         # Fourth panel: metadata + relationships
│   │   ├── DynamicPropertiesPanel.tsx  # Editable frontmatter properties
│   │   ├── AiPanel.tsx           # AI agent (Claude CLI subprocess)
│   │   ├── AiMessage.tsx         # Agent message display
│   │   ├── AiActionCard.tsx      # Agent tool action cards
│   │   ├── SearchPanel.tsx       # Search interface
│   │   ├── SettingsPanel.tsx     # App settings
│   │   ├── StatusBar.tsx         # Bottom bar: vault picker + sync
│   │   ├── CommandPalette.tsx    # Cmd+K command launcher
│   │   ├── BreadcrumbBar.tsx     # Breadcrumb + word count + actions
│   │   ├── WelcomeScreen.tsx     # Onboarding screen
│   │   ├── GitHubVaultModal.tsx  # GitHub vault clone/create
│   │   ├── GitHubDeviceFlow.tsx  # GitHub OAuth device flow
│   │   ├── TitleField.tsx         # Editable note title above editor
│   │   ├── ConflictResolverModal.tsx # Git conflict resolution
│   │   ├── CommitDialog.tsx      # Git commit modal
│   │   ├── CreateNoteDialog.tsx  # New note modal
│   │   ├── CreateTypeDialog.tsx  # New type modal
│   │   ├── UpdateBanner.tsx      # In-app update notification
│   │   ├── inspector/            # Inspector sub-panels
│   │   │   ├── BacklinksPanel.tsx
│   │   │   ├── RelationshipsPanel.tsx
│   │   │   ├── GitHistoryPanel.tsx
│   │   │   └── ...
│   │   └── ui/                   # shadcn/ui primitives
│   │       ├── button.tsx, dialog.tsx, input.tsx, ...
│   │
│   ├── hooks/                    # Custom React hooks (~87 files)
│   │   ├── useVaultLoader.ts     # Loads vault entries + content
│   │   ├── useVaultSwitcher.ts   # Multi-vault management
│   │   ├── useVaultConfig.ts     # Per-vault UI settings
│   │   ├── useNoteActions.ts     # Composes creation + rename + frontmatter
│   │   ├── useNoteCreation.ts   # Note/type/daily-note creation
│   │   ├── useNoteRename.ts     # Note renaming + wikilink updates
│   │   ├── useAiAgent.ts         # AI agent state + tool tracking
│   │   ├── useAiActivity.ts      # MCP UI bridge listener
│   │   ├── useAutoSync.ts        # Auto git pull/push
│   │   ├── useConflictResolver.ts # Git conflict handling
│   │   ├── useEditorSave.ts      # Auto-save with debounce
│   │   ├── useTheme.ts           # Flatten theme.json → CSS vars
│   │   ├── useUnifiedSearch.ts   # Keyword search
│   │   ├── useNoteSearch.ts      # Note search
│   │   ├── useCommandRegistry.ts # Command palette registry
│   │   ├── useAppCommands.ts     # App-level commands
│   │   ├── useAppKeyboard.ts     # Keyboard shortcuts
│   │   ├── useSettings.ts        # App settings
│   │   ├── useOnboarding.ts      # First-launch flow
│   │   ├── useCodeMirror.ts      # CodeMirror raw editor
│   │   ├── useMcpBridge.ts       # MCP WebSocket client
│   │   ├── useMcpStatus.ts       # MCP registration status
│   │   ├── useUpdater.ts         # In-app updates
│   │   └── ...
│   │
│   ├── utils/                    # Pure utility functions (~48 files)
│   │   ├── wikilinks.ts          # Wikilink preprocessing pipeline
│   │   ├── frontmatter.ts        # TypeScript YAML parser
│   │   ├── ai-agent.ts           # Agent stream utilities
│   │   ├── ai-chat.ts            # Token estimation utilities
│   │   ├── ai-context.ts         # Context snapshot builder
│   │   ├── noteListHelpers.ts    # Sorting, filtering, date formatting
│   │   ├── wikilink.ts           # Wikilink resolution
│   │   ├── configMigration.ts    # localStorage → vault config migration
│   │   ├── iconRegistry.ts       # Phosphor icon registry
│   │   ├── propertyTypes.ts      # Property type definitions
│   │   ├── vaultListStore.ts     # Vault list persistence
│   │   ├── vaultConfigStore.ts   # Vault config store
│   │   └── ...
│   │
│   ├── lib/
│   │   └── utils.ts              # Tailwind merge + cn() helper
│   │
│   └── test/
│       └── setup.ts              # Vitest test environment setup
│
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # Tauri app configuration
│   ├── capabilities/             # Tauri v2 security capabilities
│   ├── src/
│   │   ├── main.rs               # Entry point (calls lib::run())
│   │   ├── lib.rs                # Tauri setup + command registration (61 commands)
│   │   ├── commands/             # Tauri command handlers (split into modules)
│   │   ├── vault/                # Vault module
│   │   │   ├── mod.rs            # Core types, parse_md_file, scan_vault
│   │   │   ├── cache.rs          # Git-based incremental caching
│   │   │   ├── parsing.rs        # Text processing + title extraction
│   │   │   ├── rename.rs         # Rename + cross-vault wikilink update
│   │   │   ├── image.rs          # Image attachment saving
│   │   │   ├── migration.rs      # Frontmatter migration
│   │   │   └── getting_started.rs # Getting Started vault creation
│   │   ├── frontmatter/          # Frontmatter module
│   │   │   ├── mod.rs, yaml.rs, ops.rs
│   │   ├── git/                  # Git module
│   │   │   ├── mod.rs, commit.rs, status.rs, history.rs
│   │   │   ├── conflict.rs, remote.rs, pulse.rs
│   │   ├── github/               # GitHub module
│   │   │   ├── mod.rs, auth.rs, api.rs, clone.rs
│   │   ├── telemetry.rs          # Sentry init + path scrubber
│   │   ├── search.rs             # Keyword search (walkdir-based)
│   │   ├── claude_cli.rs         # Claude CLI subprocess management
│   │   ├── mcp.rs                # MCP server lifecycle + registration
│   │   ├── settings.rs           # App settings persistence
│   │   ├── vault_config.rs       # Per-vault UI config
│   │   ├── vault_list.rs         # Vault list persistence
│   │   └── menu.rs               # Native macOS menu bar
│   └── icons/                    # App icons
│
├── mcp-server/                   # MCP bridge (Node.js)
│   ├── index.js                  # MCP server entry (stdio, 14 tools)
│   ├── vault.js                  # Vault file operations
│   ├── ws-bridge.js              # WebSocket bridge (ports 9710, 9711)
│   ├── test.js                   # MCP server tests
│   └── package.json
│
├── e2e/                          # Playwright E2E tests (~26 specs)
├── tests/smoke/                  # Playwright specs (full regression + @smoke subset)
├── design/                       # Per-task design files
├── demo-vault-v2/                # Getting Started demo vault
├── scripts/                      # Build/utility scripts
│
├── package.json                  # Frontend dependencies + scripts
├── vite.config.ts                # Vite bundler config
├── tsconfig.json                 # TypeScript config
├── playwright.config.ts          # Full Playwright regression config
├── playwright.smoke.config.ts    # Curated pre-push Playwright config
├── ui-design.pen                 # Master design file
├── AGENTS.md                     # Shared project instructions for coding agents
├── CLAUDE.md                     # Claude Code compatibility shim importing AGENTS.md
└── docs/                         # This documentation
```

## Key Files to Know

### Start here

| File | Why it matters |
|------|---------------|
| `src/App.tsx` | Root component. Shows the 4-panel layout, state flow, and how all features connect. |
| `src/types.ts` | All shared TypeScript types. Read this first to understand the data model. |
| `src-tauri/src/commands/` | Tauri command handlers (split into modules). This is the frontend-backend API surface. |
| `src-tauri/src/lib.rs` | Tauri setup, command registration, startup tasks, WebSocket bridge lifecycle. |

### Data layer

| File | Why it matters |
|------|---------------|
| `src/hooks/useVaultLoader.ts` | How vault data is loaded and managed. The Tauri/mock branching pattern. |
| `src/hooks/useNoteActions.ts` | Orchestrates note operations: composes `useNoteCreation`, `useNoteRename`, frontmatter CRUD, and wikilink navigation. |
| `src/hooks/useVaultSwitcher.ts` | Multi-vault management, vault switching, Getting Started vault. |
| `src/mock-tauri.ts` | Mock data for browser testing. Shows the shape of all Tauri responses. |

### Backend

| File | Why it matters |
|------|---------------|
| `src-tauri/src/vault/mod.rs` | Vault scanning, frontmatter parsing, entity type inference, relationship extraction. |
| `src-tauri/src/vault/cache.rs` | Git-based incremental caching — how large vaults load fast. |
| `src-tauri/src/frontmatter/ops.rs` | YAML manipulation — how properties are updated/deleted in files. |
| `src-tauri/src/git/` | All git operations (commit, pull, push, conflicts, pulse). |
| `src-tauri/src/github/` | GitHub OAuth device flow + repo clone/create. |
| `src-tauri/src/search.rs` | Keyword search — scans vault files with walkdir. |
| `src-tauri/src/claude_cli.rs` | Claude CLI subprocess spawning + NDJSON stream parsing. |

### Editor

| File | Why it matters |
|------|---------------|
| `src/components/Editor.tsx` | BlockNote setup, breadcrumb bar, diff/raw toggle. |
| `src/components/editorSchema.tsx` | Custom wikilink inline content type definition. |
| `src/utils/wikilinks.ts` | Wikilink preprocessing pipeline (markdown ↔ BlockNote). |
| `src/components/RawEditorView.tsx` | CodeMirror 6 raw markdown editor. |

### AI

| File | Why it matters |
|------|---------------|
| `src/components/AiPanel.tsx` | AI agent panel — Claude CLI with tool execution, reasoning, actions. |
| `src/hooks/useAiAgent.ts` | Agent state: messages, streaming, tool tracking, file detection. |
| `src/utils/ai-context.ts` | Context snapshot builder for AI conversations. |

### Styling

| File | Why it matters |
|------|---------------|
| `src/index.css` | All CSS custom properties. The design token source of truth. |
| `src/theme.json` | Editor-specific theme (fonts, headings, lists, code blocks). |

### Settings & Config

| File | Why it matters |
|------|---------------|
| `src/hooks/useSettings.ts` | App settings (API keys, GitHub token, sync interval). |
| `src/hooks/useVaultConfig.ts` | Per-vault local UI preferences (zoom, view mode, colors, Inbox columns). |
| `src/components/SettingsPanel.tsx` | Settings UI including GitHub OAuth connection. |

## Architecture Patterns

### Tauri/Mock Branching

Every data-fetching operation checks `isTauri()` and branches:

```typescript
if (isTauri()) {
  result = await invoke<T>('command', { args })
} else {
  result = await mockInvoke<T>('command', { args })
}
```

This lives in `useVaultLoader.ts` and `useNoteActions.ts`. Components never call Tauri directly.

### Props-Down, Callbacks-Up

No global state management (no Redux, no Context). `App.tsx` owns the state and passes it down as props. Child-to-parent communication uses callback props (`onSelectNote`, etc.).

### Discriminated Unions for Selection State

```typescript
type SidebarSelection =
  | { kind: 'filter'; filter: SidebarFilter }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'entity'; entry: VaultEntry }
  | { kind: 'topic'; entry: VaultEntry }
```

### Command Registry

`useCommandRegistry` + `useAppCommands` build a centralized command registry. Commands are registered with labels, shortcuts, and handlers. The `CommandPalette` (Cmd+K) fuzzy-searches this registry. The native macOS menu bar also triggers commands via `useMenuEvents`.

Commands whose availability depends on the current note or Git state must also flow through `update_menu_state` so the native menu stays in sync with the command palette. The deleted-note restore action in Changes view is the reference example: the row opens a deleted diff preview, the command palette exposes "Restore Deleted Note", and the Note menu enables the same action only while that preview is active.

## Running Tests

```bash
# Unit tests (fast, no browser)
pnpm test

# Unit tests with coverage (must pass ≥70%)
pnpm test:coverage

# Rust tests
cargo test

# Rust coverage (must pass ≥85% line coverage)
cargo llvm-cov --manifest-path src-tauri/Cargo.toml --no-clean --fail-under-lines 85

# Playwright core smoke lane (requires dev server)
BASE_URL="http://localhost:5173" pnpm playwright:smoke

# Full Playwright regression suite
BASE_URL="http://localhost:5173" pnpm playwright:regression

# Single Playwright test
BASE_URL="http://localhost:5173" npx playwright test tests/smoke/<slug>.spec.ts
```

## Common Tasks

### Add a new Tauri command

1. Write the Rust function in the appropriate module (`vault/`, `git/`, etc.)
2. Add a command handler in `commands/`
3. Register it in the `generate_handler![]` macro in `lib.rs`
4. Call it from the frontend via `invoke()` in the appropriate hook
5. Add a mock handler in `mock-tauri.ts`

### Add a new component

1. Create `src/components/MyComponent.tsx`
2. If it needs vault data, receive it as props from the parent
3. Wire it into `App.tsx` or the relevant parent component
4. Add a test file `src/components/MyComponent.test.tsx`

### Add a new entity type

1. Create a type document: `type/mytype.md` with `type: Type` frontmatter (icon, color, order, etc.)
2. The sidebar section groups are auto-generated from type documents — no code change needed if `visible: true`
3. Update `CreateNoteDialog.tsx` type options if users should be able to create it from the dialog
4. Notes of this type are created at the vault root with `type: MyType` in frontmatter — no dedicated folder needed

### Add a command palette entry

1. Register the command in `useAppCommands.ts` via the command registry
2. Add a corresponding menu bar item in `menu.rs` for discoverability
3. If it has a keyboard shortcut, register it in `useAppKeyboard.ts`
4. If its enabled state depends on runtime selection (active note, deleted preview, Git status, etc.), thread that flag through `useMenuEvents.ts` and `update_menu_state` so the native menu enables/disables correctly

### Modify styling

1. **Global CSS variables**: Edit `src/index.css`
2. **Editor typography**: Edit `src/theme.json`

### Work with the AI agent

1. **Agent system prompt**: Edit `src/utils/ai-agent.ts` (inline system prompt string)
2. **Context building**: Edit `src/utils/ai-context.ts` for what data is sent to the agent
3. **Tool action display**: Edit `src/components/AiActionCard.tsx`
4. **Claude CLI arguments**: Edit `src-tauri/src/claude_cli.rs` (`run_agent_stream()`)
