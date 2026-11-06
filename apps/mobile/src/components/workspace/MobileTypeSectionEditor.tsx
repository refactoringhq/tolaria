import { Pressable, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import {
	type MobileTypeSchemaProperty,
	type MobileTypeSchemaRelationship,
	mobileTypeSchemaPropertyValueText,
	mobileTypeSchemaRelationshipValueText,
} from "../../workspace/mobileTypeDefinitionSchema";

import type {
	MobileNote,
	MobileSidebarIcon,
	MobileTone,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import { MobileMetadataPicker } from "./MobileMetadataPicker";
import { MobileSortPicker } from "./MobileSortPicker";
import { MobileViewDisplayPropertiesPicker } from "./MobileViewDisplayPropertiesPicker";
import {
	mobileWorkspaceFormSectionLayoutContract,
	mobileWorkspaceFormSheetAutoFocus,
} from "./MobileWorkspaceActionSheetModel";
import { MobileWorkspaceSuggestionList } from "./MobileWorkspaceSuggestionList";
import type { MobileWorkspaceSuggestionItem } from "./MobileWorkspaceSuggestionListModel";

type MobileTypeSectionEditorProps = {
	displayProperties: string[];
	notes: MobileNote[];
	propertyOptions: string[];
	propertyQuery: string;
	relationshipTargetOptions: MobileWorkspaceSuggestionItem[];
	schemaProperties: MobileTypeSchemaProperty[];
	schemaPropertyName: string;
	schemaPropertyNameOptions: string[];
	schemaPropertyValue: string;
	schemaRelationships: MobileTypeSchemaRelationship[];
	schemaRelationshipName: string;
	schemaRelationshipNameOptions: string[];
	schemaRelationshipTarget: string;
	sectionLabel: string;
	sort: string;
	sortPropertyOptions: string[];
	template: string;
	typeIcon: string;
	tone: string;
	typeName: string;
	typeRenameName: string;
	visible: boolean;
	onDisplayPropertiesChange: (value: string[]) => void;
	onPropertyQueryChange: (value: string) => void;
	onSchemaPropertyAdd: () => void;
	onSchemaPropertyNameChange: (value: string) => void;
	onSchemaPropertyRemove: (index: number) => void;
	onSchemaPropertyValueChange: (value: string) => void;
	onSchemaRelationshipAdd: () => void;
	onSchemaRelationshipNameChange: (value: string) => void;
	onSchemaRelationshipRemove: (index: number) => void;
	onSchemaRelationshipTargetSelect: (title: string, ref: string) => void;
	onSchemaRelationshipTargetChange: (value: string) => void;
	onSectionLabelChange: (value: string) => void;
	onSortChange: (value: string) => void;
	onTemplateChange: (value: string) => void;
	onTypeIconChange: (value: MobileSidebarIcon) => void;
	onTypeRenameNameChange: (value: string) => void;
	onToneChange: (value: MobileTone) => void;
	onVisibleChange: (value: boolean) => void;
};

export function MobileTypeSectionEditor(props: MobileTypeSectionEditorProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.editor} testID="workspace-type-section-editor">
			<Text style={styles.typeName} testID="workspace-type-section-name">
				{props.typeName}
			</Text>
			<TypeNameInputs {...props} />
			<VisibilityToggle
				visible={props.visible}
				onChange={props.onVisibleChange}
			/>
			<MobileMetadataPicker
				selectedIcon={props.typeIcon}
				selectedTone={props.tone}
				testIDPrefix="workspace-type"
				onIconSelect={props.onTypeIconChange}
				onToneSelect={props.onToneChange}
			/>
			<MobileSortPicker
				customPropertyOptions={props.sortPropertyOptions}
				selectedSort={props.sort}
				testID="workspace-type-sort-picker"
				testIDPrefix="workspace-type-sort"
				onSelect={props.onSortChange}
			/>
			<MobileTextInput
				label={mobileText("customize.template")}
				multiline
				placeholder={mobileText("customize.templatePlaceholder")}
				style={styles.templateInput}
				testID="workspace-type-template-input"
				textAlignVertical="top"
				value={props.template}
				onChangeText={props.onTemplateChange}
			/>
			<MobileViewDisplayPropertiesPicker
				options={props.propertyOptions}
				query={props.propertyQuery}
				selectedProperties={props.displayProperties}
				testIDPrefix="workspace-type-property"
				onQueryChange={props.onPropertyQueryChange}
				onSelectedPropertiesChange={props.onDisplayPropertiesChange}
			/>
			<TypeSchemaPropertiesEditor {...props} />
			<TypeSchemaRelationshipsEditor {...props} />
		</View>
	);
}

