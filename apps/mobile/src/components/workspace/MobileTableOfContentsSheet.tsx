import { TextHOne, TextHThree, TextHTwo } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileSpace } from "../../ui/tokens";
import {
	buildMobileTableOfContents,
	type MobileTableOfContentsItem,
	type MobileTableOfContentsLevel,
	type MobileTableOfContentsTarget,
} from "../../workspace/mobileTableOfContents";
import type {
	MobileEditorBlock,
	MobileNote,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

type MobileTableOfContentsSheetProps = {
	blocks: MobileEditorBlock[];
	bullets: string[];
	note: MobileNote | null;
	onClose: () => void;
	onSelectTarget?: (target: MobileTableOfContentsTarget) => void;
};

export function MobileTableOfContentsSheet({
	blocks,
	bullets,
	note,
	onClose,
	onSelectTarget,
}: MobileTableOfContentsSheetProps) {
	const themeStyles = useMobileStyles(createThemeStyles);
	const { styles, mobileColors } = themeStyles;
	if (!note) {
		return (
			<View style={styles.emptyState}>
				<Text style={styles.emptyText}>
					{mobileText("tableOfContents.emptyNoNote")}
				</Text>
			</View>
		);
	}

	const toc = buildMobileTableOfContents({
		blocks,
		bullets,
		note,
		untitledLabel: mobileText("tableOfContents.untitledHeading"),
	});

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			testID="table-of-contents-panel"
		>
			<View style={styles.header}>
				<ChromeSymbol
					name="list"
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
				<Text style={styles.headerText}>
					{mobileText("tableOfContents.navLabel")}
				</Text>
			</View>
			<MobileTocNode
				depth={0}
				item={toc}
				onPress={onClose}
				onSelectTarget={onSelectTarget}
			/>
		</ScrollView>
	);
}

function MobileTocNode({
	depth,
	item,
	onPress,
	onSelectTarget,
}: {
	depth: number;
	item: MobileTableOfContentsItem;
	onPress: () => void;
	onSelectTarget?: (target: MobileTableOfContentsTarget) => void;
}) {
	return (
		<>
			<MobileTocRow
				depth={depth}
				item={item}
				onPress={onPress}
				onSelectTarget={onSelectTarget}
			/>
			{item.children.map((child) => (
				<MobileTocNode
					key={child.id}
					depth={depth + 1}
					item={child}
					onPress={onPress}
					onSelectTarget={onSelectTarget}
				/>
			))}
		</>
	);
}

function MobileTocRow({
	depth,
	item,
	onPress,
	onSelectTarget,
}: {
	depth: number;
	item: MobileTableOfContentsItem;
	onPress: () => void;
	onSelectTarget?: (target: MobileTableOfContentsTarget) => void;
}) {
	const themeStyles = useMobileStyles(createThemeStyles);
	const { styles } = themeStyles;
	const selectTarget = () => {
		onSelectTarget?.(item);
		onPress();
	};

	return (
		<Pressable
			accessibilityLabel={item.title}
			accessibilityRole="button"
			style={({ pressed }) => [
				styles.row,
				{ paddingLeft: mobileSpace.sm + depth * mobileSpace.lg },
				pressed ? styles.rowPressed : null,
			]}
			testID={`table-of-contents-row-${item.id}`}
			onPress={selectTarget}
		>
			<View style={styles.iconSlot}>{tocIcon(themeStyles, item.level)}</View>
			<Text numberOfLines={1} style={styles.rowText}>
				{item.title}
			</Text>
		</Pressable>
	);
}

function tocIcon(
	themeStyles: ReturnType<typeof createThemeStyles>,
	level: MobileTableOfContentsLevel,
): ReactNode {
	const { mobileColors } = themeStyles;
	if (level === 1)
		return (
			<TextHOne
				color={mobileColors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
		);
	if (level === 2)
		return (
			<TextHTwo
				color={mobileColors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
		);
	return (
		<TextHThree
			color={mobileColors.textMuted}
			size={desktopToolbarActionParity.iconSize}
		/>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...contentsLayoutStyles(mobileColors, metrics),
		...contentsRowStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function contentsLayoutStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		content: {
			gap: mobileSpace.xs,
			padding: mobileSpace.md,
		},
		emptyState: {
			minHeight: 96,
			alignItems: "center",
			justifyContent: "center",
			padding: mobileSpace.md,
		},
		emptyText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.body,
		},
		header: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			paddingBottom: mobileSpace.sm,
		},
		headerText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "500",
		},
	});
}

function contentsRowStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const {
		space: mobileSpace,
		type: mobileType,
		toolbarAction: desktopToolbarActionParity,
	} = metrics;
	return StyleSheet.create({
		iconSlot: {
			width: desktopToolbarActionParity.iconSize,
			alignItems: "center",
		},
		row: {
			minHeight: 32,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			borderRadius: 4,
			paddingRight: mobileSpace.sm,
			paddingVertical: mobileSpace.xs,
		},
		rowPressed: {
			backgroundColor: mobileColors.control,
		},
		rowText: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
	});
}
