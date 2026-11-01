import {
	Button,
	Column,
	ListItem,
	RNHostView,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
	Switch,
	Text,
} from "@expo/ui/jetpack-compose";
import type { ReactNode } from "react";
import { mobileCrashReporting } from "../analytics/mobileSentry";
import { useMobileAnalytics } from "../analytics/useMobileAnalytics";
import {
	MobileGitHubSettingsRows,
	MobileSyncSettingsRows,
	MobileWorkspaceSettingsRows,
} from "../components/vaults/MobileVaultManager";
import { mobileText } from "../i18n/mobileText";
import type { useMobileVaults } from "../workspace/git/useMobileVaults";
import { mobileUpdateDiagnostics } from "./mobileUpdateDiagnostics";
import type { useMobileSettings } from "./useMobileSettings";
import type { useMobileUpdateChannel } from "./useMobileUpdateChannel";

type Props = {
	manager: ReturnType<typeof useMobileVaults>;
	preferences: ReturnType<typeof useMobileSettings>;
	updates: ReturnType<typeof useMobileUpdateChannel>;
};

export function MobileNativeSettingsForm({
	manager,
	preferences,
	updates,
}: Props) {
	if (manager.conflictReview)
		return (
			<RNHostView matchContents={{ vertical: true }}>
				<MobileSyncSettingsRows manager={manager} />
			</RNHostView>
		);
	const lastSync = manager.syncHistory.record.lastSuccessAt
		? mobileText("mobile.sync.lastSuccess").replace(
				"{time}",
				new Date(manager.syncHistory.record.lastSuccessAt).toLocaleString(),
			)
		: mobileText("mobile.sync.never");
	return (
		<Column>
			<SettingsSection title={mobileText("settings.workspaces.title")}>
				<RNHostView matchContents={{ vertical: true }}>
					<MobileWorkspaceSettingsRows manager={manager} />
				</RNHostView>
			</SettingsSection>
			<SettingsSection title={mobileText("mobile.vaults.github")}>
				<RNHostView matchContents={{ vertical: true }}>
					<MobileGitHubSettingsRows manager={manager} />
				</RNHostView>
			</SettingsSection>
			<SettingsSection
				title={mobileText("mobile.sync.action")}
				footer={lastSync}
			>
				<AutoGitRow manager={manager} preferences={preferences} />
				<RNHostView matchContents={{ vertical: true }}>
					<MobileSyncSettingsRows manager={manager} />
				</RNHostView>
			</SettingsSection>
			<AppearanceSection preferences={preferences} />
			<UpdateSection updates={updates} />
			<PrivacySection preferences={preferences} />
			<SettingsSection title="Tolaria">
				<Text>{mobileUpdateDiagnostics(updates.runtime, updates).build}</Text>
			</SettingsSection>
		</Column>
	);
}

function SettingsSection({
	title,
	footer,
	children,
}: {
	title: string;
	footer?: string;
	children: ReactNode;
}) {
	return (
		<Column>
			<Text>{title}</Text>
			{children}
			{footer ? <Text>{footer}</Text> : null}
		</Column>
	);
}

function AutoGitRow({
	manager,
	preferences,
}: Pick<Props, "manager" | "preferences">) {
	const analytics = useMobileAnalytics();
	return (
		<ListItem>
			<ListItem.HeadlineContent>
				{mobileText("settings.autogit.enable")}
			</ListItem.HeadlineContent>
			<ListItem.TrailingContent>
				<Switch
					value={preferences.settings.autoGit}
					enabled={
						Boolean(manager.active.git) &&
						preferences.ready &&
						!preferences.saving &&
						!manager.busy
					}
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
			</ListItem.TrailingContent>
		</ListItem>
	);
}

function AppearanceSection({ preferences }: Pick<Props, "preferences">) {
	const analytics = useMobileAnalytics();
	return (
		<SettingsSection title={mobileText("settings.appearance.title")}>
			<SingleChoiceSegmentedButtonRow>
				{(["system", "light", "dark"] as const).map((theme) => (
					<SegmentedButton
						key={theme}
						selected={preferences.settings.theme === theme}
						onClick={() => {
							void preferences.update({ theme }).then((saved) => {
								if (saved)
									analytics.capture({
										name: "theme_mode_changed",
										mode: theme,
									});
							});
						}}
					>
						<SegmentedButton.Label>
							{mobileText(`settings.theme.${theme}`)}
						</SegmentedButton.Label>
					</SegmentedButton>
				))}
			</SingleChoiceSegmentedButtonRow>
		</SettingsSection>
	);
}

function UpdateSection({ updates }: Pick<Props, "updates">) {
	const diagnostics = mobileUpdateDiagnostics(updates.runtime, updates);
	return (
		<SettingsSection
			title={mobileText("settings.releaseChannel")}
			footer={[
				diagnostics.build,
				diagnostics.running,
				diagnostics.runtime,
				diagnostics.checked,
			]
				.filter(Boolean)
				.join("\n")}
		>
			<SingleChoiceSegmentedButtonRow>
				{(["stable", "alpha"] as const).map((channel) => (
					<SegmentedButton
						key={channel}
						selected={updates.selected === channel}
						enabled={!updates.disabled}
						onClick={() => {
							void updates.select(channel);
						}}
					>
						<SegmentedButton.Label>
							{mobileText(
								channel === "stable"
									? "settings.releaseStable"
									: "settings.releaseAlpha",
							)}
						</SegmentedButton.Label>
					</SegmentedButton>
				))}
			</SingleChoiceSegmentedButtonRow>
			<ListItem>
				<ListItem.HeadlineContent>
					{diagnostics.status}
				</ListItem.HeadlineContent>
			</ListItem>
			<Button
				enabled={!updates.disabled}
				onClick={() => {
					void (updates.phase === "ready"
						? updates.restart()
						: updates.check());
				}}
			>
				<Text>
					{mobileText(
						updates.phase === "ready"
							? "update.restartNow"
							: "status.update.check",
					)}
				</Text>
			</Button>
		</SettingsSection>
	);
}

function PrivacySection({ preferences }: Pick<Props, "preferences">) {
	const analytics = useMobileAnalytics();
	return (
		<SettingsSection
			title={mobileText("settings.privacy.title")}
			footer={`${mobileText("settings.privacy.analyticsDescription")}\n${mobileText("settings.privacy.crashReportingDescription")}`}
		>
			<PrivacyRow
				label={mobileText("settings.privacy.analytics")}
				enabled={preferences.settings.analytics}
				available={preferences.ready && !preferences.saving}
				onChange={(value) => {
					if (!value) analytics.setEnabled(false);
					void preferences.update({ analytics: value });
				}}
			/>
			<PrivacyRow
				label={mobileText("settings.privacy.crashReporting")}
				enabled={preferences.settings.crashReporting}
				available={preferences.ready && !preferences.saving}
				onChange={(value) => {
					if (!value) void mobileCrashReporting.setEnabled(false);
					void preferences.update({ crashReporting: value });
				}}
			/>
		</SettingsSection>
	);
}

function PrivacyRow({
	label,
	enabled,
	available,
	onChange,
}: {
	label: string;
	enabled: boolean;
	available: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<ListItem>
			<ListItem.HeadlineContent>{label}</ListItem.HeadlineContent>
			<ListItem.TrailingContent>
				<Switch
					value={enabled}
					enabled={available}
					onCheckedChange={onChange}
				/>
			</ListItem.TrailingContent>
		</ListItem>
	);
}
