import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("frontmatter Unicode escapes", () => {
	it("preserves quoted escapes that are not Unicode scalar values", () => {
		const frontmatter = parseFrontmatter(
			'---\nvalue: "bad \\U0000d800 and \\U00110000"\n---\nBody',
		);
		expect(frontmatter.value).toBe("bad \\U0000d800 and \\U00110000");
	});

	it("decodes valid quoted Unicode escapes", () => {
		const frontmatter = parseFrontmatter(
			'---\nvalue: "\\U0001f600"\n---\nBody',
		);
		expect(frontmatter.value).toBe("😀");
	});
});
