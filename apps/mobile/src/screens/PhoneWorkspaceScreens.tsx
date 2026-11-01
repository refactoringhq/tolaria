import { List } from "phosphor-react-native";
import { Fragment, useCallback } from "react";
import { View } from "react-native";
import { MobileNoteListPanel } from "../components/workspace/MobileNoteListPanel";
import { MobilePropertiesPanel } from "../components/workspace/MobilePropertiesPanel";
import { MobileWorkspaceSidebar } from "../components/workspace/MobileWorkspaceSidebar";
import { mobileNoteListPrimarySwipeAction } from "../components/workspace/mobileNoteListRows";
import { mobileCopy, mobileText } from "../i18n/mobileText";
import { probeProps } from "../qa/mobileLayoutProbe";
import { desktopToolbarActionParity } from "../ui/desktopParity";
import { MobileIconButton } from "../ui/MobileIconButton";
import type { MobileColors } from "../ui/theme/mobilePalette";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { mobileWorkspaceHasNoVault } from "../workspace/mobileWorkspaceEmptyState";
import {
	noteFilename,
	noteWritePath,
} from "../workspace/mobileWorkspacePathRewrites";
import { PhoneScreenLayer } from "./PhoneScreenLayer";
import { PhoneTopBar } from "./PhoneWorkspaceChrome";
import { PhoneEditorScreen } from "./PhoneWorkspaceEditorScreen";
import { phoneRailFrame } from "./phonePanelRail";
import type {
	PhoneWorkspaceController,
	PhoneWorkspaceStateViewProps,
} from "./phoneWorkspaceScreenSupport";
import { createThemeStyles } from "./phoneWorkspaceStyles";
import { phoneWorkspaceSidebarDrawerWidth } from "./phoneWorkspaceTransitions";
import { useMobileInspectorReferenceGroups } from "./useMobileInspectorReferenceGroups";
import { usePhoneViewportWidth } from "./usePhoneViewportWidth";

function PhoneNoteListScreen({
	controller,
	options,
	openEditor,
	openSidebar,
	phoneLayoutProbe,
}: PhoneWorkspaceStateViewProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const { snapshot } = controller;

	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.list.screen")}
			style={styles.screen}
			testID="phone-note-list-screen"
		>
			<MobileNoteListPanel
				compact
				onToggleNoteFavorite={controller.onToggleNoteFavorite}
				bulkActions={phoneNoteListBulkActions(controller)}
				displayPropertyKeys={controller.noteListProperties}
				emptyVault={mobileWorkspaceHasNoVault(snapshot)}
				fullWidth
				leading={
					<PhoneNoteListSidebarButton
						colors={mobileColors}
						onPress={openSidebar}
					/>
				}
				layoutProbe={options.layoutProbe}
				neighborhood={controller.noteListNeighborhood}
				noteListFilter={controller.noteListFilter}
				noteListFilterCounts={controller.noteListFilterCounts}
				noteListFilterVisible={controller.noteListFilterVisible}
				notes={controller.notes}
				propertyDisplayModes={snapshot.vaultConfig?.propertyDisplayModes}
				searchQuery={controller.searchQuery || undefined}
				selectedNoteId={controller.selectedNoteId}
				subtitle={controller.noteListSubtitle}
				title={controller.noteListTitle}
				typeDefinitions={snapshot.typeDefinitions}
				onOpenCreateNote={controller.onOpenCreateNote}
				onOpenSearch={controller.onOpenSearch}
				onOpenVault={controller.onOpenCreateNote}
				onNoteListFilterChange={controller.onNoteListFilterChange}
				onSelectNote={openEditor}
			/>
		</View>
	);
}

function PhoneNoteListSidebarButton({
	colors,
	onPress,
}: {
	colors: MobileColors;
	onPress: () => void;
}) {
	return (
		<MobileIconButton
			accessibilityLabel={mobileCopy.showSidebar}
			density="leading"
			testID="phone-note-list-sidebar-button"
			onPress={onPress}
		>
			<List
				color={colors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
		</MobileIconButton>
	);
}

function phoneNoteListBulkActions(controller: PhoneWorkspaceController) {
	const selection = controller.sidebarSelection;
	return {
		onArchive: controller.onBulkArchiveNotes,
		onDelete: controller.onBulkDeleteNotes,
		onOrganize: controller.onBulkOrganizeNotes,
		primarySwipeAction: mobileNoteListPrimarySwipeAction(
			selection.kind === "item" && selection.sectionId === "primary"
				? selection.id
				: null,
			selection.kind === "folder" ? selection.id : null,
		),
	};
}

function PhoneSidebarDrawer(props: PhoneWorkspaceStateViewProps) {
	const {
		controller,
		options,
		openCommandPalette,
		openList,
		phoneLayoutProbe,
	} = props;
	const { styles } = useMobileStyles(createThemeStyles);
	const width = usePhoneViewportWidth();
	const drawerWidth = phoneWorkspaceSidebarDrawerWidth(width);
	const { selectFolder, selectItem } = useSidebarSelectionActions(
		controller,
		openList,
	);

	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.sidebar.screen")}
			style={styles.drawerRoot}
			testID="phone-sidebar-screen"
		>
			<PhoneSidebarDrawerContent
				controller={controller}
				options={options}
				openCommandPalette={openCommandPalette}
				phoneLayoutProbe={phoneLayoutProbe}
				drawerWidth={drawerWidth}
				selectFolder={selectFolder}
				selectItem={selectItem}
			/>
		</View>
	);
}

