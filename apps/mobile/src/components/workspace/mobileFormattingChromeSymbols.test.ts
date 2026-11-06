import { describe, expect, it } from "vitest";
import { mobileFormattingChromeSymbol } from "./mobileFormattingChromeSymbols";

describe("mobile formatting chrome symbols", () => {
	it("uses system symbols for formatting controls and keeps the whiteboard content glyph", () => {
		expect(mobileFormattingChromeSymbol("bold")).toBe("bold");
		expect(mobileFormattingChromeSymbol("tableAddRowAfter")).toBe("tableRow");
		expect(mobileFormattingChromeSymbol("whiteboard")).toBeUndefined();
	});
});
