import type { ReactNode } from "react";
import { View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { Button } from "../ui/button";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { showNativeConfirmation } from "../ui/mobileNativeDialogs";
import { Text } from "../ui/text";
import { createThemeStyles } from "./MobileNoteMoreActionRow.styles";

export function DeleteActionRow({
	message,
	onClose,
	onDeleteNote,
}: {
	message: string;
	onClose: () => void;
	onDeleteNote: () => void;
}) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<ActionRow
			destructive
			icon={
				<ChromeSymbol
					name="delete"
					color={mobileColors.red}
					size={desktopToolbarActionParity.iconSize}
				/>
			}
			label={mobileText("command.note.deleteNote")}
			testID="workspace-action-delete-note"
			onPress={() => {
				showNativeConfirmation({
					cancelLabel: mobileText("common.cancel"),
					confirmLabel: mobileText("command.note.deleteNote"),
					message,
					onConfirm: () => {
						onDeleteNote();
						onClose();
					},
					title: mobileText("command.note.deleteNote"),
				});
			}}
		/>
	);
}

export function ActionRow({
	icon,
	destructive = false,
	label,
	onPress,
	testID,
}: {
	destructive?: boolean;
	icon: ReactNode;
	label: string;
	onPress: () => void;
	testID?: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Button
			accessibilityLabel={label}
			variant="ghost"
			style={styles.actionRow}
			testID={testID}
			onPress={onPress}
		>
			<ViewActionRowContent
				icon={icon}
				label={label}
				destructive={destructive}
				styles={styles}
			/>
		</Button>
	);
}

function ViewActionRowContent({
	icon,
	label,
	destructive,
	styles,
}: {
	icon: ReactNode;
	label: string;
	destructive: boolean;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return (
		<View style={styles.actionRowContent}>
			<View style={styles.actionIcon}>{icon}</View>
			<Text
				numberOfLines={1}
				style={[
					styles.actionText,
					destructive ? styles.actionTextDestructive : null,
				]}
			>
				{label}
			</Text>
		</View>
	);
}
