# Command palette pruning audit (TOL-437)

Audit and proposal only: nothing has been removed, renamed or hidden. Each item Luca approves becomes its own follow-up card.

Source: the Linux desktop build of main as of 2026-11-26, run on a throwaway copy of the demo vault, cross-checked against the commands registered in code.

## 1. Size today

| State (demo vault, 10 note types) | Commands shown |
|---|---|
| No note open (Inbox) | **84** |
| Note open | **115** (+31: save, find, delete, archive, favorite, 12× "Turn Current Block into…", file actions, raw editor, width, TOC, backlinks) |
| Note open and unsaved changes in the vault | **118** (+ Commit & Push, Generate Commit Message, Toggle Diff Mode) |
| Folder selected | **88** (+ 4 folder actions, + New Note in Current Folder) |
| Kanban layout (Projects) | **84** (+ Show Archived Notes, − Customize Inbox columns) |
| AI panel open | no change (same list as the layout behind it) |

**Registered in code:** 132 fixed commands, plus 2 per note type ("New X", "List Xs"; no "New Note"/"New Type"). In the demo vault that is **151**. The biggest single block is **language: 23 commands** (21 "Switch Language to …", "Use System Language", "Open Language Settings"). Language commands are 23 of the 84 rows shown with no note open (27%), and because of fuzzy matching they also come up in unrelated searches: typing "changes" lists 6+ "Switch Language to …" rows.

**Registered but never shown:**
- *Switch Default AI Agent*: only built when the AI-agent status is unknown, which never happens in the desktop app. Dead.
- *Show Note List as Graph*: hidden behind the unreleased `graph_layout` flag (intended).
- *Use System Language*: correctly hidden while the language is already "System".
- *Switch AI Agent to X* (8 agents): only for agents installed on the machine, minus the current one. None show on the QA box.

**Shown but broken or misleading:**
- *Open H1 Auto-Rename Setting* and *Open Language Settings* open Settings at the top, exactly like *Open Settings*. The screenshots are pixel-identical (`open-h1-setting-same-as-settings.png`). They don't jump to their section.
- *Toggle Backlinks* opens and closes the whole Properties panel. It is the same action as *Toggle Properties Panel*, because Backlinks is a section inside that panel (`toggle-backlinks-opens-properties.png`).
- *Resolve Conflicts* is shown even when there are no conflicts. The matching **Vault > Resolve Conflicts menu item is always greyed out**, because the app never tells the menu there are conflicts.
- *Add Remote to Current Vault* is shown even when the vault already has a remote. Running it then does nothing.
- *Toggle Note List Layout* and *Show Note List as List/Kanban/Calendar* are always shown. They do nothing in Editor Only view, History or Changes, and "Show as Kanban" is listed while you are already on Kanban.
- *Switch Language to English* is listed while the app is already in English (System language = English).
- *Open AI Agents* opens Settings at whichever section was last used, not at AI Agents.

**Reachable elsewhere but missing from the palette (gaps, not pruning):** Find in Vault (Ctrl+Shift+F, full-text search), Copy Git URL, Rename note file, Note history. The palette also leaves out the shortcuts for Toggle Raw Editor (Ctrl+\) and Reset Zoom (Ctrl+0).

## 2. Inventory

Other routes: **M** = menu bar, **K** = shortcut (Ctrl on Linux/Windows, Cmd on macOS), **UI** = button or right-click menu. "When" is the state in which the palette shows the command. **Works?** = checked in the Linux app (✓), or traced in code (code ✓) where it couldn't be staged here.

