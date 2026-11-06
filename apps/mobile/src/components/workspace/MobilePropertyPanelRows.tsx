import { Pressable, View } from "react-native";
import { mobileCopy, mobileText } from "../../i18n/mobileText";
import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import { MobilePropertyRow } from "../../ui/MobilePropertyRow";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type {
	MobileInspectorPropertySlot,
	MobileInspectorRelationshipSlot,
} from "../../workspace/mobileInspectorSchema";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import { createPropertyPanelStyles } from "./MobilePropertiesPanel.styles";
import type { NotePropertiesProps } from "./MobilePropertiesPanel.types";
import { mobileInspectorPlaceholderActionLabel } from "./MobilePropertiesPanelModel";
import { PropertySection } from "./MobilePropertyRows";
import {
	EditableChipValue,
	EditableTagsValue,
	WorkspaceBadge,
} from "./MobilePropertyValues";
import { testIdSegment } from "./mobilePropertyRowModel";
import { chipTone, statusTone } from "./mobileWorkspaceTone";

export function StandardPropertyRows({
	missingTypeName,
	props,
}: {
	missingTypeName: string | null;
	props: NotePropertiesProps;
}) {
	return (
		<>
			{!props.hideTypeRow ? (
				<TypePropertyRow
					layoutProbe={props.layoutProbe}
					missingTypeName={missingTypeName}
					note={props.note}
					onCreateMissingType={props.onCreateMissingType}
					onOpenChangeNoteType={props.onOpenChangeNoteType}
				/>
			) : null}
			<StandardMetadataRows props={props} />
			<StandardTagRows props={props} />
		</>
	);
}

function StandardMetadataRows({ props }: { props: NotePropertiesProps }) {
	const { layoutProbe, note, nativeValueControl, onEditProperty } = props;
	return (
		<>
			{note.status ? (
				<MobilePropertyRow
					label={mobileText("noteList.sort.status")}
					testID="property-row-status"
					value={
						<EditableChipValue
							label={note.status}
							testID="property-row-status-edit"
							tone={statusTone(note.status)}
							nativeValue={nativeValueControl?.({
								key: "Status",
								label: mobileText("noteList.sort.status"),
								value: note.status,
							})}
							onPress={() => onEditProperty(note.id, "Status", note.status)}
						/>
					}
					layoutProbe={layoutProbe}
					layoutProbeId="properties.row.status"
				/>
			) : null}
			<MobilePropertyRow
				label={mobileText("noteList.sort.created")}
				layoutProbe={layoutProbe}
				layoutProbeId="properties.row.created"
				testID="property-row-created"
				value={note.created}
			/>
			<MobilePropertyRow
				label={mobileCopy.modified}
				layoutProbe={layoutProbe}
				layoutProbeId="properties.row.modified"
				testID="property-row-modified"
				value={note.modified}
			/>
			<MobilePropertyRow
				label={mobileText("inspector.properties.workspace")}
				layoutProbe={layoutProbe}
				layoutProbeId="properties.row.workspace"
				testID="property-row-workspace"
				value={<WorkspaceBadge label={note.workspace} />}
			/>
		</>
	);
}

function StandardTagRows({ props }: { props: NotePropertiesProps }) {
	const { layoutProbe, note, nativeValueControl, onEditProperty } = props;
	return (
		<>
			<MobilePropertyRow
				label="Tags"
				layoutProbe={layoutProbe}
				layoutProbeId="properties.section.tags"
				testID="property-section-tags"
				value={
					<EditableTagsValue
						labels={note.tags}
						nativeValue={nativeValueControl?.({
							key: "tags",
							label: "Tags",
							value: note.tags,
						})}
						onPress={() => onEditProperty(note.id, "tags", note.tags)}
					/>
				}
			/>
			<MobilePropertyRow
				label="Links"
				layoutProbe={layoutProbe}
				layoutProbeId="properties.row.links"
				testID="property-row-links"
				value={`${note.links}`}
			/>
		</>
	);
}

