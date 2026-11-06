import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ui/button";
import { ChromeSymbol } from "../components/ui/ChromeSymbol";
import { createActionStyles } from "../components/workspace/MobileNoteListPanel.styles";
import { mobileCopy } from "../i18n/mobileText";
import { useMobileStyles } from "../ui/theme/useMobileTheme";

export function PhoneNoteListCreateAction(props: {
	onPress: () => void;
	visible: boolean;
}) {
	const { styles, mobileColors, createIconSize } =
		useMobileStyles(createActionStyles);
	const insets = useSafeAreaInsets();
	if (!props.visible) return null;
	return (
		<View
			pointerEvents="box-none"
			style={[StyleSheet.absoluteFill, { bottom: insets.bottom }]}
		>
			<Button
				accessibilityLabel={mobileCopy.createNote}
				className="shadow-md active:opacity-80"
				size="icon"
				style={StyleSheet.flatten(styles.createAction)}
				testID="phone-note-list-create"
				onPress={props.onPress}
			>
				<ChromeSymbol
					name="compose"
					color={mobileColors.textInverse}
					size={createIconSize}
					weight="bold"
				/>
			</Button>
		</View>
	);
}
