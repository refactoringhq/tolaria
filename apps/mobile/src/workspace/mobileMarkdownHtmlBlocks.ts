import { mobileDiagramHtmlBlock } from "./mobileDiagramMarkdown";
import {
	isMobileDisplayMathStart,
	mobileDisplayMathLatex,
	readMobileDisplayMathBlock,
} from "./mobileDisplayMath";
import type {
	HtmlSnippet,
	MarkdownBody,
	MarkdownLine,
	MarkdownLines,
	PlainText,
	ReadHtmlBlockResult,
	ReadParagraphResult,
	ReadQuoteResult,
} from "./mobileDocumentContent.types";
import { escapeAttribute, escapeHtml } from "./mobileHtmlEncoding";
import {
	isMobileMarkdownCodeFenceClose,
	readMobileMarkdownCodeFence,
} from "./mobileMarkdownCodeFence";
import { inlineMarkdownToHtml } from "./mobileMarkdownHtmlInline";
import {
	readIndentedListSourceBlock,
	readIrregularOrderedDotListSourceBlock,
	readList,
	readListHardBreakSourceBlock,
	readMatchingSourceLines,
	readOrderedParenListSourceBlock,
	sourceLinesParagraphBlock,
} from "./mobileMarkdownHtmlLists";
import { mobileMarkdownImageHtml } from "./mobileMarkdownImage";
import {
	explicitMarkdownHardBreak,
	isCodeIndentedLine,
	isHorizontalRule,
	isIndentedTextSourceLine,
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

export { readListSourceLines } from "./mobileMarkdownHtmlLists";

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
	const opening = readIndentedCodeFenceOpening(lines, startIndex);
	if (!opening) return null;

	const nextIndex = findCodeFenceSourceEnd(lines, startIndex, opening);
	return sourceLinesParagraphBlock(
		lines.slice(startIndex, nextIndex),
		nextIndex,
	);
}

function readIndentedCodeFenceOpening(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
): ReturnType<typeof readMobileMarkdownCodeFence> {
	const line = lines[startIndex] ?? "";
	return isCodeIndentedLine(line) ? readMobileMarkdownCodeFence(line) : null;
}

function findCodeFenceSourceEnd(
	lines: MarkdownLines,
	startIndex: MarkdownLineIndex,
	opening: NonNullable<ReturnType<typeof readMobileMarkdownCodeFence>>,
): number {
	let index = startIndex + 1;
	while (
		index < lines.length &&
		!isMobileMarkdownCodeFenceClose(lines[index] ?? "", opening)
	) {
		index += 1;
	}
	return index < lines.length ? index + 1 : index;
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
