import {
	Button,
	Form,
	Picker,
	RNHostView,
	Section,
	Text,
	Toggle,
} from "@expo/ui/swift-ui";
import {
	disabled,
	listStyle,
	pickerStyle,
	tag,
} from "@expo/ui/swift-ui/modifiers";
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

export function MobileNativeSettingsForm(props: Props) {
	const { manager, preferences } = props;
	if (manager.conflictReview)
		return (
			<RNHostView matchContents={{ vertical: true }}>
				<MobileSyncSettingsRows manager={manager} />
			</RNHostView>
		);
	const syncTime = manager.syncHistory.record.lastSuccessAt;
	return (
		<Form modifiers={[listStyle("insetGrouped")]}>
			<Section title={mobileText("settings.workspaces.title")}>
				<RNHostView matchContents={{ vertical: true }}>
					<MobileWorkspaceSettingsRows manager={manager} />
				</RNHostView>
			</Section>
			<Section title={mobileText("mobile.vaults.github")}>
				<RNHostView matchContents={{ vertical: true }}>
					<MobileGitHubSettingsRows manager={manager} />
				</RNHostView>
			</Section>
			<Section
				title={mobileText("mobile.sync.action")}
				footer={
					<Text>
						{syncTime
							? mobileText("mobile.sync.lastSuccess").replace(
									"{time}",
									new Date(syncTime).toLocaleString(),
								)
							: mobileText("mobile.sync.never")}
					</Text>
				}
			>
				<AutoGitToggle manager={manager} preferences={preferences} />
				<RNHostView matchContents={{ vertical: true }}>
					<MobileSyncSettingsRows manager={manager} />
				</RNHostView>
			</Section>
			<AppearanceSection preferences={preferences} />
			<UpdateSection updates={props.updates} />
			<PrivacySection preferences={preferences} />
			<AboutSection updates={props.updates} />
		</Form>
	);
}

function AboutSection({ updates }: Pick<Props, "updates">) {
	const buildLabel = mobileText("mobile.updates.nativeBuild")
		.replace(
			"{version}",
			updates.runtime.appVersion ?? mobileText("mobile.updates.unknown"),
		)
		.replace(
			"{build}",
			updates.runtime.buildVersion ?? mobileText("mobile.updates.unknown"),
		);
	return (
		<Section title="Tolaria">
			<Text>{buildLabel}</Text>
		</Section>
	);
}

function AutoGitToggle({
	manager,
	preferences,
}: Pick<Props, "manager" | "preferences">) {
	const analytics = useMobileAnalytics();
	return (
		<Toggle
			label={mobileText("settings.autogit.enable")}
			isOn={preferences.settings.autoGit}
			modifiers={[
				disabled(
					!manager.active.git ||
						!preferences.ready ||
						preferences.saving ||
						manager.busy,
				),
			]}
			onIsOnChange={(autoGit) => {
				void preferences.update({ autoGit }).then((saved) => {
					if (saved)
						analytics.capture({
							name: "mobile_setting_changed",
							setting: "autoGit",
						});
				});
			}}
		/>
	);
}

function AppearanceSection({ preferences }: Pick<Props, "preferences">) {
	const analytics = useMobileAnalytics();
	const theme = preferences.settings.theme;
	return (
		<Section title={mobileText("settings.appearance.title")}>
			<Picker
				label={mobileText("settings.theme.label")}
				selection={theme}
				modifiers={[
					pickerStyle("segmented"),
					disabled(!preferences.ready || preferences.saving),
				]}
				onSelectionChange={(value) => {
					void preferences.update({ theme: value }).then((saved) => {
						if (saved)
							analytics.capture({ name: "theme_mode_changed", mode: value });
					});
				}}
			>
				<Text modifiers={[tag("system")]}>
					{mobileText("settings.theme.system")}
				</Text>
				<Text modifiers={[tag("light")]}>
					{mobileText("settings.theme.light")}
				</Text>
				<Text modifiers={[tag("dark")]}>
					{mobileText("settings.theme.dark")}
				</Text>
			</Picker>
		</Section>
	);
}

function UpdateSection({ updates }: Pick<Props, "updates">) {
	const diagnostics = mobileUpdateDiagnostics(updates.runtime, updates);
	return (
		<Section
			title={mobileText("settings.releaseChannel")}
			footer={
				<Text>
					{[
						diagnostics.build,
						diagnostics.running,
						diagnostics.runtime,
						diagnostics.checked,
					]
						.filter(Boolean)
						.join("\n")}
				</Text>
			}
		>
			<Picker
				label={mobileText("settings.releaseChannel")}
				selection={updates.selected}
				modifiers={[pickerStyle("menu"), disabled(updates.disabled)]}
				onSelectionChange={(value) => {
					void updates.select(value);
				}}
			>
				<Text modifiers={[tag("stable")]}>
					{mobileText("settings.releaseStable")}
				</Text>
				<Text modifiers={[tag("alpha")]}>
					{mobileText("settings.releaseAlpha")}
				</Text>
			</Picker>
			<Text>{diagnostics.status}</Text>
			<Button
				label={mobileText(
					updates.phase === "ready"
						? "update.restartNow"
						: "status.update.check",
				)}
				onPress={() => {
					void (updates.phase === "ready"
						? updates.restart()
						: updates.check());
				}}
			/>
		</Section>
	);
}

function PrivacySection({ preferences }: Pick<Props, "preferences">) {
	const analytics = useMobileAnalytics();
	return (
		<Section
			title={mobileText("settings.privacy.title")}
			footer={
				<Text>{`${mobileText("settings.privacy.analyticsDescription")}\n${mobileText("settings.privacy.crashReportingDescription")}`}</Text>
			}
		>
			<Toggle
				label={mobileText("settings.privacy.analytics")}
				isOn={preferences.settings.analytics}
				modifiers={[disabled(!preferences.ready || preferences.saving)]}
				onIsOnChange={(enabled) => {
					if (!enabled) analytics.setEnabled(false);
					void preferences.update({ analytics: enabled });
				}}
			/>
			<CrashReportingToggle preferences={preferences} />
		</Section>
	);
}

function CrashReportingToggle({ preferences }: Pick<Props, "preferences">) {
	return (
		<Toggle
			label={mobileText("settings.privacy.crashReporting")}
			isOn={preferences.settings.crashReporting}
			modifiers={[disabled(!preferences.ready || preferences.saving)]}
			onIsOnChange={(enabled) => {
				if (!enabled) void mobileCrashReporting.setEnabled(false);
				void preferences.update({ crashReporting: enabled });
			}}
		/>
	);
}
