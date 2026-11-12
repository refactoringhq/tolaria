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
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import { MobileVaultPickerContext } from "../workspace/MobileVaultContext";
import { withDefaultNoteType } from "../workspace/mobileDefaultNoteType";
import { requestCreatedNoteFocus } from "../workspace/mobileEditorFocus";
import {
	isMobileNoteHydration,
	mobileEditNeedsNoteRead,
} from "../workspace/mobileNoteRead";
import { workspacePendingWritePaths } from "../workspace/mobilePendingChanges";
import {
	type MobileWorkspaceActionFeedback,
	mobileWorkspaceActionFeedback,
} from "../workspace/mobileWorkspaceActionFeedback";
import {
	applyMobileWorkspaceEditWithWrites,
	type MobileWorkspaceEdit,
} from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import { requestForStaleNativeCreate } from "../workspace/mobileWorkspaceSnapshotEdits";
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
} from "./tabletWorkspaceHistory";
import {
	clearWorkspaceWriteFailure,
	recordWorkspaceEditHistory,
	useWorkspaceHistoryControls,
} from "./tabletWorkspacePersistenceHistory";
import {
	usePreparedWorkspaceEdits,
	type WorkspaceEditOptions,
} from "./usePreparedWorkspaceEdits";
import { useWorkspaceSnapshotFrame } from "./useWorkspaceSnapshotFrame";

type WorkspaceHistory = typeof emptyMobileWorkspaceHistory;
type WorkspaceHistorySetter = Dispatch<SetStateAction<WorkspaceHistory>>;
type MobileVaultPicker = ContextType<typeof MobileVaultPickerContext>;
type FailedWorkspaceWrite = { edit: MobileWorkspaceEdit };
type WorkspaceUndoFeedback = {
	action: MobileWorkspaceActionFeedback;
	id: object;
} | null;
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
	setLatestUndoFeedback: Dispatch<SetStateAction<WorkspaceUndoFeedback>>;
	setWorkspaceHistory: WorkspaceHistorySetter;
};
type WorkspaceEditActionsInput = {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	snapshotState: ReturnType<typeof useWorkspaceSnapshotFrame>;
	setWorkspaceHistory: WorkspaceHistorySetter;
	workspaceHistory: WorkspaceHistory;
};
type WorkspaceEditApplierInput = Omit<
	WorkspaceEditActionsInput,
	"workspaceHistory"
>;

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

function useWorkspaceEditActions(input: WorkspaceEditActionsInput) {
	const {
		repository,
		repositoryRequest,
		snapshotState,
		setWorkspaceHistory,
		workspaceHistory,
	} = input;
	const {
		apply: applyEdit,
		clearFailedWrite,
		failedWrite,
		latestUndoFeedback,
	} = useWorkspaceEditApplier({
		...input,
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
		failedWorkspaceAction: mobileWorkspaceActionFeedback(failedWrite?.edit),
		latestUndoFeedback,
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
}: WorkspaceEditApplierInput) {
	const analytics = useMobileAnalytics();
	const syncEditors = useContext(WorkspaceSyncEditorsContext);
	const [failedWrite, setFailedWrite] = useState<FailedWorkspaceWrite | null>(
		null,
	);
	const [latestUndoFeedback, setLatestUndoFeedback] =
		useState<WorkspaceUndoFeedback>(null);
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
				setLatestUndoFeedback,
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
			setLatestUndoFeedback,
			setWorkspaceHistory,
			snapshotState,
			syncEditors,
		],
	);
	const clearFailedWrite = useCallback(() => setFailedWrite(null), []);
	return { apply, clearFailedWrite, failedWrite, latestUndoFeedback };
}

function applyWorkspaceEditNow(services: ApplyWorkspaceEditServices) {
	const previousSnapshot = services.snapshotState.workspaceSnapshotRef.current;
	const generation = services.syncEditors?.generation();
	const rebasedRequest = requestForStaleNativeCreate(
		services.edit,
		previousSnapshot,
		services.repositoryRequest,
	);
	const staleGeneration = !isWorkspaceEditGenerationCurrent(
		services.generation,
		services.syncEditors,
	);
	logWorkspaceEditGeneration(
		services,
		previousSnapshot,
		generation,
		staleGeneration,
	);
	if (staleGeneration && !rebasedRequest)
		return { snapshot: previousSnapshot, writes: [] };
	return applyCurrentWorkspaceEdit(
		staleGeneration
			? { ...services, generation, repositoryRequest: rebasedRequest }
			: services,
		previousSnapshot,
	);
}

function logWorkspaceEditGeneration(
	services: ApplyWorkspaceEditServices,
	snapshot: MobileWorkspaceSnapshot,
	generation: number | undefined,
	staleGeneration: boolean,
) {
	logMobileMotionEvent("workspace-edit-generation", {
		currentGeneration: generation ?? -1,
		editGeneration: services.generation ?? -1,
		editType: services.edit.type,
		nativeSource: services.repositoryRequest?.source === "native",
		snapshotSource: snapshot.source?.kind ?? "unknown",
		staleGeneration,
		vaultPathMatches:
			snapshot.source?.vaultPath === services.repositoryRequest?.vaultRootUri,
	});
}

function applyCurrentWorkspaceEdit(
	services: ApplyWorkspaceEditServices,
	previousSnapshot: MobileWorkspaceSnapshot,
) {
	services.setFailedWrite(null);
	const { result, optimisticSnapshot } = createOptimisticEditResult(
		previousSnapshot,
		services.edit,
		services.repositoryRequest?.source,
	);
	if (services.edit.type === "createNote")
		logMobileMotionEvent("workspace-create-result", {
			previousNoteCount: previousSnapshot.notes.length,
			nextNoteCount: optimisticSnapshot.notes.length,
			selectedNote: optimisticSnapshot.selectedNoteId ?? "",
			writeCount: result.writes.length,
		});
	publishAndPersistOptimisticEdit(
		services,
		previousSnapshot,
		optimisticSnapshot,
		result,
	);
	return result;
}

function publishAndPersistOptimisticEdit(
	services: ApplyWorkspaceEditServices,
	previousSnapshot: MobileWorkspaceSnapshot,
	optimisticSnapshot: MobileWorkspaceSnapshot,
	result: ReturnType<typeof applyWorkspaceEditToWritableSnapshot>,
) {
	const {
		analytics,
		edit,
		generation,
		repository,
		repositoryRequest,
		setFailedWrite,
		setLatestUndoFeedback,
		setWorkspaceHistory,
		snapshotState,
		syncEditors,
		versions,
		options,
	} = services;
	const historyEntry = publishOptimisticWorkspaceEdit({
		edit,
		options,
		previousSnapshot,
		setWorkspaceHistory,
		optimisticSnapshot,
		result,
		snapshotState,
		syncEditors,
	});
	updateLatestUndoFeedback(setLatestUndoFeedback, historyEntry);
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
}

function updateLatestUndoFeedback(
	setLatestUndoFeedback: Dispatch<SetStateAction<WorkspaceUndoFeedback>>,
	historyEntry: MobileWorkspaceHistoryEntry | null,
) {
	setLatestUndoFeedback(
		historyEntry?.feedbackAction
			? { action: historyEntry.feedbackAction, id: historyEntry }
			: null,
	);
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
	return recordWorkspaceEditHistory({
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
