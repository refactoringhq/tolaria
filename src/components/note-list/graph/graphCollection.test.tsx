import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SET_COLLECTION_LAYOUT_EVENT } from "../../../collections/collectionTypes";
import { presentationFromViewDefinition } from "../../../collections/presentationConfig";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import type { SidebarSelection, VaultEntry, ViewFile } from "../../../types";
import { CollectionLayoutBody } from "../CollectionLayoutBody";
import { CollectionLayoutHeaderControls } from "../CollectionLayoutControls";
import {
	type CollectionLayoutSource,
	useCollectionLayout,
} from "../useCollectionLayout";
import type { GraphCanvasProps } from "./GraphCanvas";

const { invoke, trackEvent } = vi.hoisted(() => ({
	invoke: vi.fn(),
	trackEvent: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../../lib/telemetry", () => ({ trackEvent }));
// WebGL is not available in JSDOM: the canvas stub lists what it would draw and forwards clicks.
vi.mock("./GraphCanvas", () => ({
	default: ({
		visible,
		settings,
		selectedNotePath,
		onOpen,
		onBackgroundClick,
	}: GraphCanvasProps) => (
		<div
			data-testid="graph-canvas-stub"
			data-labels={String(settings.showLabels)}
			data-repel={settings.repelForce}
			data-arrows={String(settings.showArrows)}
			data-groups={settings.colorGroups.map((group) => `${group.query}:${group.color}`).join("|")}
			data-selected={selectedNotePath ?? ""}
		>
			{visible.nodes.map((node) => (
				<button
					key={node.id}
					type="button"
					data-testid="graph-node"
					onClick={(event: MouseEvent) => onOpen(node.entry, event)}
				>
					{node.entry.title}
				</button>
			))}
			{visible.edges.map((edge) => (
				<span key={edge.id} data-testid={`graph-edge-${edge.kind}`}>
					{edge.labels.join("+")}
				</span>
			))}
			<button
				type="button"
				data-testid="graph-background"
				onClick={onBackgroundClick}
			>
				background
			</button>
		</div>
	),
}));

const project = makeEntry({
	path: "/vault/launch.md",
	filename: "launch.md",
	title: "Launch",
	isA: "Project",
	relationships: { owner: ["[[ada]]"] },
	outgoingLinks: ["guide"],
});
const person = makeEntry({
	path: "/vault/ada.md",
	filename: "ada.md",
	title: "Ada",
	isA: "Person",
});
const guide = makeEntry({
	path: "/vault/guide.md",
	filename: "guide.md",
	title: "Guide",
	isA: "Note",
});
const lonely = makeEntry({
	path: "/vault/lonely.md",
	filename: "lonely.md",
	title: "Lonely",
	isA: "Note",
});
const ENTRIES = [project, person, guide, lonely];

type HarnessProps = Partial<CollectionLayoutSource> & {
	onOpen?: (entry: VaultEntry, event: MouseEvent) => void;
};

function Harness({ onOpen = vi.fn(), ...overrides }: HarnessProps) {
	const source: CollectionLayoutSource = {
		presentation: { type: "list", sort: null, properties: [] },
		selection: { kind: "filter", filter: "all" },
		visibleEntries: ENTRIES,
		allEntries: ENTRIES,
		views: [],
		onUpdateViewDefinition: () => undefined,
		vaultPath: "/vault",
		selectedNotePath: null,
		...overrides,
	};
	const layout = useCollectionLayout(source);
	const graphData = layout.graphData;
	return (
		<div
			data-testid="layout-root"
			data-kanban-panel={layout.panel.open ? "open" : "closed"}
		>
			<CollectionLayoutHeaderControls
				layout={layout.layout}
				groupBy={layout.groupBy}
				groups={layout.groups}
				calendar={{
					settings: layout.calendar,
					dateProperty: layout.dateProperty,
					dateOptions: layout.dateOptions,
					onChange: layout.changeCalendar,
				}}
				graph={
					graphData
						? {
								settings: layout.graph,
								relationshipKeys: graphData.relationshipKeys,
								typeKeys: graphData.typeKeys,
								typeEntryMap: {},
								onChange: layout.changeGraph,
								onPreview: layout.previewGraph,
							}
						: undefined
				}
				locale="en"
				onLayoutChange={layout.changeLayout}
				onGroupByChange={layout.changeGroupBy}
			/>
			<CollectionLayoutBody
				layout={layout}
				listContent={<div data-testid="classic-list">Classic list</div>}
				entries={source.visibleEntries}
				allEntries={source.allEntries ?? source.visibleEntries}
				locale="en"
				typeEntryMap={{}}
				selectedNotePath={source.selectedNotePath}
				onOpen={onOpen}
				onMove={vi.fn()}
			/>
		</div>
	);
}

function openMenu(testId: string) {
	const trigger = screen.getByTestId(testId);
	act(() => {
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
	});
}

async function chooseMenuOption(triggerTestId: string, optionTestId: string) {
	openMenu(triggerTestId);
	fireEvent.click(await screen.findByTestId(optionTestId));
	await waitFor(() =>
		expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
	);
}

function savedLayouts() {
	return invoke.mock.calls
		.filter(([command]) => command === "save_collection_layout_cmd")
		.map(([, args]) => args);
}

function nodeTitles() {
	return screen.getAllByTestId("graph-node").map((node) => node.textContent);
}

describe("graph collection layout", () => {
	beforeEach(() => {
		invoke.mockReset().mockResolvedValue({});
		trackEvent.mockReset();
		localStorage.setItem("ff_graph_layout", "true");
	});
	afterEach(() => localStorage.removeItem("ff_graph_layout"));

	it("offers Graph in the layout menu only while the flag is on", async () => {
		localStorage.setItem("ff_graph_layout", "false");
		const { unmount } = render(<Harness />);
		openMenu("layout-menu-button");
		expect(
			await screen.findByTestId("layout-option-calendar"),
		).toBeInTheDocument();
		expect(screen.queryByTestId("layout-option-graph")).not.toBeInTheDocument();
		unmount();

		localStorage.setItem("ff_graph_layout", "true");
		render(<Harness />);
		openMenu("layout-menu-button");
		expect(await screen.findByTestId("layout-option-graph")).toHaveTextContent(
			"Graph",
		);
	});

	it("opens a saved graph config as List while the flag is off, without rewriting it", async () => {
		localStorage.setItem("ff_graph_layout", "false");
		invoke.mockResolvedValueOnce({
			"builtin:all": { type: "graph", showWikiLinks: false },
		});
		render(<Harness />);
		await waitFor(() =>
			expect(invoke).toHaveBeenCalledWith("list_collection_layouts", {
				vaultPath: "/vault",
			}),
		);
		expect(screen.getByTestId("classic-list")).toBeInTheDocument();
		expect(screen.getByTestId("layout-menu-button")).toHaveAccessibleName(
			"Change layout",
		);
		expect(savedLayouts()).toEqual([]);
	});

	it("switches to Graph, draws both edge kinds, and saves only once the user changes something", async () => {
		render(<Harness />);
		await chooseMenuOption("layout-menu-button", "layout-option-graph");
		expect(await screen.findByTestId("graph-canvas-stub")).toBeInTheDocument();
		expect(nodeTitles()).toEqual(["Launch", "Ada", "Guide", "Lonely"]);
		expect(screen.getByTestId("graph-edge-relationship")).toHaveTextContent(
			"owner",
		);
		expect(screen.getByTestId("graph-edge-wikilink")).toBeInTheDocument();
		expect(savedLayouts()).toEqual([
			{
				vaultPath: "/vault",
				collection: "builtin:all",
				presentation: expect.objectContaining({
					type: "graph",
					showWikiLinks: true,
					hiddenRelationships: [],
					hiddenTypes: [],
					showOrphans: true,
					showLabels: true,
				}),
			},
		]);
		expect(trackEvent).toHaveBeenCalledWith("collection_layout_changed", {
			layout: "graph",
			collection: "filter",
		});
	});

	it("applies and persists every legend filter", async () => {
		render(<Harness />);
		act(() =>
			window.dispatchEvent(
				new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
			),
		);
		await screen.findByTestId("graph-canvas-stub");

		openMenu("graph-filter-menu-button");
		fireEvent.click(await screen.findByTestId("graph-filter-wikilinks"));
		await waitFor(() =>
			expect(
				screen.queryByTestId("graph-edge-wikilink"),
			).not.toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("graph-filter-relationship-owner"));
		await waitFor(() =>
			expect(
				screen.queryByTestId("graph-edge-relationship"),
			).not.toBeInTheDocument(),
		);
		fireEvent.click(screen.getByTestId("graph-filter-type-Person"));
		await waitFor(() => expect(nodeTitles()).not.toContain("Ada"));
		fireEvent.click(screen.getByTestId("graph-filter-labels"));
		await waitFor(() =>
			expect(screen.getByTestId("graph-canvas-stub")).toHaveAttribute(
				"data-labels",
				"false",
			),
		);
		fireEvent.click(screen.getByTestId("graph-filter-relationship-owner"));
		fireEvent.click(screen.getByTestId("graph-filter-type-Person"));
		fireEvent.click(screen.getByTestId("graph-filter-orphans"));
		await waitFor(() => expect(nodeTitles()).toEqual(["Launch", "Ada"]));

		expect(savedLayouts().at(-1)).toEqual(
			expect.objectContaining({
				presentation: expect.objectContaining({
					type: "graph",
					showWikiLinks: false,
					hiddenRelationships: [],
					hiddenTypes: [],
					showOrphans: false,
					showLabels: false,
				}),
			}),
		);
		expect(trackEvent).toHaveBeenCalledWith("graph_filter_changed", {
			filter: "showWikiLinks",
		});
	});

	it("previews and saves forces, display, search and color groups from the settings panel", async () => {
		render(<Harness />);
		act(() =>
			window.dispatchEvent(
				new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
			),
		);
		const canvas = await screen.findByTestId("graph-canvas-stub");
		fireEvent.click(screen.getByTestId("graph-settings-button"));
		await screen.findByTestId("graph-settings-menu");
		const lastSaved = () =>
			(savedLayouts().at(-1) as { presentation: Record<string, unknown> })
				.presentation;

		fireEvent.keyDown(screen.getByRole("slider", { name: "Repel force" }), {
			key: "ArrowRight",
		});
		await waitFor(() => expect(canvas).toHaveAttribute("data-repel", "10.1"));
		expect(lastSaved()).toMatchObject({ repelForce: 10.1 });
		fireEvent.click(screen.getByTestId("graph-forces-restore"));
		await waitFor(() => expect(canvas).toHaveAttribute("data-repel", "10"));
		expect(lastSaved()).toMatchObject({ repelForce: 10 });
		fireEvent.click(screen.getByTestId("graph-setting-arrows"));
		await waitFor(() => expect(canvas).toHaveAttribute("data-arrows", "true"));

		const saves = savedLayouts().length;
		fireEvent.change(screen.getByTestId("graph-search-input"), {
			target: { value: "ada" },
		});
		await waitFor(() => expect(nodeTitles()).toEqual(["Ada"]));
		expect(savedLayouts()).toHaveLength(saves);
		await waitFor(() => expect(lastSaved()).toMatchObject({ search: "ada" }));
		fireEvent.change(screen.getByTestId("graph-search-input"), {
			target: { value: "" },
		});
		fireEvent.blur(screen.getByTestId("graph-search-input"));
		await waitFor(() => expect(lastSaved()).toMatchObject({ search: "" }));

		fireEvent.click(screen.getByTestId("graph-group-add"));
		fireEvent.click(screen.getByTestId("graph-group-add"));
		const queries = screen.getAllByTestId("graph-group-query");
		fireEvent.change(queries[0], { target: { value: "type:Person" } });
		fireEvent.blur(queries[0]);
		fireEvent.change(queries[1], { target: { value: "Launch" } });
		fireEvent.blur(queries[1]);
		await waitFor(() =>
			expect(canvas.dataset.groups).toMatch(/^type:Person:\w+\|Launch:\w+$/),
		);
		fireEvent.click(screen.getAllByTestId("graph-group-color-purple")[0]);
		fireEvent.click(screen.getAllByTestId("graph-group-down")[0]);
		await waitFor(() =>
			expect(canvas.dataset.groups).toMatch(/^Launch:\w+\|type:Person:purple$/),
		);
		fireEvent.click(screen.getAllByTestId("graph-group-delete")[0]);
		await waitFor(() =>
			expect(canvas).toHaveAttribute("data-groups", "type:Person:purple"),
		);
		expect(lastSaved()).toMatchObject({
			colorGroups: [
				expect.objectContaining({ query: "type:Person", color: "purple" }),
			],
		});
	});

	it("restores saved graph filters when the list opens again", async () => {
		invoke.mockResolvedValueOnce({
			"builtin:all": {
				type: "graph",
				showOrphans: false,
				hiddenTypes: ["Note"],
			},
		});
		render(<Harness />);
		await screen.findByTestId("graph-canvas-stub");
		expect(nodeTitles()).toEqual(["Launch", "Ada"]);
	});

	it("opens a clicked node in the editor panel, keeps it marked, and closes on an empty-canvas click", async () => {
		const onOpen = vi.fn();
		const { rerender } = render(<Harness onOpen={onOpen} />);
		act(() =>
			window.dispatchEvent(
				new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
			),
		);
		await screen.findByTestId("graph-canvas-stub");
		expect(screen.getByTestId("layout-root")).toHaveAttribute(
			"data-kanban-panel",
			"closed",
		);

		fireEvent.click(screen.getByRole("button", { name: "Ada" }));
		expect(onOpen).toHaveBeenCalledWith(person, expect.anything());
		rerender(<Harness onOpen={onOpen} selectedNotePath={person.path} />);
		expect(screen.getByTestId("layout-root")).toHaveAttribute(
			"data-kanban-panel",
			"open",
		);
		expect(screen.getByTestId("graph-canvas-stub")).toHaveAttribute(
			"data-selected",
			person.path,
		);

		fireEvent.click(screen.getByTestId("graph-background"));
		expect(screen.getByTestId("layout-root")).toHaveAttribute(
			"data-kanban-panel",
			"closed",
		);
		fireEvent.click(screen.getByRole("button", { name: "Launch" }));
		rerender(<Harness onOpen={onOpen} selectedNotePath={project.path} />);
		expect(screen.getByTestId("layout-root")).toHaveAttribute(
			"data-kanban-panel",
			"open",
		);
	});

	it("adds an edge when an external edit adds a relationship, without remounting", async () => {
		const { rerender } = render(<Harness />);
		act(() =>
			window.dispatchEvent(
				new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
			),
		);
		const canvas = await screen.findByTestId("graph-canvas-stub");
		expect(screen.getAllByTestId("graph-edge-relationship")).toHaveLength(1);
		const linkedLonely = {
			...lonely,
			relationships: { related_to: ["[[guide]]"] },
		};
		const updated = [project, person, guide, linkedLonely];
		rerender(<Harness visibleEntries={updated} allEntries={updated} />);
		expect(
			screen
				.getAllByTestId("graph-edge-relationship")
				.map((edge) => edge.textContent),
		).toEqual(["owner", "related_to"]);
		expect(screen.getByTestId("graph-canvas-stub")).toBe(canvas);
	});

	it("explains a list without connections and offers List", async () => {
		render(<Harness visibleEntries={[lonely, guide]} allEntries={ENTRIES} />);
		act(() =>
			window.dispatchEvent(
				new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
			),
		);
		expect(screen.getByTestId("graph-empty")).toHaveTextContent(
			"These notes aren't linked to each other yet",
		);
		fireEvent.click(screen.getByTestId("graph-empty-use-list"));
		expect(screen.getByTestId("classic-list")).toBeInTheDocument();
	});

	it("explains filters that hide every note and resets them", async () => {
		invoke.mockResolvedValueOnce({
			"builtin:all": {
				type: "graph",
				hiddenTypes: ["Project", "Person", "Note"],
			},
		});
		render(<Harness />);
		expect(
			await screen.findByTestId("graph-empty-filtered"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByTestId("graph-empty-reset"));
		expect(await screen.findByTestId("graph-canvas-stub")).toBeInTheDocument();
	});

	it("keeps graph filters in a saved View across layout switches", async () => {
		let currentView: ViewFile = {
			filename: "map.yml",
			definition: {
				name: "Map",
				icon: null,
				color: null,
				sort: null,
				filters: { all: [] },
				presentation: { type: "graph", showWikiLinks: false },
			},
		};
		const selection: SidebarSelection = { kind: "view", filename: "map.yml" };
		const updateView = vi.fn(
			(_filename: string, patch: Partial<ViewFile["definition"]>) => {
				currentView = {
					...currentView,
					definition: { ...currentView.definition, ...patch },
				};
			},
		);
		const viewProps = () => ({
			selection,
			presentation: presentationFromViewDefinition(currentView.definition),
			views: [currentView],
			onUpdateViewDefinition: updateView,
		});

		const first = render(<Harness {...viewProps()} />);
		await screen.findByTestId("graph-canvas-stub");
		expect(screen.queryByTestId("graph-edge-wikilink")).not.toBeInTheDocument();
		await chooseMenuOption("layout-menu-button", "layout-option-kanban");
		expect(currentView.definition.presentation).toEqual(
			expect.objectContaining({ type: "kanban", showWikiLinks: false }),
		);
		first.unmount();

		render(<Harness {...viewProps()} />);
		await chooseMenuOption("layout-menu-button", "layout-option-graph");
		expect(currentView.definition.presentation).toEqual(
			expect.objectContaining({ type: "graph", showWikiLinks: false }),
		);
		await screen.findByTestId("graph-canvas-stub");
		expect(screen.queryByTestId("graph-edge-wikilink")).not.toBeInTheDocument();
	});
});
