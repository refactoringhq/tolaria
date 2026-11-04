import { describe, expect, it } from "vitest";
import { mobilePressedStyle } from "./mobilePressFeedback";

describe("mobile pressed feedback", () => {
	it("applies the configured opacity only while pressed", () => {
		expect(mobilePressedStyle(true, 0.7)).toEqual({ opacity: 0.7 });
		expect(mobilePressedStyle(false, 0.7)).toBeNull();
	});
});
