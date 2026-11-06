import { Pressable, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import {
	desktopRelationshipParity,
	desktopToolbarActionParity,
} from "../../ui/desktopParity";
import { mobilePressedStyle } from "../../ui/mobilePressFeedback";
import {
	useMobileColors,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import type { MobileNeighborhoodGroup } from "../../workspace/mobileNeighborhood";
import type {
	MobileNote,
	MobileRelationship,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import { createPropertyPanelStyles } from "./MobilePropertiesPanel.styles";
import {
	mobileInspectorReferenceRowLayoutContract,
	mobileRelationshipValueMetricSegments,
} from "./MobilePropertiesPanelModel";
import { PropertySection } from "./MobilePropertyRows";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";
import { propertyProbe, testIdSegment } from "./mobilePropertyRowModel";
import { noteTypeColor, noteTypeSoftColor } from "./mobileWorkspaceTone";

export function RelationshipValues(props: {
	layoutProbe: MobileLayoutProbe;
	noteId: string;
	relationship: MobileRelationship;
	typeDefinitions?: MobileTypeDefinitions;
	onRemoveRelationship: (noteId: string, key: string, ref: string) => void;
	onEnterNeighborhood?: (noteId: string) => void;
	onSelectNote: (noteId: string) => void;
}) {
	const {
		layoutProbe,
		noteId,
		onRemoveRelationship,
		onEnterNeighborhood,
		onSelectNote,
		relationship,
		typeDefinitions,
	} = props;
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const { relationshipStyles } = themeStyles;
	const rowSegments = mobileRelationshipValueMetricSegments(
		relationship.values,
	);

	return (
		<View style={relationshipStyles.values}>
			{relationship.values.map((value, valueIndex) => {
				const rowSegment =
					rowSegments[valueIndex] ??
					relationshipValueSegment(value, valueIndex);
				return (
					<RelationshipValueRow
						key={rowSegment}
						layoutProbe={layoutProbe}
						noteId={noteId}
						onEnterNeighborhood={onEnterNeighborhood}
						onRemoveRelationship={onRemoveRelationship}
						onSelectNote={onSelectNote}
						relationship={relationship}
						rowSegment={rowSegment}
						typeDefinitions={typeDefinitions}
						value={value}
					/>
				);
			})}
		</View>
	);
}

function RelationshipValueRow(props: {
	layoutProbe: MobileLayoutProbe;
	noteId: string;
	onEnterNeighborhood?: (noteId: string) => void;
	onRemoveRelationship: (noteId: string, key: string, ref: string) => void;
	onSelectNote: (noteId: string) => void;
	relationship: MobileRelationship;
	rowSegment: string;
	typeDefinitions?: MobileTypeDefinitions;
	value: MobileRelationship["values"][number];
}) {
	const {
		layoutProbe,
		noteId,
		onEnterNeighborhood,
		onRemoveRelationship,
		onSelectNote,
		relationship,
		rowSegment,
		typeDefinitions,
		value,
	} = props;
	const colors = useMobileColors();
	const { relationshipStyles } = useMobileStyles(createPropertyPanelStyles);
	return (
		<View
			{...propertyProbe(
				layoutProbe,
				`properties.relationship.${rowSegment}`,
				"row",
			)}
			style={relationshipStyles.row}
			testID={`relationship-row-${rowSegment}`}
		>
			<View
				pointerEvents="none"
				style={[
					relationshipStyles.background,
					{ backgroundColor: noteTypeSoftColor(value.typeTone, colors) },
				]}
			/>
			<RelationshipValueTarget
				layoutProbe={layoutProbe}
				onEnterNeighborhood={onEnterNeighborhood}
				onSelectNote={onSelectNote}
				relationshipStyles={relationshipStyles}
				rowSegment={rowSegment}
				typeDefinitions={typeDefinitions}
				value={value}
			/>
			<RelationshipRemoveButton
				noteId={noteId}
				onRemoveRelationship={onRemoveRelationship}
				relationship={relationship}
				relationshipStyles={relationshipStyles}
				rowSegment={rowSegment}
				value={value}
			/>
		</View>
	);
}

function RelationshipValueTarget(props: {
	layoutProbe: MobileLayoutProbe;
	onEnterNeighborhood?: (noteId: string) => void;
	onSelectNote: (noteId: string) => void;
	relationshipStyles: ReturnType<
		typeof createPropertyPanelStyles
	>["relationshipStyles"];
	rowSegment: string;
	typeDefinitions?: MobileTypeDefinitions;
	value: MobileRelationship["values"][number];
}) {
	const {
		layoutProbe,
		onEnterNeighborhood,
		onSelectNote,
		relationshipStyles,
		rowSegment,
		typeDefinitions,
		value,
	} = props;
	return (
		<Pressable
			accessibilityLabel={value.title}
			accessibilityRole="button"
			disabled={!value.id}
			{...propertyProbe(
				layoutProbe,
				`properties.relationship.${rowSegment}`,
				"target",
			)}
			style={({ pressed }) => [
				relationshipStyles.openTarget,
				mobilePressedStyle(pressed, desktopToolbarActionParity.pressedOpacity),
			]}
			testID={`relationship-row-${rowSegment}-open`}
			onPress={() => value.id && onSelectNote(value.id)}
			onLongPress={() => value.id && onEnterNeighborhood?.(value.id)}
		>
			<RelationshipValueLabel
				value={value}
				typeDefinitions={typeDefinitions}
				layoutProbe={layoutProbe}
				rowSegment={rowSegment}
			/>
		</Pressable>
	);
}

function RelationshipRemoveButton(props: {
	noteId: string;
	onRemoveRelationship: (noteId: string, key: string, ref: string) => void;
	relationship: MobileRelationship;
	relationshipStyles: ReturnType<
		typeof createPropertyPanelStyles
	>["relationshipStyles"];
	rowSegment: string;
	value: MobileRelationship["values"][number];
}) {
	const {
		noteId,
		onRemoveRelationship,
		relationship,
		relationshipStyles,
		rowSegment,
		value,
	} = props;
	return (
		<Pressable
			accessibilityLabel={mobileText("common.remove")}
			accessibilityRole="button"
			hitSlop={8}
			style={({ pressed }) => [
				relationshipStyles.remove,
				mobilePressedStyle(pressed, desktopToolbarActionParity.pressedOpacity),
			]}
			testID={`relationship-row-${rowSegment}-remove`}
			onPress={() =>
				relationship.key &&
				value.ref &&
				onRemoveRelationship(noteId, relationship.key, value.ref)
			}
		>
			<ChromeSymbol
				name="close"
				color={noteTypeColor(value.typeTone)}
				size={desktopRelationshipParity.removeIconSize}
			/>
		</Pressable>
	);
}

function RelationshipValueLabel(props: {
	layoutProbe: MobileLayoutProbe;
	rowSegment: string;
	typeDefinitions?: MobileTypeDefinitions;
	value: MobileRelationship["values"][number];
}) {
	const { layoutProbe, rowSegment, typeDefinitions, value } = props;
	const colors = useMobileColors();
	const { relationshipStyles } = useMobileStyles(createPropertyPanelStyles);
	return (
		<>
			<MobileTypeIcon
				size={desktopRelationshipParity.iconSize}
				tone={value.typeTone}
				type={value.type}
				typeDefinitions={typeDefinitions}
			/>
			<Text
				numberOfLines={1}
				{...propertyProbe(
					layoutProbe,
					`properties.relationship.${rowSegment}`,
					"text",
				)}
				style={[
					relationshipStyles.text,
					{ color: noteTypeColor(value.typeTone, colors) },
				]}
				testID={`relationship-row-${rowSegment}-text`}
			>
				{value.title}
			</Text>
		</>
	);
}

export function ReferenceGroups({
	groups,
	layoutProbe,
	typeDefinitions,
	onSelectNote,
}: {
	groups: MobileNeighborhoodGroup[];
	layoutProbe?: MobileLayoutProbe;
	typeDefinitions?: MobileTypeDefinitions;
	onSelectNote: (noteId: string) => void;
}) {
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const { referenceStyles } = themeStyles;
	if (groups.length === 0) return null;

	return (
		<View style={referenceStyles.container} testID="inspector-reference-groups">
			{groups.map((group) => (
				<PropertySection
					key={`${group.source}-${group.id}`}
					label={referenceGroupLabel(group)}
					testID={`inspector-reference-group-${group.id}`}
				>
					<ReferenceValues
						group={group}
						layoutProbe={layoutProbe}
						typeDefinitions={typeDefinitions}
						onSelectNote={onSelectNote}
					/>
				</PropertySection>
			))}
		</View>
	);
}

function ReferenceValues({
	group,
	layoutProbe,
	typeDefinitions,
	onSelectNote,
}: {
	group: MobileNeighborhoodGroup;
	layoutProbe?: MobileLayoutProbe;
	typeDefinitions?: MobileTypeDefinitions;
	onSelectNote: (noteId: string) => void;
}) {
	const colors = useMobileColors();
	const themeStyles = useMobileStyles(createPropertyPanelStyles);
	const { relationshipStyles, referenceStyles } = themeStyles;
	return (
		<View style={relationshipStyles.values}>
			{group.notes.map((note) => (
				<Pressable
					key={`${group.id}-${note.id}`}
					accessibilityLabel={note.title}
					accessibilityRole="button"
					{...propertyProbe(
						layoutProbe,
						referenceRowMetricId(group, note),
						"row",
					)}
					style={[
						referenceStyles.row,
						{ backgroundColor: noteTypeSoftColor(note.typeTone, colors) },
					]}
					testID={`inspector-reference-row-${testIdSegment(note.title)}`}
					onPress={() => onSelectNote(note.id)}
				>
					<MobileTypeIcon
						fileKind={note.fileKind}
						size={mobileInspectorReferenceRowLayoutContract.iconSize}
						tone={note.typeTone}
						type={note.type}
						typeDefinitions={typeDefinitions}
					/>
					<Text
						numberOfLines={1}
						style={[
							referenceStyles.text,
							{ color: noteTypeColor(note.typeTone, colors) },
						]}
					>
						{note.title}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

function referenceGroupLabel(group: MobileNeighborhoodGroup) {
	return group.source === "instances"
		? `${group.label} (${group.notes.length})`
		: group.label;
}

function referenceRowMetricId(
	group: MobileNeighborhoodGroup,
	note: MobileNote,
) {
	return `properties.reference.${testIdSegment(group.id)}.${testIdSegment(note.title)}`;
}

function relationshipValueSegment(
	value: MobileRelationship["values"][number],
	index: number,
) {
	return (
		mobileRelationshipValueMetricSegments([value])[0] ??
		`relationship-${index + 1}`
	);
}
