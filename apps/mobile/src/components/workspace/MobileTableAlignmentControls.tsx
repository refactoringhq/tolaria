import { Pressable, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileMarkdownTableAlignment } from "../../workspace/mobileMarkdownTables";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

type MobileTableAlignmentControlsProps = {
	alignments: MobileMarkdownTableAlignment[];
	columnCount: number;
	onChangeAlignment: (
		columnIndex: number,
		alignment: MobileMarkdownTableAlignment,
	) => void;
};

const tableAlignmentOptions: MobileMarkdownTableAlignment[] = [
	"default",
	"left",
	"center",
	"right",
];

export function MobileTableAlignmentControls({
	alignments,
	columnCount,
	onChangeAlignment,
}: MobileTableAlignmentControlsProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	if (columnCount <= 0) return null;

	return (
		<View style={styles.group} testID="workspace-table-alignment-controls">
			{Array.from({ length: columnCount }, (_value, columnIndex) => (
				<ColumnAlignmentRow
					alignment={alignments[columnIndex] ?? "default"}
					columnIndex={columnIndex}
					key={`alignment-${columnIndex}`}
					onChangeAlignment={onChangeAlignment}
				/>
			))}
		</View>
	);
}

function ColumnAlignmentRow({
	alignment,
	columnIndex,
	onChangeAlignment,
}: {
	alignment: MobileMarkdownTableAlignment;
	columnIndex: number;
	onChangeAlignment: (
		columnIndex: number,
		alignment: MobileMarkdownTableAlignment,
	) => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const label = tableColumnAlignmentLabel(columnIndex);

	return (
		<View
			style={styles.row}
			testID={`workspace-table-alignment-row-${columnIndex}`}
		>
			<Text numberOfLines={1} style={styles.label}>
				{label}
			</Text>
			<View style={styles.options}>
				{tableAlignmentOptions.map((option) => (
					<AlignmentButton
						alignment={option}
						columnIndex={columnIndex}
						key={option}
						label={`${label}: ${tableAlignmentLabel(option)}`}
						selected={option === alignment}
						onPress={() => onChangeAlignment(columnIndex, option)}
					/>
				))}
			</View>
		</View>
	);
}

function AlignmentButton({
	alignment,
	columnIndex,
	label,
	onPress,
	selected,
}: {
	alignment: MobileMarkdownTableAlignment;
	columnIndex: number;
	label: string;
	onPress: () => void;
	selected: boolean;
}) {
	const { mobileColors, styles } = useMobileStyles(createThemeStyles);
	const color = selected ? mobileColors.blue : mobileColors.textMuted;

	return (
		<Pressable
			accessibilityLabel={label}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			hitSlop={6}
			style={({ pressed }) => [
				styles.option,
				selected ? styles.optionSelected : null,
				pressed ? styles.optionPressed : null,
			]}
			testID={`workspace-table-alignment-${columnIndex}-${alignment}`}
			onPress={onPress}
		>
			{alignmentIcon({ alignment, color })}
		</Pressable>
	);
}

function alignmentIcon({
	alignment,
	color,
}: {
	alignment: MobileMarkdownTableAlignment;
	color: string;
}) {
	const size = desktopToolbarActionParity.iconSize;
	if (alignment === "left")
		return <ChromeSymbol name="alignLeft" color={color} size={size} />;
	if (alignment === "center")
		return <ChromeSymbol name="alignCenter" color={color} size={size} />;
	if (alignment === "right")
		return <ChromeSymbol name="alignRight" color={color} size={size} />;
	return <ChromeSymbol name="alignJustify" color={color} size={size} />;
}

function tableColumnAlignmentLabel(columnIndex: number): string {
	return `${mobileText("editor.table.column").replace("{index}", `${columnIndex + 1}`)} · ${mobileText("editor.table.alignment")}`;
}

function tableAlignmentLabel(alignment: MobileMarkdownTableAlignment): string {
	if (alignment === "left") return mobileText("editor.table.alignLeft");
	if (alignment === "center") return mobileText("editor.table.alignCenter");
	if (alignment === "right") return mobileText("editor.table.alignRight");
	return mobileText("editor.table.alignDefault");
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	const styles = StyleSheet.create({
		group: {
			gap: mobileSpace.xs,
		},
		label: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "500",
		},
		option: {
			height: 26,
			width: 26,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 4,
		},
		optionPressed: {
			backgroundColor: mobileColors.graySoft,
		},
		optionSelected: {
			backgroundColor: mobileColors.selected,
		},
		options: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		row: {
			minHeight: 34,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
		},
	});
	return { mobileColors, styles };
}
