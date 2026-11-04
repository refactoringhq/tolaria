import { FileText } from "phosphor-react-native";
import { useCallback, useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { mobileCopy, mobileText } from "../../i18n/mobileText";
import {
	type MobileLayoutProbe,
	probeProps,
	useMobileLayoutProbe,
} from "../../qa/mobileLayoutProbe";
import { MobilePanel } from "../../ui/MobilePanel";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type {
	MobileNote,
	MobileSidebarIcon,
	MobileSidebarItem,
	MobileSidebarSection,
} from "../../workspace/mobileWorkspaceModel";
import { MobileListMotion } from "./MobileSwipeableNoteRow";
import { mobilePhosphorIconElement } from "./MobileWorkspaceIconResolver";
import {
	FolderTree,
	type MobileSidebarFolderSelection,
} from "./MobileWorkspaceSidebarFolderTree";
import { SidebarItem } from "./MobileWorkspaceSidebarItem.internal";
import {
	MobileSidebarFooter,
	MobileSidebarSectionsScroll,
} from "./MobileWorkspaceSidebarLayoutParts.internal";
import { SectionTitle } from "./MobileWorkspaceSidebarSectionTitle.internal";
import { MobileWorkspaceSidebarToolbar } from "./MobileWorkspaceSidebarToolbar.internal";
import {
	createSidebarStyles as createThemeStyles,
	mobilePanelFullWidthStyle,
} from "./mobileSidebarStyles";
import { noteTypeColor, noteTypeSoftColor } from "./mobileWorkspaceTone";

export type { MobileSidebarFolderSelection } from "./MobileWorkspaceSidebarFolderTree";

export type MobileSidebarItemSelection = {
	count?: string;
	id: string;
	label: string;
	noteId?: string;
	sectionId: string;
	typeName?: string;
	viewId?: string;
};

type SidebarDisplayLabel = string;
type SidebarItemId = string;
type SidebarSectionId = string;
type SidebarSelectionHandler = NonNullable<
	MobileWorkspaceSidebarProps["onSelectItem"]
>;

type MobileWorkspaceSidebarProps = {
	activeFolderId?: string | null;
	activeItemId?: string | null;
	layoutProbe?: boolean;
	fullWidth?: boolean;
	scrollsToTop?: boolean;
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

export function MobileWorkspaceSidebar(props: MobileWorkspaceSidebarProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const layoutProbe = useMobileLayoutProbe(Boolean(props.layoutProbe));
	const [controlsHeight, setControlsHeight] = useState(0);
	const measureControls = useCallback(
		(event: LayoutChangeEvent) =>
			setControlsHeight(event.nativeEvent.layout.height),
		[],
	);
	const sections = props.sections.map((section) => (
		<SidebarSection
			{...props}
			key={section.id}
			layoutProbe={layoutProbe.probe}
			section={section}
		/>
	));
	return (
		<MobilePanel
			{...layoutProbe.probe("sidebar.panel")}
			style={[styles.panel, mobilePanelFullWidthStyle(styles, props.fullWidth)]}
			testID="workspace-sidebar-panel"
		>
			<MobileWorkspaceSidebarToolbar title={props.title} />
			<MobileSidebarSectionsScroll
				controlsHeight={controlsHeight}
				layoutProbe={layoutProbe}
				scrollsToTop={props.scrollsToTop ?? false}
				styles={styles}
			>
				{sections}
			</MobileSidebarSectionsScroll>
			<MobileSidebarFooter
				layoutProbe={layoutProbe}
				onLayout={measureControls}
				onOpenCommandPalette={props.onOpenCommandPalette}
				showLayoutProbe={props.layoutProbe ?? false}
				styles={styles}
			/>
		</MobilePanel>
	);
}

type SidebarSectionProps = Omit<MobileWorkspaceSidebarProps, "layoutProbe"> & {
	layoutProbe: MobileLayoutProbe;
	section: MobileSidebarSection;
};

function SidebarSection(props: SidebarSectionProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const { layoutProbe, section } = props;
	const [expanded, setExpanded] = useState(true);
	return (
		<View
			{...probeProps(layoutProbe, `sidebar.section.${section.id}.container`)}
			style={[
				styles.section,
				section.id === "primary" ? styles.primarySection : styles.groupSection,
			]}
			testID={`sidebar-section-${section.id}`}
		>
			<SidebarSectionTitle
				{...props}
				expanded={expanded}
				onToggle={() => setExpanded((value) => !value)}
			/>
			{expanded ? (
				<MobileListMotion testID={`sidebar-section-content-${section.id}`}>
					<SidebarSectionItems {...props} />
					{section.folders ? (
						<FolderTree
							activeFolderId={props.activeFolderId}
							folders={section.folders}
							layoutProbe={layoutProbe}
							onOpenFolderActions={props.onOpenFolderActions}
							onSelectFolder={props.onSelectFolder}
						/>
					) : null}
				</MobileListMotion>
			) : null}
		</View>
	);
}

function SidebarSectionTitle(props: {
	expanded: boolean;
	layoutProbe: MobileLayoutProbe;
	onCreateFolder?: () => void;
	onCreateType?: () => void;
	onCreateView?: () => void;
	onOpenTypeVisibility?: () => void;
	onToggle: () => void;
	section: MobileSidebarSection;
}) {
	const {
		expanded,
		layoutProbe,
		onCreateFolder,
		onCreateType,
		onCreateView,
		onOpenTypeVisibility,
		onToggle,
		section,
	} = props;
	if (!section.label) return null;

	return (
		<SectionTitle
			expanded={expanded}
			onToggle={onToggle}
			count={section.id === "types" ? undefined : section.count}
			label={sidebarSectionLabel(section.id, section.label)}
			layoutProbe={layoutProbe}
			sectionId={section.id}
			createAccessibilityLabel={sectionCreateAccessibilityLabel(section.id)}
			onCreate={sectionCreateHandler(
				section.id,
				onCreateFolder,
				onCreateType,
				onCreateView,
			)}
			visibilityAccessibilityLabel={sectionVisibilityAccessibilityLabel(
				section.id,
			)}
			onVisibility={sectionVisibilityHandler(section.id, onOpenTypeVisibility)}
		/>
	);
}

function sectionVisibilityAccessibilityLabel(sectionId: SidebarSectionId) {
	if (sectionId === "types") return mobileText("sidebar.section.showInSidebar");
	return undefined;
}

function sectionVisibilityHandler(
	sectionId: SidebarSectionId,
	onOpenTypeVisibility?: () => void,
) {
	if (sectionId === "types") return onOpenTypeVisibility;
	return undefined;
}

function sectionCreateAccessibilityLabel(sectionId: SidebarSectionId) {
	if (sectionId === "folders") return mobileText("sidebar.action.createFolder");
	if (sectionId === "types") return mobileText("sidebar.action.createType");
	if (sectionId === "views") return mobileText("sidebar.action.createView");
	return undefined;
}

function sectionCreateHandler(
	sectionId: SidebarSectionId,
	onCreateFolder?: () => void,
	onCreateType?: () => void,
	onCreateView?: () => void,
) {
	if (sectionId === "folders") return onCreateFolder;
	if (sectionId === "types") return onCreateType;
	if (sectionId === "views") return onCreateView;
	return undefined;
}

function SidebarSectionItems(props: SidebarSectionProps) {
	const { activeItemId, layoutProbe, onSelectItem, section } = props;
	const themeStyles = useMobileStyles(createThemeStyles);
	return (
		section.items?.map((item) => {
			const active = activeItemId ? item.id === activeItemId : item.active;
			const label = sidebarLabel(item.id, item.label);
			const selection = sidebarItemSelection(item, label, section.id);

			return (
				<SidebarItem
					active={active}
					activeBackgroundColor={sidebarActiveBackgroundColor(
						themeStyles,
						item.tone,
					)}
					activeColor={sidebarActiveColor(themeStyles, item.tone)}
					count={item.count}
					icon={sidebarIcon(
						themeStyles,
						item.icon,
						active ? (item.tone ?? "primary") : item.tone,
					)}
					key={item.id}
					label={label}
					layoutProbe={layoutProbe}
					metricId={`sidebar.item.${item.id}`}
					slug={item.id}
					onLongPress={sidebarItemLongPress({
						onOpenPrimaryActions: props.onOpenPrimaryActions,
						onOpenTypeActions: props.onOpenTypeActions,
						onOpenViewActions: props.onOpenViewActions,
						onOpenFavoriteActions: props.onOpenFavoriteActions,
						sectionId: section.id,
						selection,
					})}
					onPress={() => onSelectItem?.(selection)}
				/>
			);
		}) ?? null
	);
}

function sidebarItemLongPress({
	onOpenPrimaryActions,
	onOpenTypeActions,
	onOpenViewActions,
	onOpenFavoriteActions,
	sectionId,
	selection,
}: {
	onOpenPrimaryActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenTypeActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenViewActions?: (selection: MobileSidebarItemSelection) => void;
	onOpenFavoriteActions?: (selection: MobileSidebarItemSelection) => void;
	sectionId: SidebarSectionId;
	selection: MobileSidebarItemSelection;
}) {
	const handler = sidebarLongPressHandler({
		onOpenFavoriteActions,
		onOpenPrimaryActions,
		onOpenTypeActions,
		onOpenViewActions,
		sectionId,
		selection,
	});

	return handler ? () => handler(selection) : undefined;
}

function sidebarLongPressHandler({
	onOpenFavoriteActions,
	onOpenPrimaryActions,
	onOpenTypeActions,
	onOpenViewActions,
	sectionId,
	selection,
}: {
	onOpenFavoriteActions?: SidebarSelectionHandler;
	onOpenPrimaryActions?: SidebarSelectionHandler;
	onOpenTypeActions?: SidebarSelectionHandler;
	onOpenViewActions?: SidebarSelectionHandler;
	sectionId: SidebarSectionId;
	selection: MobileSidebarItemSelection;
}): SidebarSelectionHandler | undefined {
	if (sectionId === "primary")
		return primaryItemCanCustomizeColumns(selection.id)
			? onOpenPrimaryActions
			: undefined;

	const handlers: Partial<
		Record<SidebarSectionId, SidebarSelectionHandler | undefined>
	> = {
		favorites: onOpenFavoriteActions,
		types: onOpenTypeActions,
		views: onOpenViewActions,
	};
	return handlers[sectionId];
}

function primaryItemCanCustomizeColumns(itemId: SidebarItemId) {
	return itemId === "all-notes" || itemId === "inbox";
}

function sidebarItemSelection(
	item: MobileSidebarItem,
	label: SidebarDisplayLabel,
	sectionId: SidebarSectionId,
): MobileSidebarItemSelection {
	return {
		count: item.count,
		id: item.id,
		label,
		noteId: item.noteId,
		sectionId,
		typeName: item.typeName,
		viewId: item.viewId,
	};
}

function sidebarIcon(
	themeStyles: ReturnType<typeof createThemeStyles>,
	icon: MobileSidebarIcon,
	tone?: MobileNote["typeTone"] | "primary",
) {
	const color = sidebarIconColor(themeStyles, tone);

	const size = themeStyles.metrics.size(15);
	return (
		mobilePhosphorIconElement(icon, { color, size }) ?? (
			<FileText color={color} size={size} />
		)
	);
}

function sidebarIconColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: MobileNote["typeTone"] | "primary",
) {
	const { mobileColors } = themeStyles;
	if (tone === "primary") return mobileColors.primary;
	if (tone) return noteTypeColor(tone, mobileColors);

	return mobileColors.textMuted;
}

function sidebarActiveColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: MobileNote["typeTone"],
) {
	const { mobileColors } = themeStyles;
	return tone ? noteTypeColor(tone, mobileColors) : mobileColors.primary;
}

function sidebarActiveBackgroundColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: MobileNote["typeTone"],
) {
	const { mobileColors } = themeStyles;
	return tone
		? noteTypeSoftColor(tone, mobileColors)
		: mobileColors.primarySoft;
}

function sidebarLabel(id: SidebarItemId, fallback: SidebarDisplayLabel) {
	if (id === "all-notes") return mobileCopy.allNotes;
	if (id === "archive") return mobileCopy.archive;
	if (id === "inbox") return mobileCopy.inbox;

	return fallback;
}

function sidebarSectionLabel(
	id: SidebarSectionId,
	fallback: SidebarDisplayLabel,
) {
	if (id === "folders") return mobileText("sidebar.group.folders");
	if (id === "favorites") return mobileCopy.favorites;
	if (id === "types") return mobileCopy.types;
	if (id === "views") return mobileCopy.views;

	return fallback;
}
