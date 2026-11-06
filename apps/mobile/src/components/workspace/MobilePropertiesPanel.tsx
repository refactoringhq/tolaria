import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileCopy, mobileText } from "../../i18n/mobileText";
import {
	type MobileLayoutProbe,
	probeProps,
	useMobileLayoutProbe,
} from "../../qa/mobileLayoutProbe";
import { MobileIconButton } from "../../ui/MobileIconButton";
import {
	MobilePanel,
	MobileToolbar,
	MobileToolbarSpacer,
	MobileToolbarTitle,
} from "../../ui/MobilePanel";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import {
	mobileFrontmatterState,
	needsMobileFrontmatterNotice,
} from "../../workspace/mobileFrontmatterState";
import {
	type MobileInspectorPropertySlot,
	type MobileInspectorRelationshipSlot,
	mobileInspectorPropertySlots,
	mobileInspectorRelationshipSlots,
} from "../../workspace/mobileInspectorSchema";
import { resolveMobileMissingTypeName } from "../../workspace/mobileMissingType";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { MobileFrontmatterStateNotice } from "./MobileFrontmatterStateNotice";
import { createPropertyPanelStyles } from "./MobilePropertiesPanel.styles";
import type {
	MobilePropertiesPanelProps,
	NotePropertiesProps,
} from "./MobilePropertiesPanel.types";
import {
	PlaceholderPropertyRow,
	PlaceholderRelationshipSection,
	PropertiesEmptyState,
	StandardPropertyRows,
} from "./MobilePropertyPanelRows";
import { PropertyActionRow, PropertySection } from "./MobilePropertyRows";
import { EditablePropertyRow } from "./MobilePropertyValues";
import { ReferenceGroups, RelationshipValues } from "./MobileRelationshipRows";
import { relationshipHeading, testIdSegment } from "./mobilePropertyRowModel";

export function MobilePropertiesPanel(props: MobilePropertiesPanelProps) {
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const { panelStyles } = themeStyles;
	const { bottom } = useSafeAreaInsets();
	const { compact, fullWidth = false, layoutProbe = false } = props;
	const propertyLayoutProbe = useMobileLayoutProbe(layoutProbe);

	return (
		<MobilePanel
			{...probeProps(propertyLayoutProbe.probe, "properties.panel")}
			style={[
				panelStyles.panel,
				compact ? panelStyles.panelCompact : null,
				fullWidth ? panelStyles.panelFullWidth : null,
			]}
			testID="properties-panel"
		>
			<PropertiesPanelToolbar {...props} />
			<ScrollView
				{...probeProps(propertyLayoutProbe.probe, "properties.scroll")}
				contentContainerStyle={[
					panelStyles.content,
					props.note ? null : panelStyles.emptyContent,
					{ paddingBottom: panelStyles.content.padding + bottom },
				]}
				keyboardShouldPersistTaps="handled"
			>
				<PropertiesPanelContent
					layoutProbe={propertyLayoutProbe.probe}
					props={props}
				/>
			</ScrollView>
		</MobilePanel>
	);
}

function PropertiesPanelToolbar(props: MobilePropertiesPanelProps) {
	const mobileColors = useMobileColors();
	if (props.showToolbar === false) return null;
	return (
		<MobileToolbar testID="properties-toolbar">
			<MobileToolbarTitle
				testID="properties-toolbar-title"
				title={mobileCopy.properties}
				variant="inspector"
			/>
			<MobileToolbarSpacer />
			{props.note ? (
				<MobileIconButton
					accessibilityLabel={mobileText("inspector.properties.addProperty")}
					testID="properties-toolbar-add"
					onPress={() => props.onAddProperty()}
				>
					<ChromeSymbol name="plus" size={16} color={mobileColors.textMuted} />
				</MobileIconButton>
			) : null}
		</MobileToolbar>
	);
}

