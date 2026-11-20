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

describe("frontmatter YAML scalar types", () => {
	it.each([
		["null", null],
		["Null", null],
		["NULL", null],
		["~", null],
		["0o17", 15],
	])(
		"parses unquoted YAML scalar %s with its native type",
		(scalar, expected) => {
			const frontmatter = parseFrontmatter(`---\nvalue: ${scalar}\n---\nBody`);
			expect(frontmatter.value).toBe(expected);
		},
	);

	it.each(["null", "~", "0o17"])(
		"keeps quoted YAML scalar %s as a string",
		(scalar) => {
			const frontmatter = parseFrontmatter(
				`---\nvalue: ${JSON.stringify(scalar)}\n---\nBody`,
			);
			expect(frontmatter.value).toBe(scalar);
		},
	);
});
