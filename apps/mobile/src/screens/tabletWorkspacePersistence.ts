import {
	type ContextType,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
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
} from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import type {
	ReadOnlyWorkspaceRepository,
	ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import { WorkspaceSyncEditorsContext } from "../workspace/workspaceSyncEditors";
import { useWorkspaceEditRetry } from "./mobileWorkspaceEditRetry";
import { isOptimisticNoteListEdit } from "./mobileWorkspaceFlagWriteRollback";
import {
	persistWorkspaceWrites,
	snapshotAfterPendingWriteFailure,
	writePathKeys,
} from "./mobileWorkspaceWritePersistence";
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
type MobileVaultPicker = ContextType<typeof MobileVaultPickerContext>;
type FailedWorkspaceWrite = { edit: MobileWorkspaceEdit };
type FailedWorkspaceWriteSetter = Dispatch<
	SetStateAction<FailedWorkspaceWrite | null>
>;
type WriteVersions = {
	latest: MutableRefObject<number>;
	byPath: MutableRefObject<Map<string, number>>;
};
type StartWorkspacePersistence = {
	analytics: ReturnType<typeof useMobileAnalytics>;
	edit: MobileWorkspaceEdit;
	generation: number | undefined;
	versions: WriteVersions;
	optimisticSnapshot: MobileWorkspaceSnapshot;
	previousSnapshot: MobileWorkspaceSnapshot;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	result: ReturnType<typeof applyWorkspaceEditToWritableSnapshot>;
	setFailedWrite: FailedWorkspaceWriteSetter;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
	syncEditors: ContextType<typeof WorkspaceSyncEditorsContext>;
};
type ApplyWorkspaceEditServices = Omit<
	StartWorkspacePersistence,
	"result" | "optimisticSnapshot" | "previousSnapshot"
> & {
	options: WorkspaceEditOptions;
	setWorkspaceHistory: WorkspaceHistorySetter;
};

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
	const actions = useWorkspaceEditActions({
		repository,
		repositoryRequest,
		snapshotState,
		setWorkspaceHistory,
		workspaceHistory,
	});
	const reloadWorkspaceSnapshot = useWorkspaceSnapshotReload({
		repository,
		repositoryRequest,
		setWorkspaceHistory,
		snapshotState,
		vaultPicker,
	});

	return {
		...actions,
		reloadWorkspaceSnapshot,
		workspaceSnapshot: snapshotState.workspaceSnapshot,
	};
}

function useWorkspaceEditActions({
	repository,
	repositoryRequest,
	snapshotState,
	setWorkspaceHistory,
	workspaceHistory,
}: {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
	setWorkspaceHistory: WorkspaceHistorySetter;
	workspaceHistory: WorkspaceHistory;
}) {
	const {
		apply: applyEdit,
		clearFailedWrite,
		failedWrite,
	} = useWorkspaceEditApplier({
		repository,
		repositoryRequest,
		setWorkspaceHistory,
		snapshotState,
	});
	const { apply: applyWorkspaceEdit, retryFailedEdit: retryPreparedEdit } =
		usePreparedWorkspaceEdits({
			applyEdit,
			repository,
			repositoryRequest,
			snapshotRef: snapshotState.workspaceSnapshotRef,
			generation: snapshotState.generation,
		});
	const retryFailedEdit = useWorkspaceEditRetry({
		applyWorkspaceEdit,
		clearFailedWrite,
		failedWrite,
		retryPreparedEdit,
	});
	const historyControls = useWorkspaceHistoryControls({
		applyWorkspaceEdit,
		setWorkspaceHistory,
		workspaceHistory,
	});

	return {
		applyWorkspaceEdit,
		retryFailedEdit:
			failedWrite || retryPreparedEdit ? retryFailedEdit : undefined,
		...historyControls,
	};
}

