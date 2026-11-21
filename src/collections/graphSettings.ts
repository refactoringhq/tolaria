import type { GraphColorGroup, GraphSettings } from "./collectionTypes";

type UnknownRecord = Record<string, unknown>;

/** The graph settings a slider edits, with its range and step. */
export type GraphNumberSetting =
	| "textFadeThreshold"
	| "nodeSizeScale"
	| "linkThickness"
	| "centerForce"
	| "repelForce"
	| "linkForce"
	| "linkDistance";

export interface GraphNumberRange {
	min: number;
	max: number;
	step: number;
	fallback: number;
}

export const GRAPH_NUMBER_RANGES: Readonly<
	Record<GraphNumberSetting, GraphNumberRange>
> = {
	textFadeThreshold: { min: -3, max: 3, step: 0.1, fallback: 0 },
	nodeSizeScale: { min: 0.4, max: 3, step: 0.1, fallback: 1 },
	linkThickness: { min: 0.3, max: 4, step: 0.1, fallback: 1 },
	centerForce: { min: 0, max: 1, step: 0.01, fallback: 0.5 },
	repelForce: { min: 0, max: 20, step: 0.1, fallback: 10 },
	linkForce: { min: 0, max: 1, step: 0.01, fallback: 1 },
	linkDistance: { min: 20, max: 300, step: 1, fallback: 80 },
};

export const GRAPH_FORCE_SETTINGS: readonly GraphNumberSetting[] = [
	"centerForce",
	"repelForce",
	"linkForce",
	"linkDistance",
];

export const GRAPH_DISPLAY_SETTINGS: readonly GraphNumberSetting[] = [
	"textFadeThreshold",
	"nodeSizeScale",
	"linkThickness",
];

const NUMBER_KEYS = Object.keys(GRAPH_NUMBER_RANGES) as GraphNumberSetting[];
const RANGE_LOOKUP = new Map(Object.entries(GRAPH_NUMBER_RANGES));

/** The slider range and default of a numeric graph setting. */
export function graphNumberRange(key: GraphNumberSetting): GraphNumberRange {
	return RANGE_LOOKUP.get(key) ?? GRAPH_NUMBER_RANGES.nodeSizeScale;
}

/** The legend filters alone: "Show everything" restores these and keeps forces, display and groups. */
export const DEFAULT_GRAPH_FILTERS: Pick<
	GraphSettings,
	"showWikiLinks" | "hiddenRelationships" | "hiddenTypes" | "showOrphans" | "search"
> = {
	showWikiLinks: true,
	hiddenRelationships: [],
	hiddenTypes: [],
	showOrphans: true,
	search: "",
};

/** Forces back to their defaults, for "Restore defaults". */
export function defaultGraphForces(): Partial<GraphSettings> {
	return Object.fromEntries(
		GRAPH_FORCE_SETTINGS.map((key) => [key, graphNumberRange(key).fallback]),
	);
}

export function clampGraphNumber(key: GraphNumberSetting, value: unknown): number {
	const { min, max, fallback } = graphNumberRange(key);
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, value));
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function colorGroupFrom(value: unknown, index: number): GraphColorGroup | null {
	if (!isRecord(value) || typeof value.query !== "string") return null;
	const color = typeof value.color === "string" ? value.color : "";
	const id = typeof value.id === "string" && value.id ? value.id : `group-${index}`;
	return { id, query: value.query, color };
}

export function colorGroupsFrom(value: unknown): GraphColorGroup[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(colorGroupFrom)
		.filter((group): group is GraphColorGroup => group !== null);
}

function numbersFrom(source: UnknownRecord): Record<GraphNumberSetting, number> {
	return Object.fromEntries(
		NUMBER_KEYS.map((key) => [key, clampGraphNumber(key, Reflect.get(source, key))]),
	) as Record<GraphNumberSetting, number>;
}

/** Reads graph settings defensively: anything unexpected falls back to the default. */
export function graphSettingsFrom(source: UnknownRecord): GraphSettings {
	return {
		showWikiLinks: source.showWikiLinks !== false,
		hiddenRelationships: stringArray(source.hiddenRelationships),
		hiddenTypes: stringArray(source.hiddenTypes),
		showOrphans: source.showOrphans !== false,
		showLabels: source.showLabels !== false,
		search: typeof source.search === "string" ? source.search : "",
		colorGroups: colorGroupsFrom(source.colorGroups),
		showArrows: source.showArrows === true,
		...numbersFrom(source),
	};
}

/** Built by the reader itself, so defaults and read-back settings serialize with the same key order. */
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = graphSettingsFrom({});

export const GRAPH_SETTING_KEYS: readonly string[] = Object.keys(
	DEFAULT_GRAPH_SETTINGS,
);

/** True when a stored presentation carries any graph setting, even while it shows another layout. */
export function hasGraphSettings(source: UnknownRecord): boolean {
	return GRAPH_SETTING_KEYS.some((key) => key in source);
}
