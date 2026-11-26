import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import { schema } from "../components/editorSchema";
import {
	installRichEditorSafeTablePaste,
	sanitizePastedTableSpans,
} from "./richEditorSafeTablePaste";

type CellSpec = { text: string; span?: string };

function cellMarkup({ text, span }: CellSpec): string {
	const spanAttribute = span === undefined ? "" : ` colspan="${span}"`;
	return ["<td", spanAttribute, ">", text, "</td>"].join("");
}

function tableMarkup(rows: CellSpec[][]): string {
	const body = rows
		.map((cells) => ["<tr>", ...cells.map(cellMarkup), "</tr>"].join(""))
		.join("");
	return ["<table><tbody>", body, "</tbody></table>"].join("");
}

function unsafeSpanTable(span: string): string {
	return tableMarkup([
		[{ text: "Name" }, { text: "Status" }],
		[{ text: "Alpha", span }],
	]);
}

function guardedEditor() {
	const editor = BlockNoteEditor.create({ schema });
	const viewPasteHTML = vi.fn();
	Object.defineProperty(editor, "prosemirrorView", {
		configurable: true,
		value: { pasteHTML: viewPasteHTML },
	});
	installRichEditorSafeTablePaste(editor);
	return { editor, viewPasteHTML };
}

function firstTableColspans(blocks: unknown[]): unknown[] {
	const table = blocks.find(
		(block) => (block as { type?: string }).type === "table",
	) as { content: { rows: { cells: { props?: { colspan?: unknown } }[] }[] } };
	return table.content.rows.flatMap((row) =>
		row.cells.map((cell) => cell.props?.colspan),
	);
}

describe("rich editor safe table paste", () => {
	it.each(["1.5", "-2", "99999999999"])(
		"pastes a table whose cell span is %s without a RangeError",
		(span) => {
			const { editor, viewPasteHTML } = guardedEditor();

			expect(() => editor.pasteHTML(unsafeSpanTable(span))).not.toThrow();
			expect(viewPasteHTML).toHaveBeenCalledTimes(1);
		},
	);

	it("pastes Markdown with an unsafe table span without a RangeError", () => {
		const { editor, viewPasteHTML } = guardedEditor();
		const markdown = ["Intro", "", unsafeSpanTable("1.5")].join("\n");

		expect(() => editor.pasteMarkdown(markdown)).not.toThrow();
		expect(viewPasteHTML).toHaveBeenCalledTimes(1);
	});

	it("parses unsafe and oversized spans as single cells", () => {
		const editor = BlockNoteEditor.create({ schema });
		const markup = tableMarkup([
			[
				{ text: "A", span: "-2" },
				{ text: "B", span: "5000" },
			],
			[
				{ text: "C", span: "2" },
				{ text: "D", span: "abc" },
			],
		]);

		const blocks = editor.tryParseHTMLToBlocks(
			sanitizePastedTableSpans(markup),
		);

		expect(firstTableColspans(blocks)).toEqual([1, 1, 2, 1]);
	});

	it("leaves markup without unsafe spans untouched", () => {
		const markup = tableMarkup([[{ text: "A", span: "2" }], [{ text: "B" }]]);

		expect(sanitizePastedTableSpans(markup)).toBe(markup);
		expect(sanitizePastedTableSpans("plain text")).toBe("plain text");
	});

	it("installs the guard once even when the editor hook re-renders", () => {
		const { editor, viewPasteHTML } = guardedEditor();
		const guardedPasteHTML = editor.pasteHTML;

		installRichEditorSafeTablePaste(editor);
		editor.pasteHTML(unsafeSpanTable("2"));

		expect(editor.pasteHTML).toBe(guardedPasteHTML);
		expect(viewPasteHTML).toHaveBeenCalledTimes(1);
	});

	it("ignores values that are not BlockNote editors", () => {
		expect(() => installRichEditorSafeTablePaste(null)).not.toThrow();
		expect(() => installRichEditorSafeTablePaste({})).not.toThrow();
	});

	it("sanitizes raw BlockNote clipboard markup before ProseMirror parses it", () => {
		const { editor, viewPasteHTML } = guardedEditor();

		editor.pasteHTML(unsafeSpanTable("-2"), true);

		expect(viewPasteHTML).toHaveBeenCalledTimes(1);
		expect(String(viewPasteHTML.mock.calls[0]?.[0])).not.toContain("-2");
	});
});
