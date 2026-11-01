import { ArrowLeft } from "phosphor-react-native";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { Text } from "../components/ui/text";
import { MobileVaultManager } from "../components/vaults/MobileVaultManager";
import { mobileText } from "../i18n/mobileText";
import { MobileButton } from "../ui/MobileButton";
import { MobileIconButton } from "../ui/MobileIconButton";
import {
	MobilePanel,
	MobileToolbar,
	MobileToolbarSpacer,
	MobileToolbarTitle,
} from "../ui/MobilePanel";
import type { MobileMetrics } from "../ui/mobileMetrics";
import { mobileSheetPresentation } from "../ui/mobileSheetPresentation";
import type { MobileColors } from "../ui/theme/mobilePalette";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import type { useMobileVaults } from "../workspace/git/useMobileVaults";
import { useMobileModalDismiss } from "../workspace/useMobileModalDismiss";
import { MobileNativeSettingsForm } from "./MobileNativeSettingsForm";
import { useMobileSettings } from "./useMobileSettings";
import { useMobileUpdateChannel } from "./useMobileUpdateChannel";

export function MobileSettingsSheet({
	manager,
}: {
	manager: ReturnType<typeof useMobileVaults>;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const preferences = useMobileSettings();
	const updates = useMobileUpdateChannel(manager);
	const close = () => {
		if (manager.busy) return;
		manager.close();
		preferences.close();
	};
	const opened = preferences.opened || manager.opened;
	useMobileModalDismiss(close, opened);
	return (
		<Modal
			visible={opened}
			{...mobileSheetPresentation(Platform.OS)}
			onRequestClose={close}
			supportedOrientations={[
				"portrait",
				"portrait-upside-down",
				"landscape-left",
				"landscape-right",
			]}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={Platform.OS === "ios" ? styles.sheetRoot : styles.androidRoot}
			>
				<MobilePanel
					style={Platform.OS === "ios" ? styles.sheetPanel : styles.panel}
					accessibilityViewIsModal
					testID="mobile-settings"
				>
					<MobileToolbar>
						{Platform.OS === "android" && (
							<MobileIconButton
								accessibilityLabel={mobileText("command.navigation.goBack")}
								onPress={close}
								testID="settings-back"
							>
								<ArrowLeft size={20} />
							</MobileIconButton>
						)}
						<MobileToolbarTitle title={mobileText("settings.title")} />
						<MobileToolbarSpacer />
						{Platform.OS === "ios" && (
							<MobileButton
								density="compact"
								label={mobileText("common.done")}
								onPress={close}
								testID="settings-done"
								variant="ghost"
							/>
						)}
					</MobileToolbar>
					{Platform.OS === "ios" ? (
						<View style={styles.content}>
							<SettingsSheetContent
								manager={manager}
								preferences={preferences}
								updates={updates}
							/>
						</View>
					) : (
						<ScrollView
							contentContainerStyle={styles.content}
							keyboardShouldPersistTaps="handled"
						>
							<SettingsSheetContent
								manager={manager}
								preferences={preferences}
								updates={updates}
							/>
						</ScrollView>
					)}
				</MobilePanel>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function SettingsSheetContent({
	manager,
	preferences,
	updates,
}: {
	manager: ReturnType<typeof useMobileVaults>;
	preferences: ReturnType<typeof useMobileSettings>;
	updates: ReturnType<typeof useMobileUpdateChannel>;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<>
			{preferences.error && (
				<Text accessibilityRole="alert" style={styles.error}>
					{mobileText(
						preferences.error === "load"
							? "mobile.settings.loadFailed"
							: "mobile.settings.saveFailed",
					)}
				</Text>
			)}
			{preferences.error === "load" && (
				<MobileButton
					label={mobileText("pulse.retry")}
					onPress={() => {
						void preferences.retry();
					}}
				/>
			)}
			{manager.conflictReview ? (
				<MobileVaultManager manager={manager} />
			) : (
				<MobileNativeSettingsForm
					manager={manager}
					preferences={preferences}
					updates={updates}
				/>
			)}
		</>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = StyleSheet.create({
		androidRoot: { flex: 1, backgroundColor: mobileColors.dialog },
		panel: {
			width: "100%",
			maxWidth: "100%",
			height: "100%",
			borderRadius: 0,
			overflow: "hidden",
			backgroundColor: mobileColors.dialog,
		},
		sheetRoot: { flex: 1, backgroundColor: mobileColors.dialog },
		sheetPanel: {
			flex: 1,
			width: "100%",
			maxWidth: "100%",
			maxHeight: "100%",
			borderRadius: 0,
			overflow: "hidden",
			backgroundColor: mobileColors.dialog,
		},
		content: {
			flex: 1,
			padding: Platform.OS === "ios" ? 0 : metrics.size(20),
			gap: metrics.size(20),
		},
		error: {
			fontSize: metrics.size(12),
			lineHeight: metrics.size(18),
			color: mobileColors.danger,
		},
	});
	return { mobileColors, styles };
}
