import { describe, expect, it, vi } from "vitest";
import { workspaceScenarioForId } from "../fixtures/workspaceFixtures";
import * as mobileDocumentContent from "../workspace/mobileDocumentContent";
import { mobileNoteEditableContent } from "../workspace/mobileDocumentContent";
import {
	applyMobileWorkspaceEdit,
	type MobileWorkspaceEdit,
} from "../workspace/mobileWorkspaceEditing";
import {
	emptyMobileWorkspaceHistory,
	mobileWorkspaceHistoryEntry,
	recordMobileWorkspaceHistory,
} from "./tabletWorkspaceHistory";
import {
	applyHistoryEdits,
	historyRoundTripWithWrites,
	isUpdateNoteContentEdit,
	neverEdit,
	noteById,
	noteByIdOptional,
	relationshipTargetHistorySnapshot,
	requiredHistoryEntry,
	snapshotWithEditableNote,
} from "./tabletWorkspaceHistoryTestFixtures";

describe("tablet workspace editing history", () => {
	it("offers byte-exact delete restoration with an undo feedback action", () => {
		const rawContent =
			"---\ntitle: Exact restore\ntags: [one]\n---\nBody stays byte exact.\n";
		const previousSnapshot = snapshotWithEditableNote({
			id: "workflow-orchestration",
			rawContent,
		});
		const deletion = {
			noteId: "workflow-orchestration",
			type: "deleteNote" as const,
		};
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, deletion);
		const entry = mobileWorkspaceHistoryEntry(
			previousSnapshot,
			nextSnapshot,
			deletion,
		);
		expect(entry?.feedbackAction).toBe("deleted");
		expect(entry).not.toBeNull();
		const restoredSnapshot = applyMobileWorkspaceEdit(nextSnapshot, {
			edits: entry?.undoEdits ?? [],
			type: "bulkEdit",
		});
		expect(
			noteById(restoredSnapshot, "workflow-orchestration").rawContent,
		).toBe(rawContent);
	});

	it("records reversible markdown content edits from workspace snapshots", () => {
		const originalContent =
			"# Workflow Orchestration Essay\n\nOriginal body.\n";
		const previousSnapshot = snapshotWithEditableNote({
			id: "workflow-orchestration",
			rawContent: originalContent,
		});
		const nextContent = "# Workflow Orchestration Essay\n\nUpdated body.\n";
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, {
			content: nextContent,
			noteId: "workflow-orchestration",
			type: "updateNoteContent",
		});

		const entry = mobileWorkspaceHistoryEntry(previousSnapshot, nextSnapshot);

		expect(entry).toEqual({
			redoEdits: [
				{
					content: nextContent,
					noteId: "workflow-orchestration",
					type: "updateNoteContent",
				},
			],
			undoEdits: [
				{
					content: originalContent,
					noteId: "workflow-orchestration",
					type: "updateNoteContent",
				},
			],
		});
		expect(
			noteById(
				applyMobileWorkspaceEdit(
					nextSnapshot,
					entry?.undoEdits[0] ?? neverEdit(),
				),
				"workflow-orchestration",
			).rawContent,
		).toBe(originalContent);
	});

	it("records text file edits without converting them into markdown notes", () => {
		const previousSnapshot = snapshotWithEditableNote({
			fileKind: "text",
			id: "workflow-orchestration",
			rawContent: "plain=true\n",
		});
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, {
			content: "plain=false\n",
			noteId: "workflow-orchestration",
			type: "updateTextFileContent",
		});

		const entry = mobileWorkspaceHistoryEntry(previousSnapshot, nextSnapshot);

		expect(entry?.undoEdits).toEqual([
			{
				content: "plain=true\n",
				noteId: "workflow-orchestration",
				type: "updateTextFileContent",
			},
		]);
		expect(entry?.redoEdits).toEqual([
			{
				content: "plain=false\n",
				noteId: "workflow-orchestration",
				type: "updateTextFileContent",
			},
		]);
	});

	it("records fixture editor-block edits when raw content has not been hydrated yet", () => {
		const previousSnapshot = workspaceScenarioForId("default");
		const selectedNote = noteById(previousSnapshot, "workflow-orchestration");
		const content = mobileNoteEditableContent({
			...selectedNote,
			editorBlocks: previousSnapshot.editorBlocks,
			editorBullets: previousSnapshot.editorBullets,
		});
		const nextContent = content.replace("lower-priority", "quiet");
		const edit = {
			content: nextContent,
			noteId: "workflow-orchestration",
			type: "updateNoteContent",
		} as const;
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, edit);

		const entry = mobileWorkspaceHistoryEntry(
			previousSnapshot,
			nextSnapshot,
			edit,
		);

		const undoEdit = entry?.undoEdits.find(isUpdateNoteContentEdit);
		const redoEdit = entry?.redoEdits.find(isUpdateNoteContentEdit);

		expect(undoEdit).toMatchObject({
			noteId: "workflow-orchestration",
			type: "updateNoteContent",
		});
		expect(undoEdit?.content).toContain("lower-priority chrome");
		expect(redoEdit?.content).toContain("quiet chrome");
	});

	it("does not record hydration or structural edits without stable loaded content", () => {
		const previousSnapshot = workspaceScenarioForId("default");
		const hydratedSnapshot = applyMobileWorkspaceEdit(previousSnapshot, {
			noteId: "workflow-orchestration",
			rawContent: "# Workflow Orchestration Essay\n\nLoaded body.\n",
			type: "hydrateNoteContent",
		});
		const renamedSnapshot = applyMobileWorkspaceEdit(
			snapshotWithEditableNote({
				id: "workflow-orchestration",
				rawContent: "# Workflow Orchestration Essay\n\nLoaded body.\n",
			}),
			{
				filenameStem: "renamed-workflow",
				noteId: "workflow-orchestration",
				type: "renameNoteFile",
			},
		);

		expect(
			mobileWorkspaceHistoryEntry(previousSnapshot, hydratedSnapshot, {
				noteId: "workflow-orchestration",
				rawContent: "# Workflow Orchestration Essay\n\nLoaded body.\n",
				type: "hydrateNoteContent",
			}),
		).toBeNull();
		expect(
			mobileWorkspaceHistoryEntry(previousSnapshot, renamedSnapshot),
		).toBeNull();
	});

	it("appends new edits to the past stack and clears redo history", () => {
		const entry = {
			redoEdits: [
				{
					content: "next",
					noteId: "workflow-orchestration",
					type: "updateNoteContent" as const,
				},
			],
			undoEdits: [
				{
					content: "previous",
					noteId: "workflow-orchestration",
					type: "updateNoteContent" as const,
				},
			],
		};
		const history = recordMobileWorkspaceHistory(
			{
				future: [entry],
				past: [],
			},
			entry,
		);

		expect(history).toEqual({
			future: [],
			past: [entry],
		});
		expect(
			recordMobileWorkspaceHistory(emptyMobileWorkspaceHistory, null),
		).toBe(emptyMobileWorkspaceHistory);
	});

	it("undoes and redoes created notes with the exact created markdown", () => {
		const previousSnapshot = workspaceScenarioForId("default");
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, {
			title: "Mobile Structural History",
			type: "createNote",
		});
		const entry = requiredHistoryEntry(previousSnapshot, nextSnapshot, {
			title: "Mobile Structural History",
			type: "createNote",
		});

		const undoneSnapshot = applyHistoryEdits(nextSnapshot, entry.undoEdits);
		const redoneSnapshot = applyHistoryEdits(undoneSnapshot, entry.redoEdits);

		expect(
			noteByIdOptional(undoneSnapshot, "mobile-structural-history.md"),
		).toBeNull();
		expect(
			noteById(redoneSnapshot, "mobile-structural-history.md").rawContent,
		).toBe("---\ntitle: Mobile Structural History\ntype: Note\n---\n");
	});

	it("records creation history without serializing unrelated large-vault notes", () => {
		const previousSnapshot = workspaceScenarioForId("default");
		const seed = previousSnapshot.allNotes?.[0] ?? previousSnapshot.notes[0];
		const notes = Array.from({ length: 6_000 }, (_, index) => ({
			...seed,
			id: `large-vault-${index}.md`,
			path: `large-vault-${index}.md`,
			rawContent: undefined,
		}));
		const largeSnapshot = {
			...previousSnapshot,
			allNotes: notes,
			notes,
		};
		const nextSnapshot = applyMobileWorkspaceEdit(largeSnapshot, {
			title: "New during reload",
			type: "createNote",
		});
		const serializeNote = vi.spyOn(
			mobileDocumentContent,
			"mobileNoteEditableContent",
		);

		const entry = mobileWorkspaceHistoryEntry(largeSnapshot, nextSnapshot, {
			title: "New during reload",
			type: "createNote",
		});

		expect(serializeNote).not.toHaveBeenCalled();
		expect(entry?.undoEdits).toContainEqual({
			noteId: nextSnapshot.selectedNoteId,
			type: "deleteNote",
		});
		serializeNote.mockRestore();
	});

	it("undoes and redoes relationship target creation as one command", () => {
		const previousSnapshot = relationshipTargetHistorySnapshot();
		const edit: MobileWorkspaceEdit = {
			key: "related_to",
			sourceNoteId: "workflow-orchestration",
			targetTitle: "New Dependency",
			type: "createRelationshipTarget",
		};
		const nextSnapshot = applyMobileWorkspaceEdit(previousSnapshot, edit);
		const entry = requiredHistoryEntry(previousSnapshot, nextSnapshot, edit);
		const undoneSnapshot = applyHistoryEdits(nextSnapshot, entry.undoEdits);
		const redoneSnapshot = applyHistoryEdits(undoneSnapshot, entry.redoEdits);

		expect(
			noteByIdOptional(undoneSnapshot, "Tolaria/Mobile UI/new-dependency.md"),
		).toBeNull();
		expect(noteById(undoneSnapshot, "workflow-orchestration").rawContent).toBe(
			"# Workflow Orchestration Essay\n\nSource body.\n",
		);
		expect(
			noteById(redoneSnapshot, "Tolaria/Mobile UI/new-dependency.md")
				.rawContent,
		).toBe("---\ntitle: New Dependency\ntype: Note\n---\n");
		expect(
			noteById(redoneSnapshot, "workflow-orchestration").rawContent,
		).toContain('related_to:\n  - "[[Tolaria/Mobile UI/new-dependency]]"');
	});

	it("persists relationship target undo and redo write plans", () => {
		const sourcePath = "Tolaria/Mobile UI/Workflow Orchestration Essay.md";
		const targetPath = "Tolaria/Mobile UI/new-dependency.md";
		const { redoWrites, undoWrites } = historyRoundTripWithWrites(
			relationshipTargetHistorySnapshot(),
			{
				key: "related_to",
				sourceNoteId: "workflow-orchestration",
				targetTitle: "New Dependency",
				type: "createRelationshipTarget",
			},
		);

		expect(undoWrites).toEqual([
			{
				content: "# Workflow Orchestration Essay\n\nSource body.\n",
				kind: "saveNote",
				path: sourcePath,
			},
			{ kind: "deleteNote", path: targetPath },
		]);
		expect(redoWrites).toEqual([
			{
				content: expect.stringContaining(
					'related_to:\n  - "[[Tolaria/Mobile UI/new-dependency]]"',
				),
				kind: "saveNote",
				path: sourcePath,
			},
			{
				content: "---\ntitle: New Dependency\ntype: Note\n---\n",
				kind: "createNote",
				path: targetPath,
			},
		]);
	});
});
