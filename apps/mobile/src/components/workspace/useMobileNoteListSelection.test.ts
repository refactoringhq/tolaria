// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MobileNote } from "../../workspace/mobileWorkspaceModel";
import { useMobileNoteListBulkSelection } from "./useMobileNoteListSelection";

let root: ReturnType<typeof createRoot> | undefined;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(async () => {
	await act(async () => root?.unmount());
	vi.unstubAllGlobals();
});

describe("useMobileNoteListBulkSelection", () => {
	it("keeps selected note IDs when a background sync changes the visible list", async () => {
		const initialNotes = [note("one"), note("two")];
		const hook = await renderSelection(initialNotes);

		await act(async () => hook.current?.beginSelection("one"));
		expect(hook.current?.selectedNoteIds).toEqual(new Set(["one"]));

		await hook.render([
			note("one", "Updated title"),
			note("two"),
			note("three"),
		]);
		expect(hook.current?.selectedNoteIds).toEqual(new Set(["one"]));
	});
});

function note(id: string, title = id) {
	return { id, title } as MobileNote;
}

async function renderSelection(notes: MobileNote[]) {
	let currentNotes = notes;
	let current: ReturnType<typeof useMobileNoteListBulkSelection> | undefined;
	function Probe() {
		const selection = useMobileNoteListBulkSelection({
			bulkActions: {
				onArchive: () => {},
				onDelete: () => {},
				onOrganize: () => {},
			},
			neighborhood: null,
			notes: currentNotes,
			onSelectNote: () => {},
		});
		useEffect(() => {
			current = selection;
		}, [selection]);
		return null;
	}
	root = createRoot(document.createElement("div"));
	await act(async () => root?.render(createElement(Probe)));
	const render = async (nextNotes: MobileNote[]) => {
		currentNotes = nextNotes;
		await act(async () => root?.render(createElement(Probe)));
	};
	return {
		get current() {
			return current;
		},
		render,
	};
}
