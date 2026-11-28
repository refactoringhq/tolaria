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

	it("provides full Turkish (tr-TR) BlockNote localization", () => {
		const dictionary = createBlockNoteDictionary("tr-TR");

		expect(dictionary.slash_menu.heading.title).toBe("Başlık 1");
		expect(dictionary.slash_menu.toggle_heading.title).toBe("Açılır Başlık 1");
		expect(dictionary.slash_menu.divider.title).toBe("Ayırıcı");
		expect(dictionary.slash_menu.page_break.title).toBe("Sayfa Sonu");
		expect(dictionary.file_blocks.add_button_text.image).toBe("Görsel ekle");
		expect(dictionary.toggle_blocks.add_block_button).toBe(
			"Boş açılır blok. Blok eklemek için tıklayın.",
		);
		expect(dictionary.suggestion_menu.no_items_title).toBe("Öğe bulunamadı");
		expect(dictionary.formatting_toolbar.file_download.tooltip.file).toBe(
			"Dosyayı indir",
		);
		expect(dictionary.comments.actions.resolve).toBe("Çözüldü olarak işaretle");
		expect(dictionary.comments.sidebar.more_replies(3)).toBe("3 yanıt daha");
		expect(dictionary.placeholders.default).toBe(
			"Metin girin veya komutlar için '/' yazın",
		);
	});
});
