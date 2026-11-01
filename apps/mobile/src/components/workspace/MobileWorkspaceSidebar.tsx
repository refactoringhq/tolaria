import { useCallback, useState } from "react";
import {
	type LayoutChangeEvent,
	Platform,
	PlatformColor,
	ScrollView,
	View,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileLayoutProbeReadout } from "../../qa/MobileLayoutProbeReadout";
import { useMobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { MobilePanel, MobileToolbar } from "../../ui/MobilePanel";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { MobileVaultPicker } from "../vaults/MobileVaultPicker";
import { MobileSidebarSettings } from "./MobileSidebarSettings";
import type { MobileWorkspaceSidebarProps } from "./MobileWorkspaceSidebar.types";
import { SidebarSection } from "./MobileWorkspaceSidebarSection";
import { createSidebarStyles as createThemeStyles } from "./mobileSidebarStyles";

export type { MobileSidebarItemSelection } from "./MobileWorkspaceSidebar.types";
export type { MobileSidebarFolderSelection } from "./MobileWorkspaceSidebarFolderTree";

type LayoutProbeState = ReturnType<typeof useMobileLayoutProbe>;

export function MobileWorkspaceSidebar(props: MobileWorkspaceSidebarProps) {
	const layoutProbe = useMobileLayoutProbe(props.layoutProbe ?? false);
	const controls = useMeasuredControls();
	return (
		<SidebarPanel controls={controls} layoutProbe={layoutProbe} props={props} />
	);
}

function SidebarPanel({
	controls,
	layoutProbe,
	props,
}: {
	controls: ReturnType<typeof useMeasuredControls>;
	layoutProbe: LayoutProbeState;
	props: MobileWorkspaceSidebarProps;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<MobilePanel
			{...layoutProbe.probe("sidebar.panel")}
			style={[
				styles.panel,
				Platform.OS === "ios"
					? { backgroundColor: PlatformColor("systemGroupedBackground") }
					: null,
				props.fullWidth && styles.fullWidth,
			]}
			testID="workspace-sidebar-panel"
		>
			<SidebarToolbar title={props.title} />
			<SidebarScroll
				controlsHeight={controls.height}
				layoutProbe={layoutProbe}
				props={props}
			/>
			<SidebarFooter
				controls={controls}
				onOpenCommandPalette={props.onOpenCommandPalette}
				styles={styles}
			/>
			{props.layoutProbe && (
				<MobileLayoutProbeReadout
					metrics={layoutProbe.metrics}
					testID="sidebar-layout-metrics"
				/>
			)}
		</MobilePanel>
	);
}

function SidebarScroll({
	controlsHeight,
	layoutProbe,
	props,
}: {
	controlsHeight: number;
	layoutProbe: LayoutProbeState;
	props: MobileWorkspaceSidebarProps;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			{...layoutProbe.probe("sidebar.scroll")}
			testID="sidebar-scroll"
			style={styles.scroll}
			contentContainerStyle={[
				styles.content,
				{ paddingBottom: controlsHeight },
			]}
			scrollIndicatorInsets={{ bottom: controlsHeight }}
		>
			{props.sections.map((section) => (
				<SidebarSection
					{...props}
					key={section.id}
					layoutProbe={layoutProbe.probe}
					section={section}
				/>
			))}
		</ScrollView>
	);
}

function SidebarToolbar({ title }: Pick<MobileWorkspaceSidebarProps, "title">) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<MobileToolbar testID="sidebar-toolbar">
			<View style={[styles.toolbarActions, styles.vaultPicker]}>
				<MobileVaultPicker
					title={title ?? mobileText("status.vault.default")}
				/>
			</View>
		</MobileToolbar>
	);
}

function SidebarFooter({
	controls,
	onOpenCommandPalette,
	styles,
}: {
	controls: ReturnType<typeof useMeasuredControls>;
	onOpenCommandPalette?: () => void;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return (
		<View
			pointerEvents="box-none"
			style={styles.floatingControls}
			onLayout={controls.onLayout}
			testID="sidebar-floating-controls"
		>
			<MobileSidebarSettings onOpenCommandPalette={onOpenCommandPalette} />
		</View>
	);
}

function useMeasuredControls() {
	const [height, setHeight] = useState(0);
	const onLayout = useCallback(
		(event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height),
		[],
	);
	return { height, onLayout };
}
