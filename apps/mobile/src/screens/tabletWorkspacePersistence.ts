import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useRef,
} from "react";
import { captureMobileError } from "../analytics/mobileCrashChannel";
import { trackSuccessfulMobileEdit } from "../analytics/mobileSuccessfulEdit";
import { useMobileAnalytics } from "../analytics/useMobileAnalytics";
import { MobileVaultPickerContext } from "../workspace/MobileVaultContext";
import { withDefaultNoteType } from "../workspace/mobileDefaultNoteType";
import { requestCreatedNoteFocus } from "../workspace/mobileEditorFocus";
import {
	isMobileNoteHydration,
	mobileEditNeedsNoteRead,
} from "../workspace/mobileNoteRead";
import { workspacePendingWritePaths } from "../workspace/mobilePendingChanges";
import {
	applyMobileWorkspaceEditWithWrites,
	type MobileWorkspaceEdit,
	type MobileWorkspaceWrite,
} from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import type {
	ReadOnlyWorkspaceRepository,
	ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import { WorkspaceSyncEditorsContext } from "../workspace/workspaceSyncEditors";
import {
	isOptimisticNoteFlagEdit,
	rollbackFailedFlagWrites,
} from "./mobileWorkspaceFlagWriteRollback";
import {
	emptyMobileWorkspaceHistory,
	type MobileWorkspaceHistoryEntry,
	mobileWorkspaceHistoryEntry,
	recordMobileWorkspaceHistory,
} from "./tabletWorkspaceHistory";
import {
	usePreparedWorkspaceEdits,
	type WorkspaceEditOptions,
} from "./usePreparedWorkspaceEdits";
import { useWorkspaceSnapshotFrame } from "./useWorkspaceSnapshotFrame";

type WorkspaceSnapshotRef = MutableRefObject<MobileWorkspaceSnapshot>;
type WorkspaceSnapshotSetter = Dispatch<
	SetStateAction<MobileWorkspaceSnapshot>
>;
type WorkspaceHistory = typeof emptyMobileWorkspaceHistory;
type WorkspaceHistorySetter = Dispatch<SetStateAction<WorkspaceHistory>>;

export function useWorkspaceEditPipeline({
	repository,
	repositoryRequest,
	snapshot,
}: {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	snapshot: MobileWorkspaceSnapshot;
}) {
	const vaultPicker = useContext(MobileVaultPickerContext);
	const snapshotState = useWorkspaceSnapshotFrame(
		snapshot,
		repositoryRequest?.vaultRootUri,
	);
	const { workspaceHistory, setWorkspaceHistory } = snapshotState;
	const applyEdit = useWorkspaceEditApplier({
		repository,
		repositoryRequest,
		setWorkspaceHistory,
		snapshotState,
	});
	const { apply: applyWorkspaceEdit, retryFailedEdit } =
		usePreparedWorkspaceEdits({
			applyEdit,
			repository,
			repositoryRequest,
			snapshotRef: snapshotState.workspaceSnapshotRef,
			generation: snapshotState.generation,
		});
	const historyControls = useWorkspaceHistoryControls({
		applyWorkspaceEdit,
		setWorkspaceHistory,
		workspaceHistory,
	});
	const reloadWorkspaceSnapshot = useCallback(() => {
		if (repositoryRequest?.source === "native")
			return vaultPicker?.choices.find((choice) => choice.selected)?.select();
		const nextSnapshot = repository.readSnapshot(repositoryRequest);
		snapshotState.replaceWorkspaceSnapshot(nextSnapshot);
		setWorkspaceHistory(emptyMobileWorkspaceHistory);
	}, [
		repository,
		repositoryRequest,
		setWorkspaceHistory,
		snapshotState,
		vaultPicker,
	]);

	return {
		applyWorkspaceEdit,
		retryFailedEdit,
		reloadWorkspaceSnapshot,
		workspaceSnapshot: snapshotState.workspaceSnapshot,
		...historyControls,
	};
}

function useWorkspaceEditApplier({
	repository,
	repositoryRequest,
	setWorkspaceHistory,
	snapshotState,
}: {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	setWorkspaceHistory: WorkspaceHistorySetter;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
}) {
	const analytics = useMobileAnalytics();
	const syncEditors = useContext(WorkspaceSyncEditorsContext);
	const { generation } = snapshotState;
	return useCallback(
		(edit: MobileWorkspaceEdit, options: WorkspaceEditOptions = {}) => {
			const previousSnapshot = snapshotState.workspaceSnapshotRef.current;
			if (generation !== syncEditors?.generation())
				return { snapshot: previousSnapshot, writes: [] };
			const result = applyWorkspaceEditToWritableSnapshot(
				previousSnapshot,
				edit,
				repositoryRequest?.source,
			);
			requestCreatedNoteFocus(syncEditors, edit, result);
			if (result.writes.length > 0)
				syncEditors?.markDirty(workspacePendingWritePaths(result.writes));
			snapshotState.replaceWorkspaceSnapshot(result.snapshot);
			recordWorkspaceEditHistory({
				edit,
				options,
				previousSnapshot,
				resultSnapshot: result.snapshot,
				setWorkspaceHistory,
			});
			if (result.writes.length > 0)
				void persistWorkspaceWrites({
					repository,
					repositoryRequest,
					rollback: isOptimisticNoteFlagEdit(edit)
						? { previous: previousSnapshot, optimistic: result.snapshot }
						: undefined,
					setWorkspaceSnapshot: snapshotState.setWorkspaceSnapshot,
					workspaceSnapshotRef: snapshotState.workspaceSnapshotRef,
					writes: result.writes,
					onSaved: () =>
						trackSuccessfulMobileEdit(
							edit,
							result.writes.length,
							analytics.capture,
						),
				});
			return result;
		},
		[
			analytics,
			generation,
			repository,
			repositoryRequest,
			setWorkspaceHistory,
			snapshotState,
			syncEditors,
		],
	);
}

export function applyWorkspaceEditToWritableSnapshot(
	snapshot: MobileWorkspaceSnapshot,
	edit: MobileWorkspaceEdit,
	source?: ReadOnlyWorkspaceRequest["source"],
) {
	if (isMobileNoteHydration(edit))
		return applyMobileWorkspaceEditWithWrites(snapshot, edit);
	if (snapshot.sync.kind === "noVault" || snapshot.sync.kind === "readOnly")
		return { snapshot, writes: [] };
	if (mobileEditNeedsNoteRead(edit, snapshot, source))
		return { snapshot, writes: [] };
	return withDefaultNoteType(
		applyMobileWorkspaceEditWithWrites(snapshot, edit),
	);
}

function useWorkspaceHistoryControls({
	applyWorkspaceEdit,
	setWorkspaceHistory,
	workspaceHistory,
}: {
	applyWorkspaceEdit: ReturnType<typeof usePreparedWorkspaceEdits>["apply"];
	setWorkspaceHistory: WorkspaceHistorySetter;
	workspaceHistory: WorkspaceHistory;
}) {
	const historyPending = useRef(false);
	const applyWorkspaceHistoryEntry = useCallback(
		async (entry: MobileWorkspaceHistoryEntry, direction: "redo" | "undo") => {
			const edits = direction === "undo" ? entry.undoEdits : entry.redoEdits;
			return applyWorkspaceEdit(
				{ type: "bulkEdit", edits },
				{ recordHistory: false },
			);
		},
		[applyWorkspaceEdit],
	);
	const undoWorkspaceEdit = useCallback(async () => {
		const entry = latestWorkspaceHistoryEntry(workspaceHistory.past);
		if (!entry || historyPending.current) return;
		historyPending.current = true;
		try {
			if (!(await applyWorkspaceHistoryEntry(entry, "undo"))) return;
			setWorkspaceHistory({
				future: [entry, ...workspaceHistory.future],
				past: workspaceHistory.past.slice(0, -1),
			});
		} finally {
			historyPending.current = false;
		}
	}, [applyWorkspaceHistoryEntry, setWorkspaceHistory, workspaceHistory]);
	const redoWorkspaceEdit = useCallback(async () => {
		const entry = workspaceHistory.future[0];
		if (!entry || historyPending.current) return;
		historyPending.current = true;
		try {
			if (!(await applyWorkspaceHistoryEntry(entry, "redo"))) return;
			setWorkspaceHistory({
				future: workspaceHistory.future.slice(1),
				past: [...workspaceHistory.past, entry],
			});
		} finally {
			historyPending.current = false;
		}
	}, [applyWorkspaceHistoryEntry, setWorkspaceHistory, workspaceHistory]);

	return {
		canRedoWorkspaceEdit: workspaceHistory.future.length > 0,
		canUndoWorkspaceEdit: workspaceHistory.past.length > 0,
		redoWorkspaceEdit,
		undoWorkspaceEdit,
	};
}

function latestWorkspaceHistoryEntry(entries: MobileWorkspaceHistoryEntry[]) {
	return entries.at(-1) ?? null;
}

function recordWorkspaceEditHistory({
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
	if (options.recordHistory === false) return;

	setWorkspaceHistory((history) =>
		recordMobileWorkspaceHistory(
			history,
			mobileWorkspaceHistoryEntry(previousSnapshot, resultSnapshot, edit),
		),
	);
}

async function persistWorkspaceWrites({
	onSaved,
	repository,
	repositoryRequest,
	rollback,
	setWorkspaceSnapshot,
	workspaceSnapshotRef,
	writes,
}: {
	onSaved: () => void;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	rollback?: {
		previous: MobileWorkspaceSnapshot;
		optimistic: MobileWorkspaceSnapshot;
	};
	setWorkspaceSnapshot: WorkspaceSnapshotSetter;
	workspaceSnapshotRef: WorkspaceSnapshotRef;
	writes: MobileWorkspaceWrite[];
}) {
	try {
		await repository.persistWrites(writes, repositoryRequest);
		onSaved();
	} catch (error) {
		captureMobileError(error, "persistence");
		markWorkspaceWriteFailed(
			workspaceSnapshotRef,
			setWorkspaceSnapshot,
			rollback,
			writes,
		);
	}
}

function markWorkspaceWriteFailed(
	workspaceSnapshotRef: WorkspaceSnapshotRef,
	setWorkspaceSnapshot: WorkspaceSnapshotSetter,
	rollback?: {
		previous: MobileWorkspaceSnapshot;
		optimistic: MobileWorkspaceSnapshot;
	},
	writes: MobileWorkspaceWrite[] = [],
) {
	setWorkspaceSnapshot((current) => {
		const restored = rollback
			? rollbackFailedFlagWrites(
					current,
					rollback.previous,
					rollback.optimistic,
					writes,
				)
			: current;
		const failedSnapshot = snapshotWithWriteFailure(restored);
		workspaceSnapshotRef.current = failedSnapshot;
		return failedSnapshot;
	});
}

function snapshotWithWriteFailure(
	snapshot: MobileWorkspaceSnapshot,
): MobileWorkspaceSnapshot {
	return {
		...snapshot,
		sync: { kind: "writeFailed" },
	};
}
