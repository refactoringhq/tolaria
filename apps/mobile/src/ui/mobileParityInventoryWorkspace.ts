import type { MobileParityInventoryEntry } from "./mobileParityInventory";

export const mobileParityInventoryWorkspace = [
	{
		assertions: [
			"MobileWorkspaceStartup and startup lifecycle tests: browsable metadata queues selection but never replaces an active editor or supplies editable text",
			"MobileStartupVaultTests: fresh-source editing after native startup; panel inset metrics and startup video audit",
		],
		contracts: [
			"desktopPanelParity",
			"desktopSidebarParity",
			"desktopNoteItemParity",
		],
		desktopSource:
			"Existing workspace sidebar and note-list components; native cached loading presentation has no editor or mutation authority",
		mobileFile: "src/components/workspace/MobileWorkspaceStartup.tsx",
		surface: "Initial cached workspace presentation (platform adaptation)",
	},
	{
		assertions: [
			"Source Find syntax-token preservation tests",
			"native long-document source Find recheck",
		],
		contracts: ["desktopEditorParity"],
		desktopSource:
			"RawEditorFindBar and shared editorFind match/replacement utilities",
		mobileFile: "src/components/workspace/useMobileSourceFind.tsx",
		surface: "Source-editor inline Find integration",
	},
	{
		assertions: ["note row and neighborhood rendering tests"],
		contracts: ["desktopNoteItemParity", "desktopPanelParity"],
		desktopSource: "NoteItem and neighborhood note-list rows",
		mobileFile: "src/components/workspace/MobileNoteListItems.tsx",
		surface: "Note list row content and empty states",
	},
	{
		assertions: ["sidebar computed styles and click navigation"],
		contracts: ["desktopPanelParity", "desktopSidebarParity"],
		desktopSource: "SidebarGroupHeader, SidebarParts, FolderTree",
		mobileFile: "src/components/workspace/MobileWorkspaceSidebar.tsx",
		surface: "Workspace sidebar",
	},
	{
		assertions: [
			"sidebar folder computed styles, measured native row insets, and click navigation",
		],
		contracts: ["desktopSidebarParity"],
		desktopSource: "FolderTree",
		mobileFile: "src/components/workspace/MobileWorkspaceSidebarFolderTree.tsx",
		surface: "Workspace sidebar folder tree",
	},
	{
		assertions: ["sidebar count computed styles"],
		contracts: ["desktopSidebarParity"],
		desktopSource: "SidebarCountPill",
		mobileFile: "src/components/workspace/MobileSidebarCountPill.tsx",
		surface: "Sidebar note counts",
	},
	{
		assertions: ["note list computed styles and selection click"],
		contracts: [
			"desktopNoteItemParity",
			"desktopPanelParity",
			"desktopToolbarParity",
		],
		desktopSource: "NoteListHeader and NoteItem",
		mobileFile: "src/components/workspace/MobileNoteListPanel.tsx",
		surface: "Note list panel",
	},
	{
		assertions: [
			"Pending-note indicator and revisioned sync-ledger tests: per-file dots, vault isolation, restart recovery, and edits during sync",
		],
		contracts: ["desktopNoteItemParity"],
		desktopSource:
			"NoteItem Git-change status; native adaptation shows a yellow dot before connected-vault note titles",
		mobileFile: "src/components/workspace/MobilePendingNoteIndicator.tsx",
		surface: "Pending local note changes",
	},
	{
		assertions: [
			"MobileCreateNoteButtonTests: 57.6-point circular target at 120%, list-bound placement, immediate editor focus, and bulk-selection exclusion",
		],
		contracts: ["desktopToolbarActionParity"],
		desktopSource:
			"NoteListHeader create-note command; owner-requested native adaptation moves it to the bottom of the note list",
		mobileFile: "src/components/workspace/MobileCreateNoteButton.tsx",
		surface: "Native note creation action",
	},
	{
		assertions: ["note-list bulk-selection user-flow checks"],
		contracts: ["desktopNoteItemParity"],
		desktopSource: "BulkActionBar and NoteList multi-select actions",
		mobileFile: "src/components/workspace/MobileNoteListBulkActionBar.tsx",
		surface: "Note-list bulk action bar",
	},
	{
		assertions: [
			"TabletNoteSwipeTests: trailing Star/Delete/Archive, full-swipe Archive only, and rightward phone sidebar navigation",
		],
		contracts: ["desktopNoteItemParity"],
		desktopSource:
			"NoteItem and desktop favorite/archive/delete commands; owner-requested native swipe adaptation",
		mobileFile: "src/components/workspace/MobileSwipeableNoteRow.tsx",
		surface: "Native note-row swipe gestures",
	},
	{
		assertions: [
			"TabletNoteSwipeTests: visible quick actions and non-destructive full swipe",
		],
		contracts: ["desktopNoteItemParity", "desktopToolbarActionParity"],
		desktopSource:
			"Desktop note action icons and semantic colors; owner-requested native swipe adaptation",
		mobileFile: "src/components/workspace/MobileNoteSwipeActions.tsx",
		surface: "Native note-row swipe actions",
	},
	{
		assertions: [
			"properties computed styles",
			"derived reference groups from inspector semantics",
		],
		contracts: [
			"desktopPanelParity",
			"desktopPropertyParity",
			"desktopRelationshipParity",
		],
		desktopSource:
			"InspectorHeader, propertyPanelLayout, RelationshipsPanel, InstancesPanel, ReferencedByPanel, BacklinksPanel",
		mobileFile: "src/components/workspace/MobilePropertiesPanel.tsx",
		surface: "Properties panel",
	},
	{
		assertions: [
			"properties computed styles and property-action touch metrics",
		],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"propertyPanelLayout and shared inspector section/action rows",
		mobileFile: "src/components/workspace/MobilePropertyRows.tsx",
		surface: "Inspector shared section and action rows",
	},
	{
		assertions: [
			"property display-mode tests and inspector property-edit native checks",
		],
		contracts: ["desktopPropertyParity"],
		desktopSource: "PropertyValueCells and inline scalar/tag displays",
		mobileFile: "src/components/workspace/MobilePropertyValues.tsx",
		surface: "Inspector scalar and tag values",
	},
	{
		assertions: [
			"derived reference groups from inspector semantics",
			"native relationship target/removal metrics",
		],
		contracts: ["desktopPropertyParity", "desktopRelationshipParity"],
		desktopSource:
			"RelationshipsPanel, InstancesPanel, ReferencedByPanel and BacklinksPanel",
		mobileFile: "src/components/workspace/MobileRelationshipRows.tsx",
		surface: "Inspector typed relationships and references",
	},
	{
		assertions: [
			"frontmatter state unit tests and properties-panel user-flow checks",
		],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"InitializePropertiesPrompt and InvalidFrontmatterNotice from InspectorChrome",
		mobileFile: "src/components/workspace/MobileFrontmatterStateNotice.tsx",
		surface: "Properties frontmatter state notice",
	},
	{
		assertions: [
			"MobileSidebarSettingsTests: pinned Settings button, touch target, safe-area clearance, and vault-manager navigation",
		],
		contracts: ["desktopSidebarParity", "desktopToolbarActionParity"],
		desktopSource:
			"Desktop Settings action; owner-requested mobile adaptation replaces the persistent status bar",
		mobileFile: "src/components/workspace/MobileSidebarSettings.tsx",
		surface: "Sidebar Settings access",
	},
	{
		assertions: [
			"edit preparation retry regression tests and native workspace recovery checks",
		],
		contracts: ["desktopPanelParity", "desktopToolbarActionParity"],
		desktopSource:
			"Desktop error and retry actions; nonmodal mobile notice replaces the persistent footer failure state",
		mobileFile: "src/components/workspace/MobileWorkspaceEditNotice.tsx",
		surface: "Recoverable editor preparation notice",
	},
	{
		assertions: [
			"note and relationship icon size/color computed through parent rows",
		],
		contracts: ["desktopNoteItemParity", "desktopRelationshipParity"],
		desktopSource: "NoteItem type indicators and inspector relationship icons",
		mobileFile: "src/components/workspace/MobileWorkspaceIcons.tsx",
		surface: "Workspace type icons",
	},
	{
		assertions: [
			"native Phosphor export lookup exercised by icon-rendering parent rows and native simulator smoke",
		],
		contracts: [
			"desktopNoteItemParity",
			"desktopRelationshipParity",
			"desktopSidebarParity",
		],
		desktopSource:
			"Desktop Phosphor icon names used by type definitions, sidebar entries, note icons, and relationship rows",
		mobileFile: "src/components/workspace/MobileWorkspaceIconResolver.tsx",
		surface: "Workspace icon resolution",
	},
	{
		assertions: [
			"search/create/properties/more writable user-flow checks",
			"source-backed tldraw whiteboard metadata, snapshot, and text-shape add/edit/remove checks",
		],
		contracts: [
			"desktopPanelParity",
			"desktopPropertyParity",
			"desktopToolbarActionParity",
		],
		desktopSource:
			"Desktop command dialogs, note-list search, inspector property forms, and tldraw fenced markdown persistence",
		mobileFile: "src/components/workspace/MobileWorkspaceActionSheet.tsx",
		surface: "Writable workspace action sheets",
	},
	{
		assertions: ["native action-sheet primary actions and touch targets"],
		contracts: ["desktopPanelParity", "desktopToolbarActionParity"],
		desktopSource: "Desktop dialog action rows and modal footer controls",
		mobileFile: "src/components/workspace/MobileWorkspaceSheetChrome.tsx",
		surface: "Shared workspace sheet actions",
	},
	{
		assertions: [
			"view editor, filename rename and folder/type suggestion user flows",
		],
		contracts: ["desktopPanelParity", "desktopPropertyParity"],
		desktopSource: "Desktop view, filename and folder/type dialog forms",
		mobileFile: "src/components/workspace/MobileWorkspaceTextFieldForms.tsx",
		surface: "Workspace text and view forms",
	},
	{
		assertions: ["native property/relationship touch and focus-reveal checks"],
		contracts: [
			"desktopPanelParity",
			"desktopPropertyParity",
			"desktopRelationshipParity",
		],
		desktopSource: "Desktop inspector property and relationship editing forms",
		mobileFile: "src/components/workspace/MobileWorkspacePropertyForms.tsx",
		surface: "Workspace property and relationship forms",
	},
	{
		assertions: [
			"native Cmd+O all-notes search, literal technical-term query, selected-note opening, and note-list filter isolation checks",
		],
		contracts: [
			"desktopNoteItemParity",
			"desktopPanelParity",
			"desktopToolbarActionParity",
		],
		desktopSource:
			"QuickOpenDialog, quick-open search ranking, and NoteItem result rows",
		mobileFile: "src/components/workspace/MobileQuickOpenSheet.tsx",
		surface: "All-notes quick open",
	},
	{
		assertions: [
			"command-palette model tests for desktop command IDs, grouping, filtering, enabled-state, and callback dispatch",
		],
		contracts: ["desktopPanelParity", "desktopToolbarActionParity"],
		desktopSource:
			"CommandPalette.tsx, appCommandManifest.json, and desktop command registry builders",
		mobileFile: "src/components/workspace/MobileCommandPalette.tsx",
		surface: "Workspace command palette",
	},
	{
		assertions: [
			"note-more action user-flow checks",
			"source-backed markdown table and tldraw metadata/text-shape add/edit/remove checks",
		],
		contracts: ["desktopPanelParity", "desktopToolbarActionParity"],
		desktopSource:
			"Desktop note context menu, BreadcrumbBar note actions, editor command actions, markdown tables, and tldraw fenced markdown persistence",
		mobileFile:
			"src/components/workspace/MobileWorkspaceMoreActionsContent.tsx",
		surface: "Workspace More actions content",
	},
	{
		assertions: ["note-more action user-flow checks"],
		contracts: ["desktopPanelParity", "desktopToolbarActionParity"],
		desktopSource:
			"Desktop note context menu, BreadcrumbBar note actions, and editor command actions",
		mobileFile: "src/components/workspace/MobileNoteMoreActions.tsx",
		surface: "Note more actions",
	},
	{
		assertions: [
			"source-backed code, code-fence metadata, math, Mermaid, leading-space source indentation, and code-indented fence exclusion edit checks",
		],
		contracts: ["desktopEditorParity", "desktopToolbarActionParity"],
		desktopSource:
			"BlockNote code blocks, math markdown, Mermaid fences, and editor command actions",
		mobileFile: "src/components/workspace/MobileSourceBlockMoreActions.tsx",
		surface: "Source block more actions",
	},
	{
		assertions: [
			"saved-view reorder user-flow checks",
			"type-section reorder user-flow checks",
		],
		contracts: ["desktopSidebarParity", "desktopToolbarActionParity"],
		desktopSource: "Sidebar saved-view and type-section context actions",
		mobileFile: "src/components/workspace/MobileWorkspaceMoveActions.tsx",
		surface: "Workspace sidebar reorder actions",
	},
	{
		assertions: ["typed property edit user-flow checks"],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"Inspector property editors and shadcn segmented button controls",
		mobileFile: "src/components/workspace/MobilePropertyValueKindPicker.tsx",
		surface: "Property value kind picker",
	},
	{
		assertions: [
			"property and relationship suggestion user-flow checks",
			"relationship target and Type-defined view-value resolution parity",
		],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"RelationshipsPanel note search dropdown and inspector property forms",
		mobileFile: "src/components/workspace/MobileWorkspaceSuggestionList.tsx",
		surface: "Workspace action-sheet suggestions",
	},
	{
		assertions: ["saved-view filter edit user-flow checks"],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"FilterBuilder, FilterFieldCombobox, shadcn inputs and buttons",
		mobileFile: "src/components/workspace/MobileViewFilterBuilder.tsx",
		surface: "Saved-view filter builder",
	},
	{
		assertions: ["saved-view column edit user-flow checks"],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"ListPropertiesPopover and NoteListHeader column customization",
		mobileFile:
			"src/components/workspace/MobileViewDisplayPropertiesPicker.tsx",
		surface: "Saved-view note-list column picker",
	},
	{
		assertions: [
			"saved-view sort user-flow checks",
			"type-section sort user-flow checks",
		],
		contracts: ["desktopPropertyParity", "desktopToolbarActionParity"],
		desktopSource: "SortDropdown and NoteListHeader sort persistence",
		mobileFile: "src/components/workspace/MobileSortPicker.tsx",
		surface: "Saved-view and Type-section sort picker",
	},
	{
		assertions: [
			"saved-view metadata user-flow checks",
			"type-section metadata user-flow checks",
		],
		contracts: ["desktopPropertyParity", "desktopSidebarParity"],
		desktopSource:
			"CustomizeTypeDialog, CreateViewDialog, and sidebar icon/color metadata",
		mobileFile: "src/components/workspace/MobileMetadataPicker.tsx",
		surface: "Saved-view and Type-section metadata picker",
	},
	{
		assertions: ["command inventory coverage and native formatting dispatch"],
		contracts: ["desktopToolbarActionParity"],
		desktopSource:
			"Existing BlockNote formatting command icons, labels, and semantics",
		mobileFile: "src/components/workspace/mobileFormattingCommands.tsx",
		surface: "Shared source/native formatting command definitions",
	},
	{
		assertions: [
			"native 44-point target metrics",
			"XCUITest menu selection and dismissal",
		],
		contracts: [
			"desktopToolbarActionParity",
			"ADR 0202 explicit tablet touch adaptation",
		],
		desktopSource:
			"BlockNote formatting commands and Tolaria toolbar colors/icons; grouped for touch",
		mobileFile: "src/components/workspace/MobileCompactFormattingToolbar.tsx",
		surface: "Contextual native formatting controls",
	},
] satisfies MobileParityInventoryEntry[];