function PhoneSidebarDrawerContent({
	controller,
	options,
	openCommandPalette,
	phoneLayoutProbe,
	drawerWidth,
	selectFolder,
	selectItem,
}: Pick<
	PhoneWorkspaceStateViewProps,
	"controller" | "options" | "openCommandPalette" | "phoneLayoutProbe"
> & {
	drawerWidth: number;
	selectFolder: PhoneWorkspaceController["onSelectFolder"];
	selectItem: PhoneWorkspaceController["onSelectSidebarItem"];
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.sidebar.drawer")}
			style={[styles.drawerPanel, { width: drawerWidth }]}
		>
			<MobileWorkspaceSidebar
				fullWidth
				activeFolderId={controller.activeFolderId}
				activeItemId={controller.activeItemId}
				layoutProbe={options.layoutProbe}
				sections={controller.snapshot.sidebarSections}
				title={controller.snapshot.source?.label}
				onCreateFolder={controller.onOpenCreateFolder}
				onCreateType={controller.onOpenCreateType}
				onCreateView={controller.onOpenCreateView}
				onOpenFolderActions={controller.onOpenFolderActions}
				onOpenFavoriteActions={controller.onOpenFavoriteActions}
				onOpenPrimaryActions={controller.onOpenPrimaryActions}
				onOpenTypeActions={controller.onOpenTypeActions}
				onOpenTypeVisibility={controller.onOpenTypeVisibility}
				onOpenViewActions={controller.onOpenViewActions}
				onSelectFolder={selectFolder}
				onSelectItem={selectItem}
				onOpenCommandPalette={openCommandPalette}
			/>
		</View>
	);
}

function PhonePropertiesScreen(props: PhoneWorkspaceStateViewProps) {
	const {
		controller,
		options,
		openEditor,
		openSourceEditor,
		openList,
		phoneLayoutProbe,
	} = props;
	const { styles } = useMobileStyles(createThemeStyles);
	const returnToEditor = useCallback(() => openEditor(), [openEditor]);
	const { enterNeighborhood, referenceGroups, title } =
		usePhonePropertiesScreenData(controller, openList);

	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.properties.screen")}
			style={styles.screen}
			testID="phone-properties-screen"
		>
			<PhoneTopBar title={title} onBack={returnToEditor} />
			<MobilePropertiesPanel
				compact
				fullWidth
				showToolbar={false}
				layoutProbe={options.layoutProbe}
				note={controller.selectedNote}
				typeDefinitions={controller.snapshot.typeDefinitions}
				onAddProperty={controller.onAddProperty}
				onAddRelationship={controller.onAddRelationship}
				onDeleteProperty={controller.onDeleteProperty}
				onEditProperty={controller.onEditProperty}
				onEnterNeighborhood={enterNeighborhood}
				onFixInvalidFrontmatter={openSourceEditor}
				onInitializeProperties={controller.onInitializeProperties}
				onCreateMissingType={controller.onOpenCreateTypeWithName}
				onOpenChangeNoteType={controller.onOpenChangeNoteType}
				onRemoveRelationship={controller.onRemoveRelationship}
				propertyDisplayModes={
					controller.snapshot.vaultConfig?.propertyDisplayModes
				}
				referenceGroups={referenceGroups}
				onSelectNote={openEditor}
			/>
		</View>
	);
}

function useSidebarSelectionActions(
	controller: PhoneWorkspaceController,
	openList: () => void,
) {
	return {
		selectFolder: useSelectAndOpenList(controller.onSelectFolder, openList),
		selectItem: useSelectAndOpenList(controller.onSelectSidebarItem, openList),
	};
}

function usePhonePropertiesScreenData(
	controller: PhoneWorkspaceController,
	openList: () => void,
) {
	const enterNeighborhood = useCallback(
		(noteId: string) => {
			controller.onEnterNeighborhood(noteId);
			openList();
		},
		[controller, openList],
	);
	const referenceGroups = useMobileInspectorReferenceGroups(
		controller.selectedNote,
		controller.snapshot,
	);
	const title = controller.selectedNote
		? noteFilename(noteWritePath(controller.selectedNote))
		: mobileText("inspector.title.properties");
	return { enterNeighborhood, referenceGroups, title };
}

function useSelectAndOpenList<Selection>(
	select: (selection: Selection) => void,
	openList: () => void,
) {
	return useCallback(
		(selection: Selection) => {
			select(selection);
			openList();
		},
		[select, openList],
	);
}

export function PhoneWorkspaceScreens(props: PhoneWorkspaceStateViewProps) {
	const width = usePhoneViewportWidth();
	return (
		<Fragment>
			<PhoneScreenLayer
				active={props.phoneState === "sidebar"}
				eager
				frame={phoneRailFrame("sidebar", width)}
				testID="phone-sidebar-slot"
			>
				<PhoneSidebarDrawer {...props} />
			</PhoneScreenLayer>
			<PhoneScreenLayer
				active={props.phoneState === "list"}
				eager
				frame={phoneRailFrame("list", width)}
				testID="phone-list-slot"
			>
				<PhoneNoteListScreen {...props} />
			</PhoneScreenLayer>
			<PhoneScreenLayer
				active={props.phoneState === "editor"}
				retain
				frame={phoneRailFrame("editor", width)}
				testID="phone-editor-slot"
			>
				<PhoneEditorScreen {...props} />
			</PhoneScreenLayer>
			<PhoneScreenLayer
				active={props.phoneState === "properties"}
				eager
				frame={phoneRailFrame("properties", width)}
				testID="phone-properties-slot"
			>
				<PhonePropertiesScreen {...props} />
			</PhoneScreenLayer>
		</Fragment>
	);
}
