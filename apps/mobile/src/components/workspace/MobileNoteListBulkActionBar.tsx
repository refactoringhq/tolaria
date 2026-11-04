import { ArchiveIcon, CheckCircle, Trash, X } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import { mobilePressedStyle } from "../../ui/mobilePressFeedback";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileRadius } from "../../ui/tokens";
import { Text } from "../ui/text";
import { MobileListMotion } from "./MobileSwipeableNoteRow";

type MobileNoteListBulkActionBarProps = {
	archivedMode: boolean;
	count: number;
	onArchiveToggle: () => void;
	onClear: () => void;
	onDelete: () => void;
	onOrganize: () => void;
};

export function MobileNoteListBulkActionBar({
	archivedMode,
	count,
	onArchiveToggle,
	onClear,
	onDelete,
	onOrganize,
}: MobileNoteListBulkActionBarProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<MobileListMotion testID="note-list-bulk-motion">
			<View style={styles.bar} testID="note-list-bulk-action-bar">
				<Text style={styles.count} testID="note-list-bulk-selected-count">
					{selectedCountLabel(count)}
				</Text>
				<BulkActionButtons
					archivedMode={archivedMode}
					mobileColors={mobileColors}
					onArchiveToggle={onArchiveToggle}
					onClear={onClear}
					onDelete={onDelete}
					onOrganize={onOrganize}
					presentation={{
						pressedOpacity: desktopToolbarActionParity.pressedOpacity,
						styles,
					}}
				/>
			</View>
		</MobileListMotion>
	);
}

function BulkActionButtons({
	archivedMode,
	mobileColors,
	onArchiveToggle,
	onClear,
	onDelete,
	onOrganize,
	presentation,
}: {
	archivedMode: boolean;
	mobileColors: MobileColors;
	onArchiveToggle: () => void;
	onClear: () => void;
	onDelete: () => void;
	onOrganize: () => void;
	presentation: {
		pressedOpacity: number;
		styles: ReturnType<typeof createThemeStyles>["styles"];
	};
}) {
	const { pressedOpacity, styles } = presentation;
	return (
		<View style={styles.actions}>
			<BulkActionButton
				accessibilityLabel={mobileText("noteList.bulk.organize")}
				pressedOpacity={pressedOpacity}
				testID="note-list-bulk-organize"
				onPress={onOrganize}
			>
				<CheckCircle color={mobileColors.textInverse} size={16} weight="fill" />
			</BulkActionButton>
			<BulkActionButton
				accessibilityLabel={mobileText(
					archivedMode ? "noteList.bulk.unarchive" : "noteList.bulk.archive",
				)}
				pressedOpacity={pressedOpacity}
				testID="note-list-bulk-archive"
				onPress={onArchiveToggle}
			>
				<ArchiveIcon color={mobileColors.textInverse} size={16} />
			</BulkActionButton>
			<BulkActionButton
				accessibilityLabel={mobileText("noteList.bulk.delete")}
				pressedOpacity={pressedOpacity}
				destructive
				testID="note-list-bulk-delete"
				onPress={onDelete}
			>
				<Trash color={mobileColors.textInverse} size={16} />
			</BulkActionButton>
			<BulkActionButton
				accessibilityLabel={mobileText("noteList.bulk.clear")}
				pressedOpacity={pressedOpacity}
				subtle
				testID="note-list-bulk-clear"
				onPress={onClear}
			>
				<X color={mobileColors.textInverse} size={16} />
			</BulkActionButton>
		</View>
	);
}

function BulkActionButton({
	accessibilityLabel,
	children,
	pressedOpacity,
	destructive = false,
	onPress,
	subtle = false,
	testID,
}: {
	accessibilityLabel: string;
	children: ReactNode;
	pressedOpacity: number;
	destructive?: boolean;
	onPress: () => void;
	subtle?: boolean;
	testID: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			hitSlop={8}
			onPress={onPress}
			style={({ pressed }) => [
				styles.action,
				destructive ? styles.destructiveAction : null,
				subtle ? styles.subtleAction : null,
				mobilePressedStyle(pressed, pressedOpacity),
			]}
			testID={testID}
		>
			{children}
		</Pressable>
	);
}

function selectedCountLabel(count: number) {
	return mobileText("noteList.bulk.selectedCount").replace(
		"{count}",
		count.toLocaleString(),
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	const styles = StyleSheet.create({
		action: {
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "rgba(255,255,255,0.12)",
			borderRadius: mobileRadius.lg,
			height: 32,
			width: 32,
		},
		actions: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		bar: {
			alignItems: "center",
			backgroundColor: mobileColors.text,
			flexDirection: "row",
			height: 44,
			justifyContent: "space-between",
			paddingHorizontal: mobileSpace.md,
		},
		count: {
			color: mobileColors.textInverse,
			fontSize: metrics.size(13),
			fontWeight: "500",
		},
		destructiveAction: {
			backgroundColor: mobileColors.danger,
		},
		subtleAction: {
			backgroundColor: "transparent",
		},
	});
	return { mobileColors, styles };
}
