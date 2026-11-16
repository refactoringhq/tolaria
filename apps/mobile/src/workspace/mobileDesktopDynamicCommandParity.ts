export type MobileDesktopDynamicCommandStatus =
	| "deferred"
	| "implemented"
	| "mobile-adapted"
	| "out-of-scope";

export type MobileDesktopDynamicCommandEntry = {
	desktopId: string;
	evidence: string;
	mobileId?: string;
	source: MobileDesktopDynamicCommandSource;
	status: MobileDesktopDynamicCommandStatus;
};

type MobileDesktopDynamicCommandSource =
	| "desktop-filter-commands"
	| "desktop-navigation-commands"
	| "desktop-note-commands"
	| "desktop-type-commands"
	| "desktop-view-commands"
	| "mobile-adapted-note-commands";

type MobileDesktopDynamicCommandDefinition = Omit<
	MobileDesktopDynamicCommandEntry,
	"source"
>;

const dynamicCommandDefinitions = {
	"desktop-filter-commands": [
		implemented(
			"filter-open",
			"filter-open",
			"mobile note-list filter commands switch Type/folder lists to open notes",
		),
		implemented(
			"filter-archived",
			"filter-archived",
			"mobile note-list filter commands switch Type/folder lists to archived notes",
		),
	],
	"desktop-navigation-commands": [
		implemented(
			"search-notes",
			"file-quick-open",
			"mobile command palette opens the shared quick-open/search surface",
		),
		implemented(
			"go-all",
			"go-all-notes",
			"mobile primary navigation selects All Notes",
		),
		implemented(
			"go-archived",
			"go-archived",
			"mobile primary navigation selects Archive",
		),
		outOfScope(
			"go-changes",
			"Git changes are explicitly excluded from the mobile editing foundation",
		),
		outOfScope(
			"go-pulse",
			"desktop Git history/Pulse is outside the mobile editing foundation",
		),
		implemented(
			"go-back",
			"view-go-back",
			"mobile workspace history restores previous sidebar/filter/note state",
		),
		implemented(
			"go-forward",
			"view-go-forward",
			"mobile workspace history restores next sidebar/filter/note state",
		),
		implemented(
			"go-inbox",
			"go-inbox",
			"mobile primary navigation selects Inbox",
		),
		implemented(
			"reveal-selected-folder",
			"reveal-selected-folder",
			"mobile folder commands reveal the selected folder",
		),
		implemented(
			"copy-selected-folder-path",
			"copy-selected-folder-path",
			"mobile folder commands copy the selected folder path",
		),
		implemented(
			"rename-folder",
			"rename-folder",
			"mobile folder action sheet renames the selected folder",
		),
		implemented(
			"delete-folder",
			"delete-folder",
			"mobile folder action sheet deletes the selected folder",
		),
	],
	"desktop-note-commands": [
		outOfScope(
			"create-sheet",
			"desktop workbook notes do not yet have a mobile sheet editor",
		),
		implemented(
			"create-note-current-folder",
			"create-note-current-folder",
			"mobile create-note command writes into the selected folder",
		),
		implemented(
			"set-note-icon",
			"set-note-icon",
			"mobile note actions open the icon picker for the selected note",
		),
		implemented(
			"change-note-type",
			"change-note-type",
			"mobile note actions retarget the selected note type",
		),
		implemented(
			"move-note-to-folder",
			"move-note-to-folder",
			"mobile note actions move the selected note to a folder",
		),
		outOfScope(
			"restore-deleted-note",
			"deleted-note restoration depends on Git history and is excluded",
		),
		implemented(
			"reveal-active-file",
			"reveal-active-file",
			"mobile active-file commands reveal the selected note file",
		),
		implemented(
			"copy-active-file-path",
			"copy-active-file-path",
			"mobile active-file commands copy the selected file path",
		),
		implemented(
			"copy-active-deep-link",
			"copy-active-deep-link",
			"mobile active-file commands copy a Tolaria deep link",
		),
		implemented(
			"export-note-pdf",
			"note-export-pdf",
			"mobile selected-note commands export Markdown notes as PDF",
		),
		implemented(
			"open-active-file-external",
			"open-active-file-external",
			"mobile file commands open non-Markdown files in the default app",
		),
		implemented(
			"remove-note-icon",
			"remove-note-icon",
			"mobile note commands remove an existing note icon",
		),
		outOfScope(
			"open-in-new-window",
			"desktop multi-window note chrome has no mobile editing equivalent",
		),
		adapted(
			"turn-current-block-into-{type}",
			"editor-format-block",
			"the mobile formatting toolbar exposes the supported block-type conversions",
		),
	],
	"desktop-type-commands": [
		implemented(
			"new-{type}",
			"new-{type}",
			"mobile command palette creates Type-specific notes from desktop Type sections",
		),
		implemented(
			"list-{type}",
			"list-{type}",
			"mobile command palette lists desktop Type sections",
		),
	],
	"desktop-view-commands": [
		adapted(
			"view-editor",
			"view-editor-only",
			"tablet panel gestures and phone editor screen replace desktop view mode",
		),
		adapted(
			"view-editor-list",
			"view-editor-list",
			"tablet panel gestures and phone list/editor navigation replace desktop view mode",
		),
		adapted(
			"view-all",
			"view-all",
			"tablet full chrome and phone drawer navigation replace desktop view mode",
		),
		adapted(
			"toggle-inspector",
			"view-toggle-properties",
			"tablet properties rail and phone properties screen replace inspector toggle",
		),
		outOfScope(
			"toggle-diff",
			"desktop diff mode is Git/change chrome and is excluded",
		),
		implemented(
			"toggle-raw-editor",
			"edit-toggle-raw-editor",
			"mobile editor toolbar toggles source/WYSIWYG mode",
		),
		implemented(
			"set-note-width-normal",
			"set-note-width-normal",
			"mobile note commands persist normal width on the active note",
		),
		implemented(
			"set-note-width-wide",
			"set-note-width-wide",
			"mobile note commands persist wide width on the active note",
		),
		implemented(
			"set-default-note-width-normal",
			"set-default-note-width-normal",
			"mobile command palette persists normal default note width through vault config",
		),
		implemented(
			"set-default-note-width-wide",
			"set-default-note-width-wide",
			"mobile command palette persists wide default note width through vault config",
		),
		outOfScope(
			"toggle-ai-panel",
			"AI is explicitly excluded from the mobile editing foundation",
		),
		outOfScope(
			"new-ai-chat",
			"AI is explicitly excluded from the mobile editing foundation",
		),
		implemented(
			"toggle-table-of-contents",
			"view-toggle-table-of-contents",
			"mobile editor actions open the Table of Contents sheet",
		),
		adapted(
			"toggle-backlinks",
			"view-toggle-backlinks",
			"mobile properties reference groups expose backlinks and inverse references",
		),
		implemented(
			"move-view-up",
			"move-view-up",
			"mobile saved-view action sheet reorders the selected saved view upward",
		),
		implemented(
			"move-view-down",
			"move-view-down",
			"mobile saved-view action sheet reorders the selected saved view downward",
		),
		implemented(
			"customize-note-list-columns",
			"customize-note-list-columns",
			"mobile list actions customize displayed note-list properties",
		),
		outOfScope(
			"toggle-collection-layout",
			"desktop note-list layouts remain List-only on mobile",
		),
		outOfScope(
			"zoom-in",
			"desktop window zoom is installation chrome, not vault editing logic",
		),
		outOfScope(
			"zoom-out",
			"desktop window zoom is installation chrome, not vault editing logic",
		),
		outOfScope(
			"zoom-reset",
			"desktop window zoom is installation chrome, not vault editing logic",
		),
	],
	"mobile-adapted-note-commands": [
		adapted(
			"open-active-neighborhood",
			"open-active-neighborhood",
			"mobile relationship navigation opens the active note neighborhood instead of desktop backlinks chrome",
		),
		adapted(
			"rename-active-file",
			"rename-active-file",
			"mobile note actions expose explicit file rename while preserving desktop vault path semantics",
		),
		adapted(
			"rename-active-file-to-title",
			"rename-active-file-to-title",
			"mobile note actions expose title-derived file rename while preserving desktop vault path semantics",
		),
	],
} satisfies Record<
	MobileDesktopDynamicCommandSource,
	MobileDesktopDynamicCommandDefinition[]
>;

export function mobileDesktopDynamicCommandParityEntries(): MobileDesktopDynamicCommandEntry[] {
	return Object.entries(dynamicCommandDefinitions).flatMap(
		([source, definitions]) =>
			definitions.map((definition) => ({
				source: source as MobileDesktopDynamicCommandSource,
				...definition,
			})),
	);
}

export function mobileDesktopDynamicCommandParityGaps(): MobileDesktopDynamicCommandEntry[] {
	return mobileDesktopDynamicCommandParityEntries().filter(
		(entry) => entry.status === "deferred",
	);
}

function implemented(
	desktopId: string,
	mobileId: string,
	evidence: string,
): MobileDesktopDynamicCommandDefinition {
	return { desktopId, evidence, mobileId, status: "implemented" };
}

function adapted(
	desktopId: string,
	mobileId: string,
	evidence: string,
): MobileDesktopDynamicCommandDefinition {
	return { desktopId, evidence, mobileId, status: "mobile-adapted" };
}

function outOfScope(
	desktopId: string,
	evidence: string,
): MobileDesktopDynamicCommandDefinition {
	return { desktopId, evidence, status: "out-of-scope" };
}
