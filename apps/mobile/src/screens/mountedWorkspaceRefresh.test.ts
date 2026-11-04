// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildLocalVaultWorkspaceSnapshot } from "../workspace/localVaultSnapshot";
import { MobileVaultProvider } from "../workspace/MobileVaultProvider";
import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import type { ReadOnlyWorkspaceRepository } from "../workspace/readOnlyWorkspaceRepository";
import { createWorkspaceSyncEditors } from "../workspace/workspaceSyncEditors";
import { useTabletWorkspaceNavigation } from "./tabletWorkspaceNavigation";
import { useWorkspaceEditPipeline } from "./tabletWorkspacePersistence";
import { useMobileNoteRead } from "./useMobileNoteRead";

const state = vi.hoisted(() => ({ manager: () => ({}) }));
const repositoryRequest = {
	source: "native" as const,
	vaultRootUri: "file:///owned",
};
vi.mock("../workspace/git/useMobileVaults", () => ({
	useMobileVaults: () => state.manager(),
}));
vi.mock("../settings/useMobileSettings", () => ({
	useMobileSettings: () => ({ open: vi.fn() }),
}));
vi.mock("../settings/MobileSettingsSheet", () => ({
	MobileSettingsSheet: () => null,
}));
vi.mock("../components/vaults/MobileVaultNotice", () => ({
	MobileVaultNotice: () => null,
}));
vi.mock("../components/workspace/MobileWorkspaceStartup", () => ({
	MobileWorkspaceStartup: ({ children }: { children: React.ReactNode }) =>
		children,
}));
vi.mock("../components/vaults/MobileWorkspaceLoadFailure", () => ({
	MobileWorkspaceLoadFailure: () => null,
}));

let root: ReturnType<typeof createRoot> | undefined;
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(async () => {
	await act(async () => root?.unmount());
	vi.unstubAllGlobals();
});

it("keeps search, selection, navigation history and the same list node across authoritative refresh", async () => {
	const h = harness();
	await h.render();
	const input = h.host.querySelector("input");
	await act(async () => h.current().navigation.selectNote("notes/first.md"));
	await act(async () => {
		h.current().setSearch("Second");
		h.current().navigation.selectNote("notes/second.md");
	});
	expect(h.current().navigation.canGoBack).toBe(true);
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	expect(h.host.querySelector("input")).toBe(input);
	expect(h.current().search).toBe("Second");
	expect(h.current().navigation.selectedNoteId).toBe("notes/second.md");
	expect(h.current().navigation.canGoBack).toBe(true);
	expect(h.current().pipeline.workspaceSnapshot.notes[0].title).toBe(
		"Fresh second",
	);
});

it("rejects old immediate callbacks after refresh but accepts the freshly published editor", async () => {
	const h = harness();
	await h.render();
	const oldApply = h.current().pipeline.applyWorkspaceEdit;
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	await act(async () => {
		await oldApply({
			type: "updateNoteContent",
			noteId: "notes/first.md",
			content: "# Stale\n",
		});
	});
	expect(h.repository.persistWrites).not.toHaveBeenCalled();
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((n) => n.id === "notes/first.md")
			?.title,
	).toBe("Fresh first");
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "updateNoteContent",
			noteId: "notes/first.md",
			content: "# Fresh edit\n",
		});
	});
	expect(h.repository.persistWrites).toHaveBeenCalledOnce();
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((n) => n.id === "notes/first.md")
			?.title,
	).toBe("Fresh edit");
});

it("does not reset local edits or undo on ordinary parent renders with a cloned input snapshot", async () => {
	const h = harness();
	await h.render();
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	expect(h.current().pipeline.canUndoWorkspaceEdit).toBe(true);
	await h.render({ ...snapshot("Unpublished", "Unpublished") });
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((n) => n.id === "notes/first.md")
			?.favorite,
	).toBe(true);
	expect(h.current().pipeline.canUndoWorkspaceEdit).toBe(true);
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	expect(h.current().pipeline.canUndoWorkspaceEdit).toBe(false);
});

it("does not let an old write failure poison a freshly prepared workspace", async () => {
	const h = harness();
	let rejectWrite: (error: Error) => void = () => {};
	vi.mocked(h.repository.persistWrites).mockImplementationOnce(
		() =>
			new Promise((_resolve, reject) => {
				rejectWrite = reject;
			}),
	);
	await h.render();
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	await act(async () => rejectWrite(new Error("old write failed")));
	expect(h.current().pipeline.workspaceSnapshot.sync.kind).toBe("synced");
});

it("projects a list action before its disk write finishes", async () => {
	const h = harness();
	let finishWrite: () => void = () => {};
	vi.mocked(h.repository.persistWrites).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishWrite = resolve;
			}),
	);
	await h.render();

	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});

	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find(
				(note) => note.id === "notes/first.md",
			)?.favorite,
	).toBe(true);
	expect(h.repository.persistWrites).toHaveBeenCalledOnce();
	await act(async () => finishWrite());
});

