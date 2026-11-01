import { mobileEditorParityInventory } from "./mobileEditorParityInventory";
import { mobileParityInventoryUi } from "./mobileParityInventoryUi";
import { mobileParityInventoryWorkspace } from "./mobileParityInventoryWorkspace";

export type MobileParityInventoryEntry = {
	assertions: string[];
	contracts: string[];
	desktopSource: string;
	mobileFile: string;
	surface: string;
};

export const mobileParityInventory = [
	...mobileEditorParityInventory,
	...mobileParityInventoryWorkspace,
	...mobileParityInventoryUi,
	{
		assertions: ["note list row rendering and neighborhood selection tests"],
		contracts: ["desktopNoteItemParity", "desktopPanelParity"],
		desktopSource:
			"NoteItem, neighborhood note-list rows, and grouped relationship headings",
		mobileFile: "src/components/workspace/MobileNoteListPanelParts.tsx",
		surface: "Note-list content and selection actions",
	},
	{
		assertions: [
			"note list toolbar, filters, and phone glass chrome interaction tests",
		],
		contracts: [
			"desktopNoteItemParity",
			"desktopPanelParity",
			"desktopToolbarParity",
		],
		desktopSource:
			"NoteListHeader, NoteItem, and workspace panel footer controls",
		mobileFile: "src/components/workspace/MobileNoteListPanelView.tsx",
		surface: "Note-list panel composition and phone chrome",
	},
] satisfies MobileParityInventoryEntry[];
