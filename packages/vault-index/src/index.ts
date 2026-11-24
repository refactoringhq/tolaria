import {
	type Frontmatter,
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
};

export function buildVaultIndex(files: VaultFile[]): VaultEntry[] {
	return files
		.map(parseVaultEntry)
		.sort((a, b) => a.path.localeCompare(b.path));
}

function parseVaultEntry(file: VaultFile): VaultEntry {
	const fileKind = determineFileKind(file.relativePath);
	const filename = file.relativePath.split("/").at(-1) ?? file.relativePath;

	if (fileKind !== "markdown") {
		const title = extractYamlName(file.relativePath, file.content) || filename;
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
	const type = cleanTypeName(
		frontmatterScalar(document.frontmatter, ["type", "Is A", "is_a"]) ?? "Note",
	);
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

	const aliases = frontmatterList(document.frontmatter, ["aliases", "Aliases"]);
	if (aliases.length > 0) {
		entry.aliases = aliases;
	}

	const belongsTo = extractBelongsTo(document.frontmatter);
	if (belongsTo.length > 0) {
		entry.belongsTo = belongsTo;
	}

	const status = frontmatterScalar(document.frontmatter, ["Status", "status"]);
	if (status) {
		entry.status = status;
	}

	const relationships = frontmatterRelationships(document.frontmatter);

	if (type !== "Type") {
		const typeLink =
			type.startsWith("[[") && type.endsWith("]]")
				? type
				: `[[${type.toLowerCase()}]]`;
		relationships.Type = [typeLink];
	}

	if (Object.keys(relationships).length > 0) {
		entry.relationships = relationships;
	}

	if (outgoingLinks.length > 0) {
		entry.outgoingLinks = outgoingLinks;
	}

	return entry;
}

function determineFileKind(path: string): FileKind {
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

function cleanTypeName(value: string): string {
	return extractWikilinkTarget(value).replace(/\.md$/, "");
}

function extractWikilinkTarget(value: string): string {
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

function extractYamlName(path: string, content: string): string | null {
	const lower = path.toLowerCase();
	if (!lower.endsWith(".yml") && !lower.endsWith(".yaml")) {
		return null;
	}

	const nameMatch = content.match(/^name:\s*(.+)$/m);
	return nameMatch ? nameMatch[1].trim() : null;
}

export * from "./frontmatter";
export * from "./markdown";
