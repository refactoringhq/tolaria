import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { isMobileNoteHydration } from "../workspace/mobileNoteRead";
import { createMobilePreparedEdits } from "../workspace/mobilePreparedEdits";
import type {
	MobileWorkspaceEdit,
	MobileWorkspaceEditResult,
} from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import type {
	ReadOnlyWorkspaceRepository,
	ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import {
	type createWorkspaceSyncEditors,
	useWorkspaceSyncEditor,
	WorkspaceSyncEditorsContext,
} from "../workspace/workspaceSyncEditors";

export type WorkspaceEditOptions = { recordHistory?: boolean };
type EditApplier = (
	edit: MobileWorkspaceEdit,
	options?: WorkspaceEditOptions,
) => MobileWorkspaceEditResult;
type SnapshotRef = { current: MobileWorkspaceSnapshot };
type FailedEdit = {
	edit: MobileWorkspaceEdit;
	options: WorkspaceEditOptions;
	frame: SnapshotRef;
};
type PreparedQueue = {
	queue: ReturnType<typeof createMobilePreparedEdits>;
	frame: SnapshotRef;
};
type EditServices = {
	alive: { current: boolean };
	generation: number | undefined;
	latestApply: { current: EditApplier };
	prepared: { current: PreparedQueue | null };
	setFailed: (failure: FailedEdit | null) => void;
	snapshotRef: SnapshotRef;
	syncEditors: ReturnType<typeof createWorkspaceSyncEditors> | null;
};
type QueueOptions = Pick<
	EditServices,
	"generation" | "latestApply" | "snapshotRef" | "syncEditors"
> & {
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
};

export function usePreparedWorkspaceEdits({
	applyEdit,
	repository,
	repositoryRequest,
	snapshotRef,
	generation,
}: {
	applyEdit: EditApplier;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	snapshotRef: SnapshotRef;
	generation: number | undefined;
}) {
	const syncEditors = useContext(WorkspaceSyncEditorsContext);
	const alive = useRef(true);
	const latestApply = useRef(applyEdit);
	useEffect(() => {
		latestApply.current = applyEdit;
	}, [applyEdit]);
	const [failed, setFailed] = useState<FailedEdit | null>(null);
	const prepared = usePreparedEditQueue({
		generation,
		latestApply,
		repository,
		repositoryRequest,
		snapshotRef,
		syncEditors,
	});
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	useWorkspaceSyncEditor(async () => {
		await prepared.current?.queue.whenIdle();
		return () => {};
	});

	const apply = useCallback(
		(edit: MobileWorkspaceEdit, options: WorkspaceEditOptions = {}) =>
			runPreparedEdit(
				{
					alive,
					generation,
					latestApply,
					prepared,
					setFailed,
					snapshotRef,
					syncEditors,
				},
				edit,
				options,
			),
		[generation, prepared, snapshotRef, syncEditors],
	);
	const currentFailure = failed?.frame === snapshotRef ? failed : null;
	const retry = useCallback(() => {
		if (currentFailure) void apply(currentFailure.edit, currentFailure.options);
	}, [apply, currentFailure]);
	return { apply, retryFailedEdit: currentFailure ? retry : undefined };
}

function usePreparedEditQueue(options: QueueOptions) {
	const {
		generation,
		latestApply,
		repository,
		repositoryRequest,
		snapshotRef,
		syncEditors,
	} = options;
	const prepared = useRef<PreparedQueue | null>(null);
	useEffect(() => {
		let current = true;
		const queue = createMobilePreparedEdits({
			apply: (edit) => latestApply.current(edit),
			isCurrent: () => current && generation === syncEditors?.generation(),
			read: (note) => repository.readNoteContent(note, repositoryRequest),
			snapshot: () => snapshotRef.current,
			source: repositoryRequest?.source,
		});
		prepared.current = { queue, frame: snapshotRef };
		return () => {
			current = false;
			if (prepared.current?.queue === queue) prepared.current = null;
		};
	}, [
		generation,
		latestApply,
		repository,
		repositoryRequest,
		snapshotRef,
		syncEditors,
	]);
	return prepared;
}

function activeQueue(services: EditServices) {
	if (!services.alive.current) return null;
	if (services.generation !== services.syncEditors?.generation()) return null;
	const current = services.prepared.current;
	return current?.frame === services.snapshotRef ? current : null;
}

async function runPreparedEdit(
	services: EditServices,
	edit: MobileWorkspaceEdit,
	options: WorkspaceEditOptions,
) {
	if (edit.type === "createNote")
		return services.latestApply.current(edit, options);
	const current = activeQueue(services);
	if (!current) return null;
	try {
		const result = await current.queue.apply(edit, () =>
			services.latestApply.current(edit, options),
		);
		if (activeQueue(services) !== current) return null;
		if (!isMobileNoteHydration(edit)) services.setFailed(null);
		return result;
	} catch {
		if (activeQueue(services) === current)
			services.setFailed({ edit, options, frame: services.snapshotRef });
		return null;
	}
}
