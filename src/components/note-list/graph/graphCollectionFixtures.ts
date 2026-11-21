import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { expect } from "vitest";
import { SET_COLLECTION_LAYOUT_EVENT } from "../../../collections/collectionTypes";
import { makeEntry } from "../../../test-utils/noteListTestUtils";
import { invoke } from "./graphCollectionDoubles";
import { Harness } from "./GraphCollectionHarness";

/** Notes and helpers shared by the graph collection tests. */
export const project = makeEntry({
	path: "/vault/launch.md",
	filename: "launch.md",
	title: "Launch",
	isA: "Project",
	relationships: { owner: ["[[ada]]"] },
	outgoingLinks: ["guide"],
});
export const person = makeEntry({
	path: "/vault/ada.md",
	filename: "ada.md",
	title: "Ada",
	isA: "Person",
});
export const guide = makeEntry({
	path: "/vault/guide.md",
	filename: "guide.md",
	title: "Guide",
	isA: "Note",
});
export const lonely = makeEntry({
	path: "/vault/lonely.md",
	filename: "lonely.md",
	title: "Lonely",
	isA: "Note",
});
export const ENTRIES = [project, person, guide, lonely];

export function openMenu(testId: string) {
	const trigger = screen.getByTestId(testId);
	act(() => {
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
	});
}

export async function chooseMenuOption(triggerTestId: string, optionTestId: string) {
	openMenu(triggerTestId);
	fireEvent.click(await screen.findByTestId(optionTestId));
	await waitFor(() =>
		expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
	);
}

export function savedLayouts() {
	return invoke.mock.calls
		.filter(([command]) => command === "save_collection_layout_cmd")
		.map(([, args]) => args);
}

/** The presentation of the last saved layout. */
export function lastSavedGraph() {
	return (savedLayouts().at(-1) as { presentation: Record<string, unknown> })
		.presentation;
}

/** Shows the list as a graph and opens the graph settings panel; returns the canvas stub. */
export async function openGraphSettings() {
	render(createElement(Harness));
	act(() =>
		window.dispatchEvent(
			new CustomEvent(SET_COLLECTION_LAYOUT_EVENT, { detail: "graph" }),
		),
	);
	const canvas = await screen.findByTestId("graph-canvas-stub");
	fireEvent.click(screen.getByTestId("graph-settings-button"));
	await screen.findByTestId("graph-settings-menu");
	return canvas;
}

export function nodeTitles() {
	return screen.getAllByTestId("graph-node").map((node) => node.textContent);
}
