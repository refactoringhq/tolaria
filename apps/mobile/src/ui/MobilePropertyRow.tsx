import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../components/ui/text";
import { type MobileLayoutProbe, probeProps } from "../qa/mobileLayoutProbe";
import type { MobileMetrics } from "./mobileMetrics";
import type { MobileColors } from "./theme/mobilePalette";
import { useMobileStyles } from "./theme/useMobileTheme";

export function MobilePropertyRow({
	accessibilityLabel,
	label,
	layoutProbe,
	layoutProbeId,
	onPress,
	testID,
	value,
}: {
	accessibilityLabel?: string;
	label: string;
	layoutProbe?: MobileLayoutProbe;
	layoutProbeId?: string;
	onPress?: () => void;
	testID?: string;
	value: ReactNode;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const metricId = layoutProbeId ?? testID;
	const content = (
		<>
			<Text
				{...propertyProbe(layoutProbe, metricId, "label")}
				ellipsizeMode="tail"
				numberOfLines={1}
				style={styles.label}
				testID={testID ? `${testID}-label` : undefined}
			>
				{label}
			</Text>
			<View
				{...propertyProbe(layoutProbe, metricId, "value")}
				style={styles.value}
				testID={testID ? `${testID}-value` : undefined}
			>
				{typeof value === "string" ? (
					<Text ellipsizeMode="tail" numberOfLines={1} style={styles.valueText}>
						{value}
					</Text>
				) : (
					value
				)}
			</View>
		</>
	);

	if (onPress) {
		return (
			<Pressable
				{...propertyProbe(layoutProbe, metricId, "row")}
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityRole="button"
				style={styles.row}
				testID={testID}
				onPress={onPress}
			>
				{content}
			</Pressable>
		);
	}

	return (
		<View
			{...propertyProbe(layoutProbe, metricId, "row")}
			style={styles.row}
			testID={testID}
		>
			{content}
		</View>
	);
}

function propertyProbe(
	layoutProbe: MobileLayoutProbe | undefined,
	metricId: string | undefined,
	part: string,
) {
	return metricId ? probeProps(layoutProbe, `${metricId}.${part}`) : {};
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const {
		property: desktopPropertyParity,
		space: mobileSpace,
		type: mobileType,
	} = metrics;
	const styles = StyleSheet.create({
		label: {
			width: 86,
			flexShrink: 1,
			minWidth: 0,
			overflow: "hidden",
			color: mobileColors.textMuted,
			fontSize: desktopPropertyParity.labelTextSize,
		},
		row: {
			minHeight: desktopPropertyParity.rowMinHeight,
			flexShrink: 0,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			borderBottomColor: mobileColors.border,
			borderBottomWidth: StyleSheet.hairlineWidth,
			paddingHorizontal: desktopPropertyParity.rowPaddingHorizontal,
		},
		value: {
			flex: 1,
			alignItems: "flex-end",
			flexShrink: 1,
			minWidth: 0,
			overflow: "hidden",
		},
		valueText: {
			alignSelf: "stretch",
			flexShrink: 1,
			minWidth: 0,
			color: mobileColors.text,
			fontSize: mobileType.caption,
			fontWeight: "400",
			textAlign: "right",
		},
	});
	return { mobileColors, styles };
}
