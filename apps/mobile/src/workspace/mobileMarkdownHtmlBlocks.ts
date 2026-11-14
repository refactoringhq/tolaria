import { mobileDiagramHtmlBlock } from "./mobileDiagramMarkdown";
import {
	isMobileDisplayMathStart,
	mobileDisplayMathLatex,
	readMobileDisplayMathBlock,
} from "./mobileDisplayMath";
import type {
	HtmlSnippet,
	ListKind,
	MarkdownBody,
	MarkdownLine,
	MarkdownLineMatcher,
	MarkdownLines,
	PlainText,
	ReadHtmlBlockResult,
	ReadListSourceLinesResult,
	ReadParagraphResult,
	ReadQuoteResult,
	ReadSourceLinesResult,
} from "./mobileDocumentContent.types";
import { escapeAttribute, escapeHtml } from "./mobileHtmlEncoding";
import {
	isMobileMarkdownCodeFenceClose,
	readMobileMarkdownCodeFence,
} from "./mobileMarkdownCodeFence";
import { inlineMarkdownToHtml } from "./mobileMarkdownHtmlInline";
import { mobileMarkdownImageHtml } from "./mobileMarkdownImage";
import {
	type MobileMarkdownListItem,
	mobileMarkdownListHtml,
} from "./mobileMarkdownListHtml";
import {
	explicitMarkdownHardBreak,
	isBackslashListHardBreakSourceLine,
	isCodeIndentedLine,
	isHorizontalRule,
	isIndentedListSourceLine,
	isIndentedTextSourceLine,
	isIrregularOrderedDotListSource,
	isListContinuationSourceLine,
	isListHardBreakSourceLine,
	isOrderedParenListSourceLine,
	isOutdentedListSourceLine,
	leadingWhitespaceLength,
	listLine,
	orderedDotListSourceLineNumber,
} from "./mobileMarkdownSourceLines";
import {
	type MobileMarkdownTable,
	type MobileMarkdownTableAlignment,
	readMobileMarkdownTableAt,
} from "./mobileMarkdownTables";
import {
	readUnsupportedHtmlBlock,
	unsupportedHtmlBlockToParagraphHtml,
} from "./mobileUnsupportedHtmlMarkdown";

type MarkdownLineIndex = number;

export function mobileMarkdownBodyToTentapHtml(
	body: MarkdownBody,
	options: { diagrams?: boolean } = {},
): string {
	const lines = body.replace(/\r\n/g, "\n").split("\n");
	const readers = options.diagrams
		? [mobileDiagramHtmlBlock, ...htmlBlockReaders]
		: htmlBlockReaders;
	const blocks: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (!line.trim()) {
			index += 1;
			continue;
		}

		const block =
			readHtmlBlock(lines, index, readers) ?? readParagraphHtml(lines, index);
		blocks.push(block.html);
		index = block.nextIndex;
	}

	return blocks.join("\n");
}

export function readCodeBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const openingLine = lines[startIndex] ?? "";
	const opening = readMobileMarkdownCodeFence(openingLine);
	if (!opening) return null;

	const { codeLines, nextIndex } = readCodeFenceBody(
		lines,
		startIndex,
		opening,
	);
	const language = simpleCodeBlockLanguage(opening.info);
	if (
		!isNativeCodeBlockFence(
			opening.marker,
			opening.markerKind,
			language,
			opening.info,
		)
	) {
		return sourceLinesParagraphBlock(
			lines.slice(startIndex, nextIndex),
			nextIndex,
		);
	}

	const languageAttrs = language
		? ` class="language-${escapeAttribute(language)}" data-language="${escapeAttribute(language)}"`
		: "";
	return {
		html: `<pre><code${languageAttrs}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
		nextIndex,
	};
}

export function readCodeFenceBody(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
	opening: NonNullable<ReturnType<typeof readMobileMarkdownCodeFence>>,
) {
	const openingLine = lines[startIndex] ?? "";
	const openingIndent = leadingMarkdownBlockIndent(openingLine);
	const codeLines: string[] = [];
	let index = startIndex + 1;
	while (index < lines.length) {
		const line = lines[index];
		if (isMobileMarkdownCodeFenceClose(line, opening)) break;
		codeLines.push(stripMarkdownBlockContentIndent(line, openingIndent));
		index += 1;
	}

	const nextIndex = index < lines.length ? index + 1 : index;
	return { codeLines, nextIndex };
}

export function isNativeCodeBlockFence(
	marker: MarkdownLine,
	markerKind: "backtick" | "tilde",
	language: string | null,
	info: string | null,
): boolean {
	return markerKind === "backtick" && marker === "```" && language === info;
}