function PropertiesPanelContent({
	layoutProbe,
	props,
}: {
	layoutProbe: MobileLayoutProbe;
	props: MobilePropertiesPanelProps;
}) {
	if (!props.note) return <PropertiesEmptyState />;

	return (
		<NoteProperties layoutProbe={layoutProbe} {...notePropertiesProps(props)} />
	);
}

function notePropertiesProps(
	props: MobilePropertiesPanelProps,
): Omit<NotePropertiesProps, "layoutProbe"> {
	if (!props.note)
		throw new Error("A selected note is required to build property rows");

	return {
		note: props.note,
		onAddProperty: props.onAddProperty,
		onAddRelationship: props.onAddRelationship,
		onEditProperty: props.onEditProperty,
		onEnterNeighborhood: props.onEnterNeighborhood,
		onFixInvalidFrontmatter: props.onFixInvalidFrontmatter,
		onInitializeProperties: props.onInitializeProperties,
		onCreateMissingType: props.onCreateMissingType,
		onOpenChangeNoteType: props.onOpenChangeNoteType,
		onRemoveRelationship: props.onRemoveRelationship,
		onSelectNote: props.onSelectNote,
		propertyDisplayModes: props.propertyDisplayModes,
		referenceGroups: props.referenceGroups ?? [],
		typeDefinitions: props.typeDefinitions,
		hideTypeRow: props.hideTypeRow,
		nativeValueControl: props.nativeValueControl,
	};
}

function NoteProperties(props: NotePropertiesProps) {
	const { propertyStyles } = useMobileStyles(createPropertyPanelStyles);
	const { layoutProbe, note, typeDefinitions } = props;
	const frontmatterState = mobileFrontmatterState(note);
	const propertySlots = mobileInspectorPropertySlots(note, typeDefinitions);
	const relationshipSlots = mobileInspectorRelationshipSlots(
		note,
		typeDefinitions,
	);
	const missingTypeName = resolveMobileMissingTypeName(note, typeDefinitions);

	if (needsMobileFrontmatterNotice(frontmatterState)) {
		return <FrontmatterNoticeRows props={props} state={frontmatterState} />;
	}

	return (
		<>
			<StandardPropertyRows missingTypeName={missingTypeName} props={props} />
			<CustomPropertyRows propertySlots={propertySlots} props={props} />
			<PropertyActionRow
				label={mobileText("inspector.properties.addProperty")}
				layoutProbe={layoutProbe}
				layoutProbeId="properties.action.add-property"
				testID="property-action-add-property"
				onPress={() => props.onAddProperty()}
			/>
			<View
				style={propertyStyles.relationshipGroup}
				testID="properties-relationships-group"
			>
				<RelationshipPropertyRows
					relationshipSlots={relationshipSlots}
					props={props}
				/>
				<PropertyActionsAndReferences props={props} />
			</View>
		</>
	);
}

function FrontmatterNoticeRows({
	props,
	state,
}: {
	props: NotePropertiesProps;
	state: ReturnType<typeof mobileFrontmatterState>;
}) {
	return (
		<>
			<MobileFrontmatterStateNotice
				state={state}
				onFixInvalidFrontmatter={props.onFixInvalidFrontmatter}
				onInitializeProperties={() =>
					props.onInitializeProperties(props.note.id)
				}
			/>
			<ReferenceGroups
				groups={props.referenceGroups}
				layoutProbe={props.layoutProbe}
				typeDefinitions={props.typeDefinitions}
				onSelectNote={props.onSelectNote}
			/>
		</>
	);
}

