import type { Dictionary } from "@blocknote/core";
import {
	de,
	en,
	es,
	fr,
	it,
	ja,
	ko,
	pl,
	pt,
	ru,
	sk,
	uk,
	vi,
	zh,
	zhTW,
} from "@blocknote/core/locales";
import { type AppLocale, translate } from "../lib/i18n";

const BLOCKNOTE_DICTIONARIES: Partial<Record<AppLocale, Dictionary>> = {
	"de-DE": de,
	"es-ES": es,
	"es-419": es,
	"fr-FR": fr,
	"it-IT": it,
	"ja-JP": ja,
	"ko-KR": ko,
	"pl-PL": pl,
	"pt-BR": pt,
	"pt-PT": pt,
	"ru-RU": ru,
	"sk-SK": sk,
	"uk-UA": uk,
	vi,
	"zh-CN": zh,
	"zh-TW": zhTW,
};

const PLACEHOLDER_STYLE_ID = "tolaria-localized-editor-placeholders";

function blockNoteDictionaryForLocale(locale: AppLocale): Dictionary {
	return (
		Object.entries(BLOCKNOTE_DICTIONARIES).find(
			([candidate]) => candidate === locale,
		)?.[1] ?? en
	);
}

function localizeHeadings(dictionary: Dictionary, locale: AppLocale): void {
	dictionary.slash_menu.heading.title = translate(
		locale,
		"editor.blockType.heading1",
	);
	dictionary.slash_menu.heading_2.title = translate(
		locale,
		"editor.blockType.heading2",
	);
	dictionary.slash_menu.heading_3.title = translate(
		locale,
		"editor.blockType.heading3",
	);
	dictionary.slash_menu.heading_4.title = translate(
		locale,
		"editor.blockType.heading4",
	);
	dictionary.slash_menu.heading_5.title = translate(
		locale,
		"editor.blockType.heading5",
	);
	dictionary.slash_menu.heading_6.title = translate(
		locale,
		"editor.blockType.heading6",
	);
}

function localizeListsAndBlocks(
	dictionary: Dictionary,
	locale: AppLocale,
): void {
	dictionary.slash_menu.paragraph.title = translate(
		locale,
		"editor.blockType.paragraph",
	);
	dictionary.slash_menu.quote.title = translate(
		locale,
		"editor.blockType.quote",
	);
	dictionary.slash_menu.bullet_list.title = translate(
		locale,
		"editor.blockType.bulletList",
	);
	dictionary.slash_menu.numbered_list.title = translate(
		locale,
		"editor.blockType.numberedList",
	);
	dictionary.slash_menu.check_list.title = translate(
		locale,
		"editor.blockType.checklist",
	);
	dictionary.slash_menu.code_block.title = translate(
		locale,
		"editor.blockType.codeBlock",
	);
}

export function createBlockNoteDictionary(
	locale: AppLocale = "en",
): Dictionary {
	const source = blockNoteDictionaryForLocale(locale);
	const dictionary: Dictionary = {
		...source,
		slash_menu: Object.fromEntries(
			Object.entries(source.slash_menu).map(([key, item]) => [
				key,
				{ ...item },
			]),
		) as Dictionary["slash_menu"],
		placeholders: { ...source.placeholders },
	};
	localizeHeadings(dictionary, locale);
	localizeListsAndBlocks(dictionary, locale);
	dictionary.placeholders.default = translate(locale, "editor.placeholder");
	return dictionary;
}

export function applyBlockNoteLocale(
	editor: { dictionary?: Dictionary; domElement?: HTMLElement },
	locale: AppLocale = "en",
): void {
	const dictionary = createBlockNoteDictionary(locale);
	if (editor.dictionary) Object.assign(editor.dictionary, dictionary);
	if (!document.getElementById(PLACEHOLDER_STYLE_ID)) {
		const style = document.createElement("style");
		style.id = PLACEHOLDER_STYLE_ID;
		style.textContent = `
			.editor__blocknote-container [data-is-empty-and-focused] .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
				content: var(--editor-empty-placeholder) !important;
			}
			.editor__blocknote-container [data-content-type="heading"]:not([data-level]) .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
				content: var(--editor-title-placeholder, "Title") !important;
			}
		`;
		document.head.append(style);
	}
	if (editor.domElement) {
		editor.domElement.style.setProperty(
			"--editor-empty-placeholder",
			JSON.stringify(dictionary.placeholders.default),
		);
		editor.domElement.style.setProperty(
			"--editor-title-placeholder",
			JSON.stringify(translate(locale, "editor.placeholder.title")),
		);
	}
}
