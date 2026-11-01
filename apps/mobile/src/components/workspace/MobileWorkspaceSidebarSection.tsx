import { SymbolView } from "expo-symbols";
import {
	CaretDown,
	CaretRight,
	Eye,
	FileText,
	Plus,
} from "phosphor-react-native";
import { useState } from "react";
import { Platform, Pressable, useWindowDimensions, View } from "react-native";
import { mobileCopy, mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import { MobileIconButton } from "../../ui/MobileIconButton";
import { isPhoneViewport } from "../../ui/mobileMetrics";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileSidebarSection } from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { MobileSidebarCountPill } from "./MobileSidebarCountPill";
import type {
	SidebarSectionId,
	SidebarSectionProps,
} from "./MobileWorkspaceSidebar.types";
import { FolderTree } from "./MobileWorkspaceSidebarFolderTree";
import { SidebarSectionItems } from "./MobileWorkspaceSidebarItems";
import { createSidebarStyles as createThemeStyles } from "./mobileSidebarStyles";

export function SidebarSection(props: SidebarSectionProps) {
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
			{expanded && <SidebarSectionItems {...props} />}
			{expanded && section.folders && (
				<FolderTree
					activeFolderId={props.activeFolderId}
					folders={section.folders}
					layoutProbe={layoutProbe}
					onOpenFolderActions={props.onOpenFolderActions}
					onSelectFolder={props.onSelectFolder}
				/>
			)}
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

function SectionTitle(props: {
	expanded: boolean;
	count?: string;
	createAccessibilityLabel?: string;
	label: string;
	layoutProbe?: MobileLayoutProbe;
	onCreate?: () => void;
	onVisibility?: () => void;
	onToggle: () => void;
	sectionId: SidebarSectionId;
	visibilityAccessibilityLabel?: string;
}) {
	const { count, label, layoutProbe, sectionId } = props;
	const themeStyles = useMobileStyles(createThemeStyles);
	const { styles, mobileColors } = themeStyles;
	const { fontScale } = useWindowDimensions();
	const metricId = `sidebar.section.${sectionId}`;
	return (
		<View
			{...probeProps(layoutProbe, `${metricId}.row`)}
			style={[
				styles.sectionTitleRow,
				themeStyles.nativeSectionTitleRowStyle,
				count ? styles.sectionTitleRowWithCount : styles.sectionTitleRowRegular,
				fontScale > 1.3 && styles.sectionTitleRowStacked,
			]}
			testID={`sidebar-section-title-${sectionId}`}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{ expanded: props.expanded }}
				{...probeProps(layoutProbe, `${metricId}.toggle`)}
				onPress={props.onToggle}
				style={styles.sectionTitleToggle}
				testID={`sidebar-section-toggle-${sectionId}`}
			>
				<SectionDisclosure
					expanded={props.expanded}
					color={mobileColors.textMuted}
					size={themeStyles.metrics.size(13)}
				/>
				{sectionId === "views" && (
					<SymbolView
						fallback={<FileText color={mobileColors.textMuted} size={13} />}
						name={{ ios: "square.grid.2x2", android: "grid_view" }}
						size={13}
						tintColor={mobileColors.textMuted}
					/>
				)}
				{sectionId === "favorites" && (
					<SymbolView
						fallback={<FileText color={mobileColors.textMuted} size={13} />}
						name={{ ios: "star", android: "star" }}
						size={13}
						tintColor={mobileColors.textMuted}
					/>
				)}
				<Text
					{...probeProps(layoutProbe, `${metricId}.label`)}
					style={[styles.sectionTitle, themeStyles.nativeSectionTitleTextStyle]}
					testID={`sidebar-section-title-text-${sectionId}`}
				>
					{label}
				</Text>
			</Pressable>
			<SectionTitleActions {...props} />
		</View>
	);
}