function CustomPropertyRows({
	propertySlots,
	props,
}: {
	propertySlots: MobileInspectorPropertySlot[];
	props: NotePropertiesProps;
}) {
	const {
		layoutProbe,
		note,
		onEditProperty,
		propertyDisplayModes,
		nativeValueControl,
	} = props;

	return (
		<>
			{note.icon ? (
				<EditablePropertyRow
					layoutProbe={layoutProbe}
					noteId={note.id}
					property={{ key: "icon", label: "Icon", value: note.icon }}
					nativeValue={nativeValueControl?.({
						key: "icon",
						label: "Icon",
						value: note.icon,
					})}
					onEditProperty={onEditProperty}
				/>
			) : null}
			{note.properties?.map((property) => (
				<EditablePropertyRow
					key={property.key}
					layoutProbe={layoutProbe}
					noteId={note.id}
					property={property}
					nativeValue={nativeValueControl?.(property)}
					propertyDisplayModes={propertyDisplayModes}
					onEditProperty={onEditProperty}
				/>
			))}
			<InspectorPlaceholderRows propertySlots={propertySlots} props={props} />
		</>
	);
}

function RelationshipPropertyRows({
	relationshipSlots,
	props,
}: {
	relationshipSlots: MobileInspectorRelationshipSlot[];
	props: NotePropertiesProps;
}) {
	const {
		layoutProbe,
		note,
		onAddRelationship,
		onEnterNeighborhood,
		onRemoveRelationship,
		onSelectNote,
		typeDefinitions,
	} = props;

	return (
		<>
			{note.relationships.map((relationship) => (
				<PropertySection
					key={`${relationship.kind}-${relationship.label ?? relationship.values.map((value) => value.title).join("-")}`}
					label={relationshipHeading(relationship)}
					layoutProbe={layoutProbe}
					layoutProbeId={`properties.section.${testIdSegment(relationshipHeading(relationship))}`}
					testID={`property-section-${relationship.kind}`}
				>
					<RelationshipValues
						layoutProbe={layoutProbe}
						noteId={note.id}
						relationship={relationship}
						onRemoveRelationship={onRemoveRelationship}
						onEnterNeighborhood={onEnterNeighborhood}
						typeDefinitions={typeDefinitions}
						onSelectNote={onSelectNote}
					/>
					<PropertyActionRow
						label={mobileText("inspector.relationship.add")}
						testID={`relationship-add-${testIdSegment(relationship.key ?? relationshipHeading(relationship))}`}
						onPress={() =>
							onAddRelationship(
								relationship.key ?? relationshipHeading(relationship),
							)
						}
					/>
				</PropertySection>
			))}
			<InspectorPlaceholderRows
				relationshipSlots={relationshipSlots}
				props={props}
			/>
		</>
	);
}

function InspectorPlaceholderRows({
	propertySlots = [],
	relationshipSlots = [],
	props,
}: {
	propertySlots?: MobileInspectorPropertySlot[];
	relationshipSlots?: MobileInspectorRelationshipSlot[];
	props: NotePropertiesProps;
}) {
	return (
		<>
			{propertySlots.map((slot) => (
				<PlaceholderPropertyRow
					key={`${slot.source}:${slot.key}`}
					layoutProbe={props.layoutProbe}
					slot={slot}
					onPress={() => props.onAddProperty(slot.key)}
				/>
			))}
			{relationshipSlots.map((slot) => (
				<PlaceholderRelationshipSection
					key={`${slot.source}:${slot.key}`}
					layoutProbe={props.layoutProbe}
					slot={slot}
					onPress={() => props.onAddRelationship(slot.key)}
				/>
			))}
		</>
	);
}

function PropertyActionsAndReferences({
	props,
}: {
	props: NotePropertiesProps;
}) {
	const {
		layoutProbe,
		onAddRelationship,
		onSelectNote,
		referenceGroups,
		typeDefinitions,
	} = props;

	return (
		<>
			<PropertyActionRow
				label={mobileText("mobile.properties.addRelationships")}
				layoutProbe={layoutProbe}
				layoutProbeId="properties.action.add-relationship"
				testID="property-action-add-relationship"
				onPress={() => onAddRelationship()}
			/>
			<ReferenceGroups
				groups={referenceGroups}
				layoutProbe={layoutProbe}
				typeDefinitions={typeDefinitions}
				onSelectNote={onSelectNote}
			/>
		</>
	);
}
