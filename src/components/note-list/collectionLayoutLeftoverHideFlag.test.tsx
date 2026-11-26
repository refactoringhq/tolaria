import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { presentationFromViewDefinition } from "../../collections/presentationConfig";
import { makeEntry } from "../../test-utils/noteListTestUtils";
import { CollectionLayoutBody } from "./CollectionLayoutBody";
import { makeSavedCollectionView as savedView } from "./collectionLayoutTestUtils";
import {
	type CollectionLayoutSource,
	useCollectionLayout,
} from "./useCollectionLayout";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../lib/telemetry", () => ({ trackEvent: vi.fn() }));

const essay = makeEntry({
	path: "/vault/essay.md",
	title: "Essay",
	status: "Draft",
	properties: { owner: "Ada", date: "2026-11-19" },
});

function Harness(overrides: Partial<CollectionLayoutSource>) {
	const source: CollectionLayoutSource = {
		presentation: { type: "list", sort: null, properties: [] },
		selection: { kind: "filter", filter: "all" },
		visibleEntries: [essay],
		views: [],
		vaultPath: "/vault",
		selectedNotePath: null,
		...overrides,
	};
	const layout = useCollectionLayout(source);
	return (
		<div data-testid="layout-root" data-collection-layout={layout.layout}>
			<button
				type="button"
				onClick={() => layout.changeCardProperties(["owner", "date"])}
			>
				check date
			</button>
			<CollectionLayoutBody
				layout={layout}
				listContent={<div data-testid="classic-list" />}
				entries={source.visibleEntries}
				allEntries={source.visibleEntries}
				locale="en"
				typeEntryMap={{}}
				onOpen={vi.fn()}
				onMove={vi.fn()}
			/>
		</div>
	);
}

function cardChips() {
	return within(
		screen.getAllByRole("button", { name: /Essay/ })[0],
	).queryByTestId("property-chips");
}

async function renderStoredLayout(presentation: Record<string, unknown>) {
	invoke.mockResolvedValueOnce({ "builtin:all": presentation });
	render(<Harness />);
	await waitFor(() =>
		expect(screen.getByTestId("layout-root")).toHaveAttribute(
			"data-collection-layout",
			String(presentation.type),
		),
	);
}

describe("leftover hide-all properties flag (TOL-436)", () => {
	beforeEach(() => invoke.mockReset().mockResolvedValue({}));

	it("shows the checked properties on Kanban cards", async () => {
		await renderStoredLayout({
			type: "kanban",
			groupBy: "status",
			properties: ["owner"],
			showProperties: false,
		});
		expect(cardChips()).toHaveTextContent("Ada");
	});

	it("shows the checked properties on Calendar items", async () => {
		await renderStoredLayout({
			type: "calendar",
			dateProperty: "date",
			properties: ["owner"],
			showProperties: false,
		});
		expect(cardChips()).toHaveTextContent("Ada");
	});

	it("drops the leftover flag from the vault layout file on the next save", async () => {
		await renderStoredLayout({
			type: "kanban",
			groupBy: "status",
			properties: ["owner"],
			showProperties: false,
		});
		fireEvent.click(screen.getByText("check date"));
		expect(cardChips()).toHaveTextContent("2026");
		const saved = invoke.mock.calls.find(
			([command]) => command === "save_collection_layout_cmd",
		)?.[1];
		expect(saved.presentation.properties).toEqual(["owner", "date"]);
		expect(saved.presentation).not.toHaveProperty("showProperties");
	});

	it("shows the checked properties on a saved View's Kanban cards and drops the flag on save", () => {
		const view = savedView({
			type: "kanban",
			groupBy: "status",
			properties: ["owner"],
			showProperties: false,
		});
		const update = vi.fn();
		render(
			<Harness
				selection={{ kind: "view", filename: view.filename }}
				presentation={presentationFromViewDefinition(view.definition)}
				views={[view]}
				onUpdateViewDefinition={update}
			/>,
		);
		expect(cardChips()).toHaveTextContent("Ada");
		fireEvent.click(screen.getByText("check date"));
		const patch = update.mock.calls[0][1];
		expect(patch.presentation.properties).toEqual(["owner", "date"]);
		expect(patch.presentation).not.toHaveProperty("showProperties");
	});
});
