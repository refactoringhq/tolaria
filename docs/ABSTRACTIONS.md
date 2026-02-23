# Abstractions

Key abstractions and domain models in Laputa.

## Document Model

All data lives in markdown files with YAML frontmatter. There is no database — the filesystem is the source of truth.

### VaultEntry

The core data type representing a single note, defined identically in Rust (`src-tauri/src/vault.rs`) and TypeScript (`src/types.ts`):

```typescript
// src/types.ts
interface VaultEntry {
  path: string          // Absolute file path: /Users/luca/Laputa/project/my-project.md
  filename: string      // Just the filename: my-project.md
  title: string         // Extracted from first # heading, or filename as fallback
  isA: string | null    // Entity type: Project, Procedure, Person, etc.
  aliases: string[]     // Alternative names for wikilink resolution
  belongsTo: string[]   // Parent relationships (wikilinks)
  relatedTo: string[]   // Related entity links (wikilinks)
  status: string | null // Active, Done, Paused, Archived, Dropped
  owner: string | null  // Person responsible
  cadence: string | null // Update frequency: Weekly, Monthly, etc.
  modifiedAt: number | null // Unix timestamp (seconds)
  createdAt: number | null  // Unix timestamp (seconds)
  fileSize: number
}
```

### Entity Types (isA)

Entity type is inferred from the folder structure. The vault is organized by type:

```
~/Laputa/
├── type/           → "Type"       ← type definition documents
├── project/        → "Project"
├── responsibility/ → "Responsibility"
├── procedure/      → "Procedure"
├── experiment/     → "Experiment"
├── person/         → "Person"
├── event/          → "Event"
├── topic/          → "Topic"
├── note/           → "Note"
├── quarter/        → "Quarter"
├── journal/        → "Journal"
├── essay/          → "Essay"
└── evergreen/      → "Evergreen"
```

Mapping logic lives in `vault.rs:parse_md_file()`. If a folder doesn't match any known type, the folder name is capitalized and used as-is.

### Types as Files

Each entity type can have a corresponding **type document** in the `type/` folder (e.g., `type/project.md`, `type/person.md`). Type documents:

- Have `Is A: Type` in their frontmatter
- Describe what the type means, its expected properties, and how it relates to other types
- Are navigable entities — they appear in the sidebar under "Types" and can be opened/edited like any other note
- Serve as the "definition" for their type category

**Type relationship**: When any entry has an `isA` value (e.g., "Project"), the Rust backend automatically adds a `"Type"` entry to its `relationships` map pointing to `[[type/project]]`. This makes the type navigable from the Inspector panel.

**UI behavior**:
- Clicking a section group header (e.g., "Projects") pins the type document at the top of the NoteList if it exists, with instances listed below
- Viewing a type document in entity view shows an "Instances" group listing all entries of that type
- The Type field in the Inspector properties panel is rendered as a clickable chip that navigates to the type document

### Frontmatter Format

Standard YAML frontmatter between `---` delimiters:

```yaml
---
title: Write Weekly Essays
is_a: Procedure
status: Active
owner: Luca Rossi
cadence: Weekly
belongs_to:
  - "[[responsibility/grow-newsletter]]"
related_to:
  - "[[topic/writing]]"
aliases:
  - Weekly Writing
---
```

Supported value types (defined in `src-tauri/src/frontmatter.rs` as `FrontmatterValue`):
- **String**: `status: Active`
- **Number**: `priority: 5`
- **Bool**: `archived: true`
- **List**: Multi-line `  - item` or inline `[item1, item2]`
- **Null**: `owner:` (empty value)

### Title Extraction

Title comes from the first `# Heading` in the markdown body. If none is found, the filename (without `.md`) is used as fallback. This logic lives in `vault.rs:extract_title()`.

### Sidebar Selection

Navigation state is modeled as a discriminated union:

```typescript
type SidebarSelection =
  | { kind: 'filter'; filter: 'all' | 'favorites' }
  | { kind: 'sectionGroup'; type: string }    // e.g. type: 'Project'
  | { kind: 'entity'; entry: VaultEntry }      // specific entity selected
  | { kind: 'topic'; entry: VaultEntry }        // topic selected
```

## File System Integration

### Vault Scanning (Rust)

`vault::scan_vault(path)` in `src-tauri/src/vault.rs`:

1. Validates the path exists and is a directory
2. Uses `walkdir` to recursively traverse the directory (follows symlinks)
3. Filters to `.md` files only
4. For each file, calls `parse_md_file()`:
   - Reads file content with `fs::read_to_string()`
   - Parses frontmatter with `gray_matter::Matter::<YAML>`
   - Extracts title from first `#` heading
   - Infers entity type from parent folder name
   - Parses dates (`created_at`, `created_time`) as ISO 8601 to Unix timestamps
   - Collects file metadata (size, modification time)
5. Sorts results by `modified_at` descending (newest first)
6. Skips unparseable files with a warning log

### Frontmatter Manipulation (Rust)

`frontmatter::update_frontmatter_content()` in `src-tauri/src/frontmatter.rs` performs line-by-line YAML editing:

1. Finds the frontmatter block between `---` delimiters
2. Iterates through lines looking for the target key (handles quoted keys like `"Is A"`)
3. If found: replaces the value (consuming multi-line list items if present)
4. If not found: appends the new key-value at the end of the frontmatter
5. If no frontmatter exists: creates a new `---` block with the key-value

