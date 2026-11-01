import { Text as NativeText, Picker } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
			style={{
				alignItems: "center",
				paddingBottom: bottom + 8,
				paddingHorizontal: 16,
				paddingTop: 8,
			}}
			testID="note-list-filter-native"
		>
			<Picker
				modifiers={[pickerStyle("segmented")]}
				selection={props.active}
				onSelectionChange={props.onChange}
			>
				<NativeText modifiers={[tag("open")]}>
					{mobileText("noteList.filter.open")}{" "}
					{props.counts.open.toLocaleString()}
				</NativeText>
				<NativeText modifiers={[tag("archived")]}>
					{mobileText("noteList.filter.archived")}{" "}
					{props.counts.archived.toLocaleString()}
				</NativeText>
			</Picker>
		</View>
	);
}
