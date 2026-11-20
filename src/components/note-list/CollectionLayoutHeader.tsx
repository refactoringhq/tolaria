import {
	CollectionLayoutHeaderControls,
	type GraphHeaderControls,
} from "./CollectionLayoutControls";
import { NOTE_LIST_ACTION_BUTTON_CLASSNAME } from "./NoteListHeader";
import type { CollectionLayoutState } from "./useCollectionLayout";
import type { useNoteListModel } from "./useNoteListModel";

type NoteListModel = ReturnType<typeof useNoteListModel>;

function graphHeaderControls(
	layout: CollectionLayoutState,
	typeEntryMap: NoteListModel["typeEntryMap"],
): GraphHeaderControls | undefined {
	if (!layout.graphData) return undefined;
	const { relationshipKeys, typeKeys } = layout.graphData;
	return {
		settings: layout.graph,
		relationshipKeys,
		typeKeys,
		typeEntryMap,
		onChange: layout.changeGraph,
	};
}

export function LayoutHeaderControls({
	layout,
	locale,
	typeEntryMap,
}: {
	layout: CollectionLayoutState;
	locale: NoteListModel["locale"];
	typeEntryMap: NoteListModel["typeEntryMap"];
}) {
	if (!layout.enabled) return null;
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
			graph={graphHeaderControls(layout, typeEntryMap)}
			locale={locale}
			triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
			onLayoutChange={layout.changeLayout}
			onGroupByChange={layout.changeGroupBy}
		/>
	);
}