export function simpleCodeBlockLanguage(info: string | null): string | null {
	if (info === null) return null;
	return /^[A-Za-z0-9_-]+$/u.test(info) ? info : null;
}

export function readIndentedCodeFenceSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const opening = isCodeIndentedLine(lines[startIndex] ?? "")
		? readMobileMarkdownCodeFence(lines[startIndex] ?? "")
		: null;
	if (!opening) return null;

	let index = startIndex + 1;
	while (
		index < lines.length &&
		!isMobileMarkdownCodeFenceClose(lines[index] ?? "", opening)
	) {
		index += 1;
	}

	const nextIndex = index < lines.length ? index + 1 : index;
	return sourceLinesParagraphBlock(
		lines.slice(startIndex, nextIndex),
		nextIndex,
	);
}

export function leadingMarkdownBlockIndent(line: MarkdownLine): number {
	const spaces = line.match(/^ */u)?.[0].length ?? 0;
	return Math.min(spaces, 3);
}

export function stripMarkdownBlockContentIndent(
	line: MarkdownLine,
	blockIndent: number,
): MarkdownLine {
	const removableSpaces = Math.min(
		line.match(/^ */u)?.[0].length ?? 0,
		blockIndent,
	);
	return line.slice(removableSpaces);
}

export const htmlBlockReaders = [
	readIndentedCodeFenceSourceBlock,
	readCodeBlock,
	readIndentedDisplayMathSourceBlock,
	readDisplayMathBlock,
	readUnsupportedHtmlSourceBlock,
	readIndentedImageSourceBlock,
	readImageBlock,
	readTable,
	readHorizontalRule,
	readIndentedHeadingSourceBlock,
	readHeading,
	readQuote,
	readIndentedTextSourceBlock,
	readIndentedListSourceBlock,
	readListHardBreakSourceBlock,
	readOrderedParenListSourceBlock,
	readIrregularOrderedDotListSourceBlock,
	readList,
];

export function readHtmlBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
	readers = htmlBlockReaders,
): ReadHtmlBlockResult | null {
	for (const reader of readers) {
		const block = reader(lines, startIndex);
		if (block) return block;
	}

	return null;
}

export function readDisplayMathBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const openingLine = lines[startIndex] ?? "";
	const displayMath = readMobileDisplayMathBlock(lines, startIndex);
	const latex = displayMath
		? mobileDisplayMathLatex(
				nativeDisplayMathLines(displayMath.lines, openingLine),
			)
		: null;
	return displayMath
		? {
				html: displayMathBlockHtml(latex ?? displayMath.lines.join("\n")),
				nextIndex: displayMath.nextIndex,
			}
		: null;
}

export function displayMathBlockHtml(latex: PlainText): HtmlSnippet {
	const escapedLatex = escapeAttribute(latex);
	const source = `$$\n${escapeHtml(latex)}\n$$`;
	return [
		`<div class="math math--display" data-latex="${escapedLatex}" data-type="mathBlock" role="img" title="${source}">`,
		source,
		"</div>",
	].join("");
}

