import type { MouseEvent } from "react";
import { vi } from "vitest";
import type { VaultEntry } from "../../../types";
import { CollectionLayoutBody } from "../CollectionLayoutBody";
import { CollectionLayoutHeaderControls } from "../CollectionLayoutControls";
import { type CollectionLayoutSource, useCollectionLayout } from "../useCollectionLayout";
import { ENTRIES } from "./graphCollectionFixtures";

/** A note list wired to the real layout state, header controls and body, with the canvas stubbed. */
export type HarnessProps = Partial<CollectionLayoutSource> & {
	onOpen?: (entry: VaultEntry, event: MouseEvent) => void;
};

export function Harness({ onOpen = vi.fn(), ...overrides }: HarnessProps) {
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
