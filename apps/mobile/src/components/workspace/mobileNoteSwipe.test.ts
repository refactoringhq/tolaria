import { describe, expect, it } from "vitest";
import { mobileNoteListPrimarySwipeAction } from "./mobileNoteListRows";
import {
	fullSwipeNoteAction,
	mobileNoteSwipeActionOrder,
	mobileNoteSwipePrimaryActionWidth,
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

	it("keeps the trailing buttons at their rest width until the tray is fully open", () => {
		expect(mobileNoteSwipeSecondaryActionWidth(-120, 340, "organize")).toBe(72);
		expect(mobileNoteSwipeSecondaryActionWidth(-216, 340, "organize")).toBe(72);
	});

	it("shrinks trailing buttons continuously so the primary action can track the drag", () => {
		const mid = mobileNoteSwipeSecondaryActionWidth(-278, 340, "organize");
		const later = mobileNoteSwipeSecondaryActionWidth(-310, 340, "organize");
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(72);
		expect(later).toBeGreaterThan(0);
		expect(later).toBeLessThan(mid);
		expect(mobileNoteSwipeSecondaryActionWidth(-340, 340, "organize")).toBe(0);
		// Crossing the commit threshold must not snap the trailing buttons away.
		const aroundThreshold = mobileNoteSwipeSecondaryActionWidth(
			-231,
			340,
			"organize",
		);
		expect(aroundThreshold).toBeGreaterThan(50);
		expect(aroundThreshold).toBeLessThan(72);
	});

	it("grows the primary action continuously with the swipe offset, without a one-frame jump", () => {
		const widths: number[] = [];
		for (let offset = 0; offset <= 340; offset += 4) {
			widths.push(mobileNoteSwipePrimaryActionWidth(-offset, 340, "organize"));
		}
		for (let index = 1; index < widths.length; index += 1) {
			expect(widths[index]).toBeGreaterThanOrEqual(widths[index - 1] - 0.01);
			expect(widths[index] - widths[index - 1]).toBeLessThanOrEqual(12);
		}
		expect(widths[0]).toBe(0);
		expect(widths.at(-1)).toBe(340);
	});

	it("finishes a committed swipe by following the exit offset, without popping the trailing buttons", () => {
		// Release past the threshold, then the exit animation carries the row to
		// the edge in small steps. Each step must stay small for both widths.
		let previousSecondary = mobileNoteSwipeSecondaryActionWidth(-280, 340, "organize");
		let previousPrimary = mobileNoteSwipePrimaryActionWidth(-280, 340, "organize");
		expect(previousSecondary).toBeGreaterThan(0);
		for (let offset = 284; offset <= 340; offset += 4) {
			const secondary = mobileNoteSwipeSecondaryActionWidth(-offset, 340, "organize");
			const primary = mobileNoteSwipePrimaryActionWidth(-offset, 340, "organize");
			expect(previousSecondary - secondary).toBeLessThanOrEqual(12);
			expect(secondary).toBeLessThanOrEqual(previousSecondary);
			expect(primary - previousPrimary).toBeLessThanOrEqual(24);
			previousSecondary = secondary;
			previousPrimary = primary;
		}
		expect(previousSecondary).toBe(0);
		expect(previousPrimary).toBe(340);
	});
});
