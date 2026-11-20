import type {
	FilterGroup,
	SidebarSelection,
	VaultEntry,
	ViewFile,
} from "../types";

export const COLLECTION_PRESENTATION_LIST = "list";
export const COLLECTION_PRESENTATION_KANBAN = "kanban";
export const COLLECTION_PRESENTATION_CALENDAR = "calendar";
export const COLLECTION_PRESENTATION_GRAPH = "graph";

export type CollectionPresentationType =
	| typeof COLLECTION_PRESENTATION_LIST
	| typeof COLLECTION_PRESENTATION_KANBAN
	| typeof COLLECTION_PRESENTATION_CALENDAR
	| typeof COLLECTION_PRESENTATION_GRAPH;

export type CalendarViewMode = "month" | "week" | "quarter" | "year";

/** Command-palette event that switches the current list to the layout named in `detail`. */
export const SET_COLLECTION_LAYOUT_EVENT = "laputa:set-collection-layout";

export interface ListCollectionPresentationConfig {
	type: typeof COLLECTION_PRESENTATION_LIST;
	sort: string | null;
	properties: string[];
}

export interface KanbanCollectionPresentationConfig {
	type: typeof COLLECTION_PRESENTATION_KANBAN;
	groupBy: string | null;
	properties: string[];
	columnOrder: string[];
	/** Column values shown as a narrow vertical strip. */
	collapsedColumns: string[];
	/** Column values left off the board; listed under "Hidden columns". */
	hiddenColumns: string[];
}

/** The calendar-only settings a list keeps, even while it shows another layout. */
export interface CalendarSettings {
	/** Property that places a note on a day; null picks the best date property the list has. */
	dateProperty: string | null;
	/** Optional property that ends a multi-day range. */
	endDateProperty: string | null;
	view: CalendarViewMode;
	showWeekends: boolean;
	showIcons: boolean;
}

export interface CalendarCollectionPresentationConfig extends CalendarSettings {
	type: typeof COLLECTION_PRESENTATION_CALENDAR;
	properties: string[];
}

/** The graph legend filters a list keeps, even while it shows another layout. */
export interface GraphSettings {
	showWikiLinks: boolean;
	/** Relationship keys whose edges are left off the graph. */
	hiddenRelationships: string[];
	/** Note types left off the graph; an empty string stands for notes without a type. */
	hiddenTypes: string[];
	/** Notes without a visible edge. */
	showOrphans: boolean;
	showLabels: boolean;
}

export interface GraphCollectionPresentationConfig extends GraphSettings {
	type: typeof COLLECTION_PRESENTATION_GRAPH;
}

export type CollectionPresentationConfig =
	| ListCollectionPresentationConfig
	| KanbanCollectionPresentationConfig
	| CalendarCollectionPresentationConfig
	| GraphCollectionPresentationConfig;

export type CollectionOrigin =
	| "builtin"
	| "type"
	| "folder"
	| "saved-view"
	| "neighborhood";

export interface CollectionDefinition {
	id: string;
	label: string;
	origin: CollectionOrigin;
	selection: SidebarSelection;
	presentation: CollectionPresentationConfig;
	filter?: FilterGroup;
	entry?: VaultEntry;
	view?: ViewFile;
}
