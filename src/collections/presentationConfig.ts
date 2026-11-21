import type { ViewDefinition } from "../types";
import {
	type CalendarCollectionPresentationConfig,
	type CalendarSettings,
	COLLECTION_PRESENTATION_CALENDAR,
	COLLECTION_PRESENTATION_GRAPH,
	COLLECTION_PRESENTATION_KANBAN,
	COLLECTION_PRESENTATION_LIST,
	type CollectionPresentationConfig,
	type GraphCollectionPresentationConfig,
	type KanbanCollectionPresentationConfig,
	type ListCollectionPresentationConfig,
} from "./collectionTypes";
import { graphSettingsFrom } from "./graphSettings";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function showPropertiesSetting(source: UnknownRecord): {
	showProperties?: boolean;
} {
	return typeof source.showProperties === "boolean"
		? { showProperties: source.showProperties }
		: {};
}

function listPresentation(
	source: UnknownRecord,
	fallback: ListCollectionPresentationConfig,
): ListCollectionPresentationConfig {
	const properties = stringArray(source.properties);
	return {
		type: COLLECTION_PRESENTATION_LIST,
		sort: nullableString(source.sort) ?? fallback.sort,
		properties: properties.length > 0 ? properties : fallback.properties,
	};
}

function kanbanPresentation(
	source: UnknownRecord,
): KanbanCollectionPresentationConfig {
	return {
		type: COLLECTION_PRESENTATION_KANBAN,
		groupBy: nullableString(source.groupBy),
		properties: stringArray(source.properties),
		...showPropertiesSetting(source),
		columnOrder: stringArray(source.columnOrder),
		collapsedColumns: stringArray(source.collapsedColumns),
		hiddenColumns: stringArray(source.hiddenColumns),
	};
}

export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
	dateProperty: null,
	endDateProperty: null,
	view: "month",
	showWeekends: true,
	showIcons: true,
};

const CALENDAR_SETTING_KEYS = [
	"dateProperty",
	"endDateProperty",
	"view",
	"showWeekends",
	"showIcons",
] as const;

/** True when a stored presentation carries any calendar setting, even while it shows another layout. */
export function hasCalendarSettings(source: UnknownRecord): boolean {
	return CALENDAR_SETTING_KEYS.some((key) => key in source);
}

/** Reads calendar settings defensively: anything unexpected falls back to the default. */
export function calendarSettingsFrom(source: UnknownRecord): CalendarSettings {
	return {
		dateProperty: nullableString(source.dateProperty),
		endDateProperty: nullableString(source.endDateProperty),
		view:
			source.view === "week" ||
			source.view === "quarter" ||
			source.view === "year"
				? source.view
				: "month",
		showWeekends: source.showWeekends !== false,
		showIcons: source.showIcons !== false,
	};
}

function calendarPresentation(
	source: UnknownRecord,
): CalendarCollectionPresentationConfig {
	return {
		type: COLLECTION_PRESENTATION_CALENDAR,
		...calendarSettingsFrom(source),
		properties: stringArray(source.properties),
		...showPropertiesSetting(source),
	};
}

export {
	DEFAULT_GRAPH_SETTINGS,
	graphSettingsFrom,
	hasGraphSettings,
} from "./graphSettings";

function graphPresentation(
	source: UnknownRecord,
): GraphCollectionPresentationConfig {
	return { type: COLLECTION_PRESENTATION_GRAPH, ...graphSettingsFrom(source) };
}

const PRESENTATION_READERS = new Map<
	string,
	(source: UnknownRecord) => CollectionPresentationConfig
>([
	[COLLECTION_PRESENTATION_KANBAN, kanbanPresentation],
	[COLLECTION_PRESENTATION_CALENDAR, calendarPresentation],
	[COLLECTION_PRESENTATION_GRAPH, graphPresentation],
]);

export function defaultListPresentation(): ListCollectionPresentationConfig {
	return { type: COLLECTION_PRESENTATION_LIST, sort: null, properties: [] };
}

export function presentationFromViewDefinition(
	definition: ViewDefinition,
): CollectionPresentationConfig {
	const fallback: ListCollectionPresentationConfig = {
		type: COLLECTION_PRESENTATION_LIST,
		sort: nullableString(definition.sort),
		properties: stringArray(definition.listPropertiesDisplay),
	};
	const rawPresentation = Reflect.get(
		definition as unknown as UnknownRecord,
		"presentation",
	);
	if (!isRecord(rawPresentation)) return fallback;
	if (rawPresentation.type === COLLECTION_PRESENTATION_LIST)
		return listPresentation(rawPresentation, fallback);
	const reader =
		typeof rawPresentation.type === "string"
			? PRESENTATION_READERS.get(rawPresentation.type)
			: undefined;
	return reader ? reader(rawPresentation) : fallback;
}