export function readIndentedDisplayMathSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	if (
		!isCodeIndentedLine(lines[startIndex] ?? "") ||
		!isMobileDisplayMathStart(lines[startIndex] ?? "")
	) {
		return null;
	}

	const displayMath = readMobileDisplayMathBlock(lines, startIndex);
	return displayMath
		? sourceLinesParagraphBlock(
				lines.slice(startIndex, displayMath.nextIndex),
				displayMath.nextIndex,
			)
		: null;
}

export function nativeDisplayMathLines(
	lines: MarkdownLines,
	openingLine: MarkdownLine,
): MarkdownLines {
	if (lines.length <= 1) return lines;

	const openingIndent = leadingMarkdownBlockIndent(openingLine);
	return lines.map((line, index) =>
		index > 0 && index < lines.length - 1
			? stripMarkdownBlockContentIndent(line, openingIndent)
			: line,
	);
}

export function readUnsupportedHtmlSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const block = readUnsupportedHtmlBlock(lines, startIndex);
	return block
		? {
				html: unsupportedHtmlBlockToParagraphHtml(block.lines, escapeHtml),
				nextIndex: block.nextIndex,
			}
		: null;
}

export function readIndentedImageSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const line = lines[startIndex] ?? "";
	return /^(?: {4,}|\t)!\[/u.test(line) && mobileMarkdownImageHtml(line)
		? { html: `<p>${escapeHtml(line)}</p>`, nextIndex: startIndex + 1 }
		: null;
}

export function readImageBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const html = mobileMarkdownImageHtml(lines[startIndex] ?? "");
	return html ? { html, nextIndex: startIndex + 1 } : null;
}

export function readTable(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const table = readMobileMarkdownTableAt({ lineNumber: startIndex, lines });
	if (!table) return null;

	return {
		html: mobileMarkdownTableHtml(table.table),
		nextIndex: table.nextLine,
	};
}

export function readHorizontalRule(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	return isHorizontalRule(lines[startIndex] ?? "")
		? { html: "<hr>", nextIndex: startIndex + 1 }
		: null;
}

export function readIndentedHeadingSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const line = lines[startIndex] ?? "";
	return /^(?: {4,}|\t)#{1,6}(?:\s+|$)/u.test(line)
		? { html: `<p>${escapeHtml(line)}</p>`, nextIndex: startIndex + 1 }
		: null;
}

export function readHeading(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const heading = lines[startIndex]?.match(
		/^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/u,
	);
	if (!heading) return null;

	const level = heading[1].length;
	return {
		html: `<h${level}>${inlineMarkdownToHtml(heading[2] ?? "")}</h${level}>`,
		nextIndex: startIndex + 1,
	};
}

export function readQuote(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const quote = readQuoteParagraphs(lines, startIndex);
	return quote
		? { html: blockquoteHtml(quote.paragraphs), nextIndex: quote.nextIndex }
		: null;
}

export function readQuoteParagraphs(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadQuoteResult | null {
	const paragraphs: MarkdownLines[] = [[]];
	let index = startIndex;
	let quoteMarkers = 0;

	while (index < lines.length) {
		const match = lines[index]?.match(/^ {0,3}>\s?(.*)$/);
		if (!match) break;

		quoteMarkers += 1;
		appendQuoteLine(paragraphs, match[1]);
		index += 1;
	}

	const nonEmptyParagraphs = paragraphs.filter(
		(paragraph) => paragraph.length > 0,
	);
	if (nonEmptyParagraphs.length > 0)
		return { paragraphs: nonEmptyParagraphs, nextIndex: index };

	return quoteMarkers > 0 ? { paragraphs: [[]], nextIndex: index } : null;
}

export function appendQuoteLine(
	paragraphs: MarkdownLines[],
	line: MarkdownLine,
): void {
	if (line.trim()) {
		paragraphs[paragraphs.length - 1]?.push(line);
	} else if (paragraphs[paragraphs.length - 1]?.length) {
		paragraphs.push([]);
	}
}

export function blockquoteHtml(paragraphs: MarkdownLines[]): HtmlSnippet {
	return `<blockquote>${paragraphs.map(quoteParagraphHtml).join("")}</blockquote>`;
}

export function quoteParagraphHtml(lines: MarkdownLines): HtmlSnippet {
	return `<p>${paragraphLinesToHtml(lines)}</p>`;
}

export function readIndentedListSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readMatchingSourceLines(
		lines,
		startIndex,
		isIndentedListSourceLine,
	);
	return source
		? sourceLinesParagraphBlock(source.lines, source.nextIndex)
		: null;
}

