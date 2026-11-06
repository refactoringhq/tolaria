import { useEffect } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { MobileIconButton } from "../../ui/MobileIconButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import { MobileNativeNoticeSurface } from "../../ui/notices/MobileNativeNoticeSurface";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileChromeColors } from "../../ui/theme/useMobileChromeColors";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { VaultNotice } from "../../workspace/vaultNotices";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

export function MobileVaultNotice({
	notice,
	dismiss,
	onManage,
}: {
	notice: VaultNotice;
	dismiss: () => void;
	onManage: () => void;
}) {
	const styles = useMobileStyles(createStyles);
	const colors = useMobileColors();
	const chrome = useMobileChromeColors();
	const insets = useSafeAreaInsets();
	const messageKey =
		notice.kind === "saveFailed"
			? "mobile.vaults.saveFailed"
			: notice.kind === "provider"
				? "mobile.vaults.folderUnavailable"
				: (`mobile.sync.${notice.kind}` as Parameters<typeof mobileText>[0]);
	const message = mobileText(messageKey);
	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(message);
		const timer = setTimeout(dismiss, 10_000);
		return () => clearTimeout(timer);
	}, [dismiss, message]);
	return (
		<View
			pointerEvents="box-none"
			style={
				Platform.OS === "android"
					? StyleSheet.absoluteFill
					: [styles.position, { top: insets.top + 8 }]
			}
		>
			<MobileNativeNoticeSurface
				message={message}
				actionLabel={mobileText("status.vault.manageWorkspaces")}
				onAction={() => {
					dismiss();
					onManage();
				}}
				onDismiss={dismiss}
			>
				<View
					style={[
						styles.notice,
						{
							backgroundColor:
								Platform.OS === "ios" ? "transparent" : colors.popover,
							borderColor: chrome.border,
						},
					]}
					testID="vault-sync-notice"
				>
					<View style={styles.row}>
						<Text
							accessibilityLiveRegion="polite"
							style={[styles.message, { color: chrome.text }]}
						>
							{message}
						</Text>
						<MobileIconButton
							accessibilityLabel={mobileText("update.dismiss")}
							density="default"
							onPress={dismiss}
							testID="vault-notice-dismiss"
						>
							<ChromeSymbol name="close" size={20} color={colors.textMuted} />
						</MobileIconButton>
					</View>
					<MobileButton
						label={mobileText("status.vault.manageWorkspaces")}
						variant="ghost"
						density="compact"
						onPress={() => {
							dismiss();
							onManage();
						}}
						style={styles.action}
						testID="vault-notice-manage"
					/>
				</View>
			</MobileNativeNoticeSurface>
		</View>
	);
}

function createStyles(colors: MobileColors, metrics: MobileMetrics) {
	return StyleSheet.create({
		position: {
			position: "absolute",
			left: 12,
			right: 12,
			alignItems: "center",
			zIndex: 20,
		},
		notice: {
			width: "100%",
			maxWidth: 520,
			backgroundColor: colors.popover,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			borderRadius: 8,
			padding: metrics.size(12),
			gap: metrics.size(8),
			elevation: 4,
			shadowColor: "#000000",
			shadowOpacity: 0.12,
			shadowRadius: 8,
			shadowOffset: { width: 0, height: 2 },
		},
		row: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: metrics.size(8),
		},
		message: {
			flex: 1,
			color: colors.text,
			fontSize: metrics.size(13),
			lineHeight: metrics.size(19),
		},
		action: { alignSelf: "flex-end", minHeight: 44 },
	});
}
