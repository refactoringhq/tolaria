import type { MenuAction } from "@expo/ui/community/menu";
import MenuView from "@expo/ui/community/menu";
import type { SFSymbol } from "expo-symbols";
import { SymbolView } from "expo-symbols";
import { useContext } from "react";
import { Pressable, StyleSheet } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import { MobileVaultPickerContext } from "../../workspace/MobileVaultContext";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

export function MobileVaultPicker({ title }: { title?: string }) {
	const picker = useContext(MobileVaultPickerContext);
	const colors = useMobileColors();
	if (!picker) return null;
	const actions: MenuAction[] = [
		...picker.choices.map((choice) => ({
			id: `quick-select-vault-${choice.id}`,
			title: choice.label,
			state: choice.selected ? ("on" as const) : ("off" as const),
			image: choice.selected ? ("checkmark" as SFSymbol) : undefined,
		})),
		{
			id: "quick-manage-vaults",
			title: mobileText("status.vault.manageWorkspaces"),
			image: "gearshape" as SFSymbol,
		},
	];
	const trigger = (
		<Pressable
			accessibilityLabel={mobileText("status.vault.switch")}
			accessibilityRole="button"
			accessibilityState={{ disabled: picker.disabled }}
			disabled={picker.disabled}
			style={styles.trigger}
			testID="sidebar-vault-picker"
		>
			<Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
				{title ?? picker.choices.find((choice) => choice.selected)?.label}
			</Text>
			<SymbolView
				fallback={
					<ChromeSymbol name="caretDown" color={colors.textMuted} size={16} />
				}
				name={{ ios: "chevron.down", android: "arrow_drop_down" }}
				size={16}
				tintColor={colors.textMuted}
			/>
		</Pressable>
	);
	if (picker.disabled) return trigger;
	return (
		<MenuView
			actions={actions}
			onPressAction={({ nativeEvent }) => {
				const choice = picker.choices.find(
					(candidate) =>
						`quick-select-vault-${candidate.id}` === nativeEvent.event,
				);
				if (choice) void choice.select();
				else if (nativeEvent.event === "quick-manage-vaults") picker.manage();
			}}
			testID="sidebar-vault-options"
			title={title ?? mobileText("status.vault.switch")}
		>
			{trigger}
		</MenuView>
	);
}

const styles = StyleSheet.create({
	trigger: {
		minWidth: 44,
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 8,
	},
	title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: "600" },
});
