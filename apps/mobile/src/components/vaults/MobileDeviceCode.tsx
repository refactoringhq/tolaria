import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

export function MobileDeviceCode({ code }: { code: string }) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const [copied, setCopied] = useState(false);
	const [failed, setFailed] = useState(false);
	const copy = async () => {
		try {
			const accepted = await Clipboard.setStringAsync(code);
			setCopied(accepted);
			setFailed(!accepted);
		} catch {
			setFailed(true);
			setCopied(false);
		}
	};
	return (
		<View style={styles.container}>
			<View style={styles.row}>
				<Text selectable style={styles.code} testID="github-device-code">
					{code}
				</Text>
				<MobileButton
					label={mobileText(
						copied ? "mobile.vaults.codeCopied" : "editor.codeBlock.copy",
					)}
					icon={
						copied ? (
							<ChromeSymbol name="check" size={16} color={mobileColors.green} />
						) : (
							<ChromeSymbol name="copy" size={16} color={mobileColors.text} />
						)
					}
					onPress={() => {
						void copy();
					}}
					testID="github-copy-device-code"
				/>
			</View>
			{failed && (
				<Text accessibilityRole="alert" style={styles.error}>
					{mobileText("mobile.vaults.copyFailed")}
				</Text>
			)}
		</View>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = StyleSheet.create({
		container: { gap: metrics.size(8) },
		row: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: metrics.size(12),
			alignItems: "center",
			justifyContent: "space-between",
		},
		code: {
			fontSize: metrics.size(24),
			fontWeight: "600",
			color: mobileColors.text,
			paddingVertical: metrics.size(8),
		},
		error: { fontSize: metrics.size(12), color: mobileColors.danger },
	});
	return { mobileColors, styles };
}
