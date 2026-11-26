import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";
import { schema } from "../components/editorSchema";
import {
	installRichEditorSafeTablePaste,
	sanitizePastedTableSpans,
} from "./richEditorSafeTablePaste";

type CellSpec = { text: string; span?: string };

function tableMarkup(rows: CellSpec[][]): string {
	const table = document.createElement("table");
	const body = table.createTBody();
	for (const cells of rows) {
		const row = body.insertRow();
		for (const { text, span } of cells) {
			const cell = row.insertCell();
			cell.textContent = text;
			if (span !== undefined) cell.setAttribute("colspan", span);
		}
	}
	return String(Reflect.get(table, "outerHTML"));
}

function unsafeSpanTable(span: string): string {
	return tableMarkup([
		[{ text: "Name" }, { text: "Status" }],
		[{ text: "Alpha", span }],
	]);
}

function guardedEditor() {
	const editor = BlockNoteEditor.create({ schema });
	const viewPaste = vi.fn();
	Object.defineProperty(editor, "prosemirrorView", {
		configurable: true,
		value: Object.fromEntries([["pasteHTML", viewPaste]]),
	});
	installRichEditorSafeTablePaste(editor);
	return { editor, viewPaste };
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
			const { editor, viewPaste } = guardedEditor();

			expect(() => editor.pasteHTML(unsafeSpanTable(span))).not.toThrow();
			expect(viewPaste).toHaveBeenCalledTimes(1);
		},
	);

	it("pastes Markdown with an unsafe table span without a RangeError", () => {
		const { editor, viewPaste } = guardedEditor();
		const markdown = ["Intro", "", unsafeSpanTable("1.5")].join("\n");

		expect(() => editor.pasteMarkdown(markdown)).not.toThrow();
		expect(viewPaste).toHaveBeenCalledTimes(1);
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
		const { editor, viewPaste } = guardedEditor();
		const guardedPaste = Reflect.get(editor, "pasteHTML");

		installRichEditorSafeTablePaste(editor);
		editor.pasteHTML(unsafeSpanTable("2"));

		expect(Reflect.get(editor, "pasteHTML")).toBe(guardedPaste);
		expect(viewPaste).toHaveBeenCalledTimes(1);
	});

	it("ignores values that are not BlockNote editors", () => {
		expect(() => installRichEditorSafeTablePaste(null)).not.toThrow();
		expect(() => installRichEditorSafeTablePaste({})).not.toThrow();
	});

	it("sanitizes raw BlockNote clipboard markup before ProseMirror parses it", () => {
		const { editor, viewPaste } = guardedEditor();

		editor.pasteHTML(unsafeSpanTable("-2"), true);

		expect(viewPaste).toHaveBeenCalledTimes(1);
		expect(String(viewPaste.mock.calls[0]?.[0])).not.toContain("-2");
	});
});
