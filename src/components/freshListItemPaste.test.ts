import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleFreshListItemPlainTextPaste } from "./freshListItemPaste";

const formattedInline = [
	{ type: "text", text: "Bold", styles: { bold: true } },
];

function makePasteFixture({
	html = "",
	text,
	existingText = "",
	targetType = "bulletListItem",
	parsedContent = formattedInline,
}: {
	html?: string;
	text: string;
	existingText?: string;
	targetType?: string;
	parsedContent?: unknown[];
}) {
	const root = document.createElement("div");
	const item = document.createElement("div");
	const inline = document.createElement("div");
	item.setAttribute("data-content-type", targetType);
	inline.textContent = existingText;
	item.appendChild(inline);
	root.appendChild(item);
	document.body.appendChild(root);

	const event = {
		clipboardData: {
			getData: vi.fn((format: string) => {
				if (format === "text/html") return html;
				if (format === "blocknote/html" || format === "text/markdown")
					return "";
				return text;
			}),
			types: html ? ["text/html", "text/plain"] : ["text/plain"],
		},
		currentTarget: root,
		preventDefault: vi.fn(),
		target: inline,
	} as never;
	const editor = {
		focus: vi.fn(),
		insertInlineContent: vi.fn(),
		tryParseMarkdownToBlocks: vi.fn(() => [
			{ type: "paragraph", content: parsedContent },
		]),
	};
	const runEditorAction = vi.fn((action: () => void) => action());

	return { editor, event, inline, runEditorAction };
}

describe("handleFreshListItemPlainTextPaste", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("builds the editor paste handler without unsupported Safari lookbehind", async () => {
		const BrowserUint8Array = globalThis.Uint8Array;
		globalThis.Uint8Array = new TextEncoder().encode("")
			.constructor as Uint8ArrayConstructor;
		let output = "";
		try {
			const { build } = await import("esbuild");
			const bundle = await build({
				bundle: true,
				entryPoints: [resolve("src/components/freshListItemPaste.ts")],
				format: "iife",
				target: "esnext",
				write: false,
			});
			output = bundle.outputFiles[0]?.text ?? "";
		} finally {
			globalThis.Uint8Array = BrowserUint8Array;
		}

		expect(output).not.toContain("(?<!");
	});

	it.each([
		{
			html: "",
			text: "Pasted quote text",
			existingText: "",
			name: "empty quote",
		},
		{
			html: "<p><strong>Rich</strong> paste</p>",
			text: "Rich paste",
			existingText: "Existing quote",
			name: "quote with text and rich clipboard",
		},
		{
			html: "",
			text: "First line\nSecond line",
			existingText: "",
			name: "multi-line quote",
		},
	])("keeps paste inside a $name", ({ html, text, existingText }) => {
		const fixture = makePasteFixture({
			html,
			text,
			existingText,
			targetType: "quote",
		});

		expect(
			handleFreshListItemPlainTextPaste({
				editable: true,
				editor: fixture.editor,
				event: fixture.event,
				runEditorAction: fixture.runEditorAction,
			}),
		).toBe(true);
		expect(fixture.editor.insertInlineContent).toHaveBeenCalledWith(text, {
			updateSelection: true,
		});
		expect(fixture.event.preventDefault).toHaveBeenCalled();
	});

	it("leaves HTML paste to the normal rich paste handler", () => {
		const fixture = makePasteFixture({
			html: "<p><strong>Bold</strong></p>",
			text: "Bold",
		});

		expect(
			handleFreshListItemPlainTextPaste({
				editable: true,
				editor: fixture.editor,
				event: fixture.event,
				runEditorAction: fixture.runEditorAction,
			}),
		).toBe(false);

		expect(fixture.editor.insertInlineContent).not.toHaveBeenCalled();
		expect(fixture.event.preventDefault).not.toHaveBeenCalled();
		expect(fixture.runEditorAction).not.toHaveBeenCalled();
	});

	it("parses Markdown plain text into inline formatting while keeping an empty bullet item", () => {
		const fixture = makePasteFixture({ text: "**Bold**" });

		expect(
			handleFreshListItemPlainTextPaste({
				editable: true,
				editor: fixture.editor,
				event: fixture.event,
				runEditorAction: fixture.runEditorAction,
			}),
		).toBe(true);

		expect(fixture.editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
			"**Bold**",
		);
		expect(fixture.editor.insertInlineContent).toHaveBeenCalledWith(
			formattedInline,
			{ updateSelection: true },
		);
		expect(fixture.event.preventDefault).toHaveBeenCalled();
	});

	it.each([
		{ text: "*Italic*", parsesMarkdown: true },
		{ text: "word*literal*", parsesMarkdown: false },
	])(
		"preserves single-asterisk Markdown boundaries for $text",
		({ text, parsesMarkdown }) => {
			const fixture = makePasteFixture({ text });

			handleFreshListItemPlainTextPaste({
				editable: true,
				editor: fixture.editor,
				event: fixture.event,
				runEditorAction: fixture.runEditorAction,
			});

			if (parsesMarkdown) {
				expect(fixture.editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
					text,
				);
			} else {
				expect(fixture.editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled();
				expect(fixture.editor.insertInlineContent).toHaveBeenCalledWith(text, {
					updateSelection: true,
				});
			}
		},
	);

	it("keeps plain text insertion on the existing path", () => {
		const fixture = makePasteFixture({ text: "Plain paste" });

		expect(
			handleFreshListItemPlainTextPaste({
				editable: true,
				editor: fixture.editor,
				event: fixture.event,
				runEditorAction: fixture.runEditorAction,
			}),
		).toBe(true);

		expect(fixture.editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled();
		expect(fixture.editor.insertInlineContent).toHaveBeenCalledWith(
			"Plain paste",
			{
				updateSelection: true,
			},
		);
	});

	it.each([
		{ html: "<p><strong>Bold</strong></p>", text: "Bold" },
		{ text: "**Bold**" },
	])(
		"leaves a non-empty list item to the normal rich paste handler",
		(clipboard) => {
			const fixture = makePasteFixture({
				...clipboard,
				existingText: "Already here",
			});

			expect(
				handleFreshListItemPlainTextPaste({
					editable: true,
					editor: fixture.editor,
					event: fixture.event,
					runEditorAction: fixture.runEditorAction,
				}),
			).toBe(false);

			expect(fixture.event.preventDefault).not.toHaveBeenCalled();
			expect(fixture.editor.insertInlineContent).not.toHaveBeenCalled();
		},
	);
});
