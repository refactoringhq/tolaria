import type {
	FrontmatterScalar,
	FrontmatterValue,
} from "../components/Inspector";
import { canonicalFrontmatterKey } from "./systemMetadata";

export interface ParsedFrontmatter {
	[key: string]: ParsedFrontmatterValue;
}

type ParsedFrontmatterScalar = string | number | boolean | null;
type ParsedFrontmatterValue = FrontmatterValue | ParsedFrontmatterScalar[];

type MarkdownContent = string;
type FrontmatterBody = string;
type FrontmatterLine = string;
type FrontmatterKey = string;
type FrontmatterText = string;

export interface FrontmatterCollisionWarning {
	key: string;
	labels: string[];
}

export interface FrontmatterWarnings {
	collidingProperties: FrontmatterCollisionWarning[];
}

const FRONTMATTER_CLOSE_DELIMITER = /(?:^|\r?\n)---(?:\r?\n|$)/;
const YAML_ESCAPE_CODES: ReadonlyMap<string, string> = new Map([
	["\\", "\\"],
	['"', '"'],
	["0", "\0"],
	["a", "\x07"],
	["b", "\b"],
	["t", "\t"],
	["n", "\n"],
	["v", "\v"],
	["f", "\f"],
	["r", "\r"],
	["e", "\x1b"],
	[" ", " "],
	["N", "\u0085"],
	["_", "\u00a0"],
	["L", "\u2028"],
	["P", "\u2029"],
]);

