import { StyleSheet, View } from "react-native";
import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { Text } from "../components/ui/text";
import { mobileText } from "../i18n/mobileText";
import { MobileButton } from "../ui/MobileButton";
import type { MobileMetrics } from "../ui/mobileMetrics";
import type { MobileColors } from "../ui/theme/mobilePalette";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { mobileUpdateDiagnostics } from "./mobileUpdateDiagnostics";
import type { useMobileUpdateChannel } from "./useMobileUpdateChannel";

export function MobileUpdateSettings({
	updates,
}: {
	updates: ReturnType<typeof useMobileUpdateChannel>;
}) {
	const { styles } = useMobileStyles(createStyles);
	const diagnostics = mobileUpdateDiagnostics(updates.runtime, updates);
	return (
		<View style={styles.section} testID="settings-update-channel">
			<Text style={styles.heading}>
				{mobileText("settings.releaseChannel")}
			</Text>
			<View
				accessibilityRole="radiogroup"
				accessibilityLabel={mobileText("settings.releaseChannel")}
				style={styles.options}
			>
				{(["stable", "alpha"] as const).map((channel) => (
					<MobileButton
						key={channel}
						label={mobileText(
							channel === "stable"
								? "settings.releaseStable"
								: "settings.releaseAlpha",
						)}
						accessibilityRole="radio"
						accessibilityState={{ checked: updates.selected === channel }}
						variant={updates.selected === channel ? "secondary" : "ghost"}
						style={styles.option}
						disabled={updates.disabled}
						testID={`settings-update-${channel}`}
						onPress={() => {
							void updates.select(channel);
						}}
					/>
				))}
			</View>
			<Text selectable style={styles.detail} testID="settings-update-build">
				{diagnostics.build}
			</Text>
			<Text selectable style={styles.detail} testID="settings-update-running">
				{diagnostics.running}
			</Text>
			<Text selectable style={styles.detail} testID="settings-update-runtime">
				{diagnostics.runtime}
			</Text>
			<UpdateStatus
				status={diagnostics.status}
				failed={updates.phase === "failed"}
			/>
			{diagnostics.checked && (
				<Text style={styles.detail} testID="settings-update-checked">
					{diagnostics.checked}
				</Text>
			)}
			<UpdateAction updates={updates} />
		</View>
	);
}

function UpdateStatus({ status, failed }: { status: string; failed: boolean }) {
	const { styles } = useMobileStyles(createStyles);
	return (
		<Text
			accessibilityRole={failed ? "alert" : undefined}
			accessibilityLiveRegion="polite"
			style={[styles.detail, failed && styles.error]}
			testID="settings-update-status"
		>
			{status}
		</Text>
	);
}

function UpdateAction({
	updates,
}: {
	updates: ReturnType<typeof useMobileUpdateChannel>;
}) {
	const { colors } = useMobileStyles(createStyles);
	const ready = updates.phase === "ready";
	return (
		<MobileButton
			label={mobileText(ready ? "update.restartNow" : "status.update.check")}
			icon={<ChromeSymbol name="sync" size={20} color={colors.textMuted} />}
			disabled={updates.disabled}
			testID="settings-update-apply"
			onPress={() => {
				void (ready ? updates.restart() : updates.check());
			}}
		/>
	);
}

function createStyles(colors: MobileColors, metrics: MobileMetrics) {
	return {
		colors,
		styles: StyleSheet.create({
			section: { gap: metrics.size(12), paddingBottom: metrics.size(12) },
			heading: {
				fontSize: metrics.size(16),
				fontWeight: "600",
				color: colors.text,
			},
			detail: {
				fontSize: metrics.size(12),
				lineHeight: metrics.size(18),
				color: colors.textMuted,
			},
			error: { color: colors.danger },
			options: {
				flexDirection: "row",
				gap: metrics.size(4),
				padding: metrics.size(4),
				borderRadius: 6,
				backgroundColor: colors.graySoft,
			},
			option: { flex: 1, minHeight: 44 },
		}),
	};
}
