import type { VaultEntry } from "../../../types";
import { cardDisplayProperties } from "../kanbanModel";
import type { CalendarItem } from "./calendarModel";

/** Height of a day's number row, above the item lanes. */
export const DAY_HEADER_PX = 30;
export const LANE_GAP_PX = 3;
const TITLE_LINE_PX = 20;
const FIELD_LINE_PX = 16;
const CARD_VERTICAL_SPACE_PX = 8;
const MIN_LANE_PX = 38;
const TITLE_CHARS_PER_LINE = 10;
const FIELD_CHARS_PER_LINE = 14;
/** Lanes per row before the grid has been measured (tests, first paint). */
const FALLBACK_LANES = 4;

interface CardFieldSource {
	cardProperties: string[];
	typeEntryMap: Record<string, VaultEntry>;
	displayPropsOverride?: string[] | null;
}

function wrappedLineCount(value: string, charsPerLine: number): number {
	const words = value.trim().split(/\s+/).filter(Boolean);
	let lines = 1;
	let lineLength = 0;
	for (const word of words) {
		const wordLines = Math.ceil(word.length / charsPerLine);
		if (wordLines > 1) {
			lines += wordLines - 1;
			lineLength = word.length % charsPerLine;
			continue;
		}
		if (lineLength > 0 && lineLength + word.length + 1 > charsPerLine) {
			lines += 1;
			lineLength = word.length;
		} else {
			lineLength += word.length + (lineLength > 0 ? 1 : 0);
		}
	}
	return lines;
}

function propertyText(entry: VaultEntry, property: string): string {
	const value = Reflect.get(entry.properties, property);
	const rendered = Array.isArray(value)
		? value.join(", ")
		: String(value ?? "");
	return `${property} ${rendered.replaceAll("[", "").replaceAll("]", "")}`;
}

export function hasCardFields(
	entry: VaultEntry,
	source: CardFieldSource,
): boolean {
	return (
		cardDisplayProperties(
			entry,
			source.cardProperties,
			source.typeEntryMap,
			source.displayPropsOverride,
		).length > 0
	);
}

/** Reserve a lane tall enough for the longest wrapped card in the visible calendar range. */
export function laneHeightFor(
	items: CalendarItem[],
	source: CardFieldSource,
): number {
	return items.reduce((maxHeight, item) => {
		const titleLines = wrappedLineCount(item.entry.title, TITLE_CHARS_PER_LINE);
		const fields = cardDisplayProperties(
			item.entry,
			source.cardProperties,
			source.typeEntryMap,
			source.displayPropsOverride,
		);
		const fieldsText = fields.map((property) =>
			propertyText(item.entry, property),
		);
		const fieldLines = fieldsText.reduce(
			(total, field) => total + wrappedLineCount(field, FIELD_CHARS_PER_LINE),
			0,
		);
		const height =
			titleLines * TITLE_LINE_PX +
			fieldLines * FIELD_LINE_PX +
			CARD_VERTICAL_SPACE_PX;
		return Math.max(maxHeight, height);
	}, MIN_LANE_PX);
}

/** How many item lanes fit in one week row of the measured grid. */
export function lanesThatFit(
	gridHeight: number,
	rows: number,
	laneHeight: number,
): number {
	if (gridHeight <= 0) return FALLBACK_LANES;
	const rowHeight = gridHeight / rows;
	return Math.max(
		1,
		Math.floor((rowHeight - DAY_HEADER_PX - 4) / (laneHeight + LANE_GAP_PX)),
	);
}
