import { describe, expect, it } from "vitest";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import { visibleWeeks } from "./calendarDates";
import {
	DAY_HEADER_PX,
	LANE_GAP_PX,
	MORE_BUTTON_PX,
	measurableLanes,
	type StackMeasure,
	stackWeek,
} from "./calendarLanes";
import { partitionEntries, weekSegments } from "./calendarModel";

const sources = { dateProperty: "start", endDateProperty: "end" };
const week = visibleWeeks("2026-11-19", "week", 1)[0];
const WEDNESDAY = 2;
/** The day number row and the week row's bottom border. */
const ROW_CHROME_PX = DAY_HEADER_PX + 1;

function note(name: string, start: string, end?: string) {
	return makeEntry({
		path: `/v/${name}.md`,
		title: name,
		properties: end ? { start, end } : { start },
	});
}

function notesOn(day: string, prefix: string, count: number) {
	return Array.from({ length: count }, (_, index) =>
		note(`${prefix} ${index}`, day),
	);
}

function stack(
	entries: ReturnType<typeof note>[],
	available: number,
	heights: Record<string, number> = {},
) {
	const { items } = partitionEntries(entries, sources, new Map());
	const measure: StackMeasure = {
		available,
		heights: new Map(
			Object.entries(heights).map(([name, height]) => [
				`/v/${name}.md`,
				height,
			]),
		),
	};
	return stackWeek(weekSegments(items, week), week, measure);
}

function titles(layout: ReturnType<typeof stack>) {
	return layout.visible.map(({ segment }) => segment.item.entry.title);
}

/** Room for `heights` stacked with their gaps, plus `extra` pixels. */
function roomFor(heights: number[], extra = 0): number {
	const stack = heights.reduce((total, height) => total + height, 0);
	return stack + Math.max(0, heights.length - 1) * LANE_GAP_PX + 4 + extra;
}

describe("calendar week stacking", () => {
	it("stacks a day's cards top to bottom at their natural height", () => {
		const layout = stack(notesOn("2026-11-18", "Busy", 2), 200, {
			"Busy 0": 26,
			"Busy 1": 58,
		});
		expect(layout.visible.map(({ top }) => top)).toEqual([0, 26 + LANE_GAP_PX]);
		expect(layout.overflow).toEqual([]);
	});

	it("shows three short cards when they fit, but fewer tall cards with properties", () => {
		const room = roomFor([26, 26, 26]);
		expect(titles(stack(notesOn("2026-11-18", "Busy", 3), room))).toHaveLength(
			3,
		);
		const tall = { "Busy 0": 58, "Busy 1": 58, "Busy 2": 58 };
		const layout = stack(notesOn("2026-11-18", "Busy", 3), room, tall);
		expect(titles(layout)).toEqual(["Busy 0"]);
		expect(layout.overflow).toEqual([
			{ day: "2026-11-18", column: WEDNESDAY, count: 2, top: 58 + LANE_GAP_PX },
		]);
	});

	it('folds only what does not fit into "+N more", under the last shown card', () => {
		const room = roomFor([26, 26], LANE_GAP_PX + MORE_BUTTON_PX);
		const layout = stack(notesOn("2026-11-18", "Busy", 5), room);
		expect(titles(layout)).toEqual(["Busy 0", "Busy 1"]);
		expect(layout.hiddenCounts).toEqual([0, 0, 3, 0, 0, 0, 0]);
		expect(layout.overflow).toEqual([
			{ day: "2026-11-18", column: WEDNESDAY, count: 3, top: 2 * 29 },
		]);
	});

	it("keeps a short day from inheriting the tall cards of the next day", () => {
		const room = roomFor([26, 26, 26, 26]);
		const tall = { "Tall 0": 80, "Tall 1": 80 };
		const layout = stack(
			[
				...notesOn("2026-11-18", "Short", 4),
				...notesOn("2026-11-19", "Tall", 2),
			],
			room,
			tall,
		);
		expect(
			titles(layout).filter((title) => title.startsWith("Short")),
		).toHaveLength(4);
	});

	it("starts a bar under the lowest card of the days it covers, without half-showing it", () => {
		const entries = [
			...notesOn("2026-11-18", "Busy", 5),
			note("Launch", "2026-11-19", "2026-11-24"),
		];
		const layout = stack(
			entries,
			roomFor([26, 26], LANE_GAP_PX + MORE_BUTTON_PX),
		);
		expect(titles(layout)).toEqual(["Busy 0", "Busy 1", "Launch"]);
		expect(layout.visible.at(-1)?.top).toBe(0);
		const bridging = [
			note("Early", "2026-11-17"),
			note("Bar", "2026-11-17", "2026-11-18"),
		];
		const bars = stack(bridging, 200, { Early: 40 });
		expect(
			bars.visible.map(({ segment, top }) => [segment.item.entry.title, top]),
		).toEqual([
			["Bar", 0],
			["Early", 26 + LANE_GAP_PX],
		]);
	});

	it('hides a bar behind "+N more" on every day it covers when one of them is full', () => {
		const entries = [
			note("Bar", "2026-11-17", "2026-11-18"),
			...notesOn("2026-11-18", "Busy", 1),
		];
		const layout = stack(entries, roomFor([40], LANE_GAP_PX + MORE_BUTTON_PX), {
			Bar: 70,
		});
		expect(titles(layout)).toEqual(["Busy 0"]);
		expect(layout.hiddenCounts.slice(1, 3)).toEqual([1, 1]);
	});

	it("falls back to three one-line cards before the row is measured", () => {
		const layout = stack(notesOn("2026-11-18", "Busy", 6), 0);
		expect(titles(layout)).toHaveLength(3);
		expect(layout.overflow[0].count).toBe(3);
		expect(layout.minHeight).toBe(0);
	});

	it("measures only the lanes that could start inside the row", () => {
		expect(measurableLanes(0)).toBe(4);
		expect(measurableLanes(60)).toBe(4);
		expect(measurableLanes(600)).toBeGreaterThan(20);
	});
});

describe("calendar week minimum height", () => {
	it("is zero for an empty week", () => {
		expect(stack([], 100).minHeight).toBe(0);
	});

	it("always has room for two stacked cards at their natural height", () => {
		const two = stack(notesOn("2026-11-18", "Busy", 2), 50, {
			"Busy 0": 26,
			"Busy 1": 58,
		});
		expect(two.minHeight).toBe(ROW_CHROME_PX + roomFor([26, 58]));
		const one = stack(notesOn("2026-11-18", "Busy", 1), 50, { "Busy 0": 40 });
		expect(one.minHeight).toBe(ROW_CHROME_PX + roomFor([40]));
	});

	it('adds "+N more" under the two cards when a day holds more', () => {
		const layout = stack(notesOn("2026-11-18", "Busy", 3), 50);
		expect(layout.minHeight).toBe(
			ROW_CHROME_PX + roomFor([26, 26], LANE_GAP_PX + MORE_BUTTON_PX),
		);
	});
});
