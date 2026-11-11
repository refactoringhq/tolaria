import { List } from "phosphor-react-native";
import { Fragment, type ReactNode, useCallback } from "react";
import { View } from "react-native";
import { MobileNoteListPanel } from "../components/workspace/MobileNoteListPanel";
import { MobilePropertiesPanel } from "../components/workspace/MobilePropertiesPanel";
import { MobileWorkspaceSidebar } from "../components/workspace/MobileWorkspaceSidebar";
import { mobileNoteListPrimarySwipeAction } from "../components/workspace/mobileNoteListRows";
import { mobileCopy, mobileText } from "../i18n/mobileText";
import { probeProps } from "../qa/mobileLayoutProbe";
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import { desktopToolbarActionParity } from "../ui/desktopParity";
import { MobileIconButton } from "../ui/MobileIconButton";
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
	phoneState,
}: PhoneWorkspaceStateViewProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const leading = (
		<MobileIconButton
			accessibilityLabel={mobileCopy.showSidebar}
			density="leading"
			onLayout={({ nativeEvent: { layout } }) =>
				logMobileMotionEvent("chrome-layout", {
					height: layout.height,
					width: layout.width,
					x: layout.x,
					y: layout.y,
					control: "hamburger",
				})
			}
			testID="phone-note-list-sidebar-button"
			onPress={openSidebar}
		>
			<List
				color={mobileColors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
		</MobileIconButton>
	);

	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.list.screen")}
			onLayout={({ nativeEvent: { layout } }) =>
				logMobileMotionEvent("first-list-frame", {
					height: layout.height,
					width: layout.width,
					x: layout.x,
					y: layout.y,
				})
			}
			style={styles.screen}
			testID="phone-note-list-screen"
		>
			<PhoneNoteListContent
				controller={controller}
				options={options}
				leading={leading}
				openEditor={openEditor}
				scrollsToTop={phoneState === "list"}
			/>
		</View>
	);
}

function PhoneNoteListContent({
	controller,
	options,
	leading,
	openEditor,
	scrollsToTop,
}: Pick<
	PhoneWorkspaceStateViewProps,
	"controller" | "options" | "openEditor"
> & { leading: ReactNode; scrollsToTop: boolean }) {
	return (
		<MobileNoteListPanel
			compact
			scrollsToTop={scrollsToTop}
			onToggleNoteFavorite={controller.onToggleNoteFavorite}
			bulkActions={phoneNoteListBulkActions(controller)}
			displayPropertyKeys={controller.noteListProperties}
			emptyVault={mobileWorkspaceHasNoVault(controller.snapshot)}
			fullWidth
			leading={leading}
			layoutProbe={options.layoutProbe}
			neighborhood={controller.noteListNeighborhood}
			noteListFilter={controller.noteListFilter}
			noteListFilterCounts={controller.noteListFilterCounts}
			noteListFilterVisible={controller.noteListFilterVisible}
			notes={controller.notes}
			propertyDisplayModes={
				controller.snapshot.vaultConfig?.propertyDisplayModes
			}
			searchQuery={controller.searchQuery || undefined}
			selectedNoteId={controller.selectedNoteId}
			subtitle={controller.noteListSubtitle}
			title={controller.noteListTitle}
			typeDefinitions={controller.snapshot.typeDefinitions}
			onOpenCreateNote={controller.onOpenCreateNote}
			onOpenSearch={controller.onOpenSearch}
			onOpenVault={controller.onOpenCreateNote}
			onNoteListFilterChange={controller.onNoteListFilterChange}
			onSelectNote={openEditor}
		/>
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
	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.sidebar.screen")}
			style={styles.drawerRoot}
			testID="phone-sidebar-screen"
		>
			<View
				{...probeProps(phoneLayoutProbe, "phone.sidebar.drawer")}
				style={[styles.drawerPanel, { width: drawerWidth }]}
			>
				<PhoneSidebarContent
					controller={controller}
					options={options}
					openCommandPalette={openCommandPalette}
					openList={openList}
				/>
			</View>
		</View>
	);
}

function PhoneSidebarContent({
	controller,
	options,
	openCommandPalette,
	openList,
}: Pick<
	PhoneWorkspaceStateViewProps,
	"controller" | "options" | "openCommandPalette" | "openList"
>) {
	const selectFolder = useSelectAndOpenList(
		controller.onSelectFolder,
		openList,
	);
	const selectItem = useSelectAndOpenList(
		controller.onSelectSidebarItem,
		openList,
	);

	return (
		<MobileWorkspaceSidebar
			fullWidth
			scrollsToTop={false}
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

	return (
		<View
			{...probeProps(phoneLayoutProbe, "phone.properties.screen")}
			style={styles.screen}
			testID="phone-properties-screen"
		>
			<PhoneTopBar title={title} onBack={returnToEditor} />
			<PhonePropertiesContent
				controller={controller}
				options={options}
				openEditor={openEditor}
				openSourceEditor={openSourceEditor}
				referenceGroups={referenceGroups}
				enterNeighborhood={enterNeighborhood}
			/>
		</View>
	);
}

function PhonePropertiesContent({
	controller,
	options,
	openEditor,
	openSourceEditor,
	referenceGroups,
	enterNeighborhood,
}: Pick<
	PhoneWorkspaceStateViewProps,
	"controller" | "options" | "openEditor" | "openSourceEditor"
> & {
	referenceGroups: ReturnType<typeof useMobileInspectorReferenceGroups>;
	enterNeighborhood: (noteId: string) => void;
}) {
	return (
		<MobilePropertiesPanel
			compact
			scrollsToTop={false}
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
	);
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
				eager={props.prepareNewNoteEditor}
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
