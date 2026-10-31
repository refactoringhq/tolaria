import git, { type WalkerEntry, type WalkerIterate } from "isomorphic-git";
import { coalesceUnicodeEquivalentEntries } from "./gitUnicodePathEntries";
import type { GitVaultContext } from "./gitVault";

type GitWorkingTreeChange = { filepath: string; deleted: boolean };
type GitWalkRecord = { filepath: string; entries: (WalkerEntry | null)[] };
type ChangeCollector = {
	context: GitVaultContext;
	records: GitWalkRecord[];
	changes: GitWorkingTreeChange[];
};

/** Read-only guard; the library still owns stat/OID/ignore semantics. */
export async function hasGitWorkingTreeChanges(context: GitVaultContext) {
	return (await scanChanges(context, true)).length > 0;
}

export function readGitWorkingTreeChanges(context: GitVaultContext) {
	return scanChanges(context, false);
}

async function scanChanges(context: GitVaultContext, firstOnly: boolean) {
	const records: GitWalkRecord[] = [];
	const changes: GitWorkingTreeChange[] = [];
	const collector = { context, records, changes };
	await git.walk({
		...context,
		trees: [
			git.TREE({ ref: "HEAD" }),
			git.WORKDIR({ refresh: false }),
			git.STAGE(),
		],
		iterate: serially(firstOnly, changes),
		map: (filepath, entries) => collectEntry(collector, filepath, entries),
	});
	await appendUnicodeChanges(records, changes, firstOnly);
	return changes;
}

async function collectEntry(
	collector: ChangeCollector,
	filepath: string,
	entries: (WalkerEntry | null)[],
) {
	if (await ignoredUntracked(collector.context, filepath, entries)) return null;
	if (isGitlink(await Promise.all(entries.map((entry) => entry?.type()))))
		return null;
	if (containsUnicode(filepath)) collector.records.push({ filepath, entries });
	else {
		const change = await readChange(filepath, entries);
		if (change) collector.changes.push(change);
	}
}

async function appendUnicodeChanges(
	records: GitWalkRecord[],
	changes: GitWorkingTreeChange[],
	firstOnly: boolean,
) {
	const paths = coalesceUnicodeEquivalentEntries(records, 1, [2, 0]);
	for (const { filepath, entries } of paths) {
		if (firstOnly && changes.length) break;
		const change = await readChange(filepath, entries);
		if (change) changes.push(change);
	}
}

function containsUnicode(filepath: string) {
	return [...filepath].some((character) => character.charCodeAt(0) > 0x7f);
}

function ignoredUntracked(
	context: GitVaultContext,
	filepath: string,
	entries: (WalkerEntry | null)[],
) {
	return !entries[0] && !entries[2] && git.isIgnored({ ...context, filepath });
}

async function readChange(filepath: string, entries: (WalkerEntry | null)[]) {
	const types = await Promise.all(entries.map((entry) => entry?.type()));
	if (isGitlink(types) || !types.includes("blob")) return;
	if (!(entries[0] || entries[2])) return { filepath, deleted: false };
	const oids = await Promise.all(
		entries.map((entry, index) => blobOid(entry, types[index])),
	);
	if (oids.some((oid) => oid !== oids[0]))
		return { filepath, deleted: types[1] !== "blob" };
}

function isGitlink(types: (string | undefined)[]) {
	return types[0] === "commit" || types[2] === "commit";
}

function blobOid(entry: WalkerEntry | null, type: string | undefined) {
	return type === "blob" ? entry?.oid() : undefined;
}

const serially =
	(firstOnly: boolean, changes: GitWorkingTreeChange[]): WalkerIterate =>
	async (walk, children) => {
		const results: unknown[] = [];
		for (const child of children) {
			if (firstOnly && changes.length) break;
			results.push(await walk(child));
		}
		return results;
	};
