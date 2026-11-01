import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/ui/button";
import { Text } from "../components/ui/text";
import { mobileNoteListFilterOptions } from "../components/workspace/MobileNoteListPanelChrome";
import { mobileText } from "../i18n/mobileText";
import type { MobileNoteListFilter } from "../workspace/mobileNoteFilters";

export function PhoneNoteListFilter(props: {
	active: MobileNoteListFilter;
	counts: Record<MobileNoteListFilter, number>;
	onChange: (filter: MobileNoteListFilter) => void;
}) {
	const { bottom } = useSafeAreaInsets();
	return (
		<View
			accessibilityRole="tablist"
			style={{
				alignItems: "center",
				paddingBottom: bottom + 8,
				paddingHorizontal: 16,
				paddingTop: 8,
			}}
			testID="note-list-filter-native"
		>
			<View style={{ flexDirection: "row", gap: 8 }}>
				{mobileNoteListFilterOptions.map((option) => (
					<Button
						accessibilityLabel={mobileText(option.labelKey)}
						accessibilityRole="tab"
						accessibilityState={{ selected: props.active === option.value }}
						key={option.value}
						onPress={() => props.onChange(option.value)}
					>
						<Text>
							{mobileText(option.labelKey)}{" "}
							{props.counts[option.value].toLocaleString()}
						</Text>
					</Button>
				))}
			</View>
		</View>
	);
}
