import { describe, expect, it } from "vitest";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import { laneHeightFor } from "./calendarLanes";

describe("calendar item lane sizing", () => {
	it("reserves enough room for a wrapped title and visible fields", () => {
		const entry = makeEntry({
			title:
				"Interview with Samantha Rivera about the next generation of collaborative writing workflows",
			properties: { status: "In progress", owner: "Ada Lovelace" },
		});
		const laneHeight = laneHeightFor(
			[{ entry, start: "2026-11-20", end: "2026-11-20" }],
			{ cardProperties: ["status", "owner"], typeEntryMap: {} },
		);

		expect(laneHeight).toBeGreaterThan(150);
	});
});
