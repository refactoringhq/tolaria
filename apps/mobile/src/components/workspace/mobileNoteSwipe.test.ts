import { describe, expect, it } from "vitest";
import { mobileNoteListPrimarySwipeAction } from "./mobileNoteListRows";
import {
	fullSwipeNoteAction,
	mobileNoteSwipeActionOrder,
	mobileNoteSwipeSecondaryActionWidth,
} from "./mobileNoteSwipe";

describe("note row full swipe", () => {
	it("shows Organize instead of Archive as Inbox's trailing action", () => {
		expect(mobileNoteSwipeActionOrder("organize")).toEqual([
			"favorite",
			"delete",
			"organize",
		]);
		expect(mobileNoteSwipeActionOrder("archive")).toEqual([
			"favorite",
			"delete",
			"archive",
		]);
	});

	it("reveals buttons without committing on partial swipes", () => {
		expect(fullSwipeNoteAction(120, 340)).toBeNull();
		expect(fullSwipeNoteAction(-150, 340)).toBeNull();
	});

	it("reserves right swipes for navigation and only commits archive on a full left swipe", () => {
		expect(fullSwipeNoteAction(260, 340)).toBeNull();
		expect(fullSwipeNoteAction(-260, 340)).toBe("archive");
		expect(fullSwipeNoteAction(-1000, 340)).toBe("archive");
	});

	it("uses organize as the full-swipe action when the list selects it", () => {
		expect(fullSwipeNoteAction(-260, 340, "organize")).toBe("organize");
	});

	it("selects organize only for the Inbox list", () => {
		expect(mobileNoteListPrimarySwipeAction("inbox", null)).toBe("organize");
		expect(mobileNoteListPrimarySwipeAction("inbox", "folder-1")).toBe(
			"archive",
		);
		expect(mobileNoteListPrimarySwipeAction("type-1", null)).toBe("archive");
	});

	it("scales the threshold with the measured row and waits for layout", () => {
		expect(fullSwipeNoteAction(260, 600)).toBeNull();
		expect(fullSwipeNoteAction(450, 600)).toBeNull();
		expect(fullSwipeNoteAction(-450, 600)).toBe("archive");
		expect(fullSwipeNoteAction(450, 0)).toBeNull();
	});

	it("keeps secondary actions hidden after a full swipe settles to the shorter action tray", () => {
		expect(mobileNoteSwipeSecondaryActionWidth(-260, 340, "organize")).toBe(0);
		expect(
			mobileNoteSwipeSecondaryActionWidth(-216, 340, "organize", true),
		).toBe(0);
		expect(
			mobileNoteSwipeSecondaryActionWidth(-216, 340, "organize", false),
		).toBe(72);
	});
});
