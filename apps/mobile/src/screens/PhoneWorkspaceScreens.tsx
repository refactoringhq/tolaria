import { Fragment, useCallback } from "react";
import { View } from "react-native";
import { MobileWorkspaceSidebar } from "../components/workspace/MobileWorkspaceSidebar";
import { probeProps } from "../qa/mobileLayoutProbe";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { PhoneNoteListScreen } from "./PhoneNoteListScreen";
import { PhonePropertiesSheet } from "./PhonePropertiesSheet";
import { PhoneScreenLayer } from "./PhoneScreenLayer";
import { PhoneEditorScreen } from "./PhoneWorkspaceEditorScreen";
import { phoneRailFrame } from "./phonePanelRail";
import type {
	PhoneWorkspaceController,
	PhoneWorkspaceStateViewProps,
} from "./phoneWorkspaceScreenSupport";
import { createThemeStyles } from "./phoneWorkspaceStyles";
import { phoneWorkspaceSidebarDrawerWidth } from "./phoneWorkspaceTransitions";
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
			<PhonePropertiesSheet {...props} />
		</Fragment>
	);
}