### Navigation (12 + 1 per type + 2 filters)
| Command | What it does | Other routes | When | Works? |
|---|---|---|---|---|
| Search Notes | Quick Open | M File > Quick Open; K Ctrl+P / Ctrl+O | always | ✓ |
| Go to All Notes | Select All Notes | M Go > All Notes; UI sidebar | always | ✓ |
| Go to Archived | Vault-wide archive | M Go > Archived; UI sidebar "Archive" | always | ✓ |
| Go to Changes | Pending-changes list | M Go > Changes, Vault > View Pending Changes; UI status bar "Changes" | always (even without Git) | ✓ |
| Go to History | Commit history feed | UI status bar "History" | always (even without Git) | ✓ |
| Go to Inbox | Inbox | M Go > Inbox; UI sidebar | Inbox enabled | ✓ |
| Go Back / Go Forward | Navigation history | M Go; K Ctrl+← / →; UI sidebar arrows | when possible | code ✓ |
| List ‹Type› (×10 in demo) | Open a type list | UI sidebar type row | per type | ✓ |
| Show Open Notes / Show Archived Notes | Open/Archived filter inside a type list | UI Open/Archived pills under the list | type list selected | ✓ |
| Reveal Folder in Finder | Reveal folder | UI folder right-click | folder selected | code ✓ |
| Copy Folder Path | Copy path | UI folder right-click | folder selected | code ✓ |
| Rename Folder / Delete Folder | Rename / delete | UI folder right-click | non-root folder | code ✓ |

