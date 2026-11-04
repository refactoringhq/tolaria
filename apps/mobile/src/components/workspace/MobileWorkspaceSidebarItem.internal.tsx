import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import { mobilePressedStyle } from "../../ui/mobilePressFeedback";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { Text } from "../ui/text";
import { MobileSidebarCountPill } from "./MobileSidebarCountPill";
import { createSidebarStyles } from "./mobileSidebarStyles";

type SidebarItemProps = {
	active?: boolean;
	activeBackgroundColor?: string;
	activeColor?: string;
	count?: string;
	icon: ReactNode;
	label: string;
	layoutProbe?: MobileLayoutProbe;
	metricId: string;
	onLongPress?: () => void;
	onPress?: () => void;
	slug: string;
};

export function SidebarItem(props: SidebarItemProps) {
	const themeStyles = useMobileStyles(createSidebarStyles);
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
			onLongPress={onLongPress}
			onPress={onPress}
			style={({ pressed }) => [
				styles.item,
				sidebarItemPadding(themeStyles.metrics.sidebar, Boolean(count)),
				active ? { backgroundColor: activeBackgroundColor } : null,
				mobilePressedStyle(
					pressed,
					themeStyles.metrics.toolbarAction.pressedOpacity,
				),
			]}
			testID={`sidebar-item-${slug}`}
		>
			<SidebarItemContent
				active={active}
				activeColor={activeColor}
				count={count}
				icon={icon}
				label={label}
				layoutProbe={layoutProbe}
				metricId={metricId}
				slug={slug}
				themeStyles={themeStyles}
			/>
		</Pressable>
	);
}

function SidebarItemContent(
	props: SidebarItemProps & {
		themeStyles: ReturnType<typeof createSidebarStyles>;
	},
) {
	const {
		active,
		activeColor,
		count,
		icon,
		label,
		layoutProbe,
		metricId,
		slug,
		themeStyles,
	} = props;
	const { styles } = themeStyles;
	return (
		<View
			{...probeProps(layoutProbe, `${metricId}.content`)}
			style={[
				styles.itemContent,
				sidebarItemContentHeight(themeStyles.metrics.sidebar, Boolean(count)),
			]}
		>
			{icon}
			<Text
				{...probeProps(layoutProbe, `${metricId}.label`)}
				numberOfLines={1}
				style={[
					styles.itemText,
					themeStyles.nativeItemTextStyle,
					active ? { color: activeColor } : null,
				]}
				testID={`sidebar-item-${slug}-label`}
			>
				{label}
			</Text>
			{count ? (
				<MobileSidebarCountPill
					activeColor={active ? activeColor : undefined}
					layoutProbe={layoutProbe}
					metricId={`${metricId}.count`}
					testID={`sidebar-item-${slug}-count`}
					value={count}
				/>
			) : null}
		</View>
	);
}

function sidebarItemPadding(
	sidebar: MobileMetrics["sidebar"],
	hasCount: boolean,
) {
	const padding = hasCount
		? sidebar.itemPadding.withCount
		: sidebar.itemPadding.regular;
	const contentHeight = hasCount
		? sidebar.itemContentHeight.withCount
		: sidebar.itemContentHeight.regular;
	return {
		minHeight: contentHeight + padding.top + padding.bottom,
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
	const minHeight = hasCount
		? sidebar.itemContentHeight.withCount
		: sidebar.itemContentHeight.regular;
	return { minHeight };
}
