import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileWorkspaceActionFeedback } from "../../workspace/mobileWorkspaceActionFeedback";
import type { MobileSyncStatus } from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { MobileListMotion } from "./MobileSwipeableNoteRow";
import { MobileNativeNoticeSurface } from "../../ui/notices/MobileNativeNoticeSurface";
import { useMobileChromeColors } from "../../ui/theme/useMobileChromeColors";

export function MobileWorkspaceEditNotice({
	failedAction,
	undo,
	undoFeedback,
	retry,
	sync,
}: {
	failedAction?: MobileWorkspaceActionFeedback | null;
	undo?: () => void;
	undoFeedback?: {
		action: MobileWorkspaceActionFeedback;
		id: object;
	} | null;
	retry?: () => void;
	sync?: MobileSyncStatus;
}) {
	const styles = useMobileStyles(createStyles);
	const chrome = useMobileChromeColors();
	const { top } = useSafeAreaInsets();
	const saveFailure = sync?.kind === "writeFailed";
	const failed = Boolean(retry) && !saveFailure;
	const saveFailed = useSaveFailureToast(sync, Boolean(retry));
	const [dismissedUndo, setDismissedUndo] = useState<object | null>(null);
	const undoFeedbackId = undoFeedback?.id;
	const showUndo = Boolean(
		undo && undoFeedbackId && !saveFailure && dismissedUndo !== undoFeedbackId,
	);
	useEffect(() => {
		if (!showUndo || !undoFeedbackId) return;
		const timeout = setTimeout(() => setDismissedUndo(undoFeedbackId), 4000);
		return () => clearTimeout(timeout);
	}, [showUndo, undoFeedbackId]);
	useEffect(() => {
		if (failed)
			AccessibilityInfo.announceForAccessibility(
				mobileText("mobile.editor.readFailed"),
			);
		else if (saveFailure)
			AccessibilityInfo.announceForAccessibility(
				mobileText(
					failedAction
						? actionFailureMessage(failedAction)
						: "mobile.vaults.saveFailed",
				),
			);
	}, [failed, failedAction, saveFailure]);
	if (!retry && !saveFailed && !showUndo) return null;
	return (
		<MobileListMotion
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			testID="workspace-edit-notice-motion"
		>
			<View
				pointerEvents="box-none"
				style={Platform.OS === "android" ? StyleSheet.absoluteFill : [styles.position, { top: top + 8 }]}
			>
				<MobileNativeNoticeSurface
					message={mobileText(
						failed
							? "mobile.editor.readFailed"
							: saveFailed && failedAction
								? actionFailureMessage(failedAction)
								: saveFailed
									? "mobile.vaults.saveFailed"
									: undoFeedback
										? actionFeedbackMessage(undoFeedback.action)
										: "mobile.vaults.saveFailed",
					)}
					actionLabel={retry ? mobileText("pulse.retry") : showUndo ? mobileText("command.note.undo") : undefined}
					onAction={retry ?? (showUndo ? undo : undefined)}
					onDismiss={() => undefined}
				>
				<View style={[styles.notice, { backgroundColor: Platform.OS === "ios" ? "transparent" : undefined, borderColor: chrome.border }]} testID="workspace-edit-notice">
					<Text accessibilityLiveRegion="polite" style={[styles.message, { color: chrome.text }]}>
						{mobileText(
							failed
								? "mobile.editor.readFailed"
								: saveFailed && failedAction
									? actionFailureMessage(failedAction)
									: saveFailed
										? "mobile.vaults.saveFailed"
										: undoFeedback
											? actionFeedbackMessage(undoFeedback.action)
											: "mobile.vaults.saveFailed",
						)}
					</Text>
					{showUndo ? (
						<MobileButton
							label={mobileText("command.note.undo")}
							onPress={() => undo?.()}
							testID="workspace-action-undo-toast"
							variant="ghost"
						/>
					) : null}
					{retry ? (
						<MobileButton
							label={mobileText("pulse.retry")}
							onPress={retry}
							testID="workspace-edit-retry"
							variant="ghost"
						/>
					) : null}
				</View>
				</MobileNativeNoticeSurface>
			</View>
		</MobileListMotion>
	);
}

function actionFeedbackMessage(action: MobileWorkspaceActionFeedback) {
	return `mobile.workspace.action.${action}` as const;
}

function actionFailureMessage(action: MobileWorkspaceActionFeedback) {
	return `mobile.workspace.actionFailure.${action}` as const;
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
