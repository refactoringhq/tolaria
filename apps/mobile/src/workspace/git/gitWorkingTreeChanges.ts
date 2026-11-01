import type { WalkerEntry } from "isomorphic-git";
import { type GitStatusEntry, walkGitStatus } from "./gitStatusWalk";
import type { GitVaultContext } from "./gitVault";

type GitWorkingTreeChange = { filepath: string; deleted: boolean };

/** Read-only guard; the library still owns stat/OID/ignore semantics. */
export async function hasGitWorkingTreeChanges(context: GitVaultContext) {
	return (await scanChanges(context, true)).length > 0;
}

export function readGitWorkingTreeChanges(context: GitVaultContext) {
	return scanChanges(context, false);
}

async function scanChanges(context: GitVaultContext, firstOnly: boolean) {
	const changes: GitWorkingTreeChange[] = [];
	await walkGitStatus(context, {
		stopIf: () => firstOnly && changes.length > 0,
		visit: async (entry) => {
			const change = await readChange(entry);
			if (change) changes.push(change);
		},
	});
	return changes;
}
async function readChange({ filepath, head, worktree, stage }: GitStatusEntry) {
	const entries = [head, worktree, stage];
	const types = await Promise.all(entries.map((entry) => entry?.type()));
	if (isGitlink(types) || !types.includes("blob")) return;
	if (!(head || stage)) return { filepath, deleted: false };
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
