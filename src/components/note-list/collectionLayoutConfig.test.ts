import { describe, expect, it } from "vitest";
import { isWritableGroupKey, readStoredLayout } from "./collectionLayoutConfig";

describe("collectionLayoutConfig", () => {
	it("only writes Kanban drops to single-line keys the board notes already carry", () => {
		expect(isWritableGroupKey("status", ["status", "owner"])).toBe(true);
		expect(isWritableGroupKey("priority", ["status"])).toBe(false);
		expect(isWritableGroupKey("", [""])).toBe(false);
		expect(isWritableGroupKey(" status", [" status"])).toBe(false);
		expect(isWritableGroupKey("status\nowner: x", ["status\nowner: x"])).toBe(
			false,
		);
		expect(isWritableGroupKey("Due date", ["Due date"])).toBe(true);
		expect(isWritableGroupKey("belongs_to", ["belongs_to"])).toBe(true);
		for (const yamlSyntax of [
			"owner: x",
			"[status]",
			"{status}",
			"#status",
			"status # note",
			"&anchor",
			"*alias",
			"'status'",
			'"status"',
			"a|b",
			"a>b",
			"-status",
		]) {
			expect(isWritableGroupKey(yamlSyntax, [yamlSyntax])).toBe(false);
		}
		for (const lineBreak of ["\u0085", "\u2028", "\u2029"]) {
			const key = `status${lineBreak}owner: x`;
			expect(isWritableGroupKey(key, [key])).toBe(false);
		}
	});

	it("defaults missing or invalid layout fields defensively", () => {
		expect(
			readStoredLayout({
				type: "kanban",
				groupBy: 7,
				properties: ["owner", 3],
				columnOrder: "Done",
			}),
		).toEqual({
			layout: "kanban",
			groupBy: "status",
			properties: ["owner"],
			showProperties: true,
			columnOrder: [],
			collapsedColumns: [],
			hiddenColumns: [],
			graph: {
				showWikiLinks: true,
				hiddenRelationships: [],
				hiddenTypes: [],
				showOrphans: true,
				showLabels: true,
			},
			calendar: {
				dateProperty: null,
				endDateProperty: null,
				view: "month",
				showWeekends: true,
				showIcons: true,
			},
		});
		expect(readStoredLayout({ type: "timeline" })).toBeUndefined();
		expect(readStoredLayout(["kanban"])).toBeUndefined();
	});

	it("sanitizes Kanban column settings", () => {
		expect(
			readStoredLayout({
				type: "kanban",
				collapsedColumns: ["Done", 4, ""],
				hiddenColumns: "Doing",
			}),
		).toMatchObject({ collapsedColumns: ["Done", ""], hiddenColumns: [] });
	});

	it("keeps calendar display settings from stored layouts", () => {
		expect(
			readStoredLayout({
				type: "calendar",
				dateProperty: "due",
				view: "year",
				showWeekends: "no",
			}),
		).toMatchObject({
			layout: "calendar",
			calendar: {
				dateProperty: "due",
				endDateProperty: null,
				view: "year",
				showWeekends: true,
				showIcons: true,
			},
		});
		expect(
			readStoredLayout({
				type: "graph",
				showWikiLinks: false,
				hiddenRelationships: ["owner", 2],
				showOrphans: "no",
				showLabels: false,
			}),
		).toMatchObject({
			layout: "graph",
			graph: {
				showWikiLinks: false,
				hiddenRelationships: ["owner"],
				hiddenTypes: [],
				showOrphans: true,
				showLabels: false,
			},
		});
	});

	it("keeps per-collection item-property visibility when loading saved layouts", () => {
		expect(
			readStoredLayout({ type: "kanban", showProperties: false }),
		).toMatchObject({
			layout: "kanban",
			showProperties: false,
		});
		expect(
			readStoredLayout({ type: "calendar", showProperties: false }),
		).toMatchObject({
			layout: "calendar",
			showProperties: false,
		});
	});

	it("sanitizes graph filters from stored layouts", () => {
		expect(
			readStoredLayout({
				type: "graph",
				showWikiLinks: false,
				hiddenRelationships: ["owner", 2],
				showOrphans: "no",
				showLabels: false,
			}),
		).toMatchObject({
			layout: "graph",
			graph: {
				showWikiLinks: false,
				hiddenRelationships: ["owner"],
				hiddenTypes: [],
				showOrphans: true,
				showLabels: false,
			},
		});
	});
});
