import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, trackEvent } from "./graphCollectionDoubles";
import { savedLayouts, lastSavedGraph, openGraphSettings, nodeTitles } from "./graphCollectionFixtures";

vi.mock("@tauri-apps/api/core", async () => (await import("./graphCollectionDoubles")).tauriModule);
vi.mock("../../../lib/telemetry", async () => (await import("./graphCollectionDoubles")).telemetryModule);
vi.mock("./GraphCanvas", async () => (await import("./graphCollectionDoubles")).canvasModule);

describe("graph settings panel", () => {
	beforeEach(() => {
		invoke.mockReset().mockResolvedValue({});
		trackEvent.mockReset();
		localStorage.setItem("ff_graph_layout", "true");
	});
	afterEach(() => localStorage.removeItem("ff_graph_layout"));

	it("previews and saves forces and display settings from the settings panel", async () => {
		const canvas = await openGraphSettings();
		fireEvent.keyDown(screen.getByRole("slider", { name: "Repel force" }), {
			key: "ArrowRight",
		});
		await waitFor(() => expect(canvas).toHaveAttribute("data-repel", "10.1"));
		expect(lastSavedGraph()).toMatchObject({ repelForce: 10.1 });
		fireEvent.click(screen.getByTestId("graph-forces-restore"));
		await waitFor(() => expect(canvas).toHaveAttribute("data-repel", "10"));
		expect(lastSavedGraph()).toMatchObject({ repelForce: 10 });
		fireEvent.click(screen.getByTestId("graph-setting-arrows"));
		await waitFor(() => expect(canvas).toHaveAttribute("data-arrows", "true"));
	});
	it("filters the graph live while typing a search and saves it after a pause", async () => {
		await openGraphSettings();
		const saves = savedLayouts().length;
		fireEvent.change(screen.getByTestId("graph-search-input"), {
			target: { value: "ada" },
		});
		await waitFor(() => expect(nodeTitles()).toEqual(["Ada"]));
		expect(savedLayouts()).toHaveLength(saves);
		await waitFor(() =>
			expect(lastSavedGraph()).toMatchObject({ search: "ada" }),
		);
		fireEvent.change(screen.getByTestId("graph-search-input"), {
			target: { value: "" },
		});
		fireEvent.blur(screen.getByTestId("graph-search-input"));
		await waitFor(() => expect(lastSavedGraph()).toMatchObject({ search: "" }));
	});
	it("adds, recolors, reorders and deletes color groups, first match winning", async () => {
		const canvas = await openGraphSettings();
		fireEvent.click(screen.getByTestId("graph-group-add"));
		fireEvent.click(screen.getByTestId("graph-group-add"));
		const queries = screen.getAllByTestId("graph-group-query");
		for (const [index, query] of ["type:Person", "Launch"].entries()) {
			fireEvent.change(queries[index], { target: { value: query } });
			fireEvent.blur(queries[index]);
		}
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
		expect(lastSavedGraph()).toMatchObject({
			colorGroups: [
				expect.objectContaining({ query: "type:Person", color: "purple" }),
			],
		});
	});
});
