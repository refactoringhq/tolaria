import { X } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
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
import type { MobileColors } from "../ui/theme/mobilePalette";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import type { useMobileVaults } from "../workspace/git/useMobileVaults";
import { useMobileModalDismiss } from "../workspace/useMobileModalDismiss";
import { MobileAppearanceSettings } from "./MobileAppearanceSettings";
import { MobilePrivacySettings } from "./MobilePrivacySettings";
import { MobileUpdateSettings } from "./MobileUpdateSettings";
import { useMobileSettings } from "./useMobileSettings";
import { useMobileUpdateChannel } from "./useMobileUpdateChannel";

export function MobileSettingsSheet({
	manager,
}: {
	manager: ReturnType<typeof useMobileVaults>;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const preferences = useMobileSettings();
	const updates = useMobileUpdateChannel(manager);
	const close = useSettingsDismissal(manager, preferences.close);
	const opened = preferences.opened || manager.opened;
	useMobileModalDismiss(close, opened);
	return (
		<MobileSettingsModal
			manager={manager}
			preferences={preferences}
			updates={updates}
			close={close}
			opened={opened}
			styles={styles}
			mobileColors={mobileColors}
		/>
	);
}

function MobileSettingsModal({
	manager,
	preferences,
	updates,
	close,
	opened,
	styles,
	mobileColors,
}: {
	manager: ReturnType<typeof useMobileVaults>;
	preferences: ReturnType<typeof useMobileSettings>;
	updates: ReturnType<typeof useMobileUpdateChannel>;
	close: () => void;
	opened: boolean;
	styles: ReturnType<typeof createThemeStyles>["styles"];
	mobileColors: MobileColors;
}) {
	return (
		<Modal
			visible={opened}
			transparent={Platform.OS !== "ios"}
			animationType="fade"
			onRequestClose={close}
			presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
			allowSwipeDismissal={Platform.OS === "ios"}
			supportedOrientations={[
				"portrait",
				"portrait-upside-down",
				"landscape-left",
				"landscape-right",
			]}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={Platform.OS === "ios" ? styles.sheetBackdrop : styles.backdrop}
			>
				<MobilePanel
					style={Platform.OS === "ios" ? styles.sheetPanel : styles.panel}
					accessibilityViewIsModal
					testID="mobile-settings"
				>
					<MobileToolbar>
						<MobileToolbarTitle title={mobileText("settings.title")} />
						<MobileToolbarSpacer />
						<MobileIconButton
							accessibilityLabel={mobileText("settings.close")}
							testID="mobile-settings-close"
							onPress={close}
						>
							<X size={18} color={mobileColors.textMuted} />
						</MobileIconButton>
					</MobileToolbar>
					<MobileSettingsContent
						manager={manager}
						preferences={preferences}
						updates={updates}
						styles={styles}
					/>
				</MobilePanel>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function useSettingsDismissal(
	manager: ReturnType<typeof useMobileVaults>,
	closePreferences: () => void,
) {
	const { busy, close: closeManager } = manager;
	const dismissRequested = useRef(false);
	const close = () => {
		if (busy) {
			dismissRequested.current = true;
			return;
		}
		dismissRequested.current = false;
		closeManager();
		closePreferences();
	};
	useEffect(() => {
		if (busy || !dismissRequested.current) return;
		dismissRequested.current = false;
		closeManager();
		closePreferences();
	}, [busy, closeManager, closePreferences]);
	return close;
}

function MobileSettingsContent({
	manager,
	preferences,
	updates,
	styles,
}: {
	manager: ReturnType<typeof useMobileVaults>;
	preferences: ReturnType<typeof useMobileSettings>;
	updates: ReturnType<typeof useMobileUpdateChannel>;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	if (manager.conflictReview) return <MobileVaultManager manager={manager} />;
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
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
			<MobileVaultManager manager={manager} />
			<MobileAppearanceSettings />
			<MobileUpdateSettings updates={updates} />
			<MobilePrivacySettings />
		</ScrollView>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	const styles = StyleSheet.create({
		backdrop: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: mobileColors.overlay,
			padding: mobileSpace.lg,
		},
		panel: {
			width: "100%",
			maxWidth: 540,
			maxHeight: "85%",
			borderRadius: 8,
			overflow: "hidden",
			backgroundColor: mobileColors.dialog,
		},
		sheetBackdrop: { flex: 1, backgroundColor: mobileColors.dialog },
		sheetPanel: {
			flex: 1,
			width: "100%",
			maxWidth: 540,
			overflow: "hidden",
			backgroundColor: mobileColors.dialog,
		},
		content: { padding: metrics.size(20), gap: metrics.size(20) },
		error: {
			fontSize: metrics.size(12),
			lineHeight: metrics.size(18),
			color: mobileColors.danger,
		},
	});
	return { mobileColors, styles };
}
