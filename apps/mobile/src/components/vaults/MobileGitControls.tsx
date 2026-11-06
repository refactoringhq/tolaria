import { useState } from "react";
import { View } from "react-native";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { mobileText } from "../../i18n/mobileText";
import { useMobileSettings } from "../../settings/useMobileSettings";
import { MobileButton } from "../../ui/MobileButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { useMobileVaults } from "../../workspace/git/useMobileVaults";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Switch } from "../ui/switch";
import { Text } from "../ui/text";
import { createVaultManagerStyles } from "./vaultManagerStyles";

type GitControlsManager = Pick<
	ReturnType<typeof useMobileVaults>,
	"active" | "busy" | "status" | "sync" | "commit" | "lastCommitId"
>;

export function MobileGitControls({
	manager,
	showAutoGit = true,
}: {
	manager: GitControlsManager;
	showAutoGit?: boolean;
}) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const preferences = useMobileSettings();
	if (!manager.active.git) return null;
	return (
		<View style={styles.section} testID="vault-git-controls">
			<GitControlsSummary
				manager={manager}
				autoGit={preferences.settings.autoGit}
			/>
			{showAutoGit && <AutoGitSettings disabled={manager.busy} />}
			{manager.status === "committed" && <CommitSuccess />}
			{!preferences.settings.autoGit && (
				<ManualCommitActions manager={manager} />
			)}
			<SyncNowButton manager={manager} />
		</View>
	);
}

const touchControl = { minHeight: 44 };

function GitControlsSummary({
	manager,
	autoGit,
}: {
	manager: GitControlsManager;
	autoGit: boolean;
}) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const mobileColors = useMobileColors();
	return (
		<View style={styles.row}>
			<ChromeSymbol name="gitCommit" color={mobileColors.textMuted} size={18} />
			<Text style={styles.label}>{mobileText("settings.autogit.title")}</Text>
			<Text style={styles.detail}>
				{mobileText(autoGit ? "mobile.git.auto" : "mobile.git.manual")}
			</Text>
			{manager.lastCommitId && (
				<Text selectable style={styles.detail}>
					{manager.lastCommitId}
				</Text>
			)}
		</View>
	);
}

function CommitSuccess() {
	const styles = useMobileStyles(createVaultManagerStyles);
	return (
		<Text
			accessibilityLiveRegion="polite"
			style={styles.detail}
			testID="git-commit-success"
		>
			{mobileText("mobile.git.localCommit")}
		</Text>
	);
}

function ManualCommitActions({ manager }: { manager: GitControlsManager }) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const mobileColors = useMobileColors();
	const [message, setMessage] = useState("");
	const disabled = manager.busy || !message.trim();
	return (
		<>
			<MobileTextInput
				label={mobileText("mobile.git.commitMessage")}
				value={message}
				onChangeText={setMessage}
				editable={!manager.busy}
				style={touchControl}
				testID="git-commit-message"
			/>
			<View style={styles.row}>
				<MobileButton
					disabled={disabled}
					label={mobileText("mobile.git.commitLocal")}
					icon={
						<ChromeSymbol
							name="gitCommit"
							size={16}
							color={mobileColors.text}
						/>
					}
					onPress={() => {
						void manager.commit(message);
					}}
					style={touchControl}
					testID="git-commit-local"
				/>
				<MobileButton
					disabled={disabled}
					label={mobileText("mobile.git.commitAndSync")}
					onPress={() => {
						void manager.commit(message, true);
					}}
					style={touchControl}
					testID="git-commit-sync"
				/>
			</View>
		</>
	);
}

function SyncNowButton({ manager }: { manager: GitControlsManager }) {
	const mobileColors = useMobileColors();
	return (
		<MobileButton
			disabled={manager.busy}
			label={mobileText("mobile.sync.action")}
			icon={<ChromeSymbol name="sync" size={16} color={mobileColors.text} />}
			onPress={() => {
				void manager.sync();
			}}
			style={touchControl}
			testID="git-sync-now"
		/>
	);
}

function AutoGitSettings({ disabled }: { disabled: boolean }) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const preferences = useMobileSettings();
	const analytics = useMobileAnalytics();
	return (
		<View style={styles.section}>
			<View style={styles.row}>
				<Text style={styles.detail}>
					{mobileText("settings.autogit.enable")}
				</Text>
				<Switch
					checked={preferences.settings.autoGit}
					disabled={disabled || !preferences.ready || preferences.saving}
					accessibilityLabel={mobileText("settings.autogit.enable")}
					testID="settings-auto-git"
					onCheckedChange={(autoGit) => {
						void preferences.update({ autoGit }).then((saved) => {
							if (saved)
								analytics.capture({
									name: "mobile_setting_changed",
									setting: "autoGit",
								});
						});
					}}
				/>
			</View>
			<Text style={styles.detail}>
				{mobileText("mobile.settings.autoGitForeground")}
			</Text>
		</View>
	);
}
