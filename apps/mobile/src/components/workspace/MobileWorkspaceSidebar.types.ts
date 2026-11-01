import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import type {
	MobileNote,
	MobileSidebarSection,
} from "../../workspace/mobileWorkspaceModel";
import type { MobileSidebarFolderSelection } from "./MobileWorkspaceSidebarFolderTree";

export type SidebarDisplayLabel = string;
export type SidebarItemId = string;
export type SidebarMetricId = string;
export type SidebarSectionId = string;
export type SidebarSlug = string;

export type MobileSidebarItemSelection = {
	count?: string;
	id: string;
	label: string;
	noteId?: string;
	sectionId: string;
	typeName?: string;
	viewId?: string;
};

export type MobileWorkspaceSidebarProps = {
	activeFolderId?: string | null;
	activeItemId?: string | null;
	layoutProbe?: boolean;
	fullWidth?: boolean;
	onCreateFolder?: () => void;
	onCreateType?: () => void;
	onCreateView?: () => void;
	onOpenFolderActions?: (selection: MobileSidebarFolderSelection) => void;
	onOpenFavoriteActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenCommandPalette?: () => void;
	onOpenPrimaryActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenTypeVisibility?: () => void;
	onOpenTypeActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenViewActions?: (selection: MobileSidebarItemSelection) => void;
	onSelectFolder?: (selection: MobileSidebarFolderSelection) => void;
	onSelectItem?: (selection: MobileSidebarItemSelection) => void;
	sections: MobileSidebarSection[];
	title?: string;
};

export type SidebarSectionProps = Omit<
	MobileWorkspaceSidebarProps,
	"layoutProbe"
> & {
	layoutProbe: MobileLayoutProbe;
	section: MobileSidebarSection;
};

export type SidebarSelectionHandler = NonNullable<
	MobileWorkspaceSidebarProps["onSelectItem"]
>;

export type SidebarItemTone = MobileNote["typeTone"] | "primary";
