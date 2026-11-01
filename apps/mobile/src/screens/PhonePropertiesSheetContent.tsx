import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../components/ui/text";
import { MobilePropertiesPanel } from "../components/workspace/MobilePropertiesPanel";
import { MobileTypeIcon } from "../components/workspace/MobileWorkspaceIcons";
import { noteTypeColor } from "../components/workspace/mobileWorkspaceTone";
import { useMobileColors } from "../ui/theme/useMobileTheme";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../workspace/mobileWorkspaceModel";
import { PhoneNativePropertyControl } from "./PhoneNativePropertyControl";
import { PhonePropertiesTypePicker } from "./PhonePropertiesTypePicker";
import type { PhoneWorkspaceStateViewProps } from "./phoneWorkspaceScreenSupport";
import { useMobileInspectorReferenceGroups } from "./useMobileInspectorReferenceGroups";

export function PhonePropertiesSheetContent(
	props: PhoneWorkspaceStateViewProps,
) {
	const controller = props.controller;
	const note = controller.selectedNote;
	const colors = useMobileColors();
	const references = useMobileInspectorReferenceGroups(
		note,
		controller.snapshot,
	);
	const types = useMemo(
		() =>
			note
				? propertySheetTypes(
						controller.snapshot.typeDefinitions,
						note.type,
						controller.snapshot.notes,
					)
				: [],
		[controller.snapshot.notes, controller.snapshot.typeDefinitions, note],
	);
	const openList = props.openList;
	const enterNeighborhood = useCallback(
		(noteId: string) => {
			controller.onEnterNeighborhood(noteId);
			openList();
		},
		[controller, openList],
	);

	return (
		<View testID="phone-properties-sheet" style={styles.content}>
			{note ? (
				<PhonePropertiesTypeRow
					note={note}
					types={types}
					typeDefinitions={controller.snapshot.typeDefinitions}
					color={noteTypeColor(note.typeTone, colors)}
					onChange={(type) => controller.onCommitNativeNoteType(note.id, type)}
				/>
			) : null}
			<PhonePropertiesForm
				props={props}
				note={note}
				references={references}
				onEnterNeighborhood={enterNeighborhood}
			/>
		</View>
	);
}

function PhonePropertiesTypeRow(props: {
	note: MobileNote;
	types: string[];
	typeDefinitions?: MobileTypeDefinitions;
	color: string;
	onChange: (type: string) => void;
}) {
	return (
		<View style={styles.typeRow}>
			<MobileTypeIcon
				size={18}
				tone={props.note.typeTone}
				type={props.note.type}
				typeDefinitions={props.typeDefinitions}
			/>
			<Text style={[styles.typeLabel, { color: props.color }]}>
				{props.note.type}
			</Text>
			<PhonePropertiesTypePicker
				value={props.note.type}
				options={props.types}
				onChange={props.onChange}
			/>
		</View>
	);
}

function PhonePropertiesForm(props: {
	props: PhoneWorkspaceStateViewProps;
	note: MobileNote | null;
	references: ReturnType<typeof useMobileInspectorReferenceGroups>;
	onEnterNeighborhood: (noteId: string) => void;
}) {
	const { controller } = props.props;
	const { note } = props;
	const snapshot = controller.snapshot;
	return (
		<MobilePropertiesPanel
			compact
			fullWidth
			hideTypeRow
			showToolbar={false}
			layoutProbe={props.props.options.layoutProbe}
			nativeValueControl={(property) => (
				<PhoneNativePropertyControl
					key={`${note?.id ?? ""}:${property.key}:${JSON.stringify(property.value)}`}
					keyName={property.key}
					label={property.label}
					value={property.value}
					displayModes={snapshot.vaultConfig?.propertyDisplayModes}
					typeDefinitions={snapshot.typeDefinitions}
					notes={snapshot.allNotes ?? snapshot.notes}
					selectedNoteId={note?.id ?? ""}
					onCommit={(value) =>
						note &&
						controller.onCommitNativeProperty(note.id, property.key, value)
					}
				/>
			)}
			note={note}
			typeDefinitions={snapshot.typeDefinitions}
			onAddProperty={controller.onAddProperty}
			onAddRelationship={controller.onAddRelationship}
			onDeleteProperty={controller.onDeleteProperty}
			onEditProperty={controller.onEditProperty}
			onEnterNeighborhood={props.onEnterNeighborhood}
			onFixInvalidFrontmatter={props.props.openSourceEditor}
			onInitializeProperties={controller.onInitializeProperties}
			onCreateMissingType={controller.onOpenCreateTypeWithName}
			onOpenChangeNoteType={controller.onOpenChangeNoteType}
			onRemoveRelationship={controller.onRemoveRelationship}
			propertyDisplayModes={snapshot.vaultConfig?.propertyDisplayModes}
			referenceGroups={props.references}
			onSelectNote={props.props.openEditor}
		/>
	);
}

function propertySheetTypes(
	typeDefinitions: MobileTypeDefinitions | undefined,
	currentType: string,
	notes: PhoneWorkspaceStateViewProps["controller"]["snapshot"]["notes"],
) {
	return [
		...new Set([
			currentType,
			...Object.keys(typeDefinitions ?? {}),
			...notes.map((note) => note.type),
		]),
	]
		.filter(Boolean)
		.sort((left, right) => left.localeCompare(right));
}

const styles = StyleSheet.create({
	content: { flex: 1, minHeight: 0 },
	typeRow: {
		alignItems: "center",
		flexDirection: "row",
		gap: 10,
		minHeight: 52,
		paddingHorizontal: 16,
	},
	typeLabel: { flexShrink: 0, fontSize: 16, fontWeight: "600" },
});
