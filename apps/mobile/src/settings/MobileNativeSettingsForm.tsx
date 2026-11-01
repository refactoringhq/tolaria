import { View } from "react-native";
import { MobileVaultManager } from "../components/vaults/MobileVaultManager";
import type { useMobileVaults } from "../workspace/git/useMobileVaults";
import { MobileAppearanceSettings } from "./MobileAppearanceSettings";
import { MobilePrivacySettings } from "./MobilePrivacySettings";
import { MobileUpdateSettings } from "./MobileUpdateSettings";
import type { useMobileSettings } from "./useMobileSettings";
import type { useMobileUpdateChannel } from "./useMobileUpdateChannel";

type Props = {
	manager: ReturnType<typeof useMobileVaults>;
	preferences: ReturnType<typeof useMobileSettings>;
	updates: ReturnType<typeof useMobileUpdateChannel>;
};

export function MobileNativeSettingsForm({ manager, updates }: Props) {
	return (
		<View>
			<MobileVaultManager manager={manager} />
			<MobileAppearanceSettings />
			<MobileUpdateSettings updates={updates} />
			<MobilePrivacySettings />
		</View>
	);
}
