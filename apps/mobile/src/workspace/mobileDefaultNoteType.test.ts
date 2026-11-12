import { expect, it, vi } from "vitest";
import { applyWorkspaceEditToWritableSnapshot } from "../screens/tabletWorkspacePersistence";
import { buildLocalVaultWorkspaceSnapshot } from "./localVaultSnapshot";
import type { MobileWorkspaceSnapshot } from "./mobileWorkspaceModel";
import * as noteContent from "./mobileWorkspaceNoteContent";

function vault(files: Record<string, string> = {}): MobileWorkspaceSnapshot {
	return buildLocalVaultWorkspaceSnapshot({
		files: Object.entries(files).map(([relativePath, content]) => ({
			absolutePath: `/tmp/default-type-qa/${relativePath}`,
			relativePath,
			content,
			size: content.length,
			createdAt: null,
			modifiedAt: null,
		})),
		vaultLabel: "Default type QA",
		vaultPath: "/tmp/default-type-qa",
	});
}

it("creates the missing Note definition with the first new note and reloads it from the write plan", () => {
	const result = applyWorkspaceEditToWritableSnapshot(vault(), {
		type: "createNote",
		title: "",
	});
	expect(result.snapshot.typeDefinitions?.Note?.path).toBe("note.md");
	expect(result.writes).toHaveLength(2);
	const persisted: Record<string, string> = {};
	for (const write of result.writes) {
		expect(write.kind).toBe("createNote");
		if (write.kind === "createNote") persisted[write.path] = write.content;
	}
	const restored = vault(persisted);
	expect(restored.typeDefinitions?.Note?.path).toBe("note.md");
	expect(restored.notes.some((note) => note.rawContent?.includes("# \n"))).toBe(
		true,
	);
});

it("does not re-derive existing note bodies while creating the first Note definition", () => {
	const base = buildLocalVaultWorkspaceSnapshot({
		files: [
			{
				absolutePath: "/tmp/default-type-qa/essay.md",
				relativePath: "essay.md",
				content: "---\ntype: Essay\n---\n# Essay\n\nBody",
				size: 35,
				createdAt: null,
				modifiedAt: null,
			},
		],
		vaultLabel: "Default type QA",
		vaultPath: "/tmp/default-type-qa",
	});
	const notes = Array.from({ length: 6000 }, (_, index) => ({
		...base.notes[0],
		id: `essay-${index}.md`,
		path: `essay-${index}.md`,
		rawContent: `---\ntype: Essay\n---\n# Essay ${index}\n\nBody`,
	}));
	const snapshot = { ...base, allNotes: notes, notes: notes.slice(0, 24) };
	const derive = vi.spyOn(noteContent, "deriveMobileNote");

	const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "createNote",
		title: "",
	});

	expect(result.writes).toHaveLength(2);
	expect(derive).toHaveBeenCalledTimes(1);
	expect(result.snapshot.allNotes?.[1]).toMatchObject({
		rawContent: notes[0].rawContent,
		title: notes[0].title,
	});
});

it("does not recreate the definition on subsequent note creation", () => {
	const result = applyWorkspaceEditToWritableSnapshot(vault(), {
		type: "createNote",
		title: "",
	});
	const next = applyWorkspaceEditToWritableSnapshot(result.snapshot, {
		type: "createNote",
		title: "",
	});
	expect(next.writes).toHaveLength(1);
	expect(next.writes[0]).not.toMatchObject({ path: "note.md" });
});

it("preserves existing Note definitions, including custom legacy paths and settings", () => {
	const content =
		"---\ntype: Type\n_color: red\n_sidebar_label: Thoughts\n---\n# Note\n\nCustom content.\n";
	const snapshot = vault({ "types/custom-note.md": content });
	const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "createNote",
		title: "",
	});
	expect(result.snapshot.typeDefinitions?.Note).toEqual(
		snapshot.typeDefinitions?.Note,
	);
	expect(result.writes).toHaveLength(1);
	expect(
		result.writes.every(
			(write) => !("path" in write) || write.path !== "types/custom-note.md",
		),
	).toBe(true);
});

it("recognizes an existing case-equivalent definition", () => {
	const snapshot = vault({ "custom.md": "---\ntype: Type\n---\n# note\n" });
	const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "createNote",
		title: "",
	});
	expect(result.snapshot.typeDefinitions).toEqual(snapshot.typeDefinitions);
	expect(result.writes).toHaveLength(1);
});

it("bootstraps once for a batch and preserves the selected new note", () => {
	const result = applyWorkspaceEditToWritableSnapshot(vault(), {
		type: "bulkEdit",
		edits: [
			{ type: "createNote", title: "First" },
			{ type: "createNote", title: "Second" },
		],
	});
	expect(result.writes).toHaveLength(3);
	expect(
		result.writes.filter(
			(write) => "path" in write && write.path === "note.md",
		),
	).toHaveLength(1);
	expect(
		result.snapshot.notes.find(
			(note) => note.id === result.snapshot.selectedNoteId,
		)?.title,
	).toBe("Second");
});

it("never overwrites an ordinary note occupying the default definition path", () => {
	const content = "# Personal content\n\nKeep this unchanged.\n";
	const snapshot = vault({ "note.md": content });
	const result = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "createNote",
		title: "",
	});
	expect(
		result.writes.every(
			(write) => !("path" in write) || write.path !== "note.md",
		),
	).toBe(true);
	expect(
		result.snapshot.allNotes?.find((note) => note.path === "note.md")
			?.rawContent,
	).toBe(content);
});

it.each(["noVault", "readOnly"] as const)(
	"does not bootstrap definitions for %s workspaces",
	(kind) => {
		const snapshot = { ...vault(), sync: { kind } };
		expect(
			applyWorkspaceEditToWritableSnapshot(snapshot, {
				type: "createNote",
				title: "",
			}),
		).toEqual({ snapshot, writes: [] });
	},
);

it("does not bootstrap when creation fails or when only editing an existing note", () => {
	const snapshot = vault({ "existing.md": "# Existing\n" });
	const failed = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "createNote",
		title: "Existing",
	});
	expect(failed.writes).toEqual([]);
	const edited = applyWorkspaceEditToWritableSnapshot(snapshot, {
		type: "updateNoteContent",
		noteId: "existing.md",
		content: "# Existing\n\nEdited.\n",
	});
	expect(edited.writes).toHaveLength(1);
	expect(edited.snapshot.typeDefinitions?.Note).toBeUndefined();
});
