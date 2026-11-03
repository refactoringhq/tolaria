import { afterEach, describe, expect, it, vi } from "vitest";
import { handleFreshListItemPlainTextPaste } from "./freshListItemPaste";

const formattedInline = [
	{ type: "text", text: "Bold", styles: { bold: true } },
];

function makePasteFixture({
	html = "",
	text,
	existingText = "",
	parsedContent = formattedInline,
}: {
	html?: string;
	text: string;
	existingText?: string;
	parsedContent?: unknown[];
}) {
	const root = document.createElement("div");
	const item = document.createElement("div");
	const inline = document.createElement("div");
	item.setAttribute("data-content-type", "bulletListItem");
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