### Note (37 + 1 per type)
| Command | What it does | Other routes | When | Works? |
|---|---|---|---|---|
| New Note | Create note | M File > New Note; K Ctrl+N; UI note list "+" | always | ✓ |
| New ‹Type› (×9 in demo) | Create a typed note | UI "+" on sidebar type row | per type | ✓ |
| New Sheet | Create a sheet (CSV) note | **none: palette only** | always | code ✓ |
| Create New Note in Current Folder | New note in selected folder | UI folder right-click > New note | folder selected | ✓ (listed) |
| New Type | Create type | M File > New Type; UI "+" next to Types | always | ✓ (listed) |
| Save Note | Save | M File > Save; K Ctrl+S | note open | ✓ |
| Undo / Redo | App history | M Edit; K Ctrl+Z / Ctrl+Shift+Z | when possible | code ✓ |
| Paste without formatting | Plain paste | M Edit; K Ctrl+Shift+V | always | code ✓ |
| Find in Note / Replace in Note | In-note search | M Edit; K Ctrl+F (find) | text note open | ✓ (listed) |
| Delete Note | Delete | M Note; K Ctrl+Backspace; UI ⋯ menu, list right-click | note open | code ✓ |
| Archive / Unarchive Note | Archive toggle | M Note; UI ⋯ menu, list right-click | note open | code ✓ |
| Add to / Remove from Favorites | Favorite toggle | K Ctrl+D; UI star in note header | note open | code ✓ |
| Mark as Organized / Unorganized | Inbox triage | M Note; K Ctrl+E; UI header button | note open + Inbox on | code ✓ |
| Turn Current Block into … (×12: Paragraph, H1–H6, Quote, Bullet, Numbered, Checklist, Code Block) | Change block type | UI block handle "Turn into", slash menu; K Ctrl+Shift+` (code block only) | Markdown note open | ✓ (listed) |
| Restore Deleted Note | Restore from Git | M Note; UI Changes right-click | a deleted file is open | code ✓ |
| Reveal in Finder | Reveal file | UI header / ⋯ menu, list right-click | note open | code ✓ |
| Copy File Path | Copy path | UI header / ⋯ menu, list right-click | note open | code ✓ |
| Copy deep link to current item | Copy a link that opens this note in Tolaria | UI ⋯ menu > Copy note link | note open | code ✓ |
| Export note as PDF | PDF export | M Note; UI ⋯ menu, list right-click | Markdown note open | code ✓ |
| Open in Default App | Open attachment externally | UI file preview button | non-Markdown file open | code ✓ |
| Set Note Icon / Remove Note Icon | Icon picker | UI title icon, Properties icon field | note open (remove: has icon) | code ✓ |
| Change Note Type… | Retype | UI Properties > Type | note open | code ✓ |
| Move Note to Folder… | Move file | UI drag onto a sidebar folder | note open, folders exist | code ✓ |
| Open in New Window | Detach note | M Note; K Ctrl+Shift+O; UI list right-click | note open | code ✓ |

### Git (6, or 1 in a non-Git vault)
| Command | What it does | Other routes | When | Works? |
|---|---|---|---|---|
| Commit & Push | Commit dialog | M Vault; UI status bar "Commit" | changes exist | ✓ (listed) |
| Generate Commit Message from Diff | Commit dialog with AI message | UI "Generate" in the commit dialog | changes exist | ✓ (listed) |
| Add Remote to Current Vault | Connect a remote | M Vault > Add Remote…; UI status bar "No remote" | **always**, even with a remote (then a silent no-op) | ⚠ |
| Pull from Remote | Pull | M Vault; UI status bar sync | Git vault | code ✓ |
| Resolve Conflicts | Conflict resolver | UI status bar conflict badge (menu item always disabled) | **always**, even without conflicts | ⚠ |
| View Pending Changes | Same as Go to Changes | M Vault > View Pending Changes; UI status bar | Git vault | ✓ duplicate |
| Initialize Git for Current Vault | Git setup | UI status bar "Git disabled" | non-Git vault only | code ✓ |

### View (25)
| Command | What it does | Other routes | When | Works? |
|---|---|---|---|---|
| Editor Only / Editor + Note List / Full Layout | Pane layout | M View; K Ctrl+1/2/3; UI sidebar collapse | always | code ✓ |
| Toggle Note List Layout | Flip List ↔ Kanban | K Ctrl+Shift+G; UI layout switcher in list header | **always** (no-op without a list) | ✓ |
| Show Note List as List / Kanban / Calendar (/ Graph, flagged) | Pick layout | UI layout switcher in list header | **always** (incl. current layout) | ✓ |
| Toggle Properties Panel | Right panel | M View; K Ctrl+Shift+I; UI header button | always | ✓ |
| Toggle Diff Mode | Diff view | M Edit; UI ⋯ menu | note has changes | ✓ (listed) |
| Toggle Raw Editor | Markdown source | M Note; K Ctrl+\; UI header button | note open | code ✓ |
| Use Normal / Wide Note Width | This note's width | UI header width button | note open (shows the other one) | ✓ (listed) |
| Use Normal / Wide Note Width by Default | Default width | UI Settings > Content | always (shows the other one) | ✓ (listed) |
| Toggle AI Panel | AI panel | M View; K Ctrl+Shift+L; UI header + floating AI button | AI on | ✓ |
| New AI chat | Fresh AI conversation | UI "+" in AI panel | AI on | code ✓ |
| Toggle Table of Contents | TOC panel | M Note; K Ctrl+Shift+T; UI header | note open | code ✓ |
| Toggle Backlinks | **Same as Toggle Properties Panel** | M Note > Toggle Backlinks (same action) | note open | ✓ duplicate |
| Move ‹View› Up / Down | Reorder saved view | UI drag in sidebar | saved view selected | code ✓ |
| Customize ‹Inbox/All Notes/View› columns | Column picker | UI list-header columns button | Inbox / All Notes / saved view | ✓ (listed) |
| Zoom In / Zoom Out / Reset Zoom | Zoom | M View; K Ctrl+= / Ctrl+- / Ctrl+0; UI status bar zoom | within 80–150% | code ✓ |

### Settings (38) and AI (up to 10 shown)
| Command | What it does | Other routes | When | Works? |
|---|---|---|---|---|
| Open Settings | Settings | K Ctrl+,; M app menu (macOS); UI status bar gear | always | ✓ |
| Open H1 Auto-Rename Setting | **Same as Open Settings** (no jump) | — | always | ✓ duplicate |
| Contribute | Feedback dialog | UI status bar "Contribute" | always | code ✓ |
| Check for Updates | Updater | M app menu (macOS); UI status bar build number | always | code ✓ |
| Use Light Mode / Use Dark Mode / Use System Theme | Theme | UI status bar moon icon; Settings > Appearance | always | code ✓ |
| Open Language Settings | **Same as Open Settings** (no jump) | — | always | ✓ duplicate |
| Use System Language | Language = system | Settings > Appearance | not already System | code ✓ |
| Switch Language to … (×21) | Set UI language | Settings > Appearance > Language | all except current pick (English shows while on System) | ✓ (listed) |
| Create Empty Vault… | New vault | UI status bar vault menu; welcome screen | always | code ✓ |
| Open Vault… | Open folder | M Vault; UI status bar vault menu | always | code ✓ |
| Remove Vault from List | Forget vault | M Vault; UI vault menu; Settings | >1 vault | code ✓ |
| Restore Getting Started Vault | Bring back demo | M Vault; UI vault menu | demo hidden | code ✓ |
| Set Up / Manage External AI Tools… | MCP setup | M Vault; UI status bar "MCP" | always | code ✓ |
| Toggle Gitignored Files Visibility | Show/hide ignored files | UI Settings > Content toggle | always | code ✓ |
| Reload Vault | Rescan | M Vault (only other route) | always | code ✓ |
| Repair Vault | Restore config files | M Vault (only other route) | always | code ✓ |
| Open AI Agents | Settings (AI section intended) | UI AI panel settings link | AI on | ⚠ lands on last section |
| Restore Tolaria AI Guidance | Rewrite guidance files | UI "Restore" banner in AI panel | guidance missing | ✓ (listed) |
| Switch AI Agent to ‹Agent› (≤7) | Default agent | UI agent picker in AI panel, Settings > AI Agents | installed, not current | code ✓ |
| Switch Default AI Agent | Cycle agent | — | **never shown** | dead |

## 3. Proposal

### Safe to remove (duplicate or dead; another route does the same job)
| Command | Reason | Route that covers it |
|---|---|---|
| View Pending Changes (Git) | Exact duplicate of **Go to Changes**: same action, both shown together | Go to Changes (palette), Go > Changes, Vault > View Pending Changes, status bar "Changes" (`duplicate-changes-commands.png`) |
| Toggle Backlinks | Runs the same action as Toggle Properties Panel, because Backlinks lives inside that panel | Toggle Properties Panel (palette), Ctrl+Shift+I, View menu, header button (`toggle-backlinks-opens-properties.png`) |
| Open H1 Auto-Rename Setting | Opens Settings at the top, the same as Open Settings | Open Settings (palette), Ctrl+,, status bar gear (`open-h1-setting-same-as-settings.png`) |
| Open Language Settings | Same as above | Open Settings, Ctrl+,, status bar gear |
| Switch Default AI Agent | Dead: never shown in the desktop app | Switch AI Agent to ‹Agent›, AI panel agent picker, Settings > AI Agents |

None of these is the only route to its feature. Also worth cleaning up on the same card: the unused per-repository pull plumbing in the Git command builder (code only, not visible).

### Merge
| Commands | Merge into | Why |
|---|---|---|
| 21× Switch Language to … + Use System Language (+ Open Language Settings above) | One **"Change Language…"** command that opens a picker (or Settings at the Language row) | 23 rows (27% of the no-note palette) for something set once. VS Code has a single "Configure Display Language"; Obsidian, Notion, Linear and Raycast have none. |
| Toggle Note List Layout | The **Show Note List as List / Kanban / Calendar** set (Ctrl+Shift+G keeps working) | The toggle only flips List ↔ Kanban, which the explicit commands already cover |
| Switch AI Agent to ‹Agent› (up to 7) | One **"Switch AI Agent…"** picker | Same per-value pattern as language. It grows with every new agent adapter. |

### Keep
Search Notes; Go to All Notes/Archived/Changes/History/Inbox; Go Back/Forward; List ‹Type› and New ‹Type›; Show Open/Archived Notes; the 4 folder commands; New Note; **New Sheet** (palette is its only route); New Note in Current Folder; New Type; Save; Undo/Redo; Paste without formatting; Find/Replace in Note; Delete; Archive; Favorites; Organized; Restore Deleted Note; Reveal; Copy File Path; Copy deep link; Export PDF; Open in Default App; Set/Remove Icon; Change Type; Move to Folder; Open in New Window; all Git commands except View Pending Changes; the 3 pane layouts; Show Note List as …; Toggle Properties/Diff/Raw/AI/TOC; note width; New AI chat; Customize columns; Zoom; Open Settings; Contribute; Check for Updates; Light/Dark/System theme; the 4 vault commands; External AI Tools; **Reload Vault** and **Repair Vault** (only other route is the menu bar); Open AI Agents; Restore AI Guidance.

### Luca decides (taste calls, not in the safe list)
| Commands | Question | Recommendation |
|---|---|---|
| Turn Current Block into … (12) | Collapse into one "Turn Block into…" picker? The block handle and slash menu already do this with the mouse. | Collapse into one picker: 115 → 104 rows with a note open |
| Use Normal/Wide Note Width **by Default** (2) | Settings > Content covers it, and it's rarely changed | Remove; keep the per-note width commands |
| Toggle Gitignored Files Visibility | Settings > Content has the toggle | Keep (useful for power users), low priority |
| Generate Commit Message from Diff | Duplicates the Generate button in the commit dialog | Keep: it is the keyboard path to the AI commit message |
| Move ‹View› Up / Down | Drag-reordering covers it | Keep: keyboard-only path (ADR 0020, keyboard-first) |
| Paste without formatting | Ctrl+Shift+V and the Edit menu cover it, and running it from the palette is unusual | Keep, harmless |
| Create Empty Vault… / Restore Getting Started | Rare actions | Keep |

### Fix separately (bugs found by the audit, not pruning)
1. Resolve Conflicts shows with no conflicts, and the **Vault > Resolve Conflicts menu item is always disabled**.
2. Add Remote shows (and silently does nothing) when a remote exists.
3. Layout commands show with no note list (Editor Only, History, Changes) and list the layout already in use.
4. Open AI Agents opens Settings at the last-used section instead of AI Agents.
5. Find in Vault (Ctrl+Shift+F) has no palette command.

**Net effect if the Safe and Merge lists are approved:** with no note open, 84 → 60 rows; with a note open, 115 → 90 (→ 79 if the block-type picker is also approved).

## 4. Comparables

| Product | Palette size | Grouping and ranking | What it leaves out |
|---|---|---|---|
| VS Code | 2,000+ built-in (secondary sources), filtered by context | "Category: Command" prefixes; recently used on top | Commands whose `when` context doesn't match are hidden; one picker each for Color Theme and Display Language |
| Obsidian | No official count; Hotkeys lists 250+ including plugins (core estimate 150–200) | "Plugin: command" prefixes; pinned, then recent | Editor commands only when an editor is active; language only in Settings |
| Linear | No public count; only actions for the current view or selection | Context first, then "Go to…"; shortcut shown on every row | Values nested in sub-lists ("Set priority" → values), not one command per value |
| Notion | Small: Cmd+K is page search plus a few jumps | Recent pages first | Blocks live in `/`, page actions in `•••`, appearance and language in Settings |
| Raycast | Hundreds, plus extensions | Frecency, aliases | Users can disable any command; settings are one window |

Sources: code.visualstudio.com/api/ux-guidelines/command-palette, code.visualstudio.com/api/extension-guides/command, obsidian.md/help/plugins/command-palette, docs.obsidian.md/Plugins/User+interface/Commands, linear.app/changelog/2019-10-07-contextual-command-menu, notion.com/help/search, manual.raycast.com/search-bar.

**What Tolaria should borrow:** one picker command per multi-value setting (language, AI agent, block type) instead of one command per value, and hide commands that can't do anything in the current context, as VS Code's `when` clauses and Linear's contextual menu do.
