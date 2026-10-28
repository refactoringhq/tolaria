function additionLinesFor(additions, file) {
	if (additions.has(file)) return additions.get(file);
	const lines = new Set();
	lines.auditedRustUnsafeLines = new Set();
	additions.set(file, lines);
	return lines;
}

function recordAddedLine(lines, lineNumber, source, previousAddedLine) {
	lines.add(lineNumber);
	const audited =
		previousAddedLine?.trimStart().startsWith("// SAFETY:") &&
		source.includes("unsafe");
	if (audited) lines.auditedRustUnsafeLines.add(lineNumber);
}

function hunkStartLine(line) {
	if (!line.startsWith("@@ -")) return null;
	const additionStart = line.indexOf("+", 4);
	if (additionStart === -1) return null;
	const numberStart = additionStart + 1;
	const comma = line.indexOf(",", numberStart);
	const space = line.indexOf(" ", numberStart);
	const numberEnd =
		comma === -1 || (space !== -1 && space < comma) ? space : comma;
	if (numberEnd === -1 || !line.slice(numberEnd).includes("@@")) return null;
	const value = Number(line.slice(numberStart, numberEnd));
	return Number.isInteger(value) ? value : null;
}

export function addedLinesFromDiff(diff, repositoryRoot) {
	const additions = new Map();
	let file = null;
	let nextLine = 0;
	let previousAddedLine = null;

	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ b/")) {
			file = `${repositoryRoot}/${line.slice(6)}`;
			additionLinesFor(additions, file);
			previousAddedLine = null;
			continue;
		}
		const hunkLine = hunkStartLine(line);
		if (hunkLine !== null) {
			nextLine = hunkLine;
			continue;
		}
		if (!file || line.startsWith("---")) continue;
		if (line.startsWith("+")) {
			const addedLine = line.slice(1);
			const lines = additions.get(file);
			recordAddedLine(lines, nextLine, addedLine, previousAddedLine);
			previousAddedLine = addedLine;
			nextLine += 1;
		} else if (!line.startsWith("-")) {
			previousAddedLine = null;
			nextLine += 1;
		}
	}
	return additions;
}

export function biomeGateFailures(report, additions, repositoryRoot) {
	return (report.diagnostics ?? []).flatMap((diagnostic) => {
		const added = addedDiagnostic(diagnostic, additions, repositoryRoot);
		if (!added) return [];
		return [
			{
				line: added.line,
				message: diagnostic.message ?? "Biome issue",
				path: added.path,
				rule: diagnostic.category ?? "unknown rule",
				tool: "Biome",
			},
		];
	});
}

function addedDiagnostic(diagnostic, additions, repositoryRoot) {
	const path = resolveDiagnosticPath(diagnostic.location?.path, repositoryRoot);
	if (!path) return null;
	const line = diagnostic.location?.start?.line;
	if (!line) return null;
	if (!additions.get(path)?.has(line)) return null;
	return { line, path };
}

export function eslintGateFailures(report, additions) {
	return report.flatMap((file) =>
		(file.messages ?? []).flatMap((message) => {
			if (!message.line || !additions.get(file.filePath)?.has(message.line))
				return [];
			return [
				{
					line: message.line,
					message: message.message ?? "ESLint issue",
					path: file.filePath,
					rule: message.ruleId ?? "unknown rule",
					tool: "Codacy ESLint security rules",
				},
			];
		}),
	);
}

function resolveDiagnosticPath(path, repositoryRoot) {
	if (!path) return "";
	return path.startsWith("/") ? path : `${repositoryRoot}/${path}`;
}

function unquote(value) {
	const quote = value.charAt(0);
	if (quote === '"' || quote === "'") {
		const close = value.indexOf(quote, 1);
		return close === -1 ? value.slice(1) : value.slice(1, close);
	}
	const comment = value.indexOf(" #");
	return comment === -1 ? value : value.slice(0, comment).trim();
}

/** Reads `exclude_paths` from the root .codacy.yaml, the same list Codacy's hosted analysis skips. */
export function codacyExcludePatterns(yamlText) {
	const patterns = [];
	let inExcludes = false;
	for (const line of yamlText.split("\n")) {
		const parsed = parseExcludeLine(line, inExcludes);
		inExcludes = parsed.inExcludes;
		if (parsed.pattern !== null) patterns.push(parsed.pattern);
	}
	return patterns;
}

function parseExcludeLine(line, inExcludes) {
	const trimmed = line.trim();
	if (isBlankOrComment(trimmed)) return { inExcludes, pattern: null };
	if (isTopLevel(line))
		return { inExcludes: trimmed === "exclude_paths:", pattern: null };
	return { inExcludes, pattern: inExcludes ? parseExcludeItem(trimmed) : null };
}

function isBlankOrComment(line) {
	return line === "" || line.startsWith("#");
}

function isTopLevel(line) {
	return (
		!line.startsWith(" ") && !line.startsWith("\t") && !line.startsWith("-")
	);
}

function parseExcludeItem(line) {
	return line.startsWith("- ") ? unquote(line.slice(2).trim()) : null;
}

function matchesSegment(pattern, name) {
	const parts = pattern.split("*");
	if (parts.length === 1) return pattern === name;
	const head = parts.shift();
	const tail = parts.pop();
	if (!matchesSegmentBounds(name, head, tail)) return false;
	let cursor = head.length;
	const end = name.length - tail.length;
	for (const part of parts) {
		const found = findSegment(name, part, cursor, end);
		if (found === null) return false;
		cursor = found + part.length;
	}
	return true;
}

function matchesSegmentBounds(name, head, tail) {
	return (
		name.startsWith(head) &&
		name.endsWith(tail) &&
		name.length >= head.length + tail.length
	);
}

function findSegment(name, part, cursor, end) {
	const found = name.indexOf(part, cursor);
	return found !== -1 && found + part.length <= end ? found : null;
}

function matchesSegments(patternSegments, pathSegments) {
	if (patternSegments.length === 0) return pathSegments.length === 0;
	const [first, ...rest] = patternSegments;
	if (first === "**") return matchesGlobstar(rest, pathSegments);
	return matchesCurrentSegment(first, rest, pathSegments);
}

function matchesGlobstar(rest, pathSegments) {
	for (let skip = 0; skip <= pathSegments.length; skip += 1) {
		if (matchesSegments(rest, pathSegments.slice(skip))) return true;
	}
	return false;
}

function matchesCurrentSegment(pattern, rest, pathSegments) {
	if (pathSegments.length === 0) return false;
	if (!matchesSegment(pattern, pathSegments[0])) return false;
	return matchesSegments(rest, pathSegments.slice(1));
}

/** Codacy-style glob match on a repository-relative path: `**` spans directories, `*` stays inside one. */
export function matchesCodacyGlob(glob, relativePath) {
	return matchesSegments(glob.split("/"), relativePath.split("/"));
}

/** Drops files matching the Codacy exclude list so the local gate agrees with hosted Codacy. */
export function withoutExcludedPaths(additions, patterns, repositoryRoot) {
	const kept = new Map();
	for (const [file, lines] of additions) {
		const relative = file.startsWith(`${repositoryRoot}/`)
			? file.slice(repositoryRoot.length + 1)
			: file;
		if (!patterns.some((pattern) => matchesCodacyGlob(pattern, relative)))
			kept.set(file, lines);
	}
	return kept;
}
