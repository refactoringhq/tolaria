import type {
	HtmlSnippet,
	InlineMarkdownSpan,
	InlineMarkdownTokenReader,
	MarkdownLine,
	PlainText,
} from "./mobileDocumentContent.types";
import { escapeAttribute, escapeHtml } from "./mobileHtmlEncoding";
import { readMobileInlineMathAt } from "./mobileInlineMath";
import {
	type MobileMarkdownImage,
	readMobileMarkdownImageAt,
} from "./mobileMarkdownImage";
import { linkifyInlineMarkdown } from "./mobileMarkdownLinkHtml";

export function inlineMarkdownToHtml(
	markdown: MarkdownLine,
	options: { allowBreakTags?: boolean } = {},
): string {
	const codeSpans: string[] = [];
	const escapedMarkdownChars: string[] = [];
	const inlineImageSpans: string[] = [];
	const inlineMathSpans: string[] = [];
	const markdownWithoutCodeSpans = markdown.replace(
		/`([^`]+)`/g,
		(_match, code: PlainText) => {
			const token = codeSpanToken(codeSpans.length);
			codeSpans.push(`<code>${escapeHtml(code)}</code>`);
			return token;
		},
	);
	const markdownWithoutInlineImages = inlineMarkdownTokens(
		markdownWithoutCodeSpans,
		inlineImageSpans,
		inlineImageToken,
		readInlineImageMarkdownSpan,
	);
	const protectedMarkdown = markdownWithoutInlineImages.replace(
		/\\([\\`*_[\]{}()#+\-.!|<>~])/g,
		(_match, char: PlainText) => {
			const token = escapedMarkdownToken(escapedMarkdownChars.length);
			escapedMarkdownChars.push(escapeHtml(char));
			return token;
		},
	);
	const markdownWithoutInlineMath = inlineMarkdownTokens(
		protectedMarkdown,
		inlineMathSpans,
		inlineMathToken,
		readInlineMathMarkdownSpan,
	);
	const markdownWithInlineBreaks = preserveInlineBreakTags(
		markdownWithoutInlineMath,
		escapedMarkdownChars,
		options.allowBreakTags,
	);
	const escapedMarkdown = escapeHtml(markdownWithInlineBreaks);

	const html = linkifyInlineMarkdown(escapedMarkdown)
		.replace(/==([^=]+)==/g, "<mark>$1</mark>")
		.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/__([^_]+)__/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>")
		.replace(/_([^_]+)_/g, "<em>$1</em>")
		.replace(/~~([^~]+)~~/g, "<s>$1</s>");

	return restoreEscapedMarkdownTokens(
		restoreCodeSpanTokens(
			restoreInlineImageTokens(
				restoreInlineMathTokens(html, inlineMathSpans),
				inlineImageSpans,
			),
			codeSpans,
		),
		escapedMarkdownChars,
	);
}

function preserveInlineBreakTags(
	markdown: MarkdownLine,
	protectedTokens: HtmlSnippet[],
	allowed: boolean | undefined,
): MarkdownLine {
	if (!allowed) return markdown;

	return markdown.replace(/<br\s*\/?>/giu, (tag) => {
		const token = escapedMarkdownToken(protectedTokens.length);
		protectedTokens.push(tag);
		return token;
	});
}

export function inlineMarkdownTokens(
	markdown: MarkdownLine,
	spans: HtmlSnippet[],
	tokenForIndex: (index: number) => string,
	readSpan: InlineMarkdownTokenReader,
): MarkdownLine {
	let result = "";
	let index = 0;

	while (index < markdown.length) {
		const span = readSpan(markdown, index);
		if (!span) {
			result += markdown.charAt(index);
			index += 1;
			continue;
		}

		const token = tokenForIndex(spans.length);
		spans.push(span.html);
		result += token;
		index = span.endIndex;
	}

	return result;
}

export function readInlineImageMarkdownSpan(
	markdown: MarkdownLine,
	index: number,
): InlineMarkdownSpan | null {
	const image = isEscapedInlineImageStart(markdown, index)
		? null
		: readMobileMarkdownImageAt(markdown, index);
	return image
		? { endIndex: image.endIndex, html: inlineImageHtml(image.image) }
		: null;
}

export function isEscapedInlineImageStart(
	markdown: MarkdownLine,
	index: number,
): boolean {
	return markdown[index] === "!" && index > 0 && markdown[index - 1] === "\\";
}

export function inlineImageHtml(image: MobileMarkdownImage): HtmlSnippet {
	const title = image.title ? ` title="${escapeAttribute(image.title)}"` : "";
	return `<img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}"${title}>`;
}

export function readInlineMathMarkdownSpan(
	markdown: MarkdownLine,
	index: number,
): InlineMarkdownSpan | null {
	const math = readMobileInlineMathAt({ index, text: markdown });
	return math
		? { endIndex: math.end + 1, html: inlineMathHtml(math.latex) }
		: null;
}

export function inlineMathHtml(latex: PlainText): HtmlSnippet {
	const escapedLatex = escapeAttribute(latex);
	return `<span class="math math--inline" data-latex="${escapedLatex}" data-type="mathInline">$${escapeHtml(latex)}$</span>`;
}

export function codeSpanToken(index: number): string {
	return `\u0000CODESPAN${index}\u0000`;
}

export function escapedMarkdownToken(index: number): string {
	return `\u0000ESCAPEDMARKDOWN${index}\u0000`;
}

export function inlineMathToken(index: number): string {
	return `\u0000INLINEMATH${index}\u0000`;
}

export function inlineImageToken(index: number): string {
	return `\u0000INLINEIMAGE${index}\u0000`;
}

export function restoreCodeSpanTokens(
	html: HtmlSnippet,
	codeSpans: HtmlSnippet[],
): HtmlSnippet {
	return restoreInlineTokens(html, codeSpans, codeSpanToken);
}

export function restoreEscapedMarkdownTokens(
	html: HtmlSnippet,
	escapedMarkdownChars: HtmlSnippet[],
): HtmlSnippet {
	return restoreInlineTokens(html, escapedMarkdownChars, escapedMarkdownToken);
}

export function restoreInlineMathTokens(
	html: HtmlSnippet,
	spans: HtmlSnippet[],
): HtmlSnippet {
	return restoreInlineTokens(html, spans, inlineMathToken);
}

export function restoreInlineImageTokens(
	html: HtmlSnippet,
	spans: HtmlSnippet[],
): HtmlSnippet {
	return restoreInlineTokens(html, spans, inlineImageToken);
}

function restoreInlineTokens(
	html: HtmlSnippet,
	spans: HtmlSnippet[],
	tokenForIndex: (index: number) => string,
): HtmlSnippet {
	return spans.reduce(
		(current, span, index) => current.replaceAll(tokenForIndex(index), span),
		html,
	);
}
