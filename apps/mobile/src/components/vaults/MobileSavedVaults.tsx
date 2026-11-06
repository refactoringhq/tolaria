import { GithubLogo } from "phosphor-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { MobileIconButton } from "../../ui/MobileIconButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { useMobileVaults } from "../../workspace/git/useMobileVaults";
import { slugifyMobileWorkspaceAlias } from "../../workspace/mobileWorkspaceAlias";
import { optionalNativeWorkspaceAccessModule } from "../../workspace/nativeWorkspaceAccess";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { showNativeConfirmation } from "../ui/mobileNativeDialogs";
import { Text } from "../ui/text";
import { createVaultManagerStyles } from "./vaultManagerStyles";

type Manager = ReturnType<typeof useMobileVaults>;
type SavedVaultsManager = Pick<
	Manager,
	"active" | "busy" | "openFolder" | "select" | "selectLocal" | "forget"
> & {
	catalog: Pick<Manager["catalog"], "localVaults" | "vaults" | "updateAlias">;
};
type SavedVault = {
	id: string;
	label: string;
	alias?: string;
	kind: "local" | "git";
	select: () => Promise<unknown>;
};

export function MobileSavedVaults({
	manager,
}: {
	manager: SavedVaultsManager;
}) {
	const styles = useMobileStyles(createVaultManagerStyles);
	const colors = useMobileColors();
	const vaults: SavedVault[] = [
		...manager.catalog.localVaults.map((vault) => ({
			...vault,
			kind: "local" as const,
			select: () => manager.selectLocal(vault),
		})),
		...manager.catalog.vaults.map((vault) => ({
			...vault,
			kind: "git" as const,
			select: () => manager.select(vault),
		})),
	];
	return (
		<View style={styles.section} testID="saved-vaults">
			<Text style={styles.label}>
				{mobileText("status.vault.availableHeader")}
			</Text>
			{vaults.map((vault) => (
				<SavedVaultRow
					key={vault.id}
					vault={vault}
					manager={manager}
					selected={manager.active.selection?.catalogVaultId === vault.id}
					styles={styles}
				/>
			))}
			<MobileButton
				disabled={manager.busy}
				label={mobileText("status.vault.openLocal")}
				icon={<ChromeSymbol name="folderOpen" size={16} color={colors.text} />}
				onPress={() => {
					void manager.openFolder();
				}}
				testID="open-local-vault"
			/>
			<Text style={styles.detail}>
				{mobileText(
					optionalNativeWorkspaceAccessModule()?.syncLinkedWorkspace
						? "mobile.vaults.folderOpenHint"
						: "mobile.vaults.localCopy",
				)}
			</Text>
		</View>
	);
}

function SavedVaultRow({
	vault,
	manager,
	selected,
	styles,
}: {
	vault: SavedVault;
	manager: SavedVaultsManager;
	selected: boolean;
	styles: ReturnType<typeof createVaultManagerStyles>;
}) {
	return (
		<View style={rowStyles.vault}>
			<View style={rowStyles.row}>
				<SavedVaultSelect
					vault={vault}
					manager={manager}
					selected={selected}
					styles={styles}
				/>
				<SavedVaultRemove vault={vault} manager={manager} />
			</View>
			<SavedVaultAlias
				vault={vault}
				manager={manager}
				busy={manager.busy}
				styles={styles}
			/>
		</View>
	);
}

function SavedVaultSelect({
	vault,
	manager,
	selected,
	styles,
}: {
	vault: SavedVault;
	manager: SavedVaultsManager;
	selected: boolean;
	styles: ReturnType<typeof createVaultManagerStyles>;
}) {
	const colors = useMobileColors();
	const icon =
		vault.kind === "git" ? (
			<GithubLogo size={18} color={colors.textMuted} />
		) : (
			<ChromeSymbol name="folderOpen" size={18} color={colors.textMuted} />
		);
	return (
		<MobileButton
			disabled={manager.busy}
			label={vault.label}
			accessibilityState={{ selected }}
			icon={icon}
			style={[styles.vault, rowStyles.select]}
			variant={selected ? "secondary" : "ghost"}
			onPress={() => {
				void vault.select();
			}}
			testID={`select-vault-${vault.id}`}
		/>
	);
}

function SavedVaultRemove({
	vault,
	manager,
}: {
	vault: SavedVault;
	manager: SavedVaultsManager;
}) {
	const colors = useMobileColors();
	if (manager.busy) return null;
	return (
		<MobileIconButton
			accessibilityLabel={mobileText("status.vault.remove").replace(
				"{label}",
				vault.label,
			)}
			onPress={() =>
				showNativeConfirmation({
					cancelLabel: mobileText("common.cancel"),
					confirmLabel: mobileText("status.vault.removeConfirmAction"),
					message: mobileText("status.vault.removeConfirmMessage").replace(
						"{label}",
						vault.label,
					),
					onConfirm: () => {
						void manager.forget(vault.id);
					},
					title: mobileText("status.vault.removeConfirmAction"),
				})
			}
			testID={`forget-vault-${vault.id}`}
		>
			<ChromeSymbol name="close" size={16} color={colors.textMuted} />
		</MobileIconButton>
	);
}

function SavedVaultAlias({
	vault,
	manager,
	busy,
	styles,
}: {
	vault: SavedVault;
	manager: SavedVaultsManager;
	busy: boolean;
	styles: ReturnType<typeof createVaultManagerStyles>;
}) {
	const analytics = useMobileAnalytics();
	const [slug, setSlug] = useState(
		vault.alias ?? slugifyMobileWorkspaceAlias(vault.label) ?? "",
	);
	const [slugError, setSlugError] = useState(false);
	return (
		<>
			<MobileTextInput
				label={mobileText("settings.workspaces.slug")}
				value={slug}
				editable={!busy}
				autoCapitalize="none"
				autoCorrect={false}
				testID={`vault-slug-${vault.id}`}
				onChangeText={(value) => {
					setSlug(value);
					setSlugError(false);
				}}
				onEndEditing={({ nativeEvent }) => {
					void manager.catalog
						.updateAlias(vault.id, nativeEvent.text ?? "")
						.then((savedAlias) => {
							analytics.capture({
								name: "mobile_setting_changed",
								setting: "vaultSlug",
							});
							setSlug(savedAlias);
							setSlugError(false);
						})
						.catch(() => setSlugError(true));
				}}
			/>
			{slugError ? (
				<Text style={styles.error} accessibilityRole="alert">
					{mobileText("mobile.vaults.requestFailed")}
				</Text>
			) : null}
		</>
	);
}

const rowStyles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", gap: 8 },
	vault: { gap: 8 },
	select: { flex: 1, minWidth: 0 },
});
