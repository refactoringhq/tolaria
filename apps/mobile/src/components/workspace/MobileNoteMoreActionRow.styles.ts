import { StyleSheet } from "react-native";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";

export function createThemeStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { toolbarAction, space, type } = metrics;
	const styles = StyleSheet.create({
		actionIcon: { width: toolbarAction.iconSize, alignItems: "center" },
		actionRow: {
			minHeight: 44,
			justifyContent: "center",
			minWidth: 0,
			alignSelf: "stretch",
			width: "100%",
			borderRadius: 4,
			paddingHorizontal: space.sm,
			paddingVertical: space.sm,
		},
		actionRowContent: {
			minWidth: 0,
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			gap: space.sm,
		},
		actionText: {
			minWidth: 0,
			flex: 1,
			flexShrink: 1,
			color: mobileColors.text,
			fontSize: type.body,
		},
		actionTextDestructive: { color: mobileColors.red },
	});
	return { mobileColors, styles };
}