function SectionDisclosure({
	expanded,
	color,
	size,
}: {
	expanded: boolean;
	color: string;
	size: number;
}) {
	return (
		<SymbolView
			fallback={
				expanded ? (
					<CaretDown color={color} size={size} />
				) : (
					<CaretRight color={color} size={size} />
				)
			}
			name={{
				ios: expanded ? "chevron.down" : "chevron.right",
				android: expanded ? "keyboard_arrow_down" : "chevron_right",
			}}
			size={size}
			tintColor={color}
		/>
	);
}

function SectionTitleActions(props: Parameters<typeof SectionTitle>[0]) {
	const { count, layoutProbe, sectionId } = props;
	const themeStyles = useMobileStyles(createThemeStyles);
	const { styles, mobileColors, metrics } = themeStyles;
	const { fontScale, width } = useWindowDimensions();
	const isPhone = isPhoneViewport(
		width,
		Platform.OS === "ios" && Platform.isPad,
	);
	const actions = sectionTitleActions(props);
	if (!count && actions.length === 0) return null;
	return (
		<View
			style={[
				styles.sectionTitleActions,
				fontScale > 1.3 && styles.sectionTitleActionsStacked,
			]}
		>
			{count && (
				<MobileSidebarCountPill
					compact
					layoutProbe={layoutProbe}
					metricId={`sidebar.section.${sectionId}.count`}
					plain={isPhone}
					testID={`sidebar-section-count-${sectionId}`}
					value={count}
				/>
			)}
			{actions.map(({ accessibilityLabel, Icon, id, onPress }) => (
				<MobileIconButton
					key={id}
					accessibilityLabel={accessibilityLabel}
					testID={`sidebar-section-${id}-${sectionId}`}
					onPress={onPress}
				>
					<SymbolView
						fallback={
							<Icon color={mobileColors.textMuted} size={metrics.size(12)} />
						}
						name={{
							ios: id === "visibility" ? "eye" : "plus",
							android: id === "visibility" ? "visibility" : "add",
						}}
						size={metrics.size(14)}
						tintColor={mobileColors.textMuted}
					/>
				</MobileIconButton>
			))}
		</View>
	);
}

function sectionTitleActions(props: Parameters<typeof SectionTitle>[0]) {
	return [
		{
			id: "visibility",
			Icon: Eye,
			onPress: props.onVisibility,
			accessibilityLabel:
				props.visibilityAccessibilityLabel ??
				mobileText("sidebar.section.showInSidebar"),
		},
		{
			id: "create",
			Icon: Plus,
			onPress: props.onCreate,
			accessibilityLabel:
				props.createAccessibilityLabel ??
				mobileText("sidebar.action.createView"),
		},
	].filter((action) => action.onPress);
}

function sectionVisibilityAccessibilityLabel(sectionId: SidebarSectionId) {
	return sectionId === "types"
		? mobileText("sidebar.section.showInSidebar")
		: undefined;
}

function sectionVisibilityHandler(
	sectionId: SidebarSectionId,
	onOpenTypeVisibility?: () => void,
) {
	return sectionId === "types" ? onOpenTypeVisibility : undefined;
}

function sectionCreateAccessibilityLabel(sectionId: SidebarSectionId) {
	if (sectionId === "folders") return mobileText("sidebar.action.createFolder");
	if (sectionId === "types") return mobileText("sidebar.action.createType");
	if (sectionId === "views") return mobileText("sidebar.action.createView");
	return undefined;
}

function sectionCreateHandler(
	sectionId: SidebarSectionId,
	folder?: () => void,
	type?: () => void,
	view?: () => void,
) {
	if (sectionId === "folders") return folder;
	if (sectionId === "types") return type;
	if (sectionId === "views") return view;
	return undefined;
}

function sidebarSectionLabel(id: SidebarSectionId, fallback: string) {
	if (id === "folders") return mobileText("sidebar.group.folders");
	if (id === "favorites") return mobileCopy.favorites;
	if (id === "types") return mobileCopy.types;
	if (id === "views") return mobileCopy.views;
	return fallback;
}