export function TypePropertyRow({
	layoutProbe,
	missingTypeName,
	note,
	onCreateMissingType,
	onOpenChangeNoteType,
}: {
	layoutProbe: MobileLayoutProbe;
	missingTypeName: string | null;
	note: MobileNote;
	onCreateMissingType: (typeName: string) => void;
	onOpenChangeNoteType: () => void;
}) {
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const { typeStyles } = themeStyles;
	return (
		<MobilePropertyRow
			label="Type"
			testID="property-row-type"
			value={
				<View style={typeStyles.value}>
					<EditableChipValue
						label={note.type}
						testID="property-row-type-edit"
						tone={chipTone(note.typeTone)}
						onPress={onOpenChangeNoteType}
					/>
					{missingTypeName ? (
						<MissingTypeButton
							typeName={missingTypeName}
							onPress={() => onCreateMissingType(missingTypeName)}
						/>
					) : null}
				</View>
			}
			layoutProbe={layoutProbe}
			layoutProbeId="properties.row.type"
		/>
	);
}

function MissingTypeButton({
	onPress,
	typeName,
}: {
	onPress: () => void;
	typeName: string;
}) {
	const { typeStyles } = useMobileStyles(createPropertyPanelStyles);
	const mobileColors = useMobileColors();
	const label = mobileText("inspector.properties.missingTypeAria").replace(
		"{type}",
		typeName,
	);
	return (
		<Pressable
			accessibilityHint={mobileText("sidebar.action.createType")}
			accessibilityLabel={label}
			accessibilityRole="button"
			style={typeStyles.missingButton}
			testID="missing-type-warning"
			onPress={onPress}
		>
			<ChromeSymbol name="warning" color={mobileColors.orange} size={14} />
			<Text numberOfLines={1} style={typeStyles.missingText}>
				{mobileText("inspector.properties.missingType")}
			</Text>
		</Pressable>
	);
}

export function PropertiesEmptyState() {
	const { emptyStateStyles } = useMobileStyles(createPropertyPanelStyles);
	return (
		<View style={emptyStateStyles.emptyState}>
			<Text style={emptyStateStyles.emptyTitle}>
				{mobileText("inspector.empty.noNoteSelected")}
			</Text>
			<Text style={emptyStateStyles.emptyText}>
				{mobileText("inspector.empty.noProperties")}
			</Text>
		</View>
	);
}

export function PlaceholderPropertyRow({
	layoutProbe,
	onPress,
	slot,
}: {
	layoutProbe: MobileLayoutProbe;
	onPress: () => void;
	slot: MobileInspectorPropertySlot;
}) {
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const colors = useMobileColors();
	const { propertyStyles } = themeStyles;
	const sourceSegment =
		slot.source === "typeDerived" ? "type-derived" : "suggested";
	const testID = `property-placeholder-${sourceSegment}-${testIdSegment(slot.key)}`;
	return (
		<MobilePropertyRow
			accessibilityLabel={slot.label}
			label={slot.label}
			layoutProbe={layoutProbe}
			layoutProbeId={`properties.placeholder.${testIdSegment(slot.key)}`}
			testID={testID}
			onPress={onPress}
			value={
				<View
					pointerEvents="none"
					style={propertyStyles.placeholderAddValue}
					testID={`${testID}-add`}
				>
					<ChromeSymbol name="plus" size={18} color={colors.textFaint} />
				</View>
			}
		/>
	);
}

export function PlaceholderRelationshipSection({
	layoutProbe,
	onPress,
	slot,
}: {
	layoutProbe: MobileLayoutProbe;
	onPress: () => void;
	slot: MobileInspectorRelationshipSlot;
}) {
	const { propertyStyles, actionStyles } = useMobileStyles(
		createPropertyPanelStyles,
	);
	const mobileColors = useMobileColors();
	const sourceSegment =
		slot.source === "typeDerived" ? "type-derived" : "suggested";
	const testID = `relationship-placeholder-${sourceSegment}-${testIdSegment(slot.key)}`;
	return (
		<PropertySection
			label={slot.label}
			labelVariant="placeholder"
			layoutProbe={layoutProbe}
			layoutProbeId={`properties.relationship-placeholder.${testIdSegment(slot.key)}`}
			testID={testID}
		>
			<Pressable
				accessibilityLabel={mobileText("inspector.relationship.add")}
				accessibilityRole="button"
				style={propertyStyles.placeholderRelationshipButton}
				testID={`${testID}-add`}
				onPress={onPress}
			>
				<View style={actionStyles.label}>
					<View style={actionStyles.iconSlot}>
						<ChromeSymbol
							name="plus"
							color={mobileColors.textFaint}
							size={14}
						/>
					</View>
					<Text
						numberOfLines={1}
						style={[actionStyles.text, propertyStyles.placeholderButtonText]}
					>
						{mobileInspectorPlaceholderActionLabel("relationship")}
					</Text>
				</View>
			</Pressable>
		</PropertySection>
	);
}
