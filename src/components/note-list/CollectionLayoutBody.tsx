import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { COLLECTION_PRESENTATION_LIST } from "../../collections/collectionTypes";
import {
	type CollectionLayoutRendererProps,
	type GraphLayoutBindings,
	getCollectionLayout,
} from "../../collections/layoutRegistry";
import { type AppLocale, translate } from "../../lib/i18n";
import type { VaultEntry } from "../../types";
import { calendarBindings } from "./calendar/calendarBindings";
import { isWritableGroupKey } from "./collectionLayoutConfig";
import type { InitialNoteProperties } from "./noteListCreate";
import type { CollectionLayoutState } from "./useCollectionLayout";

/** Writes one frontmatter property; resolves once the write settled. */
export type WriteNoteProperty = (
	entry: VaultEntry,
	property: string,
	value: string | null,
) => unknown;

interface CollectionLayoutBodyProps {
	layout: CollectionLayoutState;
	listContent: ReactNode;
	entries: VaultEntry[];
	allEntries: VaultEntry[];
	locale: AppLocale;
	typeEntryMap: Record<string, VaultEntry>;
	displayPropsOverride?: string[] | null;
	selectedNotePath?: string | null;
	onOpen: (entry: VaultEntry, event: MouseEvent) => void;
	onMove: WriteNoteProperty;
	onCreate?: (properties: InitialNoteProperties) => void;
}

function MissingGroupProperty({
	property,
	locale,
	onUseList,
}: {
	property: string;
	locale: AppLocale;
	onUseList: () => void;
}) {
	return (
		<div
			className="flex flex-col items-start gap-3 p-6 text-sm text-muted-foreground"
			data-testid="kanban-missing-property"
		>
			<p className="m-0 max-w-md">
				{translate(locale, "layout.noPropertyValues", { property })}
			</p>
			<Button type="button" variant="outline" size="sm" onClick={onUseList}>
				{translate(locale, "layout.useList")}
			</Button>
		</div>
	);
}

function graphBindings(layout: CollectionLayoutState): GraphLayoutBindings {
	return {
		settings: layout.graph,
		data: layout.graphData,
		panelOpen: layout.panel.open,
		onSettingsChange: layout.changeGraph,
		onSettingsPreview: layout.previewGraph,
		onBackgroundClick: layout.panel.close,
		onUseList: () => layout.changeLayout(COLLECTION_PRESENTATION_LIST),
	};
}

function rendererProps(
	props: CollectionLayoutBodyProps,
): CollectionLayoutRendererProps {
	const { layout, onMove } = props;
	return {
		listContent: props.listContent,
		entries: props.entries,
		allEntries: props.allEntries,
		properties: layout.properties,
		showProperties: layout.showProperties,
		locale: props.locale,
		typeEntryMap: props.typeEntryMap,
		displayPropsOverride: props.displayPropsOverride,
		selectedNotePath: layout.panel.open ? props.selectedNotePath : null,
		onOpen: (entry, event) => {
			layout.panel.reopen();
			props.onOpen(entry, event);
		},
		kanban: {
			groupBy: layout.groupBy,
			columnOrder: layout.columnOrder,
			onColumnOrderChange: layout.changeColumnOrder,
			collapsedColumns: layout.collapsedColumns,
			hiddenColumns: layout.hiddenColumns,
			onToggleColumnCollapsed: layout.toggleColumnCollapsed,
			onToggleColumnHidden: layout.toggleColumnHidden,
			onMove: (entry, value) => {
				if (isWritableGroupKey(layout.groupBy, layout.groups))
					onMove(entry, layout.groupBy, value);
			},
		},
		calendar: calendarBindings({
			layout,
			write: onMove,
			create: props.onCreate,
		}),
		graph: graphBindings(layout),
	};
}

export function CollectionLayoutBody(props: CollectionLayoutBodyProps) {
	const { layout, locale } = props;
	const renderer = getCollectionLayout(layout.layout);
	const missingProperty = renderer
		.requiredProperties({
			groupBy: layout.groupBy,
			dateProperty: layout.dateProperty,
			endDateProperty: layout.calendar.endDateProperty,
		})
		.find((property) => !layout.groups.includes(property));
	const rendered = rendererProps(props);
	if (missingProperty === undefined) return renderer.render(rendered);
	if (renderer.renderMissing)
		return renderer.renderMissing(rendered, missingProperty);
	return (
		<MissingGroupProperty
			property={missingProperty}
			locale={locale}
			onUseList={() => layout.changeLayout(COLLECTION_PRESENTATION_LIST)}
		/>
	);
}
