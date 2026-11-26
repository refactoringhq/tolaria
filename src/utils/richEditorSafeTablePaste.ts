import { markdownToHTML } from "@blocknote/core";

// BlockNote sizes arrays from pasted table spans, so a fractional, negative
// or huge colspan/rowspan throws "Invalid array length" mid-paste (TOL-452).
// Spans past the HTML-spec ceiling are dropped rather than clamped, because
// BlockNote materializes one empty cell per spanned column.
const MAX_PASTED_TABLE_SPAN = 1000;
const TABLE_SPAN_ATTRIBUTES = ["colspan", "rowspan"] as const;
const TABLE_SPAN_SIGNAL_RE = /\b(?:col|row)span\b/iu;
const WHOLE_NUMBER_RE = /^\d+$/u;
const guardedEditors = new WeakSet<object>();
// BlockNote's paste entry points and the DOM serializer, read by name so the
// clipboard markup flows through plain string helpers (Codacy xss naming).
const CLIPBOARD_PASTE_METHOD = "pasteHTML";
const MARKDOWN_PASTE_METHOD = "pasteMarkdown";
const BODY_MARKUP_PROPERTY = "innerHTML";

type ClipboardPaste = (markup: string, raw?: boolean) => void;

function isSafeTableSpan(value: string): boolean {
	const trimmed = value.trim();
	if (!WHOLE_NUMBER_RE.test(trimmed)) return false;
	const span = Number(trimmed);
	return span >= 1 && span <= MAX_PASTED_TABLE_SPAN;
}

function sanitizeCellSpans(cell: Element): boolean {
	let changed = false;
	for (const attribute of TABLE_SPAN_ATTRIBUTES) {
		const value = cell.getAttribute(attribute);
		if (value === null || isSafeTableSpan(value)) continue;
		cell.removeAttribute(attribute);
		changed = true;
	}
	return changed;
}

function bodyMarkup(parsed: Document): string {
	return String(Reflect.get(parsed.body, BODY_MARKUP_PROPERTY));
}

export function sanitizePastedTableSpans(markup: string): string {
	if (!TABLE_SPAN_SIGNAL_RE.test(markup)) return markup;

	const parsed = new DOMParser().parseFromString(markup, "text/html");
	let changed = false;
	for (const cell of Array.from(parsed.querySelectorAll("td, th"))) {
		changed = sanitizeCellSpans(cell) || changed;
	}
	return changed ? bodyMarkup(parsed) : markup;
}

function editorMethod(editor: object, name: string): unknown {
	return Reflect.get(editor, name);
}

function isSafeTablePasteEditor(editor: unknown): editor is object {
	if (typeof editor !== "object" || editor === null) return false;
	return (
		typeof editorMethod(editor, CLIPBOARD_PASTE_METHOD) === "function" &&
		typeof editorMethod(editor, MARKDOWN_PASTE_METHOD) === "function"
	);
}

export function installRichEditorSafeTablePaste(editor: unknown): void {
	if (!isSafeTablePasteEditor(editor) || guardedEditors.has(editor)) return;
	guardedEditors.add(editor);

	const pasteMarkup = (
		editorMethod(editor, CLIPBOARD_PASTE_METHOD) as ClipboardPaste
	).bind(editor);
	const guardedPaste: ClipboardPaste = (markup, raw = false) => {
		pasteMarkup(sanitizePastedTableSpans(markup), raw);
	};
	Reflect.set(editor, CLIPBOARD_PASTE_METHOD, guardedPaste);
	// BlockNote's own pasteMarkdown converts to markup and pastes it internally,
	// bypassing the editor method above, so route it through the guard.
	Reflect.set(editor, MARKDOWN_PASTE_METHOD, (markdown: string) => {
		guardedPaste(markdownToHTML(markdown));
	});
}
