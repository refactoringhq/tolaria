import { Pressable, useWindowDimensions, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import { MobileIconButton } from "../../ui/MobileIconButton";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import type { ChromeSymbolName } from "../ui/chromeSymbolDefinitions";
import { Text } from "../ui/text";
import { MobileSidebarCountPill } from "./MobileSidebarCountPill";
import { createSidebarStyles } from "./mobileSidebarStyles";

export type MobileSidebarSectionTitleProps = {
	expanded: boolean;
	count?: string;
	createAccessibilityLabel?: string;
	label: string;
	layoutProbe?: MobileLayoutProbe;
	onCreate?: () => void;
	onVisibility?: () => void;
	onToggle: () => void;
	sectionId: string;
	visibilityAccessibilityLabel?: string;
};

type SectionTitleAction = {
	id: string;
	icon: ChromeSymbolName;
	onPress?: () => void;
	accessibilityLabel: string;
};

export function SectionTitle(props: MobileSidebarSectionTitleProps) {
	const { count, layoutProbe, sectionId } = props;
	const themeStyles = useMobileStyles(createSidebarStyles);
	const { styles } = themeStyles;
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
			<SectionTitleToggle {...props} />
			<SectionTitleActions {...props} />
		</View>
	);
}

function SectionTitleToggle(props: MobileSidebarSectionTitleProps) {
	const themeStyles = useMobileStyles(createSidebarStyles);
	const { styles, mobileColors, metrics } = themeStyles;
	const metricId = `sidebar.section.${props.sectionId}`;
	const symbol: ChromeSymbolName = props.expanded ? "caretDown" : "caretRight";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={props.label}
			accessibilityState={{ expanded: props.expanded }}
			{...probeProps(props.layoutProbe, `${metricId}.toggle`)}
			onPress={props.onToggle}
			style={styles.sectionTitleToggle}
			testID={`sidebar-section-toggle-${props.sectionId}`}
		>
			<ChromeSymbol
				name={symbol}
				color={mobileColors.textMuted}
				size={metrics.size(11)}
			/>
			<Text
				{...probeProps(props.layoutProbe, `${metricId}.label`)}
				style={[styles.sectionTitle, themeStyles.nativeSectionTitleTextStyle]}
				testID={`sidebar-section-title-text-${props.sectionId}`}
			>
				{props.label}
			</Text>
		</Pressable>
	);
}

function SectionTitleActions(props: MobileSidebarSectionTitleProps) {
	const { count, layoutProbe, sectionId } = props;
	const { styles, mobileColors, metrics } =
		useMobileStyles(createSidebarStyles);
	const { fontScale } = useWindowDimensions();
	const actions = sectionTitleActions(props);
	if (!count && actions.length === 0) return null;
	return (
		<View
			style={[
				styles.sectionTitleActions,
				fontScale > 1.3 && styles.sectionTitleActionsStacked,
			]}
		>
			{count ? (
				<MobileSidebarCountPill
					compact
					layoutProbe={layoutProbe}
					metricId={`sidebar.section.${sectionId}.count`}
					testID={`sidebar-section-count-${sectionId}`}
					value={count}
				/>
			) : null}
			{actions.map(({ accessibilityLabel, icon, id, onPress }) => (
				<MobileIconButton
					key={id}
					accessibilityLabel={accessibilityLabel}
					testID={`sidebar-section-${id}-${sectionId}`}
					onPress={() => onPress?.()}
				>
					<ChromeSymbol
						name={icon}
						color={mobileColors.textMuted}
						size={metrics.size(12)}
					/>
				</MobileIconButton>
			))}
		</View>
	);
}

function sectionTitleActions(
	props: MobileSidebarSectionTitleProps,
): SectionTitleAction[] {
	const actions: SectionTitleAction[] = [
		{
			id: "visibility",
			icon: "eye",
			onPress: props.onVisibility,
			accessibilityLabel:
				props.visibilityAccessibilityLabel ??
				mobileText("sidebar.section.showInSidebar"),
		},
		{
			id: "create",
			icon: "plus",
			onPress: props.onCreate,
			accessibilityLabel:
				props.createAccessibilityLabel ??
				mobileText("sidebar.action.createView"),
		},
	];
	return actions.filter((action) => action.onPress);
}
