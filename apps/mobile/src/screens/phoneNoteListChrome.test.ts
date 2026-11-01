import { describe, expect, it } from "vitest";
import { shouldShowPhoneNoteListTitle } from "./phoneNoteListChrome";

describe("phone note-list title chrome", () => {
	it("shows the compact title only after the large title scrolls away", () => {
		expect(shouldShowPhoneNoteListTitle(0)).toBe(false);
		expect(shouldShowPhoneNoteListTitle(96)).toBe(false);
		expect(shouldShowPhoneNoteListTitle(97)).toBe(true);
	});
});
