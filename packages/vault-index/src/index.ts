import {
	type Frontmatter,
	frontmatterFlag,
	frontmatterList,
	frontmatterRelationships,
	frontmatterScalar,
	parseDocument,
} from "./frontmatter";
import {
	countWords,
	deriveTitle,
	extractOutgoingLinks,
	extractSnippet,
	hasH1,
} from "./markdown";

export type FileKind = "markdown" | "text" | "binary";

export type VaultFile = {
	relativePath: string;
	content: string;
	size: number;
	createdAt: number | null;
	modifiedAt: number | null;
};

export type VaultEntry = {
	path: string;
	filename: string;
	title: string;
	isA?: string;
	aliases?: string[];
	belongsTo?: string[];
	status?: string;
	fileSize: number;
	snippet: string;
	relationships?: Record<string, string[]>;
	wordCount: number;
	outgoingLinks?: string[];
	hasH1: boolean;
	fileKind: FileKind;
	favorite?: boolean;
	favoriteIndex?: number;
};

export function buildVaultIndex(files: VaultFile[]): VaultEntry[] {
	return files
		.map(parseVaultEntry)
		.sort((a, b) => a.path.localeCompare(b.path));
}

function parseVaultEntry(file: VaultFile): VaultEntry {
	const fileKind = determineFileKind({ path: file.relativePath });
	const filename = file.relativePath.split("/").at(-1) ?? file.relativePath;

	if (fileKind !== "markdown") {
		const title =
			extractYamlName({ path: file.relativePath, content: file.content }) ||
			filename;
		return {
			path: file.relativePath,
			filename,
			title,
			fileSize: file.size,
			snippet: "",
			wordCount: 0,
			hasH1: false,
			fileKind,
		};
	}

	const document = parseDocument(file.content);
	return parseMarkdownEntry({ file, filename, fileKind, document });
}

function parseMarkdownEntry(input: {
	file: VaultFile;
	filename: string;
	fileKind: FileKind;
	document: ReturnType<typeof parseDocument>;
}): VaultEntry {
	const { file, filename, fileKind, document } = input;
	const type = cleanTypeName({
		value:
			frontmatterScalar(document.frontmatter, ["type", "Is A", "is_a"]) ??
			"Note",
	});
	const outgoingLinks = extractOutgoingLinks(document.body);
	const title = deriveTitle({
		body: document.body,
		fallbackTitle: frontmatterScalar(document.frontmatter, ["title"]),
		filename,
	});

	const entry: VaultEntry = {
		path: file.relativePath,
		filename,
		title,
		isA: type,
		fileSize: file.size,
		snippet: extractSnippet(document.body),
		wordCount: countWords(document.body),
		hasH1: hasH1(document.body),
		fileKind,
	};
	return addFrontmatterMetadata({
		entry,
		frontmatter: document.frontmatter,
		type,
		outgoingLinks,
	});
}

function addFrontmatterMetadata(input: {
	entry: VaultEntry;
	frontmatter: Frontmatter;
	type: string;
	outgoingLinks: string[];
}): VaultEntry {
	const { entry, frontmatter, type, outgoingLinks } = input;
	Object.assign(entry, readFavoriteMetadata(frontmatter));
	const aliases = frontmatterList(frontmatter, ["aliases", "Aliases"]);
	if (aliases.length > 0) entry.aliases = aliases;
	const belongsTo = extractBelongsTo(frontmatter);
	if (belongsTo.length > 0) entry.belongsTo = belongsTo;
	const status = frontmatterScalar(frontmatter, ["Status", "status"]);
	if (status) entry.status = status;
	const relationships = frontmatterRelationships(frontmatter);
	if (type !== "Type") relationships.Type = [formatTypeLink(type)];
	if (Object.keys(relationships).length > 0)
		entry.relationships = relationships;
	if (outgoingLinks.length > 0) entry.outgoingLinks = outgoingLinks;
	return entry;
}

function formatTypeLink(type: string): string {
	return type.startsWith("[[") && type.endsWith("]]")
		? type
		: `[[${type.toLowerCase()}]]`;
}

function readFavoriteMetadata(
	frontmatter: Frontmatter,
): Pick<VaultEntry, "favorite" | "favoriteIndex"> {
	const result: Pick<VaultEntry, "favorite" | "favoriteIndex"> = {};
	if (frontmatterFlag(frontmatter, ["_favorite", "favorite"])) {
		result.favorite = true;
	}
	const rawIndex = frontmatter._favorite_index;
	const favoriteIndex =
		typeof rawIndex === "number" ? rawIndex : Number(rawIndex);
	if (rawIndex !== undefined && Number.isSafeInteger(favoriteIndex)) {
		result.favoriteIndex = favoriteIndex;
	}
	return result;
}

function determineFileKind({ path }: { path: string }): FileKind {
	const lower = path.toLowerCase();

	if (lower.endsWith(".md")) return "markdown";

	const binaryExtensions = [
		".png",
		".jpg",
		".jpeg",
		".gif",
		".webp",
		".bmp",
		".svg",
		".pdf",
		".zip",
		".tar",
		".gz",
		".7z",
		".mp3",
		".mp4",
		".avi",
		".mov",
		".wav",
		".exe",
		".dll",
		".so",
		".dylib",
	];

	if (binaryExtensions.some((ext) => lower.endsWith(ext))) {
		return "binary";
	}

	return "text";
}

function cleanTypeName({ value }: { value: string }): string {
	return extractWikilinkTarget({ value }).replace(/\.md$/, "");
}

function extractWikilinkTarget({ value }: { value: string }): string {
	const match = value.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
	return match ? match[1].trim() : value.trim();
}

function extractBelongsTo(frontmatter: Frontmatter): string[] {
	return frontmatterList(frontmatter, [
		"belongs_to",
		"Belongs To",
		"belongsTo",
	]);
}

function extractYamlName({
	path,
	content,
}: {
	path: string;
	content: string;
}): string | null {
	const lower = path.toLowerCase();
	if (!lower.endsWith(".yml") && !lower.endsWith(".yaml")) {
		return null;
	}

	const nameMatch = content.match(/^name:\s*(.+)$/m);
	return nameMatch ? nameMatch[1].trim() : null;
}

export * from "./frontmatter";
export * from "./markdown";