it("restores a deleted row and offers retry when its disk write fails", async () => {
	const h = harness();
	let rejectWrite: (error: Error) => void = () => {};
	vi.mocked(h.repository.persistWrites)
		.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectWrite = reject;
				}),
		)
		.mockResolvedValueOnce();
	await h.render();

	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "deleteNote",
			noteId: "notes/first.md",
		});
	});
	expect(workspaceNote(h, "notes/first.md")).toBeUndefined();

	await act(async () => rejectWrite(new Error("disk full")));

	expect(workspaceNote(h, "notes/first.md")).toBeDefined();
	expect(h.current().pipeline.workspaceSnapshot.sync.kind).toBe("writeFailed");
	expect(h.current().pipeline.retryFailedEdit).toBeTypeOf("function");

	await act(async () => {
		h.current().pipeline.retryFailedEdit?.();
		await Promise.resolve();
		await Promise.resolve();
	});

	expect(h.repository.persistWrites).toHaveBeenCalledTimes(2);
	expect(workspaceNote(h, "notes/first.md")).toBeUndefined();
	expect(h.current().pipeline.workspaceSnapshot.sync.kind).toBe("synced");
});

it("restores an archived note to the active list when the disk write fails", async () => {
	const h = harness();
	let rejectWrite: (error: Error) => void = () => {};
	vi.mocked(h.repository.persistWrites).mockImplementationOnce(
		() =>
			new Promise((_resolve, reject) => {
				rejectWrite = reject;
			}),
	);
	await h.render();

	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "setArchived",
			noteId: "notes/first.md",
			archived: true,
		});
	});
	expect(workspaceNote(h, "notes/first.md")?.archived).toBe(true);

	await act(async () => rejectWrite(new Error("disk full")));

	expect(workspaceNote(h, "notes/first.md")?.archived).toBe(false);
	expect(h.current().pipeline.workspaceSnapshot.sync.kind).toBe("writeFailed");
});

it("ignores a late failed write after a newer same-note edit has been persisted", async () => {
	const h = harness();
	let rejectFirstWrite: (error: Error) => void = () => {};
	vi.mocked(h.repository.persistWrites)
		.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectFirstWrite = reject;
				}),
		)
		.mockResolvedValueOnce();
	await h.render();

	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "setOrganized",
			noteId: "notes/first.md",
			organized: true,
		});
	});
	await act(async () => rejectFirstWrite(new Error("late failure")));

	const note = h
		.current()
		.pipeline.workspaceSnapshot.notes.find(
			(candidate) => candidate.id === "notes/first.md",
		);
	expect(note?.favorite).toBe(true);
	expect(note?.organized).toBe(true);
	expect(h.current().pipeline.workspaceSnapshot.sync.kind).toBe("synced");
});

it("discards obsolete hydration rather than applying its action to the fresh frame", async () => {
	const h = harness();
	let finishRead: (content: string) => void = () => {};
	vi.mocked(h.repository.readNoteContent).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishRead = resolve;
			}),
	);
	const lazy = snapshot("First", "Second");
	lazy.notes = lazy.notes.map((note) => ({ ...note, rawContent: undefined }));
	await h.render(lazy);
	let pending:
		| ReturnType<
				ReturnType<typeof useWorkspaceEditPipeline>["applyWorkspaceEdit"]
		  >
		| undefined;
	await act(async () => {
		pending = h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	await act(async () => {
		finishRead("# Old read\n");
		await pending;
	});
	expect(h.repository.persistWrites).not.toHaveBeenCalled();
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((n) => n.id === "notes/first.md")
			?.title,
	).toBe("Fresh first");
});

it("keeps cached native note content inert until an exact disk read completes", async () => {
	const h = harness();
	let finishRead: (content: string) => void = () => {};
	vi.mocked(h.repository.readNoteContent).mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishRead = resolve;
			}),
	);
	await h.render();

	expect(h.current().noteRead.status).toBe("loading");
	expect(h.repository.readNoteContent).toHaveBeenCalledOnce();
	const selectedId = h.current().navigation.selectedNoteId;
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((note) => note.id === selectedId)
			?.rawContent,
	).toBeDefined();

	await act(async () => finishRead("# Disk version\n"));

	expect(h.current().noteRead.status).toBe("ready");
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.notes.find((note) => note.id === selectedId)
			?.rawContent,
	).toBe("# Disk version\n");
});

it("keeps a note created during the network wait when fresh disk results include its persisted write", async () => {
	const h = harness();
	await h.render();
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "createNote",
			title: "During fetch",
		});
	});
	const createdId = h.current().pipeline.workspaceSnapshot.selectedNoteId;
	await act(async () => h.current().navigation.selectNote(createdId ?? null));
	const created = vi
		.mocked(h.repository.persistWrites)
		.mock.calls.flatMap(([writes]) => writes)
		.find((write) => write.kind === "createNote");
	if (created?.kind !== "createNote")
		throw new Error("Missing persisted new note");
	const fresh = snapshot("Remote first", "Remote second", [
		{ relativePath: created.path, content: created.content },
	]);
	await h.refresh(fresh);
	expect(h.current().navigation.selectedNoteId).toBe(createdId);
	expect(
		h
			.current()
			.pipeline.workspaceSnapshot.allNotes?.filter(
				(note) => note.id === createdId,
			),
	).toHaveLength(1);
	expect(h.current().navigation.selectedNote?.rawContent).toBe(created.content);
});

