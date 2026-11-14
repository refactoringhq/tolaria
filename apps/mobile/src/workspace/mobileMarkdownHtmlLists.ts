import type {
	ListKind,
	MarkdownLine,
	MarkdownLineMatcher,
	MarkdownLines,
	ReadHtmlBlockResult,
	ReadListSourceLinesResult,
	ReadSourceLinesResult,
} from "./mobileDocumentContent.types";
import { escapeHtml } from "./mobileHtmlEncoding";
import { inlineMarkdownToHtml } from "./mobileMarkdownHtmlInline";
import {
	type MobileMarkdownListItem,
	mobileMarkdownListHtml,
} from "./mobileMarkdownListHtml";
import {
	isBackslashListHardBreakSourceLine,
	isIndentedListSourceLine,
	isIrregularOrderedDotListSource,
	isListContinuationSourceLine,
	isListHardBreakSourceLine,
	isOrderedParenListSourceLine,
	isOutdentedListSourceLine,
	leadingWhitespaceLength,
	listLine,
	orderedDotListSourceLineNumber,
} from "./mobileMarkdownSourceLines";

type MarkdownLineIndex = number;

function readIndentedSourceBlock(
	matches: MarkdownLineMatcher,
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readMatchingSourceLines(lines, startIndex, matches);
	return source
		? sourceLinesParagraphBlock(source.lines, source.nextIndex)
		: null;
}

export const readIndentedListSourceBlock = readIndentedSourceBlock.bind(
	null,
	isIndentedListSourceLine,
);

export function readListHardBreakSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readListSourceLines(lines, startIndex);
	if (!source?.hasHardBreak || !hasUnsupportedListHardBreakSource(source))
		return null;

	return sourceLinesParagraphBlock(source.lines, source.nextIndex);
}

export function hasUnsupportedListHardBreakSource(
	source: ReadListSourceLinesResult,
): boolean {
	return source.lines.some(isBackslashListHardBreakSourceLine);
}

export function readListSourceLines(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadListSourceLinesResult | null {
	const firstLine = lines[startIndex] ?? "";
	const first = listLine(firstLine);
	if (!first) return null;

	const baseIndent = leadingWhitespaceLength(firstLine);
	const source: ReadListSourceLinesResult = {
		baseIndent,
		hasContinuation: false,
		hasHardBreak: false,
		lines: [],
		nextIndex: startIndex,
	};

	while (source.nextIndex < lines.length) {
		const sourceLine = readListSourceLine(
			lines[source.nextIndex] ?? "",
			baseIndent,
		);
		if (!sourceLine) break;
		appendSourceLine(source, sourceLine);
	}

	return source;
}

export function appendSourceLine(
	source: ReadListSourceLinesResult,
	line: NonNullable<ReturnType<typeof readListSourceLine>>,
): void {
	source.hasContinuation ||= line.hasContinuation;
	source.hasHardBreak ||= line.hasHardBreak;
	source.lines.push(line.line);
	source.nextIndex += 1;
}

export function readListSourceLine(
	line: MarkdownLine,
	baseIndent: number,
): {
	hasContinuation: boolean;
	hasHardBreak: boolean;
	line: MarkdownLine;
} | null {
	if (!line.trim() || isOutdentedListSourceLine(line, baseIndent)) return null;

	const hasContinuation = isListContinuationSourceLine(line, baseIndent);
	if (!listLine(line) && !hasContinuation) return null;

	return {
		hasContinuation,
		hasHardBreak: isListHardBreakSourceLine(line),
		line,
	};
}

export const readOrderedParenListSourceBlock = readIndentedSourceBlock.bind(
	null,
	isOrderedParenListSourceLine,
);

export function readIrregularOrderedDotListSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readOrderedDotListSourceLines(lines, startIndex);
	if (!source || !isIrregularOrderedDotListSource(source.lines)) return null;

	return sourceLinesParagraphBlock(source.lines, source.nextIndex);
}

export function readOrderedDotListSourceLines(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadSourceLinesResult | null {
	return readMatchingSourceLines(
		lines,
		startIndex,
		(line) => orderedDotListSourceLineNumber(line) !== null,
	);
}

export function readMatchingSourceLines(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
	matches: MarkdownLineMatcher,
): ReadSourceLinesResult | null {
	if (!matches(lines[startIndex] ?? "")) return null;

	const sourceLines: string[] = [];
	let index = startIndex;
	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (!matches(line)) break;
		sourceLines.push(line);
		index += 1;
	}

	return { lines: sourceLines, nextIndex: index };
}

export function sourceLinesParagraphBlock(
	sourceLines: MarkdownLines,
	nextIndex: MarkdownLineIndex,
): ReadHtmlBlockResult {
	return {
		html: `<p>${sourceLines.map(escapeHtml).join("<br>")}</p>`,
		nextIndex,
	};
}

export function readList(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const first = listLine(lines[startIndex] ?? "");
	if (!first) return null;

	const items: MobileMarkdownListItem[] = [];
	let index = startIndex;
	const kind: ListKind = first.kind;

	while (
		index < lines.length &&
		appendNextListLine(items, lines[index] ?? "", first)
	) {
		index += 1;
	}

	return {
		html: mobileMarkdownListHtml(kind, items, inlineMarkdownToHtml),
		nextIndex: index,
	};
}

export function appendNextListLine(
	items: MobileMarkdownListItem[],
	line: MarkdownLine,
	first: MobileMarkdownListItem,
): boolean {
	const current = listLine(line);
	if (!current) return appendListContinuation(items, line);
	if (endsCurrentList(current, first)) return false;
	items.push(current);
	return true;
}

export function endsCurrentList(
	current: MobileMarkdownListItem,
	first: MobileMarkdownListItem,
): boolean {
	return (
		current.depth < first.depth ||
		(current.depth === first.depth && current.kind !== first.kind)
	);
}

export function appendListContinuation(
	items: MobileMarkdownListItem[],
	line: MarkdownLine,
): boolean {
	const item = items[items.length - 1];
	if (!item || !isListContinuationSourceLine(line, listIndentLength(item)))
		return false;
	item.paragraphs = [...(item.paragraphs ?? []), line.trim()];
	return true;
}

export function listIndentLength(item: MobileMarkdownListItem): number {
	return item.depth * 2;
}
