import type { ClipboardEvent } from "react";

export type InlineContentEditor = {
	focus: () => void;
	insertInlineContent: (
		content: string | unknown[],
		options: { updateSelection: true },
	) => void;
	tryParseMarkdownToBlocks?: (markdown: string) => PasteBlock[];
};

type PasteBlock = {
	children?: PasteBlock[];
	content?: unknown[] | string;
	type: string;
};

type FreshListItemPasteOptions = {
	editable: boolean;
	editor: InlineContentEditor;
	event: ClipboardEvent<HTMLDivElement>;
	runEditorAction: (action: () => void) => void;
};

const LIST_ITEM_SELECTOR =
	'[data-content-type="bulletListItem"], [data-content-type="checkListItem"]';
const QUOTE_SELECTOR = '[data-content-type="quote"]';
const MARKDOWN_INLINE_SIGNAL_RE =
	/(?:\*\*|__)\S[\s\S]*?\S(?:\*\*|__)|(?:^|[^\w])\*(?!\s)\S[^*\n]*\*(?!\w)|~~\S[\s\S]*?\S~~|`[^`\n]+`|\[[^\]\n]+\]\([^)]+\)/u;

function singleParagraphContent(blocks: PasteBlock[]): unknown[] | null {
	if (blocks.length !== 1) return null;

	const [block] = blocks;
	if (block.type !== "paragraph" || block.children?.length) return null;
	return Array.isArray(block.content) && block.content.length > 0
		? block.content
		: null;
}

function markdownPasteText(
	event: ClipboardEvent<HTMLDivElement>,
	plainText: string,
): string | null {
	const markdown = event.clipboardData.getData("text/markdown");
	if (markdown.length > 0) return markdown;
	return MARKDOWN_INLINE_SIGNAL_RE.test(plainText) ? plainText : null;
}

function markdownPasteContent(
	markdown: string,
	editor: InlineContentEditor,
): unknown[] | null {
	return editor.tryParseMarkdownToBlocks
		? singleParagraphContent(editor.tryParseMarkdownToBlocks(markdown))
		: null;
}

function parsedInlineContent(
	event: ClipboardEvent<HTMLDivElement>,
	editor: InlineContentEditor,
	plainText: string,
): unknown[] | string | null {
	const html =
		event.clipboardData.getData("blocknote/html") ||
		event.clipboardData.getData("text/html");
	if (html.length > 0) return null;

	const markdown = markdownPasteText(event, plainText);
	return markdown === null ? plainText : markdownPasteContent(markdown, editor);
}

function eventTargetElement(target: EventTarget | null): HTMLElement | null {
	if (target instanceof HTMLElement) return target;
	if (!(target instanceof Node)) return null;
	return target.parentElement;
}

function isEmptyListItemPaste(event: ClipboardEvent<HTMLDivElement>): boolean {
	const target = eventTargetElement(event.target);
	const listItem = target?.closest<HTMLElement>(LIST_ITEM_SELECTOR);
	if (!listItem || !event.currentTarget.contains(listItem)) return false;
	return (
		(listItem.textContent ?? "").replace(/[\u200B\uFEFF]/g, "").trim()
			.length === 0
	);
}

function isQuotePaste(event: ClipboardEvent<HTMLDivElement>): boolean {
	const target = eventTargetElement(event.target);
	const quote = target?.closest<HTMLElement>(QUOTE_SELECTOR);
	return Boolean(quote && event.currentTarget.contains(quote));
}

function hasClipboardContent(
	event: ClipboardEvent<HTMLDivElement>,
	plainText: string,
): boolean {
	return Boolean(
		plainText ||
			event.clipboardData.getData("text/html") ||
			event.clipboardData.getData("blocknote/html"),
	);
}

function freshListItemContent(
	editable: boolean,
	event: ClipboardEvent<HTMLDivElement>,
	editor: InlineContentEditor,
): unknown[] | string | null {
	if (!editable || !isEmptyListItemPaste(event)) return null;

	const text = event.clipboardData.getData("text/plain");
	return hasClipboardContent(event, text)
		? parsedInlineContent(event, editor, text)
		: null;
}

function quotePasteContent(
	editable: boolean,
	event: ClipboardEvent<HTMLDivElement>,
): string | null {
	if (!editable || !isQuotePaste(event)) return null;
	const text = event.clipboardData.getData("text/plain");
	return text.length > 0 ? text : null;
}

export function handleFreshListItemPlainTextPaste({
	editable,
	editor,
	event,
	runEditorAction,
}: FreshListItemPasteOptions): boolean {
	const content =
		quotePasteContent(editable, event) ??
		freshListItemContent(editable, event, editor);
	if (content === null) return false;

	event.preventDefault();
	runEditorAction(() => {
		editor.focus();
		editor.insertInlineContent(content, { updateSelection: true });
	});
	return true;
}
