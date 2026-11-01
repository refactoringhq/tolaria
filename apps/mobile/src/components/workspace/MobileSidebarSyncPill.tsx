import { SymbolView } from "expo-symbols";
import { ArrowClockwise } from "phosphor-react-native";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import {
	MobileVaultControlsContext,
	MobileVaultDisplayContext,
} from "../../workspace/MobileVaultContext";
import { Button } from "../ui/button";
import { Text } from "../ui/text";
import { sidebarSyncPresentation } from "./mobileSidebarSyncStatus";

export function MobileSidebarSyncPill({ autoGit }: { autoGit: boolean }) {
	const controls = useContext(MobileVaultControlsContext);
	const display = useContext(MobileVaultDisplayContext);
	const colors = useMobileColors();
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(timer);
	}, []);
	const state = sidebarSyncPresentation(controls, display, autoGit, now);
	if (!state || !controls) return null;
	const action = mobileText(
		state.action === "sync"
			? "status.sync.now"
			: "status.vault.manageWorkspaces",
	);
	const color = state.problem ? colors.danger : colors.textMuted;
	return (
		<Button
			variant="secondary"
			accessibilityLabel={syncAccessibilityLabel(state, action)}
			accessibilityHint={action}
			disabled={state.disabled}
			accessibilityState={{ busy: state.busy, disabled: state.disabled }}
			className="h-auto min-h-12 flex-1 rounded-[24px] px-3 py-2 sm:h-auto"
			style={[styles.button, { backgroundColor: colors.control }]}
			testID="sidebar-sync-action"
			onPress={() => {
				void (state.action === "sync" ? controls.sync() : controls.open());
			}}
		>
			<SyncPillIcon busy={state.busy} color={color} />
			<SyncPillCopy
				state={state}
				textColor={colors.text}
				detailColor={color}
				pendingDotColor={colors.yellow}
			/>
		</Button>
	);
}

function syncAccessibilityLabel(
	state: NonNullable<ReturnType<typeof sidebarSyncPresentation>>,
	action: string,
) {
	return [state.destination, state.state, state.lastSync, action]
		.filter(Boolean)
		.join(". ");
}

function SyncPillIcon({ busy, color }: { busy: boolean; color: string }) {
	if (busy) return <ActivityIndicator size="small" color={color} />;
	return (
		<SymbolView
			fallback={<ArrowClockwise size={18} color={color} />}
			name={{ ios: "arrow.clockwise", android: "refresh" }}
			size={18}
			tintColor={color}
		/>
	);
}

function SyncPillCopy({
	state,
	textColor,
	detailColor,
	pendingDotColor,
}: {
	state: NonNullable<ReturnType<typeof sidebarSyncPresentation>>;
	textColor: string;
	detailColor: string;
	pendingDotColor: string;
}) {
	return (
		<View style={styles.copy}>
			<View style={styles.destinationRow}>
				<Text
					numberOfLines={1}
					ellipsizeMode="tail"
					style={[styles.destination, { color: textColor }]}
					testID="sidebar-sync-destination"
				>
					{state.destination}
				</Text>
				{state.pendingLocalChanges && (
					<View
						accessible={false}
						style={[styles.pendingDot, { backgroundColor: pendingDotColor }]}
						testID="sidebar-sync-pending-local"
					/>
				)}
			</View>
			<Text
				numberOfLines={1}
				ellipsizeMode="tail"
				style={[styles.detail, { color: detailColor }]}
				testID="sidebar-sync-state"
			>
				{state.detail}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	button: {
		flex: 1,
		minWidth: 0,
		minHeight: 48,
		height: 48,
		paddingHorizontal: 8,
		paddingVertical: 0,
		borderRadius: 24,
		flexDirection: "row",
		gap: 6,
		alignItems: "center",
		justifyContent: "flex-start",
	},
	copy: { flex: 1, minWidth: 0 },
	destinationRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		minWidth: 0,
	},
	destination: {
		fontSize: 13,
		lineHeight: 17,
		fontWeight: "500",
		flexShrink: 1,
		minWidth: 0,
	},
	pendingDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
	detail: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
});
