import { describe, expect, it } from "vitest";
import {
	cellAddress,
	columnNameFromIndex,
	mergeSheetDocument,
	parseCsvRows,
	parseCsvRowsWithSource,
	serializeCsvRows,
	serializeCsvRowsPreservingSourceRows,
	serializeCsvRowsReplacingParsedSourceRows,
	splitSheetDocument,
} from "./sheetCsv";

describe("sheetCsv", () => {
	it("splits frontmatter from the sheet CSV body", () => {
		const content = [
			"---",
			"type: Sheet",
			"belongs_to:",
			'  - "[[Revenue Model]]"',
			"---",
			"Item,Amount",
			"Total,=SUM(B2:B3)",
		].join("\n");

		const parts = splitSheetDocument(content);

		expect(parts.frontmatter).toBe(
			'---\ntype: Sheet\nbelongs_to:\n  - "[[Revenue Model]]"\n---\n',
		);
		expect(parts.body).toBe("Item,Amount\nTotal,=SUM(B2:B3)");
		expect(mergeSheetDocument(parts.frontmatter, parts.body)).toBe(content);
	});

	it("parses and serializes quoted CSV cells", () => {
		const rows = parseCsvRows(
			'Name,Formula\n"ACME, Inc.","=SUM(A1,B1)"\n"He said ""hi""",42',
		);

		expect(rows).toEqual([
			["Name", "Formula"],
			["ACME, Inc.", "=SUM(A1,B1)"],
			['He said "hi"', "42"],
		]);
		expect(serializeCsvRows(rows)).toBe(
			'Name,Formula\n"ACME, Inc.","=SUM(A1,B1)"\n"He said ""hi""",42',
		);
	});

	it("keeps meaningful blank rows while trimming each row trailing empty cells", () => {
		const rows = [
			["A", "B", ""],
			["", "", ""],
			["C", "", ""],
			["", "", ""],
		];

		expect(serializeCsvRows(rows)).toBe("A,B\n\nC");
	});

	it("preserves leading and interior empty cells without padding the rest of the row", () => {
		const rows = [
			["Name", "Value", "Notes"],
			["Intro", "", ""],
			["", "Only second column", ""],
			["Total", "42", ""],
		];

		expect(serializeCsvRows(rows)).toBe(
			"Name,Value,Notes\nIntro\n,Only second column\nTotal,42",
		);
	});

	it("preserves raw source rows and trailing width for changed rows", () => {
		const source = 'Name,Value,,\n"Keep quoted",1,,\nTotal,42,,';
		const rows = parseCsvRows(source);
		rows[0] = ["Name", "Amount", "", ""];

		expect(serializeCsvRowsPreservingSourceRows(rows, source)).toBe(
			'Name,Amount,,\n"Keep quoted",1,,\nTotal,42,,',
		);
	});

	it("preserves source row separators while serializing changed rows", () => {
		const source = "Name,Value,,\r\nRevenue,1200,,\r\n";
		const rows = parseCsvRows(source);
		rows[1] = ["Revenue", "1300", "", ""];

		expect(serializeCsvRowsPreservingSourceRows(rows, source)).toBe(
			"Name,Value,,\r\nRevenue,1300,,\r\n",
		);
	});

	it("keeps raw row syntax when a row replacement has identical cells", () => {
		const source = 'Metric,"January",,\nRevenue,1200,,';
		const parsed = parseCsvRowsWithSource(source);
		const replacements = new Map([[0, ["Metric", "January", "", ""]]]);

		expect(
			serializeCsvRowsReplacingParsedSourceRows(parsed, replacements),
		).toBe(source);
	});

	it("separates a replacement row appended after an unterminated source row", () => {
		const parsed = parseCsvRowsWithSource("Name,Qty");
		const replacements = new Map([[1, ["Apple", "5"]]]);

		expect(
			serializeCsvRowsReplacingParsedSourceRows(parsed, replacements),
		).toBe("Name,Qty\nApple,5");
	});

	it("separates an appended edited row after an unterminated source row", () => {
		const parsed = parseCsvRowsWithSource("Name,Qty");

		expect(
			serializeCsvRowsPreservingSourceRows(
				[
					["Name", "Qty"],
					["Apple", "5"],
				],
				parsed.rawRows.join(""),
			),
		).toBe("Name,Qty\nApple,5");
	});

	it("formats spreadsheet addresses", () => {
		expect(columnNameFromIndex(0)).toBe("A");
		expect(columnNameFromIndex(25)).toBe("Z");
		expect(columnNameFromIndex(26)).toBe("AA");
		expect(cellAddress(4, 27)).toBe("AB5");
	});
});
