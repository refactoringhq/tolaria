import { describe, expect, it, vi } from "vitest";
import { layoutPropertyVisibility } from "./collectionLayoutHeaderUtils";
import type { CollectionLayoutState } from "./useCollectionLayout";

function visibilityFor(layout: string) {
	return layoutPropertyVisibility({
		layout,
		showProperties: true,
		graph: { showLabels: true },
		changeShowProperties: vi.fn(),
		changeGraph: vi.fn(),
	} as unknown as CollectionLayoutState);
}

describe("layout property visibility action", () => {
	it.each(["kanban", "calendar"])(
		"does not add a bulk visibility toggle to %s cards",
		(layout) => {
			expect(visibilityFor(layout)).toBeUndefined();
		},
	);

	it("keeps the Graph label visibility action", () => {
		const graph = {
			layout: "graph",
			showProperties: true,
			graph: { showLabels: true },
			changeShowProperties: vi.fn(),
			changeGraph: vi.fn(),
		} as unknown as CollectionLayoutState;

		const visibility = layoutPropertyVisibility(graph);

		expect(visibility?.visible).toBe(true);
		visibility?.onToggle();
		expect(graph.changeGraph).toHaveBeenCalledWith({ showLabels: false });
	});
});