function unquote(s: FrontmatterText): FrontmatterText {
	if (s.startsWith('"') && s.endsWith('"')) {
		return s
			.slice(1, -1)
			.replace(
				/\\([\\"0abtnvfre N_LP]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/g,
				(_match, escapeCode: string) => {
					const decoded = YAML_ESCAPE_CODES.get(escapeCode);
					if (decoded !== undefined) return decoded;
					const digits = escapeCode.slice(1);
					const codePoint = Number.parseInt(digits, 16);
					if (!isUnicodeScalarValue(codePoint)) return `\\${escapeCode}`;
					return String.fromCodePoint(codePoint);
				},
			);
	}
	return s.replace(/^["']|["']$/g, "");
}

function isUnicodeScalarValue(codePoint: number): boolean {
	return codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
}

function collapseList(
	items: ParsedFrontmatterScalar[],
): ParsedFrontmatterValue {
	return items;
}

function isBlockScalar(value: FrontmatterText): boolean {
	return value === "|" || value === ">";
}

function isInlineArrayLiteral(value: FrontmatterText): boolean {
	return (
		value.startsWith("[") && value.endsWith("]") && !value.startsWith("[[")
	);
}

function parseInlineArray(value: FrontmatterText): ParsedFrontmatterValue {
	const contents = value.slice(1, -1);
	if (contents.trim() === "") return [];
	const items = splitInlineArrayItems(contents).map((item) =>
		parseInlineArrayItem(item.trim()),
	);
	return items;
}

function parseInlineArrayItem(value: FrontmatterText): ParsedFrontmatterScalar {
	if (isQuotedScalar(value)) return parseTextItem(value);
	return parseScalar(value);
}

function splitInlineArrayItems(value: FrontmatterText): FrontmatterText[] {
	const items: FrontmatterText[] = [];
	let start = 0;
	let quote: '"' | "'" | null = null;
	for (let index = 0; index < value.length; index += 1) {
		const scan = scanInlineCharacter(
			value.charAt(index),
			value.charAt(index + 1),
			quote,
		);
		quote = scan.quote;
		if (scan.skipNext) index += 1;
		if (scan.separator) {
			items.push(value.slice(start, index));
			start = index + 1;
		}
	}
	items.push(value.slice(start));
	return items;
}

function scanInlineCharacter(
	character: string,
	nextCharacter: string | undefined,
	quote: '"' | "'" | null,
): { quote: '"' | "'" | null; skipNext: boolean; separator: boolean } {
	if (isEscapedDoubleQuoteCharacter(quote, character)) {
		return { quote, skipNext: true, separator: false };
	}
	if (isEscapedSingleQuoteCharacter(quote, character, nextCharacter)) {
		return { quote, skipNext: true, separator: false };
	}
	if (quote !== null) {
		return {
			quote: endQuoteIfPresent(quote, character),
			skipNext: false,
			separator: false,
		};
	}
	if (isQuoteCharacter(character)) {
		return { quote: character, skipNext: false, separator: false };
	}
	return { quote: null, skipNext: false, separator: character === "," };
}

function isEscapedDoubleQuoteCharacter(
	quote: '"' | "'" | null,
	character: string,
): boolean {
	return quote === '"' && character === "\\";
}

function isEscapedSingleQuoteCharacter(
	quote: '"' | "'" | null,
	character: string,
	nextCharacter: string | undefined,
): boolean {
	return quote === "'" && character === "'" && nextCharacter === "'";
}

function endQuoteIfPresent(
	quote: '"' | "'",
	character: string,
): '"' | "'" | null {
	return character === quote ? null : quote;
}

function isQuoteCharacter(character: string): character is '"' | "'" {
	return character === '"' || character === "'";
}

function isQuotedScalar(value: FrontmatterText): boolean {
	return (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	);
}

function parseQuotedScalar(value: FrontmatterText): FrontmatterText {
	if (value.startsWith('"') && value.endsWith('"')) return unquote(value);
	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replaceAll("''", "'");
	}
	return value;
}

function parseBooleanScalar(value: FrontmatterText): boolean | undefined {
	const lower = value.toLowerCase();
	if (lower === "true" || lower === "yes") return true;
	if (lower === "false" || lower === "no") return false;
	return undefined;
}

function parseScalar(value: FrontmatterText): FrontmatterScalar {
	const clean = parseQuotedScalar(value);
	if (isQuotedScalar(value)) return clean;
	return parseUnquotedScalar(clean, value);
}

function parseUnquotedScalar(
	clean: FrontmatterText,
	original: FrontmatterText,
): ParsedFrontmatterScalar {
	if (clean === "~" || /^(null|Null|NULL)$/.test(clean)) return null;
	const booleanValue = parseBooleanScalar(clean);
	if (booleanValue !== undefined) return booleanValue;
	const radixValue = parseRadixNumber(clean);
	if (radixValue !== undefined) return radixValue;
	if (clean === original && isNumericScalar(clean)) return Number(clean);
	return clean;
}

function parseRadixNumber(value: FrontmatterText): number | undefined {
	if (/^0o[0-7]+$/.test(value)) return Number.parseInt(value.slice(2), 8);
	if (/^0x[0-9a-f]+$/i.test(value)) return Number(value);
	return undefined;
}

function parseTextItem(value: FrontmatterText): FrontmatterText {
	if (!isQuotedScalar(value)) return unquote(value);
	const parsed = parseScalar(value);
	return typeof parsed === "string" ? parsed : value;
}

function isNumericScalar(value: FrontmatterText): boolean {
	if (!value) return false;
	const unsigned = value.startsWith("-") ? value.slice(1) : value;
	if (!unsigned) return false;
	const parts = unsigned.split(".");
	return (
		(parts.length === 1 || parts.length === 2) &&
		parts.every(
			(part) =>
				part.length > 0 &&
				[...part].every((char) => char >= "0" && char <= "9"),
		)
	);
}

export type FrontmatterState = "valid" | "empty" | "none" | "invalid";

function frontmatterContentStart(content: MarkdownContent): number | null {
	if (content.startsWith("---\r\n")) return 5;
	if (content.startsWith("---\n")) return 4;
	return null;
}

function extractFrontmatterBody(
	content: MarkdownContent | null,
): FrontmatterBody | null {
	if (!content) return null;
	const start = frontmatterContentStart(content);
	if (start === null) return null;
	const rest = content.slice(start);
	const close = rest.match(FRONTMATTER_CLOSE_DELIMITER);
	if (!close || close.index === undefined) return null;
	return rest.slice(0, close.index);
}

/** Detect whether content has valid, empty, missing, or invalid frontmatter. */
export function detectFrontmatterState(
	content: MarkdownContent | null,
): FrontmatterState {
	if (!content) return "none";
	const frontmatterBody = extractFrontmatterBody(content);
	if (frontmatterBody === null) return "none";
	const body = frontmatterBody.trim();
	if (!body) return "empty";
	// Valid frontmatter needs at least one top-level key followed by a colon.
	const hasValidLine = body
		.split(/\r?\n/)
		.some((line) => /^[_A-Za-z][\w -]*:/.test(line));
	return hasValidLine ? "valid" : "invalid";
}

function parseListItem(
	line: FrontmatterLine,
): ParsedFrontmatterScalar | undefined {
	const match = line.match(/^ {2}- (.*)$/);
	return match ? parseScalar(match[1]) : undefined;
}

function parseKeyValueLine(
	line: FrontmatterLine,
): { key: FrontmatterKey; value: FrontmatterText } | null {
	const match = line.match(/^["']?([^"':]+)["']?\s*:\s*(.*)$/);
	if (!match) return null;
	return {
		key: match[1].trim(),
		value: match[2].trim(),
	};
}

function isNestedFrontmatterLine(line: FrontmatterLine): boolean {
	return line.startsWith(" ") || line.startsWith("\t");
}

function parseTopLevelKey(line: FrontmatterLine): FrontmatterKey | null {
	if (line.trim() === "" || isNestedFrontmatterLine(line)) return null;
	return parseKeyValueLine(line)?.key ?? null;
}

function frontmatterCollisionKey(key: FrontmatterKey): FrontmatterKey {
	return canonicalFrontmatterKey(key);
}

function addCollisionCandidate(
	groups: Map<FrontmatterKey, { labels: FrontmatterKey[]; count: number }>,
	key: FrontmatterKey,
) {
	const collisionKey = frontmatterCollisionKey(key);
	const group = groups.get(collisionKey) ?? { labels: [], count: 0 };
	group.count += 1;
	if (!group.labels.includes(key)) group.labels.push(key);
	groups.set(collisionKey, group);
}

function assignFrontmatterValue(
	result: ParsedFrontmatter,
	collisionKeys: Map<FrontmatterKey, FrontmatterKey>,
	key: FrontmatterKey,
	value: ParsedFrontmatterValue,
) {
	const collisionKey = frontmatterCollisionKey(key);
	const previousKey = collisionKeys.get(collisionKey);
	if (previousKey && previousKey !== key)
		Reflect.deleteProperty(result, previousKey);
	collisionKeys.set(collisionKey, key);
	Reflect.set(result, key, value);
}

function parseFrontmatterValue(
	value: FrontmatterText,
): ParsedFrontmatterValue | undefined {
	if (isBlockScalar(value)) return undefined;
	if (isInlineArrayLiteral(value)) return parseInlineArray(value);
	return parseScalar(value);
}

function flushList(
	result: ParsedFrontmatter,
	collisionKeys: Map<FrontmatterKey, FrontmatterKey>,
	currentKey: FrontmatterKey | null,
	currentList: ParsedFrontmatterScalar[],
): ParsedFrontmatterScalar[] {
	if (currentKey && currentList.length > 0) {
		assignFrontmatterValue(
			result,
			collisionKeys,
			currentKey,
			collapseList(currentList),
		);
	}
	return [];
}

/** Parse YAML frontmatter from content */
export function parseFrontmatter(
	content: MarkdownContent | null,
): ParsedFrontmatter {
	const frontmatterBody = extractFrontmatterBody(content);
	if (frontmatterBody === null) return {};

	const result: ParsedFrontmatter = {};
	const collisionKeys = new Map<FrontmatterKey, FrontmatterKey>();
	let currentKey: FrontmatterKey | null = null;
	let currentList: ParsedFrontmatterScalar[] = [];

	for (const line of frontmatterBody.split(/\r?\n/)) {
		const listItem = parseListItem(line);
		if (listItem !== undefined && currentKey) {
			currentList.push(listItem);
			continue;
		}

		if (isNestedFrontmatterLine(line)) continue;

		currentList = flushList(result, collisionKeys, currentKey, currentList);

		const keyValue = parseKeyValueLine(line);
		if (!keyValue) continue;
		currentKey = keyValue.key;

		const parsedValue = parseFrontmatterValue(keyValue.value);
		if (parsedValue !== undefined) {
			assignFrontmatterValue(result, collisionKeys, currentKey, parsedValue);
		}
	}

	flushList(result, collisionKeys, currentKey, currentList);
	return result;
}

export function detectFrontmatterWarnings(
	content: MarkdownContent | null,
): FrontmatterWarnings {
	const frontmatterBody = extractFrontmatterBody(content);
	if (frontmatterBody === null) return { collidingProperties: [] };

	const groups = new Map<
		FrontmatterKey,
		{ labels: FrontmatterKey[]; count: number }
	>();
	for (const line of frontmatterBody.split(/\r?\n/)) {
		const key = parseTopLevelKey(line);
		if (key) addCollisionCandidate(groups, key);
	}

	const collidingProperties = Array.from(groups.entries())
		.filter(([, group]) => group.count > 1)
		.map(([key, group]) => ({ key, labels: group.labels }));

	return { collidingProperties };
}

export function hasFrontmatterWarnings(warnings: FrontmatterWarnings): boolean {
	return warnings.collidingProperties.length > 0;
}
