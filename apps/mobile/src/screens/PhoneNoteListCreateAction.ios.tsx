import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { mobileCopy } from "../i18n/mobileText";
import { useMobileColors, useMobileMetrics } from "../ui/theme/useMobileTheme";

export function PhoneNoteListCreateAction(props: {
	onPress: () => void;
	visible: boolean;
}) {
	const colors = useMobileColors();
	const metrics = useMobileMetrics();
	if (!props.visible) return null;
	return (
		<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
			<GlassView
				glassEffectStyle="regular"
				isInteractive
				style={[
					styles.glass,
					{
						bottom: metrics.space.md,
						right: metrics.phoneChrome.rowHorizontalPadding,
					},
				]}
			>
				<Pressable
					accessibilityLabel={mobileCopy.createNote}
					accessibilityRole="button"
					onPress={props.onPress}
					style={styles.button}
					testID="phone-note-list-create"
				>
					<SymbolView
						fallback={null}
						name={{ ios: "square.and.pencil", android: "edit" }}
						size={24}
						tintColor={colors.text}
					/>
				</Pressable>
			</GlassView>
		</View>
	);
}

const styles = StyleSheet.create({
	glass: {
		borderRadius: 28,
		height: 56,
		overflow: "hidden",
		position: "absolute",
		width: 56,
	},
	button: {
		alignItems: "center",
		height: 56,
		justifyContent: "center",
		width: 56,
	},
});
