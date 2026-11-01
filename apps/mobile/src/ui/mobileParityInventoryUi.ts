import type { MobileParityInventoryEntry } from "./mobileParityInventory";

export const mobileParityInventoryUi = [
	{
		assertions: ["native safe-area continuity and panel divider screenshots"],
		contracts: ["desktopPanelParity", "desktopToolbarParity"],
		desktopSource:
			"Desktop shell panel backgrounds and borders; native-only safe-area insets",
		mobileFile: "src/ui/MobilePanelSafeArea.tsx",
		surface: "Edge-to-edge panel surfaces (platform adaptation)",
	},
	{
		assertions: [
			"TabletKeyboardTests: measured software-keyboard clearance, rotation, and editor-to-form focus handoff",
		],
		contracts: ["desktopPanelParity", "desktopToolbarParity"],
		desktopSource:
			"Desktop dialog and editor viewport layout; native-only keyboard avoidance preserves their existing visual tokens",
		mobileFile: "src/ui/MobileKeyboardAvoidingView.tsx",
		surface: "Native keyboard-aware viewport (platform adaptation)",
	},
	{
		assertions: ["panel chrome computed styles"],
		contracts: ["desktopPanelParity", "desktopToolbarParity"],
		desktopSource:
			"App shell split panes, NoteListHeader, InspectorHeader, BreadcrumbBar",
		mobileFile: "src/ui/MobilePanel.tsx",
		surface: "Panel and toolbar chrome",
	},
	{
		assertions: [
			"sync footer computed styles",
			"MobileFormKeyboardTests: default actions remain at least 44 points and above the native keyboard through rotation",
		],
		contracts: ["desktopStatusBarParity"],
		desktopSource:
			"shadcn Button, StatusBarFooter and StatusBarAction; native default actions have a 44-point minimum",
		mobileFile: "src/ui/MobileButton.tsx",
		surface: "Modal and status-density buttons",
	},
	{
		assertions: ["action-sheet input computed styles through user-flow checks"],
		contracts: ["desktopPropertyParity"],
		desktopSource:
			"shadcn Input wrappers used by desktop dialogs and property editors",
		mobileFile: "src/ui/MobileTextInput.tsx",
		surface: "Mobile text inputs",
	},
	{
		assertions: ["property chips and sidebar count computed styles"],
		contracts: ["desktopPropertyParity", "desktopSidebarParity"],
		desktopSource: "SidebarCountPill and property chip styles",
		mobileFile: "src/ui/MobileChip.tsx",
		surface: "Pills and property chips",
	},
	{
		assertions: ["toolbar action computed styles"],
		contracts: ["desktopToolbarActionParity"],
		desktopSource:
			"NoteListHeader action buttons and BreadcrumbBar icon buttons",
		mobileFile: "src/ui/MobileIconButton.tsx",
		surface: "Toolbar icon actions",
	},
	{
		assertions: ["note list computed styles"],
		contracts: ["desktopNoteItemParity"],
		desktopSource: "NoteItem",
		mobileFile: "src/ui/MobileListRow.tsx",
		surface: "Note list rows",
	},
	{
		assertions: ["properties computed styles"],
		contracts: ["desktopPropertyParity"],
		desktopSource: "propertyPanelLayout",
		mobileFile: "src/ui/MobilePropertyRow.tsx",
		surface: "Property rows",
	},
] satisfies MobileParityInventoryEntry[];