it("does not revive an invalidated editor before authoritative revision publication", async () => {
	const h = harness();
	await h.render();
	h.editors.beginReplacement();
	await h.render(snapshot("Not published", "Not published"));
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	expect(h.repository.persistWrites).not.toHaveBeenCalled();
	expect(h.current().pipeline.workspaceSnapshot.notes[0].title).toBe("Second");
});

it("does not offer a stale failed action for retry in the next workspace frame", async () => {
	const h = harness();
	const lazy = snapshot();
	lazy.notes = lazy.notes.map((note) => ({ ...note, rawContent: undefined }));
	vi.mocked(h.repository.readNoteContent).mockRejectedValueOnce(
		new Error("read unavailable"),
	);
	await h.render(lazy);
	await act(async () => {
		await h.current().pipeline.applyWorkspaceEdit({
			type: "toggleFavorite",
			noteId: "notes/first.md",
		});
	});
	const oldRetry = h.current().pipeline.retryFailedEdit;
	expect(oldRetry).toBeTypeOf("function");
	await h.refresh(snapshot("Fresh first", "Fresh second"));
	expect(h.current().pipeline.retryFailedEdit).toBeUndefined();
	await act(async () => oldRetry?.());
	expect(h.repository.persistWrites).not.toHaveBeenCalled();
});

function snapshot(
	first = "First",
	second = "Second",
	additional: { relativePath: string; content: string }[] = [],
): MobileWorkspaceSnapshot {
	const files = [
		{
			relativePath: "types/Note.md",
			content: "---\ntype: Type\n---\n# Note\n",
		},
		{ relativePath: "notes/first.md", content: `# ${first}\n` },
		{ relativePath: "notes/second.md", content: `# ${second}\n` },
		...additional,
	].map((file, index) => ({
		...file,
		absolutePath: `file:///owned/${file.relativePath}`,
		createdAt: index,
		modifiedAt: index,
		size: file.content.length,
	}));
	return buildLocalVaultWorkspaceSnapshot({
		files,
		vaultPath: "file:///owned",
		vaultAlias: "owned",
		vaultLabel: "Owned",
	});
}

function useProbe(
	repository: ReadOnlyWorkspaceRepository,
	source: MobileWorkspaceSnapshot,
) {
	const pipeline = useWorkspaceEditPipeline({
		repository,
		repositoryRequest,
		snapshot: source,
	});
	const [search, setSearch] = useState("");
	const navigation = useTabletWorkspaceNavigation(
		pipeline.workspaceSnapshot,
		search,
	);
	const noteRead = useMobileNoteRead({
		applyEdit: pipeline.applyWorkspaceEdit,
		note: navigation.selectedNote,
		repository,
		request: repositoryRequest,
	});
	return { pipeline, navigation, noteRead, search, setSearch };
}

function harness() {
	const host = document.createElement("div");
	root = createRoot(host);
	const editors = createWorkspaceSyncEditors();
	const manager = {
		active: { selection: { vaultRootUri: "file:///owned" }, git: null },
		editors,
		revision: 0,
		catalog: { pending: false, vaults: [], localVaults: [] },
		syncHistory: { record: {}, ready: true },
		notices: {},
	};
	state.manager = () => manager;
	const repository: ReadOnlyWorkspaceRepository = {
		persistWrites: vi.fn(async () => {}),
		readNoteContent: vi.fn(async (note) => note.rawContent ?? null),
		readSnapshot: vi.fn(() => snapshot()),
	};
	let latest: ReturnType<typeof useProbe> | undefined;
	function Probe({ source }: { source: MobileWorkspaceSnapshot }) {
		const value = useProbe(repository, source);
		useEffect(() => {
			latest = value;
		}, [value]);
		return createElement("input", {
			value: value.search,
			onChange: (event) => value.setSearch(event.currentTarget.value),
		});
	}
	const render = async (source = snapshot()) => {
		await act(async () =>
			root?.render(
				createElement(
					MobileVaultProvider,
					null,
					createElement(Probe, { source }),
				),
			),
		);
	};
	return {
		host,
		repository,
		render,
		editors,
		current: () => {
			if (!latest) throw new Error("Probe not mounted");
			return latest;
		},
		refresh: async (source: MobileWorkspaceSnapshot) => {
			editors.beginReplacement();
			manager.revision++;
			await render(source);
		},
	};
}

function workspaceNote(h: ReturnType<typeof harness>, noteId: string) {
	return h
		.current()
		.pipeline.workspaceSnapshot.notes.find((note) => note.id === noteId);
}