function useWorkspaceSnapshotReload({
	repository,
	repositoryRequest,
	setWorkspaceHistory,
	snapshotState,
	vaultPicker,
}: {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	setWorkspaceHistory: WorkspaceHistorySetter;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
	vaultPicker: MobileVaultPicker;
}) {
	return useCallback(() => {
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
	const [failedWrite, setFailedWrite] = useState<FailedWorkspaceWrite | null>(
		null,
	);
	const latestWriteVersion = useRef(0);
	const writeVersions = useRef(new Map<string, number>());
	const { generation } = snapshotState;
	const apply = useCallback(
		(edit: MobileWorkspaceEdit, options: WorkspaceEditOptions = {}) =>
			applyWorkspaceEditNow({
				analytics,
				edit,
				generation,
				options,
				repository,
				repositoryRequest,
				setFailedWrite,
				setWorkspaceHistory,
				snapshotState,
				syncEditors,
				versions: {
					latest: latestWriteVersion,
					byPath: writeVersions,
				},
			}),
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
	const clearFailedWrite = useCallback(() => setFailedWrite(null), []);
	return { apply, clearFailedWrite, failedWrite };
}

function applyWorkspaceEditNow(services: ApplyWorkspaceEditServices) {
	const {
		analytics,
		edit,
		generation,
		options,
		repository,
		repositoryRequest,
		setFailedWrite,
		setWorkspaceHistory,
		snapshotState,
		syncEditors,
		versions,
	} = services;
	const previousSnapshot = snapshotState.workspaceSnapshotRef.current;
	if (!isWorkspaceEditGenerationCurrent(generation, syncEditors))
		return { snapshot: previousSnapshot, writes: [] };
	setFailedWrite(null);
	const { result, optimisticSnapshot } = createOptimisticEditResult(
		previousSnapshot,
		edit,
		repositoryRequest?.source,
	);
	publishOptimisticWorkspaceEdit({
		edit,
		options,
		previousSnapshot,
		setWorkspaceHistory,
		optimisticSnapshot,
		result,
		snapshotState,
		syncEditors,
	});
	if (result.writes.length > 0)
		startWorkspaceEditPersistence({
			analytics,
			edit,
			generation,
			versions,
			optimisticSnapshot,
			previousSnapshot,
			repository,
			repositoryRequest,
			result,
			setFailedWrite,
			snapshotState,
			syncEditors,
		});
	return result;
}

function createOptimisticEditResult(
	previousSnapshot: MobileWorkspaceSnapshot,
	edit: MobileWorkspaceEdit,
	source?: ReadOnlyWorkspaceRequest["source"],
) {
	const result = applyWorkspaceEditToWritableSnapshot(
		previousSnapshot,
		edit,
		source,
	);
	return {
		result,
		optimisticSnapshot: snapshotAfterPendingWriteFailure(
			result.snapshot,
			result.writes.length > 0,
		),
	};
}

function isWorkspaceEditGenerationCurrent(
	generation: number | undefined,
	syncEditors: ContextType<typeof WorkspaceSyncEditorsContext>,
) {
	return generation === syncEditors?.generation();
}

function publishOptimisticWorkspaceEdit(services: {
	edit: MobileWorkspaceEdit;
	options: WorkspaceEditOptions;
	previousSnapshot: MobileWorkspaceSnapshot;
	setWorkspaceHistory: WorkspaceHistorySetter;
	optimisticSnapshot: MobileWorkspaceSnapshot;
	result: ReturnType<typeof applyWorkspaceEditToWritableSnapshot>;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
	syncEditors: ContextType<typeof WorkspaceSyncEditorsContext>;
}) {
	const {
		edit,
		options,
		previousSnapshot,
		setWorkspaceHistory,
		optimisticSnapshot,
		result,
		snapshotState,
		syncEditors,
	} = services;
	requestCreatedNoteFocus(syncEditors, edit, result);
	if (result.writes.length > 0)
		syncEditors?.markDirty(workspacePendingWritePaths(result.writes));
	snapshotState.replaceWorkspaceSnapshot(optimisticSnapshot);
	recordWorkspaceEditHistory({
		edit,
		options,
		previousSnapshot,
		resultSnapshot: optimisticSnapshot,
		setWorkspaceHistory,
	});
}

function startWorkspaceEditPersistence(services: StartWorkspacePersistence) {
	const {
		analytics,
		edit,
		generation,
		optimisticSnapshot,
		previousSnapshot,
		repository,
		repositoryRequest,
		result,
		setFailedWrite,
		snapshotState,
		syncEditors,
		versions,
	} = services;
	const version = ++versions.latest.current;
	const paths = writePathKeys(result.writes);
	for (const path of paths) versions.byPath.current.set(path, version);
	const isCurrentWrite = () =>
		generation === syncEditors?.generation() &&
		paths.every((path) => versions.byPath.current.get(path) === version);
	void persistWorkspaceWrites({
		repository,
		repositoryRequest,
		isCurrentWrite,
		rollback: isOptimisticNoteListEdit(edit)
			? { edit, previous: previousSnapshot, optimistic: optimisticSnapshot }
			: undefined,
		setFailedWrite,
		setWorkspaceSnapshot: snapshotState.setWorkspaceSnapshot,
		workspaceSnapshotRef: snapshotState.workspaceSnapshotRef,
		writes: result.writes,
		clearFailure: () =>
			clearWorkspaceWriteFailure(
				snapshotState.workspaceSnapshotRef,
				snapshotState.setWorkspaceSnapshot,
			),
		onSaved: () =>
			trackSuccessfulMobileEdit(edit, result.writes.length, analytics.capture),
	});
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

function clearWorkspaceWriteFailure(
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