The `with_frontmatter()` helper wraps this in a read-transform-write cycle on the actual file.

### Content Loading

- **Tauri mode**: Content is loaded on-demand when a tab is opened via `invoke('get_note_content', { path })`
- **Browser mode**: All content is loaded at startup from `MOCK_CONTENT` in `mock-tauri.ts`
- Content for backlink detection (`allContent`) is stored in memory as `Record<string, string>`

## Git Integration

Git operations live in `src-tauri/src/git.rs`. All operations shell out to the `git` CLI (not libgit2).

### Data Types

```typescript
interface GitCommit {
  hash: string       // Full SHA-1
  shortHash: string  // First 7 chars
  message: string
  author: string
  date: number       // Unix timestamp
}

interface ModifiedFile {
  path: string          // Absolute path
  relativePath: string  // Relative to vault root
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'
}
```

### Operations

| Operation | Git command | Notes |
|-----------|------------|-------|
| File history | `git log --format=%H\|%h\|%an\|%aI\|%s -n 20 -- <file>` | Last 20 commits for a file |
| Modified files | `git status --porcelain` | Filtered to `.md` files only |
| File diff | `git diff -- <file>`, fallback to `--cached`, then synthetic diff for untracked | Unified diff format |
| Commit | `git add -A && git commit -m "<message>"` | Stages all changes |
| Push | `git push` | Pushes to upstream of current branch |

### Frontend Integration

- **Modified file badges**: Loaded at startup, shown in sidebar and breadcrumb bar
- **Diff view**: Loaded on-demand when user clicks the diff toggle in the breadcrumb bar
- **Git history**: Loaded when active tab changes, shown in Inspector panel
- **Commit dialog**: Triggered from sidebar, runs commit + push

## BlockNote Customization

The editor uses [BlockNote](https://www.blocknotejs.org/) (not CodeMirror 6) for rich text editing.

### Custom Wikilink Inline Content

Defined in `src/components/Editor.tsx`:

```typescript
const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink",
    propSchema: { target: { default: "" } },
    content: "none",
  },
  {
    render: (props) => (
      <span className="wikilink" data-target={props.inlineContent.props.target}>
        {props.inlineContent.props.target}
      </span>
    ),
  }
)

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikiLink,
  },
})
```

### Markdown-to-BlockNote Pipeline

Since BlockNote doesn't natively understand `[[wikilinks]]`, content goes through a preprocessing pipeline in `src/utils/wikilinks.ts`:

```
Raw markdown
  → splitFrontmatter() → [yaml, body]
  → preProcessWikilinks(body) → replaces [[target]] with Unicode placeholder tokens
  → editor.tryParseMarkdownToBlocks() → BlockNote block tree
  → injectWikilinks(blocks) → walks tree, replaces placeholder text with wikilink inline content nodes
  → editor.replaceBlocks()
```

Placeholder tokens use `\u2039` (single left-pointing angle quotation mark) and `\u203A` (single right-pointing) to avoid colliding with markdown syntax.

### Wikilink Navigation

Two navigation mechanisms:

1. **Click handler**: A DOM event listener on `.editor__blocknote-container` catches clicks on `.wikilink` elements and calls `onNavigateWikilink(target)`.

2. **Suggestion menu**: Typing `[[` triggers BlockNote's `SuggestionMenuController`, which shows a filtered list of all vault entries. Selecting one inserts a wikilink inline content node.

Wikilink resolution in `useNoteActions.handleNavigateWikilink()` uses fuzzy matching:
- Exact title match
- Alias match
- Path stem match (e.g., `person/matteo-cellini`)
- Filename stem match
- Slug-to-words match (e.g., `matteo-cellini` → `matteo cellini`)

## Theme System

See [THEMING.md](./THEMING.md) for the full theme system documentation.

In brief: `src/theme.json` defines editor typography and styling as nested JSON. The `useEditorTheme` hook flattens it into CSS custom properties that are applied as inline styles on the BlockNote container.

## Inspector Abstraction

The Inspector panel (`src/components/Inspector.tsx`) is composed of four sub-panels:

1. **DynamicPropertiesPanel** (`src/components/DynamicPropertiesPanel.tsx`): Renders frontmatter as editable key-value pairs with two distinct sections:
   - **Editable properties** (top): frontmatter fields the user can modify — shown with interactive hover styling (`hover:bg-muted`), cursor pointer, and click-to-edit. Includes Type badge, Status pill, boolean toggles, array tag pills, and text fields.
   - **Info section** (bottom, separated by border): read-only derived metadata — Modified, Created, Words, File Size. Uses muted text color (`--text-muted`) with no hover states or click interaction. These fields are computed from file metadata and content, not from frontmatter.
   - Keys in `SKIP_KEYS` (`aliases`, `notion_id`, `workspace`, `is_a`, `Is A`) are hidden from the editable section since they are either internal or already displayed elsewhere (e.g., `is_a` is shown via the TypeRow badge).
2. **Relationships**: Shows `belongs_to` and `related_to` wikilinks as clickable chips.
3. **Backlinks**: Scans `allContent` for notes that reference the current note via `[[title]]` or `[[path]]`.
4. **Git History**: Shows the last few commits from `gitHistory` state.

Frontmatter parsing on the TypeScript side is handled by `src/utils/frontmatter.ts:parseFrontmatter()`, a lightweight YAML parser that handles strings, booleans, inline arrays, and multi-line lists.
