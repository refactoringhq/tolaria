import { describe, expect, it } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import { requestForStaleNativeCreate } from "../workspace/mobileWorkspaceSnapshotEdits";
import { rollbackFailedNoteListWrites } from "./mobileWorkspaceFlagWriteRollback";
import { applyWorkspaceEditToWritableSnapshot } from "./tabletWorkspacePersistence";

describe("applyWorkspaceEditToWritableSnapshot", () => {
	it("rebases a delayed native create onto the currently active vault", () => {
		const snapshot = {
			...workspaceScenarioForId("default"),
			source: {
				kind: "localVault" as const,
				label: "QA vault",
				totalNotes: 1,
				visibleNotes: 1,
				vaultPath: "file:///qa-vault",
			},
		};
		const createNote = { type: "createNote" as const, title: "" };

		expect(
			requestForStaleNativeCreate(createNote, snapshot, {
				source: "native",
				vaultRootUri: "file:///old-vault",
			}),
		).toMatchObject({ source: "native", vaultRootUri: "file:///qa-vault" });
		expect(
			requestForStaleNativeCreate(
				{ type: "toggleFavorite", noteId: "note.md" },
				snapshot,
				{ source: "native", vaultRootUri: "file:///qa-vault" },
			),
		).toBeUndefined();
	});

	it("does not create transient content before a native vault is selected", () => {
		const snapshot = {
			...workspaceScenarioForId("empty"),
			sync: { kind: "noVault" as const },
		};

		const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
			type: "createNote",
			title: "",
		});

		expect(result).toEqual({ snapshot, writes: [] });
	});

	it("does not create transient content through a read-only vault bridge", () => {
		const snapshot = {
			...workspaceScenarioForId("default"),
			sync: { kind: "readOnly" as const },
		};

		const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
			type: "createNote",
			title: "",
		});

		expect(result).toEqual({ snapshot, writes: [] });
	});

	it("applies edits once the workspace is writable", () => {
		const snapshot = workspaceScenarioForId("empty");

		const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
			type: "createNote",
			title: "",
		});

		expect(result.snapshot.notes).toHaveLength(snapshot.notes.length + 1);
		expect(result.writes).toHaveLength(2);
		expect(result.writes[1]).toMatchObject({
			kind: "createNote",
			path: "note.md",
		});
	});

	it("restores only the failed optimistic note flag without overwriting newer snapshot changes", () => {
		const fixture = workspaceScenarioForId("default");
		const previous = {
			...fixture,
			notes: fixture.notes.map((candidate) => ({
				...candidate,
				rawContent: `---\ntype: ${candidate.type}\n---\n# ${candidate.title}\n`,
			})),
		};
		const note = previous.notes[0];
		const optimistic = applyWorkspaceEditToWritableSnapshot(previous, {
			edits: [{ noteId: note.id, organized: true, type: "setOrganized" }],
			type: "bulkEdit",
		});
		const other = optimistic.snapshot.notes[1];
		const current = {
			...optimistic.snapshot,
			notes: optimistic.snapshot.notes.map((candidate) =>
				candidate.id === other.id
					? { ...candidate, title: "Newer title" }
					: candidate,
			),
		};

		const rollback = rollbackFailedNoteListWrites(
			current,
			previous,
			optimistic.snapshot,
			optimistic.writes,
		);
		const rolledBack = rollback.snapshot;

		expect(optimistic.writes).toHaveLength(1);
		expect(
			rolledBack.notes.find((candidate) => candidate.id === note.id),
		).toEqual(note);
		expect(
			rolledBack.notes.find((candidate) => candidate.id === other.id)?.title,
		).toBe("Newer title");
	});
});
