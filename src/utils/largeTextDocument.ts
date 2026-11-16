export const LARGE_TEXT_DOCUMENT_LIMIT = 1_000_000;
export const LONG_TEXT_LINE_LIMIT = 100_000;

export function isLargeTextDocument(content: string): boolean {
	if (content.length >= LARGE_TEXT_DOCUMENT_LIMIT) return true;

	let lineStart = 0;
	while (lineStart < content.length) {
		const lineEnd = content.indexOf("\n", lineStart);
		const lineLength = (lineEnd < 0 ? content.length : lineEnd) - lineStart;
		if (lineLength >= LONG_TEXT_LINE_LIMIT) return true;
		if (lineEnd < 0) return false;
		lineStart = lineEnd + 1;
	}

	return false;
}
