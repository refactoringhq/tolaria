import { afterEach, describe, expect, it } from "vitest";
import { makeEntry } from "../test-utils/noteListTestUtils";
import type { ViewDefinition, ViewFile } from "../types";
import { collectionFromSelection } from "./collectionFromSelection";
import { getCollectionLayout, getCollectionLayouts } from "./layoutRegistry";
import { presentationFromViewDefinition } from "./presentationConfig";
import { DEFAULT_GRAPH_SETTINGS } from "./graphSettings";

function emptyFilters(): ViewDefinition["filters"] {
	return { all: [] };
}

function makeView(definition: Partial<ViewDefinition> = {}): ViewFile {
	return {
		filename: "active-projects.yml",
		definition: {
			name: "Active Projects",
			icon: null,
			color: null,
			sort: "modified:desc",
			listPropertiesDisplay: ["status"],
			filters: emptyFilters(),
			...definition,
		},
	};
}

describe("collectionFromSelection", () => {
	it("registers List, Kanban and Calendar through the shared layout contract", () => {
		expect(getCollectionLayouts().map((layout) => layout.type)).toEqual([
			"list",
			"kanban",
			"calendar",
		]);
		expect(
			getCollectionLayout("kanban").requiredProperties({ groupBy: "status" }),
		).toEqual(["status"]);
		expect(getCollectionLayout("calendar").controls).toEqual(["dateProperty"]);
		expect(
			getCollectionLayout("calendar").requiredProperties({
				dateProperty: "start",
				endDateProperty: "end",
			}),
		).toEqual(["start", "end"]);
		expect(
			getCollectionLayout("calendar").requiredProperties({
				dateProperty: "$created",
				endDateProperty: null,
			}),
		).toEqual([]);
	});

	describe("graph_layout flag", () => {
		afterEach(() => localStorage.removeItem("ff_graph_layout"));

		it("leaves Graph out of the layouts while the flag is off and falls back to List", () => {
			localStorage.setItem("ff_graph_layout", "false");
			expect(getCollectionLayouts().map((layout) => layout.type)).toEqual([
				"list",
				"kanban",
				"calendar",
			]);
			expect(getCollectionLayout("graph").type).toBe("list");
		});

		it("registers Graph with its filters control when the flag is on", () => {
			localStorage.setItem("ff_graph_layout", "true");
			expect(getCollectionLayouts().map((layout) => layout.type)).toEqual([
				"list",
				"kanban",
				"calendar",
				"graph",
			]);
			expect(getCollectionLayout("graph")).toMatchObject({
				type: "graph",
				labelKey: "layout.graph",
				controls: ["graphFilters", "graphSettings"],
			});
			expect(getCollectionLayout("graph").requiredProperties({})).toEqual([]);
		});
	});

	it("reads a saved graph View presentation, defaulting missing filters", () => {
		expect(
			presentationFromViewDefinition({
				name: "Map",
				icon: null,
				color: null,
				sort: null,
				filters: { all: [] },
				presentation: {
					type: "graph",
					showWikiLinks: false,
					hiddenTypes: ["Person"],
				},
			}),
		).toEqual({
			...DEFAULT_GRAPH_SETTINGS,
			type: "graph",
			showWikiLinks: false,
			hiddenTypes: ["Person"],
		});
	});

	it("reads a saved calendar View presentation", () => {
		expect(
			presentationFromViewDefinition({
				name: "Plan",
				icon: null,
				color: null,
				sort: null,
				filters: { all: [] },
				presentation: {
					type: "calendar",
					dateProperty: "due",
					endDateProperty: "end",
					view: "week",
					showWeekends: false,
					showIcons: true,
					properties: ["owner"],
				},
			}),
		).toEqual({
			type: "calendar",
			dateProperty: "due",
			endDateProperty: "end",
			view: "week",
			showWeekends: false,
			showIcons: true,
			properties: ["owner"],
		});
	});

	it("maps built-in filters to list-presented collections", () => {
		const collection = collectionFromSelection({
			kind: "filter",
			filter: "all",
		});

		expect(collection).toMatchObject({
			id: "builtin:all",
			label: "All Notes",
			origin: "builtin",
			presentation: { type: "list", sort: null, properties: [] },
		});
	});

	it("maps type and folder selections without requiring saved YAML", () => {
		expect(
			collectionFromSelection({ kind: "sectionGroup", type: "Project" }),
		).toMatchObject({
			id: "type:Project",
			label: "Project",
			origin: "type",
		});

		expect(
			collectionFromSelection({
				kind: "folder",
				path: "clients",
				rootPath: "/vault",
			}),
		).toMatchObject({
			id: "folder:/vault:clients",
			label: "clients",
			origin: "folder",
		});
	});

	it("maps neighborhood selections to a collection around the source note", () => {
		const entry = makeEntry({ path: "/vault/alpha.md", title: "Alpha" });
		const collection = collectionFromSelection({ kind: "entity", entry });

		expect(collection).toMatchObject({
			id: "neighborhood:/vault/alpha.md",
			label: "Alpha",
			origin: "neighborhood",
			entry,
		});
	});

	it("normalizes legacy saved-view list settings into presentation config", () => {
		const view = makeView();
		const collection = collectionFromSelection(
			{ kind: "view", filename: view.filename },
			{ views: [view] },
		);

		expect(collection).toMatchObject({
			id: "saved-view::active-projects.yml",
			label: "Active Projects",
			origin: "saved-view",
			filter: view.definition.filters,
			presentation: {
				type: "list",
				sort: "modified:desc",
				properties: ["status"],
			},
			view,
		});
	});

	it("lets nested list presentation config override legacy saved-view fields in memory", () => {
		const view = makeView({
			presentation: {
				type: "list",
				sort: "title:asc",
				properties: ["Owner"],
			},
		} as Partial<ViewDefinition>);

		const collection = collectionFromSelection(
			{ kind: "view", filename: view.filename },
			{ views: [view] },
		);

		expect(collection.presentation).toEqual({
			type: "list",
			sort: "title:asc",
			properties: ["Owner"],
		});
	});

	it("preserves nested Kanban layout settings for saved views", () => {
		const view = makeView({
			presentation: {
				type: "kanban",
				groupBy: "status",
				properties: ["owner"],
				columnOrder: ["Doing", "Todo"],
			},
		} as Partial<ViewDefinition>);

		const collection = collectionFromSelection(
			{ kind: "view", filename: view.filename },
			{ views: [view] },
		);

		expect(collection.presentation).toEqual({
			type: "kanban",
			groupBy: "status",
			properties: ["owner"],
			columnOrder: ["Doing", "Todo"],
			collapsedColumns: [],
			hiddenColumns: [],
		});
	});
});
