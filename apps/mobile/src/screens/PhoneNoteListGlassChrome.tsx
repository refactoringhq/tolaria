import { GlassView } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/ui/text";
import { mobileCopy } from "../i18n/mobileText";
import { useMobileMetrics } from "../ui/theme/useMobileTheme";
import { useMobileChromeColors } from "../ui/theme/useMobileChromeColors";
import { PhoneEditorTopFade } from "./PhoneEditorTopFade";

export function PhoneNoteListGlassChrome(props: {
	leading?: ReactNode;
	onOpenSearch: () => void;
	title: string;
	titleVisible: boolean;
}) {
	const colors = useMobileChromeColors();
	const metrics = useMobileMetrics();
	const insets = useSafeAreaInsets();
	return (
		<View
			pointerEvents="box-none"
			style={StyleSheet.absoluteFill}
			testID="phone-note-list-glass-chrome"
		>
			<PhoneEditorTopFade />
			<PhoneNoteListGlassActions
				color={colors.text}
				leading={props.leading}
				left={metrics.phoneChrome.rowHorizontalPadding}
				onOpenSearch={props.onOpenSearch}
				top={insets.top + metrics.space.sm}
			/>
			{props.titleVisible ? (
				<PhoneNoteListCollapsedTitle
					color={colors.text}
					top={insets.top + metrics.space.sm}
					title={props.title}
				/>
			) : null}
		</View>
	);
}

function PhoneNoteListGlassActions(props: {
	color: ColorValue;
	leading?: ReactNode;
	left: number;
	onOpenSearch: () => void;
	top: number;
}) {
	return (
		<View
			pointerEvents="box-none"
			style={[
				styles.row,
				{ left: props.left, right: props.left, top: props.top },
			]}
		>
			<GlassView
				glassEffectStyle="regular"
				isInteractive
				style={styles.buttonGlass}
			>
				<View style={styles.leading}>{props.leading}</View>
			</GlassView>
			<GlassView
				glassEffectStyle="regular"
				isInteractive
				style={styles.buttonGlass}
			>
				<Pressable
					accessibilityLabel={mobileCopy.searchNotes}
					accessibilityRole="button"
					onPress={props.onOpenSearch}
					style={styles.iconButton}
					testID="phone-note-list-search"
				>
					<SymbolView
						fallback={<Text style={{ color: props.color }}>⌕</Text>}
						name={{ ios: "magnifyingglass", android: "search" }}
						size={20}
						tintColor={props.color}
					/>
				</Pressable>
			</GlassView>
		</View>
	);
}

function PhoneNoteListCollapsedTitle(props: {
	color: ColorValue;
	title: string;
	top: number;
}) {
	return (
		<GlassView
			glassEffectStyle="regular"
			style={[styles.titleGlass, { top: props.top }]}
		>
			<View style={styles.titleButton} testID="phone-note-list-collapsed-title">
				<Text numberOfLines={1} style={[styles.title, { color: props.color }]}>
					{props.title}
				</Text>
			</View>
		</GlassView>
	);
}

const styles = StyleSheet.create({
	row: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
		position: "absolute",
		zIndex: 20,
	},
	buttonGlass: { borderRadius: 24, height: 44, overflow: "hidden", width: 44 },
	leading: { alignItems: "center", flex: 1, justifyContent: "center" },
	iconButton: {
		alignItems: "center",
		height: 44,
		justifyContent: "center",
		width: 44,
	},
	titleGlass: {
		alignSelf: "center",
		maxWidth: "56%",
		position: "absolute",
		zIndex: 19,
		borderRadius: 20,
		overflow: "hidden",
	},
	titleButton: {
		alignItems: "center",
		justifyContent: "center",
		minHeight: 40,
		paddingHorizontal: 14,
	},
	title: { fontSize: 15, fontWeight: "600" },
});
