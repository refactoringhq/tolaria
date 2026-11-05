import type { Dispatch, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import type { MobileWorkspaceEdit } from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import {
	type MobileWorkspaceHistoryEntry,
	mobileWorkspaceHistoryEntry,
	recordMobileWorkspaceHistory,
} from "./tabletWorkspaceHistory";
import type { WorkspaceEditOptions } from "./usePreparedWorkspaceEdits";

type WorkspaceHistory = {
	future: MobileWorkspaceHistoryEntry[];
	past: MobileWorkspaceHistoryEntry[];
};
type WorkspaceHistorySetter = Dispatch<SetStateAction<WorkspaceHistory>>;
type WorkspaceSnapshotRef = { current: MobileWorkspaceSnapshot };
type WorkspaceSnapshotSetter = Dispatch<
	SetStateAction<MobileWorkspaceSnapshot>
>;

export function useWorkspaceHistoryControls({
	applyWorkspaceEdit,
	setWorkspaceHistory,
	workspaceHistory,
}: {
	applyWorkspaceEdit: (
		edit: MobileWorkspaceEdit,
		options?: WorkspaceEditOptions,
	) => Promise<unknown>;
	setWorkspaceHistory: WorkspaceHistorySetter;
	workspaceHistory: WorkspaceHistory;
}) {
	const historyPending = useRef(false);
	const applyEntry = useCallback(
		(entry: MobileWorkspaceHistoryEntry, direction: "redo" | "undo") =>
			applyWorkspaceEdit(
				{
					type: "bulkEdit",
					edits: direction === "undo" ? entry.undoEdits : entry.redoEdits,
				},
				{ recordHistory: false },
			),
		[applyWorkspaceEdit],
	);
	const undoWorkspaceEdit = useHistoryDirection(
		"undo",
		applyEntry,
		historyPending,
		setWorkspaceHistory,
		workspaceHistory,
	);
	const redoWorkspaceEdit = useHistoryDirection(
		"redo",
		applyEntry,
		historyPending,
		setWorkspaceHistory,
		workspaceHistory,
	);
	return {
		canRedoWorkspaceEdit: workspaceHistory.future.length > 0,
		canUndoWorkspaceEdit: workspaceHistory.past.length > 0,
		redoWorkspaceEdit,
		undoWorkspaceEdit,
	};
}

function useHistoryDirection(
	direction: "redo" | "undo",
	applyEntry: (
		entry: MobileWorkspaceHistoryEntry,
		direction: "redo" | "undo",
	) => Promise<unknown>,
	historyPending: { current: boolean },
	setWorkspaceHistory: WorkspaceHistorySetter,
	workspaceHistory: WorkspaceHistory,
) {
	return useCallback(async () => {
		const entry =
			direction === "undo"
				? workspaceHistory.past.at(-1)
				: workspaceHistory.future[0];
		if (!entry || historyPending.current) return;
		historyPending.current = true;
		try {
			if (!(await applyEntry(entry, direction))) return;
			setWorkspaceHistory(nextHistoryState(direction, entry, workspaceHistory));
		} finally {
			historyPending.current = false;
		}
	}, [
		applyEntry,
		direction,
		historyPending,
		setWorkspaceHistory,
		workspaceHistory,
	]);
}

function nextHistoryState(
	direction: "redo" | "undo",
	entry: MobileWorkspaceHistoryEntry,
	history: WorkspaceHistory,
): WorkspaceHistory {
	return direction === "undo"
		? {
				future: [entry, ...history.future],
				past: history.past.slice(0, -1),
			}
		: {
				future: history.future.slice(1),
				past: [...history.past, entry],
			};
}

export function recordWorkspaceEditHistory({
	edit,
	options,
	previousSnapshot,
	resultSnapshot,
	setWorkspaceHistory,
}: {
	edit: MobileWorkspaceEdit;
	options: WorkspaceEditOptions;
	previousSnapshot: MobileWorkspaceSnapshot;
	resultSnapshot: MobileWorkspaceSnapshot;
	setWorkspaceHistory: WorkspaceHistorySetter;
}) {
	if (options.recordHistory === false) return null;
	const entry = mobileWorkspaceHistoryEntry(
		previousSnapshot,
		resultSnapshot,
		edit,
	);
	setWorkspaceHistory((history) =>
		recordMobileWorkspaceHistory(history, entry),
	);
	return entry;
}

export function clearWorkspaceWriteFailure(
	workspaceSnapshotRef: WorkspaceSnapshotRef,
	setWorkspaceSnapshot: WorkspaceSnapshotSetter,
) {
	setWorkspaceSnapshot((current) => {
		if (current.sync.kind !== "writeFailed") return current;
		const recovered = {
			...current,
			sync: { kind: "synced" as const, minutesAgo: 0 },
		};
		workspaceSnapshotRef.current = recovered;
		return recovered;
	});
}
