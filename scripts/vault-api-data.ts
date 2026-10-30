interface WikilinkValue {
	value: unknown;
	depth: number;
}
interface MarkdownTitleInput {
	content: string;
	frontmatter: Record<string, unknown>;
	fallback: string;
}

import {
	closeSync,
	type Dirent,
	fstatSync,
	opendirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface VaultEntry {
	path: string;
	filename: string;
	title: string;
	isA: string | null;
	aliases: string[];
	belongsTo: string[];
	relatedTo: string[];
	status: string | null;
	archived: boolean;
	trashed: boolean;
	trashedAt: number | null;
	modifiedAt: number | null;
	createdAt: number | null;
	fileSize: number;
	snippet: string;
	wordCount: number;
	relationships: Record<string, string[]>;
	icon: string | null;
	color: string | null;
	order: number | null;
	sidebarLabel: string | null;
	template: string | null;
	sort: string | null;
	view: string | null;
	visible: boolean | null;
	outgoingLinks: string[];
	properties: Record<string, string | number | boolean | null>;
}

/** Extract all [[wiki-links]] from a string. */
function extractWikiLinks({ value }: { value: string }): string[] {
	const matches = value.match(/\[\[[^\]]+\]\]/g);
	return matches ?? [];
}

/** Extract wiki-links from a frontmatter value (string or array of strings). */
function wikiLinksFromValue(value: unknown): string[] {
	return collectWikiLinksFromValue({ value, depth: 0 });
}

function collectWikiLinksFromValue({ value, depth }: WikilinkValue): string[] {
	if (typeof value === "string") return extractWikiLinks({ value });
	if (!Array.isArray(value)) return [];

	const nestedLink = nestedFlowWikilink({ value, depth });
	if (nestedLink) return [nestedLink];
	return value.flatMap((item) =>
		collectWikiLinksFromValue({ value: item, depth: depth + 1 }),
	);
}

function nestedFlowWikilink({
	value,
	depth,
}: WikilinkValue & { value: unknown[] }): string | null {
	if (depth === 0) return null;
	if (value.length !== 1) return null;
	if (typeof value[0] !== "string") return null;
	return extractWikiLinks({ value: value[0] }).length === 0
		? `[[${value[0]}]]`
		: null;
}

// Frontmatter keys that map to dedicated VaultEntry fields (skip in generic properties/relationships)
const DEDICATED_KEYS = new Set(
	[
		"aliases",
		"is_a",
		"is a",
		"type",
		"status",
		"title",
		"_archived",
		"archived",
		"_icon",
		"icon",
		"color",
		"_order",
		"order",
		"_sidebar_label",
		"sidebar_label",
		"sidebar label",
		"template",
		"_sort",
		"sort",
		"view",
		"_width",
		"width",
		"visible",
		"_organized",
		"_favorite",
		"_favorite_index",
		"_list_properties_display",
	].map((key) => key.toLowerCase()),
);

type FrontmatterPropertyValue = string | number | boolean | null;
type VaultSearchResult = {
	title: string;
	path: string;
	snippet: string;
	score: number;
	note_type: string | null;
};

interface SearchEntryInput {
	excludeFrontmatter: boolean;
	entry: VaultEntry;
	query: string;
	rawContent: string;
}

interface SearchRequestInput {
	excludeFrontmatter: boolean;
	query: string;
	vaultPath: string;
}

function getFrontmatterValue(
	frontmatter: Record<string, unknown>,
	keys: string[],
): unknown {
	const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
	return Object.entries(frontmatter).find(([key]) =>
		normalizedKeys.has(key.toLowerCase()),
	)?.[1];
}

function parseYamlBool(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return null;

	switch (value.toLowerCase()) {
		case "true":
		case "yes":
			return true;
		case "false":
		case "no":
			return false;
		default:
			return null;
	}
}

export function readUtf8File(filePath: string): string {
	const fd = openSync(filePath, "r");
	try {
		return readFileSync(fd, "utf-8");
	} finally {
		closeSync(fd);
	}
}

export function writeUtf8File(filePath: string, content: string): void {
	const fd = openSync(filePath, "w");
	try {
		writeFileSync(fd, content, "utf-8");
	} finally {
		closeSync(fd);
	}
}

function pathStats(filePath: string) {
	const fd = openSync(filePath, "r");
	try {
		return fstatSync(fd);
	} finally {
		closeSync(fd);
	}
}

export function pathExists(filePath: string): boolean {
	try {
		pathStats(filePath);
		return true;
	} catch {
		return false;
	}
}

function directoryEntries(dir: string): Dirent[] {
	const directory = opendirSync(dir);
	try {
		const entries: Dirent[] = [];
		let entry = directory.readSync();
		while (entry) {
			entries.push(entry);
			entry = directory.readSync();
		}
		return entries;
	} finally {
		directory.closeSync();
	}
}

