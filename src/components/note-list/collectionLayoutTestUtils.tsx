import { act, fireEvent, screen } from "@testing-library/react";
import { makeEntry } from "../../test-utils/noteListTestUtils";
import type { ViewFile } from "../../types";

export const collectionLayoutAlpha = makeEntry({
	path: "/vault/a.md",
	title: "Alpha",
	status: "Doing",
	properties: { owner: "Ada", priority: "High" },
});

export async function chooseLayoutMenuOption(
	triggerTestId: string,
	optionTestId: string,
) {
	const trigger = screen.getAllByTestId(triggerTestId).at(-1);
	if (!trigger) throw new Error(`Missing ${triggerTestId}`);
	act(() => {
		trigger.focus();
		fireEvent.keyDown(trigger, { key: "ArrowDown" });
	});
	fireEvent.click(await screen.findByTestId(optionTestId));
}

export function makeSavedCollectionView(
	presentation: ViewFile["definition"]["presentation"],
): ViewFile {
	return {
		filename: "active-projects.yml",
		definition: {
			name: "Active Projects",
			icon: null,
			color: null,
			sort: "modified",
			listPropertiesDisplay: ["priority"],
			filters: { all: [] },
			presentation,
		},
	};
}