function TypeNameInputs(props: MobileTypeSectionEditorProps) {
	return (
		<>
			<MobileTextInput
				autoFocus={mobileWorkspaceFormSheetAutoFocus}
				label={mobileText("sidebar.section.typeName")}
				placeholder={props.typeName}
				testID="workspace-type-section-type-name-input"
				value={props.typeRenameName}
				onChangeText={props.onTypeRenameNameChange}
			/>
			<MobileTextInput
				label={mobileText("sidebar.section.name")}
				placeholder={props.typeName}
				testID="workspace-type-section-label-input"
				value={props.sectionLabel}
				onChangeText={props.onSectionLabelChange}
			/>
		</>
	);
}

function TypeSchemaPropertiesEditor(props: MobileTypeSectionEditorProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.section} testID="workspace-type-schema-properties">
			<SectionLabel label={mobileText("inspector.title.properties")} />
			{props.schemaProperties.map((property, index) => (
				<SchemaRow
					key={`${property.key}-${index}`}
					label={property.key}
					testID={`workspace-type-schema-property-${schemaSlug(property.key)}`}
					value={mobileTypeSchemaPropertyValueText(property.value)}
					onRemove={() => props.onSchemaPropertyRemove(index)}
				/>
			))}
			<View style={styles.schemaInputs}>
				<MobileTextInput
					label={mobileText("inspector.properties.propertyName")}
					placeholder={mobileText("inspector.properties.propertyName")}
					testID="workspace-type-schema-property-name-input"
					value={props.schemaPropertyName}
					onChangeText={props.onSchemaPropertyNameChange}
				/>
				<MobileWorkspaceSuggestionList
					labels={props.schemaPropertyNameOptions}
					testID="workspace-type-schema-property-name-suggestions"
					testIDPrefix="workspace-type-schema-property-name-suggestion"
					onSelect={props.onSchemaPropertyNameChange}
				/>
				<MobileTextInput
					label={mobileText("inspector.properties.valuePlaceholder")}
					placeholder={mobileText("inspector.properties.valuePlaceholder")}
					testID="workspace-type-schema-property-value-input"
					value={props.schemaPropertyValue}
					onChangeText={props.onSchemaPropertyValueChange}
				/>
				<MobileButton
					disabled={props.schemaPropertyName.trim().length === 0}
					label={mobileText("inspector.properties.addProperty")}
					onPress={props.onSchemaPropertyAdd}
				/>
			</View>
		</View>
	);
}

function TypeSchemaRelationshipsEditor(props: MobileTypeSectionEditorProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.section} testID="workspace-type-schema-relationships">
			<SectionLabel
				label={mobileText("inspector.relationship.addRelationship").replace(
					/^\+\s*/,
					"",
				)}
			/>
			{props.schemaRelationships.map((relationship, index) => (
				<SchemaRow
					key={`${relationship.key}-${index}`}
					label={relationship.key}
					testID={`workspace-type-schema-relationship-${schemaSlug(relationship.key)}`}
					value={mobileTypeSchemaRelationshipValueText(
						relationship,
						props.notes,
					)}
					onRemove={() => props.onSchemaRelationshipRemove(index)}
				/>
			))}
			<View style={styles.schemaInputs}>
				<MobileTextInput
					label={mobileText("inspector.relationship.name")}
					placeholder={mobileText("inspector.relationship.name")}
					testID="workspace-type-schema-relationship-name-input"
					value={props.schemaRelationshipName}
					onChangeText={props.onSchemaRelationshipNameChange}
				/>
				<MobileWorkspaceSuggestionList
					labels={props.schemaRelationshipNameOptions}
					testID="workspace-type-schema-relationship-name-suggestions"
					testIDPrefix="workspace-type-schema-relationship-name-suggestion"
					onSelect={props.onSchemaRelationshipNameChange}
				/>
				<MobileTextInput
					label={mobileText("inspector.relationship.noteTitle")}
					placeholder={mobileText("inspector.relationship.noteTitle")}
					testID="workspace-type-schema-relationship-target-input"
					value={props.schemaRelationshipTarget}
					onChangeText={props.onSchemaRelationshipTargetChange}
				/>
				<MobileWorkspaceSuggestionList
					items={props.relationshipTargetOptions}
					testID="workspace-type-schema-relationship-target-suggestions"
					testIDPrefix="workspace-type-schema-relationship-target-suggestion"
					onSelect={(ref, item) =>
						props.onSchemaRelationshipTargetSelect(item.label, ref)
					}
				/>
				<MobileButton
					disabled={props.schemaRelationshipName.trim().length === 0}
					label={mobileText("inspector.relationship.addRelationship").replace(
						/^\+\s*/,
						"",
					)}
					onPress={props.onSchemaRelationshipAdd}
				/>
			</View>
		</View>
	);
}