export function readIndentedTextSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readMatchingSourceLines(
		lines,
		startIndex,
		isIndentedTextSourceLine,
	);
	return source
		? sourceLinesParagraphBlock(source.lines, source.nextIndex)
		: null;
}

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

export function readOrderedParenListSourceBlock(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult | null {
	const source = readMatchingSourceLines(
		lines,
		startIndex,
		isOrderedParenListSourceLine,
	);
	return source
		? sourceLinesParagraphBlock(source.lines, source.nextIndex)
		: null;
}

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

export function readParagraph(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadParagraphResult {
	const paragraph: string[] = [];
	let index = startIndex;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (!line.trim() || isBlockStart(lines, index)) break;
		paragraph.push(line);
		index += 1;
	}

	return { lines: paragraph, nextIndex: index };
}

export function readParagraphHtml(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReadHtmlBlockResult {
	const paragraph = readParagraph(lines, startIndex);
	return {
		html: `<p>${paragraphLinesToHtml(paragraph.lines)}</p>`,
		nextIndex: paragraph.nextIndex,
	};
}

export function paragraphLinesToHtml(lines: MarkdownLines): HtmlSnippet {
	return lines.reduce((html, line) => {
		const hardBreak = explicitMarkdownHardBreak(line);
		const text = inlineMarkdownToHtml(hardBreak.text);
		const separator = html && !html.endsWith("<br>") ? " " : "";
		return `${html}${separator}${text}${hardBreak.break ? "<br>" : ""}`;
	}, "");
}

export function isBlockStart(
	lines: MarkdownLines,
	index: MarkdownLineIndex,
): boolean {
	return readHtmlBlock(lines, index) !== null;
}

export function mobileMarkdownTableHtml(
	table: MobileMarkdownTable,
): HtmlSnippet {
	const header = `<thead><tr>${table.headers.map((cell, index) => tableHeaderCellHtml(cell, table.alignments[index] ?? "default")).join("")}</tr></thead>`;
	const body =
		table.rows.length > 0
			? `<tbody>${table.rows.map((row) => tableRowHtml(row, table.alignments)).join("")}</tbody>`
			: "";

	return `<table>${header}${body}</table>`;
}

export function tableRowHtml(
	cells: MarkdownLines,
	alignments: MobileMarkdownTableAlignment[],
): HtmlSnippet {
	return `<tr>${cells.map((cell, index) => tableCellHtml(cell, alignments[index] ?? "default")).join("")}</tr>`;
}

export function tableHeaderCellHtml(
	cell: MarkdownLine,
	alignment: MobileMarkdownTableAlignment,
): HtmlSnippet {
	return `<th${tableCellAlignmentHtmlAttrs(alignment)}><p>${inlineMarkdownToHtml(cell, { allowBreakTags: true })}</p></th>`;
}

export function tableCellHtml(
	cell: MarkdownLine,
	alignment: MobileMarkdownTableAlignment,
): HtmlSnippet {
	return `<td${tableCellAlignmentHtmlAttrs(alignment)}><p>${inlineMarkdownToHtml(cell, { allowBreakTags: true })}</p></td>`;
}

export function tableCellAlignmentHtmlAttrs(
	alignment: MobileMarkdownTableAlignment,
): string {
	if (alignment === "default") return "";

	return ` data-tolaria-alignment="${alignment}" style="text-align: ${alignment}"`;
}
