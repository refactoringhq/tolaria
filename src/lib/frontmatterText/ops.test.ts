import { describe, expect, it } from "vitest";
import golden from "../../../tests/fixtures/frontmatter-ops/cases.json";
import { parseFrontmatter } from "../../utils/frontmatter";
import { MalformedFrontmatterError, updateFrontmatterContent } from "./ops";
import { UnsafeFrontmatterEditError } from "./safety";
import type { FrontmatterTextValue } from "./yaml";

interface GoldenCase {
	name: string;
	content: string;
	key: string;
	op: string;
	value?: FrontmatterTextValue;
	expected?: string;
	error?: string;
	/** `refused`: the web refuses an edit whose desktop bytes do not read back as written. */
	web?: string;
}

const cases = golden.cases as GoldenCase[];

function run({ content, key, op, value }: GoldenCase): string {
	return updateFrontmatterContent(
		content,
		key,
		op === "delete" ? undefined : value,
	);
}

describe("updateFrontmatterContent matches the desktop writer byte for byte", () => {
	it("reads the shared golden cases", () => {
		expect(cases.length).toBeGreaterThan(50);
	});

	it.each(
		cases.filter(
			(golden) => golden.expected !== undefined && golden.web === undefined,
		),
	)("$name", (golden) => {
		expect(run(golden)).toBe(golden.expected);
	});

	it.each(cases.filter((golden) => golden.web === "refused"))(
		"refuses on the web: $name",
		(golden) => {
			expect(() => run(golden)).toThrow(UnsafeFrontmatterEditError);
		},
	);

	it.each(cases.filter((golden) => golden.error !== undefined))(
		"$name",
		(golden) => {
			expect(() => run(golden)).toThrow(MalformedFrontmatterError);
			expect(() => run(golden)).toThrow(golden.error);
		},
	);
});

