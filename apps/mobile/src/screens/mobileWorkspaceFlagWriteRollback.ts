import type {
	MobileWorkspaceEdit,
	MobileWorkspaceWrite,
} from "../workspace/mobileWorkspaceEditing";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";

export function isOptimisticNoteFlagEdit(edit: MobileWorkspaceEdit): boolean {
	const edits = edit.type === "bulkEdit" ? edit.edits : [edit];
	return (
		edits.length > 0 &&
		edits.every(
			(item) => item.type === "setArchived" || item.type === "setOrganized",
		)
	);
}

export function rollbackFailedFlagWrites(
	current: MobileWorkspaceSnapshot,
	previous: MobileWorkspaceSnapshot,
	optimistic: MobileWorkspaceSnapshot,
	writes: MobileWorkspaceWrite[],
): MobileWorkspaceSnapshot {
	const restored = restoredNotes(current, previous, optimistic, writes);
	if (restored.size === 0) return current;

	const restore = (notes: MobileNote[]) =>
		notes.map((note) => restored.get(note.id) ?? note);
	return {
		...current,
		allNotes: current.allNotes ? restore(current.allNotes) : current.allNotes,
		notes: restore(current.notes),
	};
}

function restoredNotes(
	current: MobileWorkspaceSnapshot,
	previous: MobileWorkspaceSnapshot,
	optimistic: MobileWorkspaceSnapshot,
	writes: MobileWorkspaceWrite[],
) {
	const paths = new Set(
		writes.flatMap((write) => (write.kind === "saveNote" ? [write.path] : [])),
	);
	const previousById = new Map(previous.notes.map((note) => [note.id, note]));
	return new Map(
		optimistic.notes.flatMap((expected) => {
			const prior = previousById.get(expected.id);
			const actual = current.notes.find((note) => note.id === expected.id);
			return prior &&
				expected.path &&
				paths.has(expected.path) &&
				actual?.rawContent === expected.rawContent
				? [[expected.id, prior] as const]
				: [];
		}),
	);
}
