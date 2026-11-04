import { View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileToolbar } from "../../ui/MobilePanel";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { Text } from "../ui/text";
import { MobileVaultPicker } from "../vaults/MobileVaultPicker";
import { createSidebarStyles } from "./mobileSidebarStyles";

export function MobileWorkspaceSidebarToolbar({ title }: { title?: string }) {
	const { styles } = useMobileStyles(createSidebarStyles);
	return (
		<MobileToolbar testID="sidebar-toolbar">
			<Text
				numberOfLines={1}
				style={styles.vaultTitle}
				testID="sidebar-toolbar-title"
			>
				{title ?? mobileText("status.vault.default")}
			</Text>
			<View style={styles.toolbarActions}>
				<MobileVaultPicker />
			</View>
		</MobileToolbar>
	);
}
