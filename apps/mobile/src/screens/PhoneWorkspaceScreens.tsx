import { Fragment, useCallback } from "react";
import { View } from "react-native";
import { MobilePropertiesPanel } from "../components/workspace/MobilePropertiesPanel";
import { MobileWorkspaceSidebar } from "../components/workspace/MobileWorkspaceSidebar";
import { mobileText } from "../i18n/mobileText";
import { probeProps } from "../qa/mobileLayoutProbe";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import {
	noteFilename,
	noteWritePath,
} from "../workspace/mobileWorkspacePathRewrites";
import { PhoneNoteListScreen } from "./PhoneNoteListScreen";
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
	const selectFolder = useSelectAndOpenList(
		controller.onSelectFolder,
		openList,
	);
	const selectItem = useSelectAndOpenList(
		controller.onSelectSidebarItem,
		openList,
	);
	return (
		<PhoneSidebarDrawerContent
			controller={controller}
			drawerWidth={drawerWidth}
			layoutProbe={phoneLayoutProbe}
			options={options}
			openCommandPalette={openCommandPalette}
			selectFolder={selectFolder}
			selectItem={selectItem}
			styles={styles}
		/>
	);
}

function PhoneSidebarDrawerContent(props: {
	controller: PhoneWorkspaceController;
	drawerWidth: number;
	layoutProbe: PhoneWorkspaceStateViewProps["phoneLayoutProbe"];
	options: PhoneWorkspaceStateViewProps["options"];
	openCommandPalette: () => void;
	selectFolder: (
		folderId: Parameters<PhoneWorkspaceController["onSelectFolder"]>[0],
	) => void;
	selectItem: (
		itemId: Parameters<PhoneWorkspaceController["onSelectSidebarItem"]>[0],
	) => void;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return (
		<View
			{...probeProps(props.layoutProbe, "phone.sidebar.screen")}
			style={props.styles.drawerRoot}
			testID="phone-sidebar-screen"
		>
			<View
				{...probeProps(props.layoutProbe, "phone.sidebar.drawer")}
				style={[props.styles.drawerPanel, { width: props.drawerWidth }]}
			>
				<MobileWorkspaceSidebar
					fullWidth
					activeFolderId={props.controller.activeFolderId}
					activeItemId={props.controller.activeItemId}
					layoutProbe={props.options.layoutProbe}
					sections={props.controller.snapshot.sidebarSections}
					title={props.controller.snapshot.source?.label}
					onCreateFolder={props.controller.onOpenCreateFolder}
					onCreateType={props.controller.onOpenCreateType}
					onCreateView={props.controller.onOpenCreateView}
					onOpenFolderActions={props.controller.onOpenFolderActions}
					onOpenFavoriteActions={props.controller.onOpenFavoriteActions}
					onOpenPrimaryActions={props.controller.onOpenPrimaryActions}
					onOpenTypeActions={props.controller.onOpenTypeActions}
					onOpenTypeVisibility={props.controller.onOpenTypeVisibility}
					onOpenViewActions={props.controller.onOpenViewActions}
					onSelectFolder={props.selectFolder}
					onSelectItem={props.selectItem}
					onOpenCommandPalette={props.openCommandPalette}
				/>
			</View>
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
			<PhonePropertiesPanelContent
				controller={controller}
				layoutProbe={options.layoutProbe}
				onEnterNeighborhood={enterNeighborhood}
				onFixInvalidFrontmatter={openSourceEditor}
				onSelectNote={openEditor}
				referenceGroups={referenceGroups}
			/>
		</View>
	);
}

function PhonePropertiesPanelContent(props: {
	controller: PhoneWorkspaceController;
	layoutProbe: PhoneWorkspaceStateViewProps["options"]["layoutProbe"];
	onEnterNeighborhood: (noteId: string) => void;
	onFixInvalidFrontmatter: () => void;
	onSelectNote: () => void;
	referenceGroups: ReturnType<typeof useMobileInspectorReferenceGroups>;
}) {
	return (
		<MobilePropertiesPanel
			compact
			fullWidth
			showToolbar={false}
			layoutProbe={props.layoutProbe}
			note={props.controller.selectedNote}
			typeDefinitions={props.controller.snapshot.typeDefinitions}
			onAddProperty={props.controller.onAddProperty}
			onAddRelationship={props.controller.onAddRelationship}
			onDeleteProperty={props.controller.onDeleteProperty}
			onEditProperty={props.controller.onEditProperty}
			onEnterNeighborhood={props.onEnterNeighborhood}
			onFixInvalidFrontmatter={props.onFixInvalidFrontmatter}
			onInitializeProperties={props.controller.onInitializeProperties}
			onCreateMissingType={props.controller.onOpenCreateTypeWithName}
			onOpenChangeNoteType={props.controller.onOpenChangeNoteType}
			onRemoveRelationship={props.controller.onRemoveRelationship}
			propertyDisplayModes={
				props.controller.snapshot.vaultConfig?.propertyDisplayModes
			}
			referenceGroups={props.referenceGroups}
			onSelectNote={props.onSelectNote}
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
