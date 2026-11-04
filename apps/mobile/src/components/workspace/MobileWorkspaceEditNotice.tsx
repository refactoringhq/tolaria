import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileSyncStatus } from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { MobileListMotion } from "./MobileSwipeableNoteRow";

export function MobileWorkspaceEditNotice({
	retry,
	sync,
}: {
	retry?: () => void;
	sync?: MobileSyncStatus;
}) {
	const styles = useMobileStyles(createStyles);
	const { top } = useSafeAreaInsets();
	const saveFailure = sync?.kind === "writeFailed";
	const failed = Boolean(retry) && !saveFailure;
	const saveFailed = useSaveFailureToast(sync, Boolean(retry));
	useEffect(() => {
		if (failed)
			AccessibilityInfo.announceForAccessibility(
				mobileText("mobile.editor.readFailed"),
			);
		else if (saveFailure)
			AccessibilityInfo.announceForAccessibility(
				mobileText("mobile.vaults.saveFailed"),
			);
	}, [failed, saveFailure]);
	if (!retry && !saveFailed) return null;
	return (
		<MobileListMotion
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			testID="workspace-edit-notice-motion"
		>
			<View
				pointerEvents="box-none"
				style={[styles.position, { top: top + 8 }]}
			>
				<View style={styles.notice} testID="workspace-edit-notice">
					<Text accessibilityLiveRegion="polite" style={styles.message}>
						{mobileText(
							failed ? "mobile.editor.readFailed" : "mobile.vaults.saveFailed",
						)}
					</Text>
					{retry ? (
						<MobileButton
							label={mobileText("pulse.retry")}
							onPress={retry}
							testID="workspace-edit-retry"
							variant="ghost"
						/>
					) : null}
				</View>
			</View>
		</MobileListMotion>
	);
}

function useSaveFailureToast(
	sync: MobileSyncStatus | undefined,
	retryable: boolean,
) {
	const [dismissedWriteFailure, setDismissedWriteFailure] =
		useState<MobileSyncStatus | null>(null);
	useEffect(() => {
		if (sync?.kind !== "writeFailed") return;
		const timeout = setTimeout(() => setDismissedWriteFailure(sync), 2400);
		return () => clearTimeout(timeout);
	}, [sync]);
	return (
		sync?.kind === "writeFailed" &&
		(retryable || dismissedWriteFailure !== sync)
	);
}

function createStyles(colors: MobileColors, metrics: MobileMetrics) {
	return StyleSheet.create({
		position: {
			position: "absolute",
			left: 12,
			right: 12,
			zIndex: 20,
			alignItems: "center",
		},
		notice: {
			width: "100%",
			maxWidth: 520,
			flexDirection: "row",
			alignItems: "center",
			gap: metrics.size(8),
			padding: metrics.size(12),
			borderRadius: 8,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.popover,
		},
		message: {
			flex: 1,
			color: colors.text,
			fontSize: metrics.size(13),
			lineHeight: metrics.size(19),
		},
	});
}
