import type { CollectionLayoutState } from "./useCollectionLayout";

export function layoutPropertyVisibility(
	layout: CollectionLayoutState,
): { visible: boolean; onToggle: () => void } | undefined {
	if (layout.layout === "list") return undefined;
	if (layout.layout === "graph") {
		return {
			visible: layout.graph.showLabels,
			onToggle: () =>
				layout.changeGraph({ showLabels: !layout.graph.showLabels }),
		};
	}
	return undefined;
}
