import { describe, expect, it } from "vitest";
import { statusSortRank } from "./noteSort";

describe("statusSortRank (TOL-466)", () => {
	it("ranks known statuses the same regardless of case", () => {
		expect(statusSortRank("active")).toBe(statusSortRank("Active"));
		expect(statusSortRank("done")).toBe(statusSortRank("Done"));
		expect(statusSortRank("active")).toBeLessThan(statusSortRank("done"));
	});

	it("ranks unknown or missing statuses last", () => {
		expect(statusSortRank("someday")).toBeGreaterThan(
			statusSortRank("finished"),
		);
		expect(statusSortRank(null)).toBe(statusSortRank("someday"));
	});
});
