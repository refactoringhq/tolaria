import { describe, expect, it } from "vitest";
import {
	clampGraphNumber,
	colorGroupsFrom,
	DEFAULT_GRAPH_FILTERS,
	DEFAULT_GRAPH_SETTINGS,
	defaultGraphForces,
	GRAPH_NUMBER_RANGES,
	graphSettingsFrom,
	hasGraphSettings,
} from "./graphSettings";

describe("graphSettings", () => {
	it("defaults every setting and serializes defaults like a read-back", () => {
		expect(DEFAULT_GRAPH_SETTINGS).toMatchObject({
			...DEFAULT_GRAPH_FILTERS,
			showLabels: true,
			showArrows: false,
			colorGroups: [],
			centerForce: 0.5,
			repelForce: 10,
			linkForce: 1,
			linkDistance: 80,
			textFadeThreshold: 0,
		});
		expect(JSON.stringify(graphSettingsFrom({}))).toBe(
			JSON.stringify(DEFAULT_GRAPH_SETTINGS),
		);
	});

	it("reads saved forces, display and search, clamping numbers into range", () => {
		const settings = graphSettingsFrom({
			repelForce: 99,
			linkDistance: -5,
			centerForce: "strong",
			nodeSizeScale: 2,
			showArrows: true,
			search: "type:Project",
		});
		expect(settings.repelForce).toBe(GRAPH_NUMBER_RANGES.repelForce.max);
		expect(settings.linkDistance).toBe(GRAPH_NUMBER_RANGES.linkDistance.min);
		expect(settings.centerForce).toBe(0.5);
		expect(settings.nodeSizeScale).toBe(2);
		expect(settings.showArrows).toBe(true);
		expect(settings.search).toBe("type:Project");
	});

	it("keeps well-formed color groups in order and drops broken ones", () => {
		expect(
			colorGroupsFrom([
				{ id: "a", query: "type:Person", color: "blue" },
				{ query: "Alpha" },
				"nope",
				{ id: "c", color: "red" },
			]),
		).toEqual([
			{ id: "a", query: "type:Person", color: "blue" },
			{ id: "group-1", query: "Alpha", color: "" },
		]);
		expect(colorGroupsFrom("x")).toEqual([]);
	});

	it("restores only the forces", () => {
		expect(defaultGraphForces()).toEqual({
			centerForce: 0.5,
			repelForce: 10,
			linkForce: 1,
			linkDistance: 80,
		});
	});

	it("clamps numbers and spots stored graph settings", () => {
		expect(clampGraphNumber("linkForce", Number.NaN)).toBe(1);
		expect(clampGraphNumber("linkForce", 0.25)).toBe(0.25);
		expect(hasGraphSettings({ repelForce: 3 })).toBe(true);
		expect(hasGraphSettings({ groupBy: "status" })).toBe(false);
	});
});