describe("updateFrontmatterContent beyond the golden cases", () => {
	it("round-trips NUL through a YAML reader", () => {
		const value = `before${String.fromCharCode(0)}after`;
		const written = updateFrontmatterContent("", "value", value);

		expect(written).toContain('value: "before\\0after"');
		expect(parseFrontmatter(written).value).toBe(value);
	});

	it("round-trips escaped list items through the frontmatter parser", () => {
		const backslash = String.fromCharCode(92);
		const value = [
			"a\\b",
			`backslash ${backslash}`,
			"line one\nline two",
			`quote " and slash ${backslash}${backslash}`,
		];
		const written = updateFrontmatterContent("", "items", value);

		expect(parseFrontmatter(written).items).toEqual(value);
	});

	it.each([
		["empty", [] as string[]],
		["one item", ["only item"]],
	])("round-trips %s list values as arrays", (_label, value) => {
		const written = updateFrontmatterContent("", "items", value);

		expect(parseFrontmatter(written).items).toEqual(value);
		expect(Array.isArray(parseFrontmatter(written).items)).toBe(true);
	});

	it("preserves array shape for empty and one-item inline arrays", () => {
		expect(parseFrontmatter("---\nitems: []\n---\n").items).toEqual([]);
		expect(parseFrontmatter("---\nitems: [ ]\n---\n").items).toEqual([]);
		expect(parseFrontmatter("---\nitems: [  ]\n---\n").items).toEqual([]);
		expect(parseFrontmatter('---\nitems: ["only item"]\n---\n').items).toEqual([
			"only item",
		]);
	});

	it("preserves leading and trailing spaces in quoted scalars", () => {
		for (const value of [" 5", "5 ", " 5 "]) {
			const written = updateFrontmatterContent("", "v", value);
			expect(parseFrontmatter(written).v).toBe(value);
		}
	});

	it("decodes quoted inline array items through the scalar parser", () => {
		expect(parseFrontmatter('---\nitems: ["a\\\\b"]\n---\n').items).toEqual([
			"a\\b",
		]);
	});

	it("escapes every YAML double-quoted escape sequence in literal strings", () => {
		const yamlEscapes = [
			String.raw`\\`,
			String.raw`\"`,
			String.raw`\0`,
			String.raw`\a`,
			String.raw`\b`,
			String.raw`\t`,
			String.raw`\n`,
			String.raw`\v`,
			String.raw`\f`,
			String.raw`\r`,
			String.raw`\e`,
			String.raw`\/`,
			String.raw`\ `,
			String.raw`\N`,
			String.raw`\_`,
			String.raw`\L`,
			String.raw`\P`,
			String.raw`\x41`,
			String.raw`\u0041`,
			String.raw`\U00000041`,
		];

		for (const escapeSequence of yamlEscapes) {
			const value = `prefix ${escapeSequence}: suffix`;
			const written = updateFrontmatterContent("", "value", value);
			const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
			expect(written).toContain(`value: "${escaped}"`);
			expect(parseFrontmatter(written).value).toBe(value);
		}
	});

	it("coerces unquoted inline array scalars but preserves quoted strings", () => {
		expect(
			parseFrontmatter("---\nvalues: [yes, 007, 0x10]\n---\n").values,
		).toEqual([true, 7, 16]);
		expect(
			parseFrontmatter('---\nvalues: ["yes", "007", "0x10"]\n---\n').values,
		).toEqual(["yes", "007", "0x10"]);
	});

	it.each(["0X10", "0O17"])(
		"quotes radix-like string %s consistently",
		(value) => {
			const written = updateFrontmatterContent("", "v", value);
			expect(parseFrontmatter(written).v).toBe(value);
			expect(written).toContain(`v: "${value}"`);
		},
	);

	it.each(["0x", "0o", "0X", "0O"])(
		"does not quote invalid radix-looking string %s",
		(value) => {
			expect(updateFrontmatterContent("", "v", value)).toBe(
				`---\nv: ${value}\n---\n`,
			);
		},
	);

	it("round-trips typed scalar arrays without quoting non-strings", () => {
		const values: FrontmatterTextValue = [true, 15, null, "null"];
		const written = updateFrontmatterContent("", "values", values);
		expect(written).toBe(
			'---\nvalues:\n  - true\n  - 15\n  - null\n  - "null"\n---\n',
		);
		expect(parseFrontmatter(written).values).toEqual(values);
	});

	it("decodes backslashes in quoted scalars and inline array items", () => {
		const value = "C:\\notes\\new";
		expect(
			parseFrontmatter('---\npath: "C:\\\\notes\\\\new"\n---\n').path,
		).toBe(value);
		expect(
			parseFrontmatter("---\npaths: [\"C:\\\\notes\\\\new\", 'a,b']\n---\n")
				.paths,
		).toEqual([value, "a,b"]);
	});

	it("decodes YAML single-quoted scalars and doubled apostrophes", () => {
		expect(parseFrontmatter("---\nvalue: 'can''t'\n---\n").value).toBe("can't");
		expect(
			parseFrontmatter("---\nvalues: ['C:\\\\notes', 'can''t']\n---\n").values,
		).toEqual(["C:\\\\notes", "can't"]);
	});

	it("writes non-finite numbers the way Rust prints them", () => {
		expect(updateFrontmatterContent("", "n", Number.NaN)).toBe(
			"---\nn: NaN\n---\n",
		);
		expect(updateFrontmatterContent("", "n", Number.POSITIVE_INFINITY)).toBe(
			"---\nn: inf\n---\n",
		);
		expect(updateFrontmatterContent("", "n", Number.NEGATIVE_INFINITY)).toBe(
			"---\nn: -inf\n---\n",
		);
	});

	it.each([
		"C:\\notes\\new",
		"line one\nline two",
		"yes",
		"no",
		"null",
		"true",
		"false",
		"on",
		"off",
		"~",
		"007",
		"1.5",
		"0x10",
		"#tag",
		"x\t#tag",
		":value",
		"- item",
		"\u2028",
		"\u2029",
		"\u0080",
		"\u009f",
		"  padded  ",
	])("round-trips string %j with its type", (value) => {
		const written = updateFrontmatterContent("", "v", value);
		expect(parseFrontmatter(written).v).toBe(value);
	});
});

describe("updateFrontmatterContent with input the desktop would write unsafely", () => {
	it.each([["a newline in a key", "a\nb", "x"]] as const)(
		"refuses %s",
		(_name, key, value) => {
			const content = "---\r---\r";
			expect(() =>
				updateFrontmatterContent(
					content,
					key,
					value as unknown as FrontmatterTextValue,
				),
			).toThrow(UnsafeFrontmatterEditError);
		},
	);
});

describe("updateFrontmatterContent with an empty key", () => {
	it("refuses it instead of writing a null key", () => {
		expect(() =>
			updateFrontmatterContent("---\ntitle: T\n---\n", "", "x"),
		).toThrow(UnsafeFrontmatterEditError);
	});
});
