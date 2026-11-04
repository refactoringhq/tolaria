import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { captureMobileError } from "../analytics/mobileCrashChannel";
import type {
	MobileWorkspaceEdit,
	MobileWorkspaceWrite,
} from "../workspace/mobileWorkspaceEditing";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import type {
	ReadOnlyWorkspaceRepository,
	ReadOnlyWorkspaceRequest,
} from "../workspace/readOnlyWorkspaceRepository";
import {
	type OptimisticNoteListRollback,
	rollbackFailedNoteListWrites,
} from "./mobileWorkspaceFlagWriteRollback";

type SnapshotRef = MutableRefObject<MobileWorkspaceSnapshot>;
type SnapshotSetter = Dispatch<SetStateAction<MobileWorkspaceSnapshot>>;
type FailedWriteSetter = Dispatch<
	SetStateAction<{ edit: MobileWorkspaceEdit } | null>
>;

export type WorkspaceWritePersistence = {
	clearFailure: () => void;
	isCurrentWrite: () => boolean;
	onSaved: () => void;
	repository: ReadOnlyWorkspaceRepository;
	repositoryRequest?: ReadOnlyWorkspaceRequest;
	rollback?: OptimisticNoteListRollback;
	setFailedWrite: FailedWriteSetter;
	setWorkspaceSnapshot: SnapshotSetter;
	workspaceSnapshotRef: SnapshotRef;
	writes: MobileWorkspaceWrite[];
};

export async function persistWorkspaceWrites(
	services: WorkspaceWritePersistence,
) {
	const {
		clearFailure,
		isCurrentWrite,
		onSaved,
		repository,
		repositoryRequest,
		rollback,
		setFailedWrite,
		setWorkspaceSnapshot,
		workspaceSnapshotRef,
		writes,
	} = services;
	try {
		await repository.persistWrites(writes, repositoryRequest);
		onSaved();
		if (isCurrentWrite()) clearFailure();
	} catch (error) {
		captureMobileError(error, "persistence");
		if (!isCurrentWrite()) return;
		markWorkspaceWriteFailed({
			workspaceSnapshotRef,
			setWorkspaceSnapshot,
			setFailedWrite,
			rollback,
			writes,
		});
	}
}

export function writePathKeys(writes: MobileWorkspaceWrite[]) {
	return [
		...new Set(
			writes.flatMap((write) =>
				"path" in write
					? [write.path, ...("toPath" in write ? [write.toPath] : [])]
					: ["vault-config"],
			),
		),
	];
}

export function snapshotAfterPendingWriteFailure(
	snapshot: MobileWorkspaceSnapshot,
	hasWrites: boolean,
) {
	return hasWrites && snapshot.sync.kind === "writeFailed"
		? { ...snapshot, sync: { kind: "synced" as const, minutesAgo: 0 } }
		: snapshot;
}

function markWorkspaceWriteFailed({
	workspaceSnapshotRef,
	setWorkspaceSnapshot,
	setFailedWrite,
	rollback,
	writes,
}: {
	workspaceSnapshotRef: SnapshotRef;
	setWorkspaceSnapshot: SnapshotSetter;
	setFailedWrite: FailedWriteSetter;
	rollback?: OptimisticNoteListRollback;
	writes: MobileWorkspaceWrite[];
}) {
	setWorkspaceSnapshot((current) => {
		const rollbackResult = rollback
			? rollbackFailedNoteListWrites(
					current,
					rollback.previous,
					rollback.optimistic,
					writes,
				)
			: { snapshot: current, fullyRolledBack: false };
		setFailedWrite(
			rollback && rollbackResult.fullyRolledBack
				? { edit: rollback.edit }
				: null,
		);
		const failedSnapshot = {
			...rollbackResult.snapshot,
			sync: { kind: "writeFailed" as const },
		};
		workspaceSnapshotRef.current = failedSnapshot;
		return failedSnapshot;
	});
}
