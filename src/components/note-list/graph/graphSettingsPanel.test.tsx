import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, trackEvent } from "./graphCollectionDoubles";
import { lastSavedGraph, openGraphSettings, nodeTitles } from "./graphCollectionFixtures";

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
	it("shows only the Display and Forces sections", async () => {
		await openGraphSettings();
		const menu = screen.getByTestId("graph-settings-menu");
		const headings = within(menu)
			.getAllByRole("heading")
			.map((heading) => heading.textContent);
		expect(headings).toEqual(["Display", "Forces"]);
		expect(screen.queryByTestId("graph-search-input")).not.toBeInTheDocument();
		expect(screen.queryByTestId("graph-group-add")).not.toBeInTheDocument();
	});
	it("ignores a saved search and color groups but keeps them in the saved view", async () => {
		const colorGroups = [{ id: "people", query: "type:Person", color: "purple" }];
		const canvas = await openGraphSettings({
			presentation: { type: "graph", sort: null, properties: [], search: "ada", colorGroups },
		});
		expect(nodeTitles()).toEqual(["Launch", "Ada", "Guide", "Lonely"]);
		fireEvent.keyDown(screen.getByRole("slider", { name: "Repel force" }), {
			key: "ArrowRight",
		});
		await waitFor(() => expect(canvas).toHaveAttribute("data-repel", "10.1"));
		expect(lastSavedGraph()).toMatchObject({ search: "ada", colorGroups });
	});
});
