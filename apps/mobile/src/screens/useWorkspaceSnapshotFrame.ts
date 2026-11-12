import { useContext, useState, useSyncExternalStore } from "react";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import { isStartupPreviewSnapshot } from "../workspace/workspaceSnapshotPreview";
import type { createWorkspaceSyncEditors } from "../workspace/workspaceSyncEditors";
import {
	WorkspaceSnapshotRevisionContext,
	WorkspaceSyncEditorsContext,
} from "../workspace/workspaceSyncEditors";
import { createWorkspaceSnapshotFrame } from "./workspaceSnapshotFrame";

type FrameIdentity = {
	editors: ReturnType<typeof createWorkspaceSyncEditors> | null;
	revision: number;
	root?: string | null;
	startupPreview: boolean;
};

/** Revision publication follows the existing save/recovery/preparation barrier. */
export function useWorkspaceSnapshotFrame(
	snapshot: MobileWorkspaceSnapshot,
	root?: string | null,
) {
	const revision = useContext(WorkspaceSnapshotRevisionContext);
	const editors = useContext(WorkspaceSyncEditorsContext);
	const identity = {
		revision,
		root,
		editors,
		startupPreview: isStartupPreviewSnapshot(snapshot),
	};
	const [current, setCurrent] = useState(() => ({
		identity,
		frame: createWorkspaceSnapshotFrame(snapshot, editors?.generation()),
	}));
	if (!sameFrameIdentity(current.identity, identity)) {
		setCurrent({
			identity,
			frame: createWorkspaceSnapshotFrame(snapshot, editors?.generation()),
		});
	}
	const { frame } = current;
	const state = useSyncExternalStore(
		frame.subscribe,
		frame.getSnapshot,
		frame.getSnapshot,
	);
	return { ...frame, ...state };
}

export function sameFrameIdentity(
	previous: FrameIdentity,
	next: FrameIdentity,
) {
	if (previous.revision !== next.revision) return false;
	if (previous.root !== next.root) return false;
	return (
		previous.editors === next.editors &&
		previous.startupPreview === next.startupPreview
	);
}
