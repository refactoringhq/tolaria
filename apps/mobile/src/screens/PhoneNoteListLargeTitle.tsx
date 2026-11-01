import { StyleSheet, View } from "react-native";
import { Text } from "../components/ui/text";
import { useMobileColors, useMobileMetrics } from "../ui/theme/useMobileTheme";

export function PhoneNoteListLargeTitle({ title }: { title: string }) {
	const colors = useMobileColors();
	const metrics = useMobileMetrics();
	return (
		<View
			style={{
				paddingTop: metrics.size(108),
				paddingHorizontal: metrics.phoneChrome.rowHorizontalPadding,
			}}
			testID="phone-note-list-large-title"
		>
			<Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>
				{title}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	title: { fontSize: 34, fontWeight: "700", lineHeight: 40 },
});
