import { describe, expect, it } from "vitest";
import golden from "../../../tests/fixtures/frontmatter-ops/cases.json";
import {
	assertSafeFrontmatterEdit,
	UnsafeFrontmatterEditError,
} from "./safety";
import type { FrontmatterTextValue } from "./yaml";

interface GoldenCase {
	key: string;
	op: string;
	value?: FrontmatterTextValue;
	web?: string;
}

describe("assertSafeFrontmatterEdit", () => {
	it("accepts every edit of the shared golden cases the web does not refuse", () => {
		for (const { key, op, value } of (golden.cases as GoldenCase[]).filter(
			(golden) => golden.web === undefined,
		)) {
			expect(() =>
				assertSafeFrontmatterEdit(key, op === "delete" ? undefined : value),
			).not.toThrow();
		}
	});

	it.each([
		["tab in a plain value", "Status", "a\tb"],
		["backslash in a plain value", "Path", "C\\notes"],
		["CRLF lines in a block scalar", "template", "one\r\ntwo\r\n"],
		["a lone CR in an escaped value", "Status", "Done\rinjected: true"],
		["a NUL in an escaped value", "Status", "a\u0000b"],
		["DEL in an escaped value", "Status", "a\u007fb"],
		["a line separator in an escaped value", "Status", "a\u2028b"],
		["backslash in a quoted value", "Link", "see: C:\\notes"],
		["backslash in a list item", "tags", ["a\\b"]],
		["newline in a list item", "tags", ["a\nb: c"]],
		["a lone CR inside a multiline value", "template", "one\rtwo: x\nthree"],
		[
			"a multiline value whose first line is indented",
			"template",
			"  indented\nnext",
		],
		["a backslash in a quoted key", "a\\b c", "x"],
		["deleting a key", "Status", undefined],
		["numbers, booleans and null", "Count", 3],
		["a quoted key without backslashes", 'Due "soon"', "x"],
	] as const)("accepts %s", (_name, key, value) => {
		expect(() =>
			assertSafeFrontmatterEdit(key, value as FrontmatterTextValue | undefined),
		).not.toThrow();
	});

	it.each([
		["a newline in a key", "a\nb", "x"],
		["a CR in a plain key", "ab\r", "x"],
		["an empty key", "", "x"],
		["a key that would start a new mapping line", "a: b\nc", "x"],
	] as const)("refuses %s", (_name, key, value) => {
		expect(() =>
			assertSafeFrontmatterEdit(key, value as unknown as FrontmatterTextValue),
		).toThrow(UnsafeFrontmatterEditError);
	});
});
