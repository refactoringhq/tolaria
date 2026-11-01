import {
	Host,
	Text as NativeText,
	SegmentedButton,
	SingleChoiceSegmentedButtonRow,
} from "@expo/ui/jetpack-compose";
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
			<Host matchContents>
				<SingleChoiceSegmentedButtonRow>
					<SegmentedButton
						selected={props.active === "open"}
						onClick={() => props.onChange("open")}
					>
						<SegmentedButton.Label>
							<NativeText>
								{mobileText("noteList.filter.open")}{" "}
								{props.counts.open.toLocaleString()}
							</NativeText>
						</SegmentedButton.Label>
					</SegmentedButton>
					<SegmentedButton
						selected={props.active === "archived"}
						onClick={() => props.onChange("archived")}
					>
						<SegmentedButton.Label>
							<NativeText>
								{mobileText("noteList.filter.archived")}{" "}
								{props.counts.archived.toLocaleString()}
							</NativeText>
						</SegmentedButton.Label>
					</SegmentedButton>
				</SingleChoiceSegmentedButtonRow>
			</Host>
		</View>
	);
}
