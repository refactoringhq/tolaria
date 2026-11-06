import { View } from "react-native";
import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { Text } from "../components/ui/text";
import { mobileText } from "../i18n/mobileText";
import { MobileIconButton } from "../ui/MobileIconButton";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { createThemeStyles } from "./phoneWorkspaceStyles";

export function PhoneTopBar({
	onBack,
	title,
}: {
	onBack: () => void;
	title: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.topBar} testID="phone-top-bar">
			<PhoneBackButton onBack={onBack} />
			<Text numberOfLines={1} style={styles.topBarTitle}>
				{title}
			</Text>
		</View>
	);
}

export function PhoneBackButton({ onBack }: { onBack: () => void }) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<MobileIconButton
			accessibilityLabel={mobileText("command.navigation.goBack")}
			testID="phone-back-action"
			onPress={onBack}
		>
			<ChromeSymbol name="back" color={mobileColors.textMuted} size={18} />
		</MobileIconButton>
	);
}
