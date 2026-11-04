import type {
	MobileWorkspaceEdit,
	MobileWorkspaceWrite,
} from "../workspace/mobileWorkspaceEditing";
import type {
	MobileNote,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";

const OPTIMISTIC_NOTE_LIST_ACTIONS = new Set([
	"setArchived",
	"setOrganized",
	"toggleFavorite",
	"deleteNote",
]);

export type OptimisticNoteListRollback = {
	edit: MobileWorkspaceEdit;
	previous: MobileWorkspaceSnapshot;
	optimistic: MobileWorkspaceSnapshot;
};

export function isOptimisticNoteListEdit(edit: MobileWorkspaceEdit): boolean {
	const edits = edit.type === "bulkEdit" ? edit.edits : [edit];
	return (
		edits.length > 0 &&
		edits.every((item) => OPTIMISTIC_NOTE_LIST_ACTIONS.has(item.type))
	);
}

export function rollbackFailedNoteListWrites(
	current: MobileWorkspaceSnapshot,
	previous: MobileWorkspaceSnapshot,
	optimistic: MobileWorkspaceSnapshot,
	writes: MobileWorkspaceWrite[],
): { snapshot: MobileWorkspaceSnapshot; fullyRolledBack: boolean } {
	const { fullyRolledBack, restored } = collectRestorableNotes({
		current,
		optimistic,
		previous,
		writes,
	});
	if (restored.size === 0) return { snapshot: current, fullyRolledBack: false };

	const restore = (notes: MobileNote[], priorNotes: MobileNote[]) =>
		restoreMissingNotes(notes, priorNotes, restored);
	const notes = restore(current.notes, previous.notes);
	const allNotes = current.allNotes
		? restore(current.allNotes, previous.allNotes ?? previous.notes)
		: current.allNotes;
	return {
		snapshot: {
			...current,
			allNotes,
			notes,
			selectedNoteId: restoredSelection(
				current,
				previous,
				optimistic,
				restored,
			),
		},
		fullyRolledBack,
	};
}

function collectRestorableNotes({
	current,
	optimistic,
	previous,
	writes,
}: {
	current: MobileWorkspaceSnapshot;
	optimistic: MobileWorkspaceSnapshot;
	previous: MobileWorkspaceSnapshot;
	writes: MobileWorkspaceWrite[];
}) {
	const restored = new Map<string, MobileNote>();
	let fullyRolledBack = writes.length > 0;
	for (const write of writes) {
		const restoredWrite =
			write.kind === "saveNote"
				? rollbackSavedNote({ current, optimistic, previous, write, restored })
				: write.kind === "deleteNote"
					? rollbackDeletedNote({ current, previous, write, restored })
					: false;
		fullyRolledBack = restoredWrite && fullyRolledBack;
	}
	return { fullyRolledBack, restored };
}

function rollbackSavedNote({
	current,
	optimistic,
	previous,
	write,
	restored,
}: {
	current: MobileWorkspaceSnapshot;
	optimistic: MobileWorkspaceSnapshot;
	previous: MobileWorkspaceSnapshot;
	write: Extract<MobileWorkspaceWrite, { kind: "saveNote" }>;
	restored: Map<string, MobileNote>;
}) {
	const prior = noteAtPath(previous, write.path);
	const expected = noteAtPath(optimistic, write.path);
	const actual = noteAtPath(current, write.path);
	if (
		!prior ||
		!expected ||
		!actual ||
		!samePersistedNoteState(actual, expected)
	)
		return false;
	restored.set(prior.id, prior);
	return true;
}

function rollbackDeletedNote({
	current,
	previous,
	write,
	restored,
}: {
	current: MobileWorkspaceSnapshot;
	previous: MobileWorkspaceSnapshot;
	write: Extract<MobileWorkspaceWrite, { kind: "deleteNote" }>;
	restored: Map<string, MobileNote>;
}) {
	const prior = noteAtPath(previous, write.path);
	if (!prior || noteAtPath(current, write.path)) return false;
	restored.set(prior.id, prior);
	return true;
}

function noteAtPath(snapshot: MobileWorkspaceSnapshot, path: string) {
	return [...snapshot.notes, ...(snapshot.allNotes ?? [])].find(
		(note) => (note.path ?? note.id) === path,
	);
}

function samePersistedNoteState(actual: MobileNote, expected: MobileNote) {
	return (
		actual.path === expected.path &&
		actual.rawContent === expected.rawContent &&
		actual.favorite === expected.favorite &&
		actual.archived === expected.archived &&
		actual.organized === expected.organized
	);
}

function restoreMissingNotes(
	current: MobileNote[],
	previous: MobileNote[],
	restored: Map<string, MobileNote>,
) {
	const next = current.map((note) => restored.get(note.id) ?? note);
	for (const note of restored.values()) {
		if (next.some((candidate) => candidate.id === note.id)) continue;
		const previousIndex = previous.findIndex(
			(candidate) => candidate.id === note.id,
		);
		if (previousIndex < 0) continue;
		const nextNeighbor = previous
			.slice(previousIndex + 1)
			.find((candidate) =>
				next.some((currentNote) => currentNote.id === candidate.id),
			);
		const insertAt = nextNeighbor
			? next.findIndex((candidate) => candidate.id === nextNeighbor.id)
			: Math.min(previousIndex, next.length);
		next.splice(insertAt, 0, note);
	}
	return next;
}

function restoredSelection(
	current: MobileWorkspaceSnapshot,
	previous: MobileWorkspaceSnapshot,
	optimistic: MobileWorkspaceSnapshot,
	restored: Map<string, MobileNote>,
) {
	const priorSelection = previous.selectedNoteId;
	return priorSelection &&
		restored.has(priorSelection) &&
		current.selectedNoteId === optimistic.selectedNoteId
		? priorSelection
		: current.selectedNoteId;
}
