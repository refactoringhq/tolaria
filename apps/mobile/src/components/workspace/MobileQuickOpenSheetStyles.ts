import { StyleSheet } from "react-native";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";

export const quickOpenRowLayout = { minHeight: 62 };

export function createThemeStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	const styles = {
		...createQuickOpenBaseStyles(mobileColors, mobileSpace, mobileType),
		...createQuickOpenResultStyles(mobileColors, mobileSpace, mobileType),
		...createQuickOpenSearchStyles(mobileColors, mobileSpace, mobileType),
	};
	return { mobileColors, metrics, styles };
}

function createQuickOpenBaseStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		cancelText: { color: mobileColors.primary, fontSize: mobileType.body },
		content: {
			alignSelf: "stretch",
			flexShrink: 1,
			gap: mobileSpace.sm,
			minHeight: 0,
			padding: mobileSpace.md,
		},
		emptyText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.body,
			paddingVertical: mobileSpace.md,
			textAlign: "center",
		},
		history: { paddingBottom: mobileSpace.xs },
		historyText: { color: mobileColors.text, fontSize: mobileType.body },
		matchedTerm: { fontWeight: "700" },
		sectionTitle: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "600",
			paddingHorizontal: mobileSpace.sm,
			paddingTop: mobileSpace.sm,
		},
	});
}

function createQuickOpenResultStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		historyRow: {
			justifyContent: "center",
			minHeight: quickOpenRowLayout.minHeight,
			paddingHorizontal: mobileSpace.sm,
		},
		resultList: { paddingBottom: mobileSpace.md },
		resultPressed: { backgroundColor: mobileColors.control },
		resultIcon: {
			alignItems: "center",
			height: 20,
			justifyContent: "center",
			marginTop: 2,
			width: 20,
		},
		resultRow: {
			alignItems: "flex-start",
			borderBottomColor: mobileColors.border,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderRadius: 8,
			flexDirection: "row",
			gap: mobileSpace.sm,
			minHeight: quickOpenRowLayout.minHeight,
			paddingHorizontal: mobileSpace.sm,
			paddingVertical: mobileSpace.xs,
		},
		resultSelected: { backgroundColor: mobileColors.graySoft },
		resultSnippet: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			minWidth: 0,
		},
		resultText: { flex: 1, gap: 2, minWidth: 0 },
		resultTitle: {
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
			minWidth: 0,
		},
		resultScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
	});
}

function createQuickOpenSearchStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		searchField: {
			alignItems: "center",
			backgroundColor: mobileColors.control,
			borderRadius: 10,
			flex: 1,
			flexDirection: "row",
			gap: mobileSpace.sm,
			minWidth: 0,
			paddingHorizontal: mobileSpace.sm,
		},
		searchInput: {
			backgroundColor: "transparent",
			borderWidth: 0,
			color: mobileColors.text,
			flex: 1,
			fontSize: mobileType.body,
			minHeight: 40,
			minWidth: 0,
			paddingHorizontal: 0,
			paddingVertical: mobileSpace.xs,
		},
		searchRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
		},
	});
}