function SectionLabel({ label }: { label: string }) {
	const { styles } = useMobileStyles(createThemeStyles);
	return <Text style={styles.label}>{label}</Text>;
}

function SchemaRow({
	label,
	onRemove,
	testID,
	value,
}: {
	label: string;
	onRemove: () => void;
	testID: string;
	value: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.schemaRow} testID={testID}>
			<Text numberOfLines={1} style={styles.schemaKey}>
				{label}
			</Text>
			<Text numberOfLines={1} style={styles.schemaValue}>
				{value || mobileText("inspector.properties.none")}
			</Text>
			<MobileButton
				density="status"
				label={mobileText("common.remove")}
				variant="ghost"
				onPress={onRemove}
			/>
		</View>
	);
}

function VisibilityToggle({
	onChange,
	visible,
}: {
	onChange: (value: boolean) => void;
	visible: boolean;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<Pressable
			accessibilityLabel={mobileText("sidebar.section.showInSidebar")}
			accessibilityRole="switch"
			accessibilityState={{ checked: visible }}
			style={({ pressed }) => [
				styles.toggleRow,
				pressed ? styles.pressed : null,
			]}
			testID="workspace-type-visible-toggle"
			onPress={() => onChange(!visible)}
		>
			{visible ? (
				<ChromeSymbol name="check" color={mobileColors.primary} size={16} />
			) : (
				<ChromeSymbol name="check" color={mobileColors.textFaint} size={16} />
			)}
			<Text style={styles.rowText}>
				{mobileText("sidebar.section.showInSidebar")}
			</Text>
		</Pressable>
	);
}

function schemaSlug(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-|-$/gu, "") || "field"
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...typeSectionLayoutStyles(mobileColors, metrics),
		...typeSchemaStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function typeSectionLayoutStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		editor: {
			gap: mobileSpace.md,
		},
		label: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
		pressed: {
			backgroundColor: mobileColors.graySoft,
		},
		rowText: {
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
		},
		section: {
			gap: metrics.size(mobileWorkspaceFormSectionLayoutContract.gap),
			borderColor: mobileColors.border,
			borderRadius: mobileWorkspaceFormSectionLayoutContract.radius,
			borderWidth: StyleSheet.hairlineWidth,
			padding: metrics.size(mobileWorkspaceFormSectionLayoutContract.padding),
		},
		toggleRow: {
			minHeight: 34,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			borderRadius: 6,
			paddingHorizontal: mobileSpace.sm,
		},
		typeName: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
	});
}

function typeSchemaStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		schemaInputs: {
			gap: mobileSpace.sm,
		},
		schemaKey: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
		schemaRow: {
			minHeight: 34,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			borderRadius: 6,
			backgroundColor: mobileColors.graySoft,
			paddingHorizontal: mobileSpace.sm,
			paddingVertical: mobileSpace.xs,
		},
		schemaValue: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
		templateInput: {
			minHeight: 92,
			fontFamily: "Menlo",
			fontSize: mobileType.caption,
			lineHeight: metrics.size(18),
			paddingTop: mobileSpace.sm,
		},
	});
}
