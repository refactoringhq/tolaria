import git, { type WalkerEntry, type WalkerIterate } from "isomorphic-git";
import { coalesceUnicodeEquivalentEntries } from "./gitUnicodePathEntries";
import type { GitVaultContext } from "./gitVault";

export type GitStatusEntry = {
	filepath: string;
	head: WalkerEntry | null;
	worktree: WalkerEntry | null;
	stage: WalkerEntry | null;
	types: (string | undefined)[];
	gitlink: boolean;
};

type GitStatusOptions = {
	stopIf: () => boolean;
	visit: (entry: GitStatusEntry) => Promise<void> | void;
};

type GitWalkRecord = {
	filepath: string;
	entries: (WalkerEntry | null)[];
};

export async function walkGitStatus(
	context: GitVaultContext,
	{ stopIf, visit }: GitStatusOptions,
) {
	const unicodeEntries: GitWalkRecord[] = [];
	await git.walk({
		...context,
		trees: [
			git.TREE({ ref: "HEAD" }),
			git.WORKDIR({ refresh: false }),
			git.STAGE(),
		],
		iterate: serially(stopIf),
		map: async (filepath, entries) => {
			const record = await toGitStatusEntry(filepath, entries);
			if (await isIgnoredUntracked(context, record)) return null;
			if (containsUnicode(filepath)) {
				unicodeEntries.push({ filepath, entries });
				return record.gitlink ? null : undefined;
			}
			await visit(record);
			if (record.gitlink) return null;
		},
	});
	for (const record of coalesceUnicodeStatusEntries(
		unicodeEntries,
		1,
		[0, 2],
	)) {
		if (stopIf()) break;
		await visit(await toGitStatusEntry(record.filepath, record.entries));
	}
}

function coalesceUnicodeStatusEntries<T extends GitWalkRecord>(
	records: T[],
	worktreeIndex: number,
	trackedIndexes: number[],
) {
	const distinct = findDistinctTrackedSpellings(records, trackedIndexes);
	const eligible = records.filter(
		(record) => !distinct.has(record.filepath.normalize("NFC")),
	);
	return [
		...coalesceUnicodeEquivalentEntries(
			eligible,
			worktreeIndex,
			trackedIndexes,
		),
		...records.filter((record) =>
			distinct.has(record.filepath.normalize("NFC")),
		),
	];
}

function findDistinctTrackedSpellings(
	records: GitWalkRecord[],
	trackedIndexes: number[],
) {
	const pathsByNormalizedName = new Map<string, Set<string>>();
	for (const { filepath, entries } of records) {
		if (!trackedIndexes.some((index) => entries[index])) continue;
		const key = filepath.normalize("NFC");
		const paths = pathsByNormalizedName.get(key) ?? new Set<string>();
		paths.add(filepath);
		pathsByNormalizedName.set(key, paths);
	}
	return new Set(
		[...pathsByNormalizedName]
			.filter(([, paths]) => paths.size > 1)
			.map(([key]) => key),
	);
}

async function toGitStatusEntry(
	filepath: string,
	[head, worktree, stage]: (WalkerEntry | null)[],
): Promise<GitStatusEntry> {
	const entries = [head, worktree, stage];
	const types = await Promise.all(entries.map((entry) => entry?.type()));
	return {
		filepath,
		head,
		worktree,
		stage,
		types,
		gitlink: types[0] === "commit" || types[2] === "commit",
	};
}

async function isIgnoredUntracked(
	context: GitVaultContext,
	{ filepath, head, stage }: GitStatusEntry,
) {
	return !head && !stage && (await git.isIgnored({ ...context, filepath }));
}

function containsUnicode(filepath: string) {
	return [...filepath].some((character) => character.charCodeAt(0) > 0x7f);
}

const serially =
	(stopIf: () => boolean): WalkerIterate =>
	async (walk, children) => {
		const results: unknown[] = [];
		for (const child of children) {
			if (stopIf()) break;
			results.push(await walk(child));
		}
		return results;
	};
