import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import {
	type MobileSortDirection,
	mobileCustomPropertySortValue,
	mobileCustomSortFromValue,
	mobileSortFieldMatches,
} from "./MobileSortPickerModel";
import {
	mobileWorkspaceFormSheetMaxSuggestions,
	mobileWorkspaceSortPickerLayoutContract,
} from "./MobileWorkspaceActionSheetModel";
import { MobileWorkspaceSuggestionList } from "./MobileWorkspaceSuggestionList";

type BuiltInSortField = "created" | "modified" | "status" | "title";

const mobileSortFieldRows: BuiltInSortField[][] = [
	["modified", "created"],
	["title", "status"],
];

const builtInSortFields = new Set<BuiltInSortField>([
	"created",
	"modified",
	"status",
	"title",
]);

export function MobileSortPicker({
	customPropertyOptions = [],
	selectedSort,
	testID = "workspace-sort-picker",
	testIDPrefix = "workspace-sort",
	onSelect,
}: {
	customPropertyOptions?: string[];
	selectedSort: string;
	testID?: string;
	testIDPrefix?: string;
	onSelect: (value: string) => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const customSort = mobileCustomSortFromValue(selectedSort);
	const [customField, setCustomField] = useState(customSort.field);
	const builtInSort = builtInSortFromValue(selectedSort);
	const hasCustomField = customField.trim().length > 0;
	const selectedDirection = builtInSort?.direction ?? "desc";
	const customDirection = customSort.direction ?? "asc";
	const customSuggestions = useMemo(() => {
		if (!hasCustomField) return [];
		return customPropertyOptions
			.filter((property) => mobileSortFieldMatches(property, customField))
			.slice(0, mobileWorkspaceFormSheetMaxSuggestions);
	}, [customField, customPropertyOptions, hasCustomField]);

	const selectCustomSort = (
		field: string,
		direction: MobileSortDirection = customDirection,
	) => {
		const trimmedField = field.trim();
		if (!trimmedField) return;
		setCustomField(trimmedField);
		onSelect(mobileCustomPropertySortValue(trimmedField, direction));
	};
	const selectBuiltInField = (field: BuiltInSortField) =>
		onSelect(`${field}:${selectedDirection}`);
	const selectBuiltInDirection = (direction: MobileSortDirection) => {
		onSelect(`${builtInSort?.field ?? "modified"}:${direction}`);
	};

	return (
		<View style={styles.section} testID={testID}>
			<Text style={styles.label}>{sortLabel()}</Text>
			<View style={styles.optionRows} testID={`${testIDPrefix}-preset-options`}>
				{mobileSortFieldRows.map((row) => (
					<View key={row.join("-")} style={styles.optionRow}>
						{row.map((field) => (
							<SortOptionButton
								key={field}
								label={sortFieldLabel(field)}
								selected={builtInSort?.field === field}
								testID={`${testIDPrefix}-field-${field}`}
								onPress={() => selectBuiltInField(field)}
							/>
						))}
					</View>
				))}
				<View style={styles.optionRow}>
					<SortOptionButton
						label={mobileText("noteList.sort.ascending")}
						selected={builtInSort?.direction === "asc"}
						testID={`${testIDPrefix}-direction-asc`}
						onPress={() => selectBuiltInDirection("asc")}
					/>
					<SortOptionButton
						label={mobileText("noteList.sort.descending")}
						selected={builtInSort?.direction === "desc"}
						testID={`${testIDPrefix}-direction-desc`}
						onPress={() => selectBuiltInDirection("desc")}
					/>
				</View>
			</View>
			<View
				style={styles.customSort}
				testID={`${testIDPrefix}-custom-property`}
			>
				<MobileTextInput
					label={mobileText("viewDialog.filter.fieldLabel")}
					placeholder={mobileText("viewDialog.filter.fieldLabel")}
					testID={`${testIDPrefix}-custom-field-input`}
					value={customField}
					onChangeText={setCustomField}
				/>
				<MobileWorkspaceSuggestionList
					labels={customSuggestions}
					maxVisibleItems={mobileWorkspaceFormSheetMaxSuggestions}
					testID={`${testIDPrefix}-custom-field-suggestions`}
					testIDPrefix={`${testIDPrefix}-custom-field-suggestion`}
					onSelect={(field) => selectCustomSort(field)}
				/>
				{hasCustomField ? (
					<View style={styles.customDirectionRow}>
						<CustomDirectionButton
							disabled={false}
							label={mobileText("noteList.sort.ascending")}
							selected={
								selectedSort ===
								mobileCustomPropertySortValue(customField, "asc")
							}
							testID={`${testIDPrefix}-custom-asc`}
							onPress={() => selectCustomSort(customField, "asc")}
						/>
						<CustomDirectionButton
							disabled={false}
							label={mobileText("noteList.sort.descending")}
							selected={
								selectedSort ===
								mobileCustomPropertySortValue(customField, "desc")
							}
							testID={`${testIDPrefix}-custom-desc`}
							onPress={() => selectCustomSort(customField, "desc")}
						/>
					</View>
				) : null}
			</View>
		</View>
	);
}

function SortOptionButton({
	label,
	onPress,
	selected,
	testID,
}: {
	label: string;
	selected: boolean;
	testID: string;
	onPress: () => void;
}) {
	const { mobileColors, styles } = useMobileStyles(createThemeStyles);
	return (
		<MobileButton
			accessibilityLabel={label}
			icon={
				<ChromeSymbol
					name="check"
					color={selected ? mobileColors.primary : mobileColors.textFaint}
					size={14}
				/>
			}
			label={label}
			style={[styles.sortButton, selected ? styles.sortButtonSelected : null]}
			testID={testID}
			variant="secondary"
			onPress={onPress}
		/>
	);
}

function CustomDirectionButton({
	disabled,
	label,
	onPress,
	selected,
	testID,
}: {
	disabled: boolean;
	label: string;
	onPress: () => void;
	selected: boolean;
	testID: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<MobileButton
			accessibilityLabel={label}
			disabled={disabled}
			label={label}
			style={[
				styles.directionButton,
				selected ? styles.sortButtonSelected : null,
			]}
			testID={testID}
			variant="secondary"
			onPress={onPress}
		/>
	);
}

function sortLabel() {
	return mobileText("noteList.sort.menu")
		.replace(/\s*\{label\}/u, "")
		.trim();
}

function sortFieldLabel(field: BuiltInSortField) {
	return mobileText(`noteList.sort.${field}`);
}

function builtInSortFromValue(
	value: string,
): { direction: MobileSortDirection; field: BuiltInSortField } | null {
	const [field, direction] = value.split(":");
	if (!isBuiltInSortField(field) || !isSortDirection(direction)) return null;

	return { direction, field };
}

function isBuiltInSortField(
	value: string | undefined,
): value is BuiltInSortField {
	return builtInSortFields.has(value as BuiltInSortField);
}

function isSortDirection(
	value: string | undefined,
): value is MobileSortDirection {
	return value === "asc" || value === "desc";
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...sortLayoutStyles(metrics),
		...sortControlStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function sortLayoutStyles(metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	return StyleSheet.create({
		customDirectionRow: {
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		customSort: {
			gap: mobileSpace.xs,
			paddingTop: mobileSpace.xs,
		},
		section: {
			gap: mobileSpace.xs,
		},
		optionRow: {
			flexDirection: "row",
			gap: metrics.size(mobileWorkspaceSortPickerLayoutContract.gap),
		},
		optionRows: {
			gap: metrics.size(mobileWorkspaceSortPickerLayoutContract.gap),
		},
	});
}

function sortControlStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		directionButton: {
			minHeight: metrics.size(
				mobileWorkspaceSortPickerLayoutContract.optionMinHeight,
			),
			flex: 1,
			alignItems: "center",
			backgroundColor: mobileColors.control,
			justifyContent: "center",
			borderRadius: mobileWorkspaceSortPickerLayoutContract.optionRadius,
			paddingHorizontal: mobileSpace.sm,
		},
		label: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
		sortButton: {
			minWidth: 0,
			minHeight: metrics.size(
				mobileWorkspaceSortPickerLayoutContract.optionMinHeight,
			),
			flex: 1,
			justifyContent: "flex-start",
			backgroundColor: mobileColors.control,
			borderColor: mobileColors.borderStrong,
			borderWidth: 1,
			borderRadius: mobileWorkspaceSortPickerLayoutContract.optionRadius,
			paddingHorizontal: mobileSpace.sm,
		},
		sortButtonSelected: {
			backgroundColor: mobileColors.primarySoft,
			borderColor: mobileColors.primary,
		},
	});
}
