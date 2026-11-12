import { expect, it, vi } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import { sameFrameIdentity } from "./useWorkspaceSnapshotFrame";
import { createWorkspaceSnapshotFrame } from "./workspaceSnapshotFrame";

it("replaces a workspace frame when startup preview is resolved", () => {
	const identity = {
		editors: null,
		revision: 3,
		root: "file:///vault",
		startupPreview: true,
	};

	expect(sameFrameIdentity(identity, identity)).toBe(true);
	expect(
		sameFrameIdentity(identity, { ...identity, startupPreview: false }),
	).toBe(false);
	expect(sameFrameIdentity(identity, { ...identity })).toBe(true);
});

it("keeps a stable snapshot until state changes and synchronizes its current reference before notification", () => {
	const snapshot = workspaceScenarioForId("default");
	const frame = createWorkspaceSnapshotFrame(snapshot, 3);
	const initial = frame.getSnapshot();
	const listener = vi.fn(() =>
		expect(frame.workspaceSnapshotRef.current).toBe(
			frame.getSnapshot().workspaceSnapshot,
		),
	);
	const unsubscribe = frame.subscribe(listener);
	expect(frame.getSnapshot()).toBe(initial);
	frame.setWorkspaceSnapshot(snapshot);
	expect(listener).not.toHaveBeenCalled();
	frame.setWorkspaceSnapshot((previous) => ({
		...previous,
		sync: { kind: "writeFailed" },
	}));
	expect(listener).toHaveBeenCalledOnce();
	expect(frame.generation).toBe(3);
	expect(frame.getSnapshot()).not.toBe(initial);
	unsubscribe();
	frame.setWorkspaceSnapshot(snapshot);
	expect(listener).toHaveBeenCalledOnce();
});

it("keeps history immutable and isolates late completions in a retired frame", () => {
	const original = createWorkspaceSnapshotFrame(
		workspaceScenarioForId("default"),
	);
	const fresh = createWorkspaceSnapshotFrame(
		workspaceScenarioForId("empty-inbox"),
		1,
	);
	const listener = vi.fn();
	fresh.subscribe(listener);
	original.setWorkspaceHistory((previous) => ({
		...previous,
		past: [{ undoEdits: [], redoEdits: [] }],
	}));
	original.setWorkspaceSnapshot((previous) => ({
		...previous,
		sync: { kind: "writeFailed" },
	}));
	expect(fresh.getSnapshot().workspaceHistory.past).toEqual([]);
	expect(fresh.getSnapshot().workspaceSnapshot.sync.kind).not.toBe(
		"writeFailed",
	);
	expect(listener).not.toHaveBeenCalled();
	const history = original.getSnapshot().workspaceHistory;
	const originalListener = vi.fn();
	original.subscribe(originalListener);
	original.setWorkspaceHistory(history);
	expect(originalListener).not.toHaveBeenCalled();
});
