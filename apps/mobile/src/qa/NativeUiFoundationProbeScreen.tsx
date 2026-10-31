import { Text as ExpoText, Host } from "@expo/ui";
import {
	isGlassEffectAPIAvailable,
	isLiquidGlassAvailable,
} from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { Platform, StyleSheet, Text, View } from "react-native";

export function NativeUiFoundationProbeScreen() {
	const glass = readGlassAvailability();

	return (
		<View style={styles.screen}>
			<Text testID="native-ui-glass-status">{glass}</Text>
			<View style={styles.symbol} testID="native-ui-symbol">
				<SymbolView
					name={{
						ios: "sparkles",
						android: "auto_awesome",
						web: "auto_awesome",
					}}
					size={36}
				/>
			</View>
			<Host style={styles.host} testID="native-ui-host">
				<ExpoText>Expo UI Host rendered</ExpoText>
			</Host>
		</View>
	);
}

function readGlassAvailability() {
	if (Platform.OS !== "ios") return "Liquid Glass: iOS only";

	try {
		return `Liquid Glass: ${isLiquidGlassAvailable() ? "available" : "unavailable"}; API: ${isGlassEffectAPIAvailable() ? "available" : "unavailable"}`;
	} catch {
		return "Liquid Glass: native module unavailable";
	}
}

const styles = StyleSheet.create({
	screen: {
		alignItems: "center",
		flex: 1,
		gap: 24,
		justifyContent: "center",
		padding: 24,
	},
	symbol: {
		alignItems: "center",
		height: 48,
		justifyContent: "center",
		width: 48,
	},
	host: { alignSelf: "stretch", minHeight: 56 },
});
