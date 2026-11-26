import { markdownToHTML } from "@blocknote/core";

// BlockNote sizes arrays from pasted table spans, so a fractional, negative
// or huge colspan/rowspan throws "Invalid array length" mid-paste (TOL-452).
// Browsers clamp spans to the same HTML-spec ceiling.
const MAX_PASTED_TABLE_SPAN = 1000;
const TABLE_SPAN_ATTRIBUTES = ["colspan", "rowspan"] as const;
const TABLE_SPAN_SIGNAL_RE = /\b(?:col|row)span\b/iu;
const WHOLE_NUMBER_RE = /^\d+$/u;
const guardedEditors = new WeakSet<object>();

interface SafeTablePasteEditor {
	pasteHTML: (markup: string, raw?: boolean) => void;
	pasteMarkdown: (markdown: string) => void;
}

function safeTableSpan(value: string): string | null {
	const trimmed = value.trim();
	if (!WHOLE_NUMBER_RE.test(trimmed)) return null;
	const span = Number(trimmed);
	if (span < 1) return null;
	return String(Math.min(span, MAX_PASTED_TABLE_SPAN));
}

function sanitizeCellSpans(cell: Element): boolean {
	let changed = false;
	for (const attribute of TABLE_SPAN_ATTRIBUTES) {
		const value = cell.getAttribute(attribute);
		if (value === null) continue;
		const safeValue = safeTableSpan(value);
		if (safeValue === value) continue;
		changed = true;
		if (safeValue === null) cell.removeAttribute(attribute);
		else cell.setAttribute(attribute, safeValue);
	}
	return changed;
}

export function sanitizePastedTableSpans(markup: string): string {
	if (!TABLE_SPAN_SIGNAL_RE.test(markup)) return markup;

	const parsed = new DOMParser().parseFromString(markup, "text/html");
	let changed = false;
	for (const cell of Array.from(parsed.querySelectorAll("td, th"))) {
		changed = sanitizeCellSpans(cell) || changed;
	}
	return changed ? parsed.body.innerHTML : markup;
}

function isSafeTablePasteEditor(
	editor: unknown,
): editor is SafeTablePasteEditor {
	if (typeof editor !== "object" || editor === null) return false;
	const candidate = editor as Partial<SafeTablePasteEditor>;
	return (
		typeof candidate.pasteHTML === "function" &&
		typeof candidate.pasteMarkdown === "function"
	);
}

export function installRichEditorSafeTablePaste(editor: unknown): void {
	if (!isSafeTablePasteEditor(editor) || guardedEditors.has(editor)) return;
	guardedEditors.add(editor);

	const pasteHTML = editor.pasteHTML.bind(editor);
	editor.pasteHTML = (markup, raw = false) => {
		pasteHTML(sanitizePastedTableSpans(markup), raw);
	};
	// BlockNote's own pasteMarkdown converts to HTML and pastes it internally,
	// bypassing the editor method above, so route it through the guard.
	editor.pasteMarkdown = (markdown) => {
		editor.pasteHTML(markdownToHTML(markdown));
	};
}
