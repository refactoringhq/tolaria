import { describe, expect, it, vi } from "vitest";
import {
	mobileNoteContextActions,
	runMobileNoteContextAction,
} from "./mobileNoteContextMenuModel";

describe("mobile note context menu", () => {
	it("offers row actions and only offers selection when bulk selection is available", () => {
		expect(
			mobileNoteContextActions({
				archived: false,
				favorite: false,
				selectionEnabled: false,
			}).map(({ id }) => id),
		).toEqual(["favorite", "archive", "move", "delete"]);
		expect(
			mobileNoteContextActions({
				archived: true,
				favorite: true,
				selectionEnabled: true,
			}).map(({ id }) => id),
		).toEqual(["favorite", "archive", "move", "delete", "select"]);
		expect(
			mobileNoteContextActions({
				archived: true,
				favorite: true,
				selectionEnabled: true,
			})[4].title,
		).toBe("select");
	});

	it("routes each native action through the existing note-list callbacks", () => {
		const callbacks = {
			noteId: "n-1",
			actions: {
				onArchive: vi.fn(),
				onDelete: vi.fn(),
				onOrganize: vi.fn(),
				onToggleFavorite: vi.fn(),
			},
			archived: false,
			onBeginSelection: vi.fn(),
		};
		for (const action of ["favorite", "archive", "move", "delete", "select"]) {
			runMobileNoteContextAction(action, callbacks);
		}
		expect(callbacks.actions.onToggleFavorite).toHaveBeenCalledWith("n-1");
		expect(callbacks.actions.onArchive).toHaveBeenCalledWith(["n-1"], true);
		expect(callbacks.actions.onOrganize).toHaveBeenCalledWith(["n-1"]);
		expect(callbacks.actions.onDelete).toHaveBeenCalledWith(["n-1"]);
		expect(callbacks.onBeginSelection).toHaveBeenCalledWith("n-1");
	});
});
