import type { MobileMarkdownFormatAction } from "../../workspace/mobileMarkdownFormatting";
import type { ChromeSymbolName } from "../ui/chromeSymbolDefinitions";

const formattingSymbols: Partial<
	Record<MobileMarkdownFormatAction, ChromeSymbolName>
> = {
	attachment: "paperclip",
	bold: "bold",
	bulletList: "list",
	code: "code",
	codeBlock: "code",
	divider: "minus",
	heading1: "heading",
	heading2: "heading",
	heading3: "heading",
	heading4: "heading",
	heading5: "heading",
	heading6: "heading",
	highlight: "bold",
	indent: "indent",
	italic: "italic",
	link: "link",
	mathBlock: "function",
	mermaid: "flowchart",
	orderedList: "listNumbered",
	outdent: "outdent",
	pastePlainText: "clipboard",
	quote: "quote",
	strike: "strikethrough",
	table: "table",
	tableAddColumnAfter: "tableColumn",
	tableAddRowAfter: "tableRow",
	tableDeleteColumn: "tableColumn",
	tableDeleteRow: "tableRow",
	taskList: "checklist",
	wikilink: "link",
};

export function mobileFormattingChromeSymbol(
	action: MobileMarkdownFormatAction,
) {
	return formattingSymbols[action];
}
