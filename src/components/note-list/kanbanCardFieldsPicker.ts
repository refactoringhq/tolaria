import { COLLECTION_PRESENTATION_LIST } from "../../collections/collectionTypes";
import { type AppLocale, translate } from "../../lib/i18n";
import type { NoteListPropertyPicker } from "./noteListHooks";

interface CardFieldsSource {
	layout: string;
	properties: string[];
	cardFields: string[];
	changeCardProperties: (properties: string[] | null) => void;
}

const EMPTY_LIST_PICKER: Pick<
	NoteListPropertyPicker,
	"scope" | "availableProperties" | "currentDisplay"
> = {
	scope: "view",
	availableProperties: [],
	currentDisplay: [],
};

/**
 * In Kanban and Calendar, the note-list visible-properties control edits the card fields. Until the layout
 * has its own fields, cards show the same properties as list rows.
 */
export function layoutPropertyPicker(
	layout: CardFieldsSource,
	listPicker: NoteListPropertyPicker | null,
	locale: AppLocale,
): NoteListPropertyPicker | null {
	if (layout.layout === COLLECTION_PRESENTATION_LIST) return listPicker;
	if (layout.layout === "graph") return null;
	const list = listPicker ?? EMPTY_LIST_PICKER;
	return {
		scope: list.scope,
		availableProperties: [
			...new Set([...list.availableProperties, ...layout.cardFields]),
		],
		currentDisplay:
			layout.properties.length > 0 ? layout.properties : list.currentDisplay,
		onSave: layout.changeCardProperties,
		triggerTitle: translate(locale, "layout.cardFields"),
	};
}
