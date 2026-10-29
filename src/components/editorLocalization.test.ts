import { describe, expect, it } from "vitest";
import {
	applyBlockNoteLocale,
	createBlockNoteDictionary,
} from "./editorLocalization";

describe("createBlockNoteDictionary", () => {
	it("uses app translations for built-in names and the empty-line placeholder", () => {
		const dictionary = createBlockNoteDictionary("ru-RU");

		expect(dictionary.slash_menu.quote.title).toBe("Цитата");
		expect(dictionary.slash_menu.bullet_list.title).toBe(
			"Маркированный список",
		);
		expect(dictionary.placeholders.default).toBe(
			"Введите текст или символ «/» для команд",
		);
	});

	it("keeps English and falls back per translation key", () => {
		const english = createBlockNoteDictionary("en");
		const unsupported = createBlockNoteDictionary("be-Latn");

		expect(english.slash_menu.heading.title).toBe("Heading 1");
		expect(unsupported.slash_menu.heading.title).not.toBe(
			english.slash_menu.heading.title,
		);
		expect(unsupported.slash_menu.heading_2.title).toBe("Zahalovak 2");
	});

	it("refreshes placeholder CSS when the app language changes", () => {
		const editor = {
			dictionary: createBlockNoteDictionary("en"),
			domElement: document.createElement("div"),
		};

		applyBlockNoteLocale(editor, "ru-RU");

		expect(
			editor.domElement.style.getPropertyValue("--editor-empty-placeholder"),
		).toBe('"Введите текст или символ «/» для команд"');
		expect(
			editor.domElement.style.getPropertyValue("--editor-title-placeholder"),
		).toBe('"Заголовок"');
		expect(
			document.getElementById("tolaria-localized-editor-placeholders")
				?.textContent,
		).toContain("--editor-title-placeholder");
		expect(
			document.getElementById("tolaria-localized-editor-placeholders")
				?.textContent,
		).toContain('[data-content-type="heading"]:not([data-level])');
	});
});
