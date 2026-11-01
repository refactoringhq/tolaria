import { SymbolView } from "expo-symbols";
import { Command, GearSix } from "phosphor-react-native";
import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { useMobileSettings } from "../../settings/useMobileSettings";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import { Button } from "../ui/button";
import { MobileSidebarSyncPill } from "./MobileSidebarSyncPill";
import { mobilePaneFooterFrame } from "./mobilePaneFooterLayout";

export function MobileSidebarSettings({
	onOpenCommandPalette,
}: {
	onOpenCommandPalette?: () => void;
}) {
	const preferences = useMobileSettings();
	const colors = useMobileColors();
	const insets = useSafeAreaInsets();
	return (
		<View
			pointerEvents="box-none"
			style={[styles.footer, mobilePaneFooterFrame(insets.bottom)]}
			testID="sidebar-settings"
		>
			<MobileSidebarSyncPill autoGit={preferences.settings.autoGit} />
			{onOpenCommandPalette && (
				<SidebarButton
					accessibilityLabel={mobileText("menu.view.commandPalette")}
					style={[styles.button, { backgroundColor: colors.control }]}
					onPress={onOpenCommandPalette}
					testID="sidebar-command-palette-action"
				>
					<SymbolView
						fallback={<Command size={22} color={colors.textMuted} />}
						name={{ ios: "command", android: "keyboard_command_key" }}
						size={22}
						tintColor={colors.textMuted}
					/>
				</SidebarButton>
			)}
			<SidebarButton
				accessibilityLabel={mobileText("settings.title")}
				style={[styles.button, { backgroundColor: colors.control }]}
				onPress={preferences.open}
				testID="open-mobile-settings"
			>
				<SymbolView
					fallback={<GearSix size={22} color={colors.textMuted} />}
					name={{ ios: "gearshape", android: "settings" }}
					size={22}
					tintColor={colors.textMuted}
				/>
			</SidebarButton>
		</View>
	);
}

function SidebarButton({
	accessibilityLabel,
	children,
	onPress,
	style,
	testID,
}: {
	accessibilityLabel: string;
	children: ReactNode;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	testID: string;
}) {
	return (
		<Button
			accessibilityLabel={accessibilityLabel}
			size="icon"
			variant="secondary"
			style={style}
			className="h-12 w-12 rounded-[24px] sm:h-12 sm:w-12"
			onPress={onPress}
			testID={testID}
		>
			{children}
		</Button>
	);
}

const styles = StyleSheet.create({
	footer: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 6,
		paddingHorizontal: 8,
	},
	button: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
	},
});
