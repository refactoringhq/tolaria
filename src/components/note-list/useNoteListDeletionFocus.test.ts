import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	allSelection,
	makeIndexedEntry,
} from "../../test-utils/noteListTestUtils";
import { useNoteListDeletionFocus } from "./useNoteListDeletionFocus";

const notes = [0, 1, 2, 3].map((index) => makeIndexedEntry(index));

function setup(visible = notes) {
	const openNote = vi.fn();
	const focusList = vi.fn();
	const initialProps = {
		entries: notes,
		visible,
		selection: allSelection,
		loading: false,
	};
	const hook = renderHook(
		(props) => useNoteListDeletionFocus({ ...props, openNote, focusList }),
		{ initialProps },
	);
	return { ...hook, initialProps, openNote, focusList };
}

describe("note list focus after deletion", () => {
	it("reuses the vault path index when callback identities change", () => {
		const entries = [...notes];
		const map = vi.spyOn(entries, "map");
		const openNote = vi.fn();
		const initialFocusList = vi.fn();
		const initialProps = {
			entries,
			visible: entries,
			selection: allSelection,
			loading: false,
			focusList: initialFocusList,
		};
		const hook = renderHook(
			(props) => useNoteListDeletionFocus({ ...props, openNote }),
			{ initialProps },
		);

		hook.rerender({
			...initialProps,
			focusList: vi.fn(),
		});

		expect(map).toHaveBeenCalledOnce();
	});

	it("opens the next note using the filtered, sorted visible order", () => {
		const hook = setup([notes[3], notes[1], notes[0]]);
		hook.rerender({
			...hook.initialProps,
			entries: [notes[0], notes[2], notes[3]],
			visible: [notes[3], notes[0]],
		});
		expect(hook.openNote).toHaveBeenCalledExactlyOnceWith(notes[0]);
	});

	it("opens the previous note when the last visible note is deleted", () => {
		const hook = setup([notes[2], notes[0]]);
		hook.rerender({
			...hook.initialProps,
			entries: notes.slice(1),
			visible: [notes[2]],
		});
		expect(hook.openNote).toHaveBeenCalledExactlyOnceWith(notes[2]);
	});

	it("keeps an empty list empty", () => {
		const hook = setup([notes[0]]);
		hook.rerender({
			...hook.initialProps,
			entries: notes.slice(1),
			visible: [],
		});
		expect(hook.openNote).not.toHaveBeenCalled();
	});

	it("skips every deleted note in a batch", () => {
		const hook = setup();
		hook.rerender({
			...hook.initialProps,
			entries: [notes[0], notes[3]],
			visible: [notes[0], notes[3]],
		});
		expect(hook.openNote).toHaveBeenCalledExactlyOnceWith(notes[3]);
	});

	it("does not change selection for filtering, sorting, or a sidebar switch", () => {
		const hook = setup();
		hook.rerender({ ...hook.initialProps, visible: [notes[3], notes[0]] });
		hook.rerender({
			...hook.initialProps,
			entries: [],
			visible: [],
			selection: { kind: "filter", filter: "inbox" },
		});
		expect(hook.openNote).not.toHaveBeenCalled();
	});

	it("leaves selection to the rename flow when a path is replaced", () => {
		const hook = setup();
		const renamed = makeIndexedEntry(4, { title: notes[0].title });
		const entries = [renamed, ...notes.slice(1)];
		hook.rerender({ ...hook.initialProps, entries, visible: entries });
		expect(hook.openNote).not.toHaveBeenCalled();
	});

	it("restores keyboard focus after opening the replacement", async () => {
		const hook = setup();
		hook.rerender({
			...hook.initialProps,
			entries: notes.slice(1),
			visible: notes.slice(1),
		});
		await act(
			() =>
				new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
		);
		expect(hook.focusList).toHaveBeenCalledOnce();
		expect(hook.openNote.mock.invocationCallOrder[0]).toBeLessThan(
			hook.focusList.mock.invocationCallOrder[0],
		);
	});
});
