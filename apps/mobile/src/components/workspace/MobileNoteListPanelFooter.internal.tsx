import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { MobileLayoutProbeReadout } from "../../qa/MobileLayoutProbeReadout";
import type { useMobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileNoteListFilter } from "../../workspace/mobileNoteFilters";
import { Button } from "../ui/button";
import { Text } from "../ui/text";
import { createThemeStyles } from "./MobileNoteListPanel.styles";
import { mobileNoteListFilterOptions } from "./MobileNoteListPanelChrome";
import { mobilePaneFooterFrame } from "./mobilePaneFooterLayout";

type MobileNoteListPanelFooterProps = {
	active: MobileNoteListFilter;
	counts: Record<MobileNoteListFilter, number>;
	layoutProbe: ReturnType<typeof useMobileLayoutProbe> | null;
	onChange: ((filter: MobileNoteListFilter) => void) | undefined;
};
export function MobileNoteListPanelFooter({
	active,
	counts,
	layoutProbe,
	onChange,
}: MobileNoteListPanelFooterProps) {
	return (
		<>
			{onChange ? (
				<NoteListFilterPills
					active={active}
					counts={counts}
					onChange={onChange}
				/>
			) : null}
			{layoutProbe ? (
				<MobileLayoutProbeReadout
					metrics={layoutProbe.metrics}
					testID="note-list-layout-metrics"
				/>
			) : null}
		</>
	);
}

function NoteListFilterPills({
	active,
	counts,
	onChange,
}: Pick<MobileNoteListPanelFooterProps, "active" | "counts" | "onChange"> & {
	onChange: (filter: MobileNoteListFilter) => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const { bottom } = useSafeAreaInsets();
	return (
		<View
			accessibilityRole="tablist"
			style={[styles.filterBar, mobilePaneFooterFrame(bottom)]}
			testID="note-list-filter-pills"
		>
			{mobileNoteListFilterOptions.map((option) => (
				<FilterPill
					active={active === option.value}
					count={counts[option.value].toLocaleString()}
					key={option.value}
					label={mobileText(option.labelKey)}
					testID={`filter-pill-${option.value}`}
					onPress={() => onChange(option.value)}
				/>
			))}
		</View>
	);
}

function FilterPill({
	active,
	count,
	label,
	testID,
	onPress,
}: {
	active: boolean;
	count: string;
	label: string;
	testID: string;
	onPress: () => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Button
			accessibilityLabel={label}
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			className="shadow-none"
			size="sm"
			style={[styles.filterPill, active ? styles.filterPillSelected : null]}
			testID={testID}
			variant="ghost"
			onPress={onPress}
		>
			<Text
				style={[
					styles.filterPillText,
					active ? styles.filterPillTextSelected : null,
				]}
			>
				{label}
			</Text>
			<Text
				style={[
					styles.filterPillCount,
					active ? styles.filterPillCountSelected : null,
				]}
			>
				{count}
			</Text>
		</Button>
	);
}
