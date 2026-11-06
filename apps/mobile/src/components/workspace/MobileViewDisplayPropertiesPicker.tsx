import { StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import { mobileWorkspaceFormSectionLayoutContract } from "./MobileWorkspaceActionSheetModel";

type MobileViewDisplayPropertiesPickerProps = {
	options: string[];
	query: string;
	selectedProperties: string[];
	testIDPrefix?: string;
	onQueryChange: (value: string) => void;
	onSelectedPropertiesChange: (value: string[]) => void;
};

export function MobileViewDisplayPropertiesPicker({
	onQueryChange,
	onSelectedPropertiesChange,
	options,
	query,
	selectedProperties,
	testIDPrefix = "workspace-view-property",
}: MobileViewDisplayPropertiesPickerProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const orderedOptions = orderedDisplayPropertyOptions(
		options,
		selectedProperties,
	);

	return (
		<View style={styles.picker} testID={`${testIDPrefix}-picker`}>
			<Text style={styles.label}>
				{mobileText("noteList.properties.showInNoteList")}
			</Text>
			<MobileTextInput
				label={mobileText("noteList.properties.searchLabel")}
				placeholder={mobileText("noteList.properties.searchPlaceholder")}
				testID={`${testIDPrefix}-search-input`}
				value={query}
				onChangeText={onQueryChange}
			/>
			<View style={styles.optionList} testID={`${testIDPrefix}-options`}>
				{orderedOptions.length === 0 ? (
					<Text style={styles.empty}>
						{mobileText("noteList.properties.noMatches")}
					</Text>
				) : (
					orderedOptions.map((key) => (
						<PropertyOption
							key={key}
							label={key}
							selected={selectedDisplayProperty(selectedProperties, key)}
							testIDPrefix={testIDPrefix}
							onPress={() =>
								onSelectedPropertiesChange(
									toggleDisplayProperty(selectedProperties, key),
								)
							}
						/>
					))
				)}
			</View>
		</View>
	);
}

function PropertyOption({
	label,
	onPress,
	selected,
	testIDPrefix,
}: {
	label: string;
	onPress: () => void;
	selected: boolean;
	testIDPrefix: string;
}) {
	const { mobileColors, styles } = useMobileStyles(createThemeStyles);
	return (
		<MobileButton
			accessibilityLabel={label}
			accessibilityRole="checkbox"
			accessibilityState={{ checked: selected }}
			density="compact"
			icon={
				<ChromeSymbol
					name="check"
					color={selected ? mobileColors.primary : mobileColors.textFaint}
					size={14}
				/>
			}
			label={label}
			style={[styles.option, selected ? styles.optionSelected : null]}
			testID={`${testIDPrefix}-option-${testIdSegment(label)}`}
			variant="secondary"
			onPress={onPress}
		/>
	);
}

function orderedDisplayPropertyOptions(options: string[], selected: string[]) {
	const selectedKeys = normalizedPropertyKeys(selected);
	const optionKeys = normalizedPropertyKeys(options);
	return [
		...selectedKeys.filter((key) =>
			optionKeys.some(
				(option) => displayPropertyKey(option) === displayPropertyKey(key),
			),
		),
		...optionKeys.filter(
			(key) =>
				!selectedKeys.some(
					(selectedKey) =>
						displayPropertyKey(selectedKey) === displayPropertyKey(key),
				),
		),
	];
}

function toggleDisplayProperty(selected: string[], key: string) {
	if (selectedDisplayProperty(selected, key)) {
		return selected.filter(
			(current) => displayPropertyKey(current) !== displayPropertyKey(key),
		);
	}

	return [...normalizedPropertyKeys(selected), key];
}

function selectedDisplayProperty(selected: string[], key: string) {
	return selected.some(
		(current) => displayPropertyKey(current) === displayPropertyKey(key),
	);
}

function normalizedPropertyKeys(keys: string[]) {
	const seen = new Set<string>();
	return keys
		.map((key) => key.trim())
		.filter((key) => {
			const normalized = key.toLowerCase();
			if (!normalized || seen.has(normalized)) return false;
			seen.add(normalized);
			return true;
		});
}

function displayPropertyKey(value: string) {
	return value.trim().toLowerCase();
}

function testIdSegment(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-|-$/gu, "") || "property"
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { type: mobileType, space: mobileSpace } = metrics;
	const styles = StyleSheet.create({
		empty: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
		label: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "600",
		},
		option: {
			minHeight: 32,
			alignSelf: "stretch",
			justifyContent: "flex-start",
			backgroundColor: mobileColors.control,
			borderColor: mobileColors.border,
			borderRadius: 6,
			borderWidth: StyleSheet.hairlineWidth,
			paddingHorizontal: mobileSpace.sm,
		},
		optionList: {
			gap: mobileSpace.xs,
		},
		optionSelected: {
			backgroundColor: mobileColors.primarySoft,
			borderColor: mobileColors.primary,
		},
		picker: {
			gap: metrics.size(mobileWorkspaceFormSectionLayoutContract.gap),
			borderColor: mobileColors.border,
			borderRadius: mobileWorkspaceFormSectionLayoutContract.radius,
			borderWidth: StyleSheet.hairlineWidth,
			padding: metrics.size(mobileWorkspaceFormSectionLayoutContract.padding),
		},
	});
	return { mobileColors, styles };
}
