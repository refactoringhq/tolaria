import { mobileText } from "../../i18n/mobileText";
import type { MobileMarkdownTableAlignment } from "../../workspace/mobileMarkdownTables";

export function addColumnToHeaders(headers: string[]): string[] {
	return [...headers, ""];
}

export function addColumnToAlignments(
	alignments: MobileMarkdownTableAlignment[],
): MobileMarkdownTableAlignment[] {
	return [...alignments, "default"];
}

export function addColumnToRows(rows: string[][]): string[][] {
	return rows.map((row) => [...row, ""]);
}

export function addTableRow({
	columnCount,
	rows,
}: {
	columnCount: number;
	rows: string[][];
}): string[][] {
	return [...rows, Array.from({ length: columnCount }, () => "")];
}

export function removeLastColumn(rows: string[][]): string[][] {
	return rows.map((row) => row.slice(0, -1));
}

export function removeLastItem<T>(items: T[]): T[] {
	return items.slice(0, -1);
}

export function replaceAt({
	index,
	value,
	values,
}: {
	index: number;
	value: string;
	values: string[];
}): string[] {
	return values.map((current, currentIndex) =>
		currentIndex === index ? value : current,
	);
}

export function replaceAlignmentAt({
	alignments,
	columnCount,
	columnIndex,
	value,
}: {
	alignments: MobileMarkdownTableAlignment[];
	columnCount: number;
	columnIndex: number;
	value: MobileMarkdownTableAlignment;
}): MobileMarkdownTableAlignment[] {
	return Array.from({ length: columnCount }, (_current, currentIndex) =>
		currentIndex === columnIndex
			? value
			: (alignments[currentIndex] ?? "default"),
	);
}

export function updateTableCell({
	columnIndex,
	rowIndex,
	rows,
	value,
}: {
	columnIndex: number;
	rowIndex: number;
	rows: string[][];
	value: string;
}): string[][] {
	return rows.map((row, currentRow) =>
		currentRow === rowIndex
			? replaceAt({ index: columnIndex, value, values: row })
			: row,
	);
}

export function cellLabel({
	columnIndex,
	rowIndex,
}: {
	columnIndex: number;
	rowIndex: number;
}): string {
	return mobileText("editor.table.cell")
		.replace("{row}", `${rowIndex + 1}`)
		.replace("{column}", `${columnIndex + 1}`);
}

export function columnLabel({ columnIndex }: { columnIndex: number }): string {
	return mobileText("editor.table.column").replace(
		"{index}",
		`${columnIndex + 1}`,
	);
}

export function rowLabel({ rowIndex }: { rowIndex: number }): string {
	return mobileText("editor.table.row").replace("{index}", `${rowIndex + 1}`);
}

export function tableLabel({ index }: { index: number }): string {
	return `${mobileText("editor.formatting.table")} ${index + 1}`;
}
