import MenuView from "@expo/ui/community/menu";
import type { AndroidSymbol, SFSymbol } from "expo-symbols";
import { SymbolView } from "expo-symbols";
import { FileText } from "phosphor-react-native";
import type { ReactNode } from "react";
import {
	type ColorValue,
	Platform,
	PlatformColor,
	Pressable,
	useWindowDimensions,
	View,
} from "react-native";
import { mobileCopy, mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import {
	isPhoneViewport,
	type MobileMetrics,
	phoneViewportStyle,
} from "../../ui/mobileMetrics";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type {
	MobileNote,
	MobileSidebarIcon,
	MobileSidebarItem,
} from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { MobileSidebarCountPill } from "./MobileSidebarCountPill";
import { mobilePhosphorIconElement } from "./MobileWorkspaceIconResolver";
import type {
	MobileSidebarItemSelection,
	SidebarDisplayLabel,
	SidebarItemId,
	SidebarItemTone,
	SidebarMetricId,
	SidebarSectionId,
	SidebarSectionProps,
	SidebarSelectionHandler,
	SidebarSlug,
} from "./MobileWorkspaceSidebar.types";
import { createSidebarStyles as createThemeStyles } from "./mobileSidebarStyles";
import { noteTypeColor, noteTypeSoftColor } from "./mobileWorkspaceTone";

type SidebarItemProps = {
	active?: boolean;
	activeBackgroundColor?: ColorValue;
	activeColor?: string;
	count?: string;
	icon: ReactNode;
	label: SidebarDisplayLabel;
	layoutProbe?: MobileLayoutProbe;
	metricId: SidebarMetricId;
	onLongPress?: () => void;
	onPress?: () => void;
	sectionId: SidebarSectionId;
	slug: SidebarSlug;
};

export function SidebarSectionItems(props: SidebarSectionProps) {
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
					icon={sidebarIcon({
						themeStyles,
						icon: item.icon,
						tone: active ? (item.tone ?? "primary") : item.tone,
						itemId: item.id,
						sectionId: section.id,
					})}
					key={item.id}
					label={label}
					layoutProbe={layoutProbe}
					metricId={`sidebar.item.${item.id}`}
					sectionId={section.id}
					slug={item.id}
					onLongPress={sidebarItemLongPress({
						...props,
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
	onOpenPrimaryActions?: SidebarSelectionHandler;
	onOpenTypeActions?: SidebarSelectionHandler;
	onOpenViewActions?: SidebarSelectionHandler;
	onOpenFavoriteActions?: SidebarSelectionHandler;
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

function SidebarItem(props: SidebarItemProps) {
	const row = <SidebarItemRow {...props} />;
	if (!props.onLongPress || Platform.OS === "web") return row;
	return (
		<MenuView
			actions={[
				{
					id: "open-actions",
					title: sidebarContextActionLabel(props.sectionId, props.slug),
				},
			]}
			onPressAction={props.onLongPress}
			shouldOpenOnLongPress
			testID={`sidebar-context-menu-${props.slug}`}
			title={props.label}
		>
			{row}
		</MenuView>
	);
}

function SidebarItemRow(props: SidebarItemProps) {
	const themeStyles = useMobileStyles(createThemeStyles);
	const isPhone = isPhoneViewport(
		useWindowDimensions().width,
		Platform.OS === "ios" && Platform.isPad,
	);
	const { mobileColors, styles } = themeStyles;
	const {
		active = false,
		activeBackgroundColor = mobileColors.primarySoft,
		activeColor = mobileColors.primary,
		count,
		icon,
		label,
		layoutProbe,
		metricId,
		onLongPress,
		onPress,
		slug,
	} = props;
	return (
		<Pressable
			{...probeProps(layoutProbe, `${metricId}.row`)}
			accessibilityLabel={label}
			accessibilityRole="button"
			delayLongPress={300}
			onLongPress={Platform.OS === "web" ? onLongPress : undefined}
			onPress={onPress}
			style={[
				styles.item,
				sidebarItemPadding(themeStyles.metrics.sidebar, Boolean(count)),
				phoneViewportStyle(isPhone, themeStyles.phoneItemStyle),
				Platform.OS === "android" ? { minHeight: 56 } : null,
				active
					? {
							backgroundColor: activeBackgroundColor,
							...(Platform.OS === "android" ? { borderRadius: 28 } : {}),
						}
					: null,
			]}
			testID={`sidebar-item-${slug}`}
		>
			<View
				{...probeProps(layoutProbe, `${metricId}.content`)}
				style={[
					styles.itemContent,
					sidebarItemContentHeight(themeStyles.metrics.sidebar, Boolean(count)),
					phoneViewportStyle(isPhone, themeStyles.phoneItemContentStyle),
				]}
			>
				{icon}
				<Text
					{...probeProps(layoutProbe, `${metricId}.label`)}
					numberOfLines={1}
					style={[
						styles.itemText,
						themeStyles.nativeItemTextStyle,
						phoneViewportStyle(isPhone, themeStyles.phoneItemTextStyle),
						active ? { color: activeColor } : null,
					]}
					testID={`sidebar-item-${slug}-label`}
				>
					{label}
				</Text>
				{count && (
					<MobileSidebarCountPill
						activeColor={active ? activeColor : undefined}
						layoutProbe={layoutProbe}
						metricId={`${metricId}.count`}
						plain={isPhone}
						testID={`sidebar-item-${slug}-count`}
						value={count}
					/>
				)}
			</View>
		</Pressable>
	);
}

function sidebarIcon({
	themeStyles,
	icon,
	tone,
	itemId,
	sectionId,
}: {
	themeStyles: ReturnType<typeof createThemeStyles>;
	icon: MobileSidebarIcon;
	tone: SidebarItemTone | undefined;
	itemId: string;
	sectionId: string;
}) {
	const color = sidebarIconColor(themeStyles, tone);
	const size = themeStyles.metrics.size(15);
	const systemSymbol = fixedSidebarSymbol(itemId, sectionId);
	if (systemSymbol)
		return (
			<SymbolView
				fallback={<FileText color={color} size={size} />}
				name={systemSymbol}
				size={size}
				tintColor={color}
			/>
		);
	return (
		mobilePhosphorIconElement(icon, { color, size }) ?? (
			<FileText color={color} size={size} />
		)
	);
}

function fixedSidebarSymbol(
	itemId: string,
	sectionId: string,
): { ios: SFSymbol; android: AndroidSymbol } | undefined {
	if (sectionId !== "primary") return undefined;
	const symbols = {
		"all-notes": { ios: "doc.text", android: "description" },
		archive: { ios: "archivebox", android: "archive" },
		inbox: { ios: "tray", android: "inbox" },
	} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;
	return Object.hasOwn(symbols, itemId)
		? symbols[itemId as keyof typeof symbols]
		: undefined;
}

function sidebarContextActionLabel(sectionId: string, itemId: string) {
	if (sectionId === "favorites")
		return mobileText("sidebar.action.moveFavoriteUp");
	if (sectionId === "views") return mobileText("sidebar.action.editView");
	if (sectionId === "types") return mobileText("sidebar.action.renameType");
	if (itemId === "all-notes")
		return mobileText("noteList.properties.customizeAllColumns");
	if (itemId === "inbox")
		return mobileText("noteList.properties.customizeInboxColumns");
	return mobileText("sidebar.action.customizeSections");
}

function sidebarIconColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: SidebarItemTone,
) {
	const { mobileColors } = themeStyles;
	if (tone === "primary") return mobileColors.primary;
	return tone ? noteTypeColor(tone, mobileColors) : mobileColors.textMuted;
}

function sidebarActiveColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: MobileNote["typeTone"],
) {
	return tone
		? noteTypeColor(tone, themeStyles.mobileColors)
		: themeStyles.mobileColors.primary;
}

function sidebarActiveBackgroundColor(
	themeStyles: ReturnType<typeof createThemeStyles>,
	tone?: MobileNote["typeTone"],
) {
	if (Platform.OS === "ios" && !tone) return PlatformColor("systemGray5");
	return tone
		? noteTypeSoftColor(tone, themeStyles.mobileColors)
		: themeStyles.mobileColors.primarySoft;
}

function sidebarLabel(id: SidebarItemId, fallback: SidebarDisplayLabel) {
	if (id === "all-notes") return mobileCopy.allNotes;
	if (id === "archive") return mobileCopy.archive;
	if (id === "inbox") return mobileCopy.inbox;
	return fallback;
}

function sidebarItemPadding(
	sidebar: MobileMetrics["sidebar"],
	hasCount: boolean,
) {
	const padding = hasCount
		? sidebar.itemPadding.withCount
		: sidebar.itemPadding.regular;
	const height = hasCount
		? sidebar.itemContentHeight.withCount
		: sidebar.itemContentHeight.regular;
	return {
		minHeight: height + padding.top + padding.bottom,
		paddingBottom: padding.bottom,
		paddingLeft: padding.left,
		paddingRight: padding.right,
		paddingTop: padding.top,
	};
}

function sidebarItemContentHeight(
	sidebar: MobileMetrics["sidebar"],
	hasCount: boolean,
) {
	return {
		minHeight: hasCount
			? sidebar.itemContentHeight.withCount
			: sidebar.itemContentHeight.regular,
	};
}
