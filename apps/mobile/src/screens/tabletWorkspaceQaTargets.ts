import type { MobileSidebarItemSelection } from "../components/workspace/MobileWorkspaceSidebar";
import type {
	MobileNote,
	MobilePropertyValue,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";
import type { actionSheetWorkspaceActions } from "./tabletWorkspaceActionOpeners";
import type { MobileActionSheetQaTarget } from "./tabletWorkspaceTypes";

type ActionSheetActions = ReturnType<typeof actionSheetWorkspaceActions>;

export function openMobileActionSheetQaTarget(
	actions: ActionSheetActions,
	target: MobileActionSheetQaTarget,
	workspaceSnapshot: MobileWorkspaceSnapshot,
) {
	if (openSimpleActionSheetTarget(actions, target)) return;
	if (openDataBackedActionSheetTarget(actions, target, workspaceSnapshot))
		return;
	actions.onOpenSearch();
}

function openSimpleActionSheetTarget(
	actions: ActionSheetActions,
	target: MobileActionSheetQaTarget,
) {
	switch (target) {
		case "addProperty":
			actions.onAddProperty();
			return true;
		case "addRelationship":
			actions.onAddRelationship();
			return true;
		case "createView":
			actions.onOpenCreateView();
			return true;
		case "editTypeVisibility":
			actions.onOpenTypeVisibility();
			return true;
		default:
			return false;
	}
}

function openDataBackedActionSheetTarget(
	actions: ActionSheetActions,
	target: MobileActionSheetQaTarget,
	snapshot: MobileWorkspaceSnapshot,
) {
	switch (target) {
		case "editProperty":
			openPropertyTarget(actions, snapshot);
			return true;
		case "editView":
			openViewTarget(actions, snapshot);
			return true;
		case "editTypeSection":
			openTypeTarget(actions, snapshot);
			return true;
		default:
			return false;
	}
}

function openPropertyTarget(
	actions: ActionSheetActions,
	snapshot: MobileWorkspaceSnapshot,
) {
	const property = firstEditableProperty(snapshot);
	if (property) actions.onOpenEditProperty(property.key, property.value);
}

function openViewTarget(
	actions: ActionSheetActions,
	snapshot: MobileWorkspaceSnapshot,
) {
	const selection = firstSidebarItemSelection(snapshot, "views");
	if (selection) actions.onOpenViewActions(selection);
}

function openTypeTarget(
	actions: ActionSheetActions,
	snapshot: MobileWorkspaceSnapshot,
) {
	const selection = firstSidebarItemSelection(snapshot, "types");
	if (selection) actions.onOpenTypeActions(selection);
}

function firstEditableProperty(
	snapshot: MobileWorkspaceSnapshot,
): { key: string; value: MobilePropertyValue } | null {
	const note = selectedSnapshotNote(snapshot);
	if (!note) return null;
	const property = note.properties?.[0];
	if (property) return { key: property.key, value: property.value };
	if (note.tags.length > 0) return { key: "tags", value: note.tags };
	return note.status ? { key: "Status", value: note.status } : null;
}

function selectedSnapshotNote(
	snapshot: MobileWorkspaceSnapshot,
): MobileNote | null {
	const selectedNoteId = snapshot.selectedNoteId;
	if (!selectedNoteId) return null;
	return (
		snapshot.notes.find((note) => note.id === selectedNoteId) ??
		snapshot.allNotes?.find((note) => note.id === selectedNoteId) ??
		null
	);
}

function firstSidebarItemSelection(
	snapshot: MobileWorkspaceSnapshot,
	sectionId: string,
): MobileSidebarItemSelection | null {
	const item = snapshot.sidebarSections.find(
		(section) => section.id === sectionId,
	)?.items?.[0];
	if (!item) return null;
	return {
		count: item.count,
		id: item.id,
		label: item.label,
		noteId: item.noteId,
		sectionId,
		typeName: item.typeName,
		viewId: item.viewId,
	};
}
