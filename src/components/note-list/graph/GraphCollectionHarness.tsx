import type { MouseEvent } from "react";
import { vi } from "vitest";
import type { VaultEntry } from "../../../types";
import { CollectionLayoutBody } from "../CollectionLayoutBody";
import { CollectionLayoutHeaderControls } from "../CollectionLayoutControls";
import {
	type CollectionLayoutSource,
	useCollectionLayout,
} from "../useCollectionLayout";
import { ENTRIES } from "./graphCollectionFixtures";

/** A note list wired to the real layout state, header controls and body, with the canvas stubbed. */
export type HarnessProps = Partial<CollectionLayoutSource> & {
	onOpen?: (entry: VaultEntry, event: MouseEvent) => void;
};

type HarnessLayout = ReturnType<typeof useCollectionLayout>;

function harnessSource(
	overrides: Partial<CollectionLayoutSource>,
): CollectionLayoutSource {
	return {
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
}

function graphControls(layout: HarnessLayout) {
	const graphData = layout.graphData;
	if (!graphData) return undefined;
	return {
		settings: layout.graph,
		relationshipKeys: graphData.relationshipKeys,
		typeKeys: graphData.typeKeys,
		typeEntryMap: {},
		onChange: layout.changeGraph,
		onPreview: layout.previewGraph,
	};
}

function HarnessHeader({ layout }: { layout: HarnessLayout }) {
	return (
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
			graph={graphControls(layout)}
			locale="en"
			onLayoutChange={layout.changeLayout}
			onGroupByChange={layout.changeGroupBy}
		/>
	);
}

export function Harness(props: HarnessProps) {
	const { onOpen = vi.fn(), ...overrides } = props;
	const source = harnessSource(overrides);
	const layout = useCollectionLayout(source);
	return (
		<div
			data-testid="layout-root"
			data-kanban-panel={layout.panel.open ? "open" : "closed"}
		>
			<HarnessHeader layout={layout} />
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