function isInsideRelativePath({ relative }: { relative: string }): boolean {
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

export function resolveInside(root: string, target: string): string | null {
	const normalizedTarget = path.normalize(target);
	if (path.isAbsolute(normalizedTarget)) return null;
	const candidate = path.normalize(`${root}${path.sep}${normalizedTarget}`);
	return isInsideRelativePath({ relative: path.relative(root, candidate) })
		? candidate
		: null;
}

function frontmatterString(
	frontmatter: Record<string, unknown>,
	...keys: string[]
): string | null {
	const value = getFrontmatterValue(frontmatter, keys);
	return typeof value === "string" ? value : null;
}

function frontmatterStringArray(
	frontmatter: Record<string, unknown>,
	...keys: string[]
): string[] {
	const value = getFrontmatterValue(frontmatter, keys);
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string") return [value];
	return [];
}

function frontmatterBool(
	frontmatter: Record<string, unknown>,
	...keys: string[]
): boolean | null {
	return parseYamlBool(getFrontmatterValue(frontmatter, keys));
}

function markdownTitle({
	content,
	frontmatter,
	fallback,
}: MarkdownTitleInput): string {
	const title = frontmatterString(frontmatter, "title");
	if (title) return title;

	const h1Match = content.match(/^#\s+(.+)$/m);
	return h1Match ? h1Match[1].trim() : fallback;
}

function markdownBodyText({ content }: { content: string }): string {
	return content
		.replace(/^#+\s+.+$/gm, "")
		.replace(/[\n\r]+/g, " ")
		.trim();
}

interface TypeTemplateSource {
	body: string;
	explicitTemplate: string | null;
	isA: string | null;
	title: string;
}

function resolveTypeTemplate(source: TypeTemplateSource): string | null {
	if (source.explicitTemplate !== null) return source.explicitTemplate;
	if (source.isA !== "Type") return null;

	const template = bodyAfterTypeTitle(source)?.trim();
	if (!template) return null;
	return structuredTemplate({ template });
}

function bodyAfterTypeTitle(
	source: Pick<TypeTemplateSource, "body" | "title">,
): string | null {
	const body = source.body.trimStart();
	const lineEnd = body.indexOf("\n");
	const firstLine = (lineEnd === -1 ? body : body.slice(0, lineEnd)).replace(
		/\r$/,
		"",
	);
	const heading = firstLine.startsWith("# ") ? firstLine.slice(2).trim() : null;
	if (heading !== source.title) return null;
	return lineEnd === -1 ? "" : body.slice(lineEnd + 1);
}

function templateLineHasStructure({ line }: { line: string }): boolean {
	const trimmed = line.trimStart();
	return (
		trimmed.startsWith("## ") ||
		trimmed.startsWith("- [ ] ") ||
		templateLineIsField({ line: trimmed })
	);
}

function templateLineIsField({ line }: { line: string }): boolean {
	const trimmed = line.trim();
	if (!trimmed.endsWith(":")) return false;
	const label = trimmed.replace(/:+$/, "").trim();
	return label.length > 0 && !label.startsWith("-");
}

function frontmatterWikiLinks(
	frontmatter: Record<string, unknown>,
	...keys: string[]
): string[] {
	return frontmatterStringArray(frontmatter, ...keys).flatMap((value) =>
		extractWikiLinks({ value }),
	);
}

function frontmatterRelationships(
	frontmatter: Record<string, unknown>,
): Record<string, string[]> {
	const relationships: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (DEDICATED_KEYS.has(key.toLowerCase())) continue;
		const links = wikiLinksFromValue(value);
		if (links.length > 0) relationships[key] = links;
	}
	return relationships;
}

function frontmatterProperties(
	frontmatter: Record<string, unknown>,
): Record<string, FrontmatterPropertyValue> {
	const properties: Record<string, FrontmatterPropertyValue> = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (DEDICATED_KEYS.has(key.toLowerCase()) || key.trim().startsWith("_"))
			continue;
		const propertyValue = frontmatterPropertyValue(value);
		if (propertyValue !== undefined) properties[key] = propertyValue;
	}
	return properties;
}

function isScalarFrontmatterProperty(
	value: unknown,
): value is number | boolean {
	return typeof value === "number" || typeof value === "boolean";
}

function singleStringArrayValue(value: unknown): string | undefined {
	if (!Array.isArray(value)) return undefined;
	if (value.length !== 1) return undefined;
	return typeof value[0] === "string" ? value[0] : undefined;
}

function wikiLinkFreeString({ value }: { value: string }): string | undefined {
	return extractWikiLinks({ value }).length === 0 ? value : undefined;
}

function frontmatterPropertyValue(
	value: unknown,
): FrontmatterPropertyValue | undefined {
	if (value === null) return null;
	if (isScalarFrontmatterProperty(value)) return value;
	if (typeof value === "string") return wikiLinkFreeString({ value });
	const singleArrayValue = singleStringArrayValue(value);
	return singleArrayValue === undefined
		? undefined
		: wikiLinkFreeString({ value: singleArrayValue });
}

export function parseMarkdownFile(filePath: string): VaultEntry | null {
	try {
		const raw = readUtf8File(filePath);
		const stats = pathStats(filePath);
		const { data, content } = matter(raw);
		const fm = data as Record<string, unknown>;

		const filename = path.basename(filePath);
		const basename = filename.replace(/\.md$/, "");

		const title = markdownTitle({
			content,
			frontmatter: fm,
			fallback: basename,
		});
		const isA = frontmatterString(fm, "is_a", "is a", "type");
		const bodyText = markdownBodyText({ content });
		const snippet = bodyText.slice(0, 200);
		const template = resolveTypeTemplate({
			body: content,
			explicitTemplate: frontmatterString(fm, "template"),
			isA,
			title,
		});

		return {
			path: filePath,
			filename,
			title,
			isA,
			aliases: frontmatterStringArray(fm, "aliases"),
			belongsTo: frontmatterWikiLinks(fm, "belongs_to", "belongs to"),
			relatedTo: frontmatterWikiLinks(fm, "related_to", "related to"),
			status: frontmatterString(fm, "status"),
			archived: frontmatterBool(fm, "archived") ?? false,
			trashed: frontmatterBool(fm, "trashed") ?? false,
			trashedAt: null,
			modifiedAt: Math.floor(stats.mtimeMs / 1000),
			createdAt: Math.floor(stats.birthtimeMs / 1000),
			fileSize: stats.size,
			snippet,
			wordCount: bodyText.split(/\s+/).filter(Boolean).length,
			relationships: frontmatterRelationships(fm),
			icon: frontmatterString(fm, "icon"),
			color: frontmatterString(fm, "color"),
			order: fm.order != null ? Number(fm.order) : null,
			sidebarLabel: frontmatterString(fm, "sidebar label", "sidebar_label"),
			template,
			sort: frontmatterString(fm, "sort"),
			view: frontmatterString(fm, "view"),
			visible: frontmatterBool(fm, "visible"),
			outgoingLinks: [],
			properties: frontmatterProperties(fm),
		};
	} catch {
		return null;
	}
}

/** Recursively find all .md files under a directory. */
export function findMarkdownFiles(dir: string): string[] {
	const results: string[] = [];
	try {
		const items = directoryEntries(dir);
		for (const item of items) {
			if (item.name.startsWith(".")) continue;
			const full = resolveInside(dir, item.name);
			if (!full) continue;
			if (item.isDirectory()) {
				results.push(...findMarkdownFiles(full));
			} else if (item.name.endsWith(".md")) {
				results.push(full);
			}
		}
	} catch {
		// skip unreadable dirs
	}
	return results;
}

export function collectVaultSearchResults({
	excludeFrontmatter,
	vaultPath,
	query,
}: SearchRequestInput): VaultSearchResult[] {
	const results: VaultSearchResult[] = [];
	for (const filePath of findMarkdownFiles(vaultPath)) {
		const entry = parseMarkdownFile(filePath);
		if (!entry || entry.trashed) continue;
		const rawContent = readUtf8File(filePath);
		if (entryMatchesSearch({ entry, rawContent, query, excludeFrontmatter })) {
			results.push(searchResultFromEntry(entry));
		}
	}
	return results.slice(0, 20);
}

function searchableSearchContent({
	rawContent,
	excludeFrontmatter,
}: Pick<SearchEntryInput, "rawContent" | "excludeFrontmatter">): string {
	return excludeFrontmatter ? matter(rawContent).content : rawContent;
}

function entryMatchesSearch({
	entry,
	excludeFrontmatter,
	rawContent,
	query,
}: SearchEntryInput): boolean {
	const content = searchableSearchContent({ rawContent, excludeFrontmatter });
	return (
		entry.title.toLowerCase().includes(query) ||
		content.toLowerCase().includes(query)
	);
}

function searchResultFromEntry(entry: VaultEntry): VaultSearchResult {
	return {
		title: entry.title,
		path: entry.path,
		snippet: entry.snippet,
		score: 1.0,
		note_type: entry.isA,
	};
}

function structuredTemplate({ template }: { template: string }): string | null {
	return template
		.split(/\r?\n/)
		.some((line) => templateLineHasStructure({ line }))
		? template
		: null;
}
