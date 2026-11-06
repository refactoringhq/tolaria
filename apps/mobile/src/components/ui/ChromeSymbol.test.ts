import { describe, expect, it } from "vitest";
import { chromeSymbolDefinitions } from "./chromeSymbolDefinitions";

describe("fixed chrome system-symbol allowlist", () => {
	it("keeps the supported control symbols explicit and excludes content icons", () => {
		expect(Object.keys(chromeSymbolDefinitions).sort()).toEqual(
			[
				"archive",
				"back",
				"check",
				"close",
				"caretDown",
				"caretRight",
				"command",
				"compose",
				"copy",
				"delete",
				"edit",
				"face",
				"eye",
				"findNext",
				"findPrevious",
				"list",
				"map",
				"move",
				"notes",
				"inbox",
				"organize",
				"plus",
				"redo",
				"search",
				"share",
				"star",
				"starFilled",
				"settings",
				"sync",
				"text",
				"undo",
				"width",
				"widthCompact",
			].sort(),
		);
		expect(chromeSymbolDefinitions).not.toHaveProperty("noteType");
		expect(chromeSymbolDefinitions).not.toHaveProperty("userIcon");
	});
});
