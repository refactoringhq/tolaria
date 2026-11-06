import * as WebBrowser from "expo-web-browser";
import { GithubLogo } from "phosphor-react-native";
import { View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { useMobileChromeColors } from "../../ui/theme/useMobileChromeColors";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { useGitHubAccount } from "../../workspace/git/useGitHubAccount";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { showNativeConfirmation } from "../ui/mobileNativeDialogs";
import { Text } from "../ui/text";
import { MobileDeviceCode } from "./MobileDeviceCode";
import { MobileGitHubRepositories } from "./MobileGitHubRepositories";
import { createVaultManagerStyles } from "./vaultManagerStyles";

type GitHubAccountProps = {
	account: ReturnType<typeof useGitHubAccount>;
	disabled: boolean;
	clone: (url: string) => Promise<void>;
};

export function MobileGitHubAccount({
	account,
	disabled,
	clone,
}: GitHubAccountProps) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const locked = disabled || account.busy;
	return (
		<View style={styles.section}>
			<Text style={styles.label}>{mobileText("mobile.vaults.github")}</Text>
			{!account.configured && (
				<Text style={styles.detail}>
					{mobileText("mobile.vaults.notConfigured")}
				</Text>
			)}
			{account.error && (
				<Text accessibilityRole="alert" style={styles.error}>
					{mobileText(account.error)}
				</Text>
			)}
			{account.session ? (
				<GitHubConnectedActions
					account={account}
					clone={clone}
					disabled={locked}
					login={account.session.login}
				/>
			) : (
				<GitHubSignInAction account={account} disabled={locked} />
			)}
			<GitHubDeviceCode account={account} />
		</View>
	);
}

function GitHubConnectedActions({
	account,
	clone,
	disabled,
	login,
}: GitHubAccountProps & { login: string }) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const mobileColors = useMobileColors();
	const chrome = useMobileChromeColors();
	return (
		<>
			<Text style={[styles.detail, { color: chrome.text }]}>
				{mobileText("mobile.vaults.connectedAs").replace("{login}", login)}
			</Text>
			<View style={styles.row}>
				<MobileGitHubRepositories
					account={account}
					clone={clone}
					disabled={disabled}
				/>
				<MobileButton
					disabled={disabled}
					label={mobileText("mobile.vaults.signOut")}
					icon={
						<ChromeSymbol
							name="signOut"
							size={16}
							color={mobileColors.textMuted}
						/>
					}
					onPress={() =>
						showNativeConfirmation({
							cancelLabel: mobileText("common.cancel"),
							confirmLabel: mobileText("mobile.vaults.signOut"),
							message: mobileText("mobile.vaults.connectedAs").replace(
								"{login}",
								login,
							),
							onConfirm: () => {
								void account.signOut();
							},
							title: mobileText("mobile.vaults.signOut"),
						})
					}
					variant="ghost"
				/>
			</View>
		</>
	);
}

function GitHubSignInAction({
	account,
	disabled,
}: Pick<GitHubAccountProps, "account" | "disabled">) {
	const mobileColors = useMobileColors();
	return (
		<MobileButton
			disabled={disabled || !account.configured}
			label={mobileText("mobile.vaults.signIn")}
			icon={<GithubLogo size={16} color={mobileColors.text} />}
			onPress={() => {
				void account.signIn();
			}}
		/>
	);
}

function GitHubDeviceCode({ account }: Pick<GitHubAccountProps, "account">) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const mobileColors = useMobileColors();
	const code = account.code;
	if (!code) return null;
	return (
		<View style={styles.section}>
			<Text style={styles.detail}>
				{mobileText("mobile.vaults.deviceCode")}
			</Text>
			<MobileDeviceCode key={code.user_code} code={code.user_code} />
			<View style={styles.row}>
				<MobileButton
					label={mobileText("mobile.vaults.openGitHub")}
					icon={
						<ChromeSymbol
							name="externalLink"
							size={16}
							color={mobileColors.text}
						/>
					}
					onPress={() => {
						void WebBrowser.openBrowserAsync(
							"https://github.com/login/device",
						).catch(account.cancelSignIn);
					}}
				/>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={account.cancelSignIn}
				/>
			</View>
		</View>
	);
}
