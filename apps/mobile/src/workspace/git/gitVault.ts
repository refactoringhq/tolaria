import "./gitRuntime";
import git, { type FsClient } from "isomorphic-git";
import {
	checkoutGitFastForward,
	recoverGitCheckout,
} from "./gitCheckoutRecovery";
import { mergeGitHeads } from "./gitMerge";
import { stageVerifiedGitChanges } from "./gitSelectiveStaging";
import {
	hasGitWorkingTreeChanges,
	readGitWorkingTreeChanges,
} from "./gitWorkingTreeChanges";

export type GitAuthor = { name: string; email: string };
export type GitRelationship = "equal" | "ahead" | "behind" | "diverged";
export type GitVaultContext = { fs: FsClient; dir: string; cache?: object };

export { githubRepositoryUrl } from "./githubRepositoryUrl";

export function createGitVault(options: GitVaultContext) {
	// Transport options can include a short ref; local writes must follow HEAD.
	const context = {
		fs: options.fs,
		dir: options.dir,
		cache: options.cache ?? {},
	};
	return {
		checkpoint: (author: GitAuthor, message?: string) =>
			checkpoint(context, author, message),
		requireClean: () => requireClean(context),
		integrate: (remoteOid: string, author?: GitAuthor) =>
			integrate(context, remoteOid, author),
		// Sync calls this under the workspace lock immediately after a verified checkpoint.
		integrateVerifiedCleanWorkspace: (remoteOid: string, author?: GitAuthor) =>
			integrate(context, remoteOid, author, true),
		relationship: (remoteOid: string) => relationship(context, remoteOid),
		recover: () => recoverGitCheckout(context),
	};
}

async function refreshedChanges(context: GitVaultContext) {
	const workspaceChanged = await recoverGitCheckout(context);
	const clean = await stageVerifiedGitChanges(context);
	const changed = clean ? [] : await readGitWorkingTreeChanges(context);
	return { changed, workspaceChanged };
}

async function requireClean(context: GitVaultContext) {
	const { changed, workspaceChanged } = await refreshedChanges(context);
	if (changed.length) throw new Error("uncommittedChanges");
	return {
		changedFiles: 0,
		oid: await git.resolveRef({ ...context, ref: "HEAD" }),
		workspaceChanged,
	};
}

async function checkpoint(
	context: GitVaultContext,
	author: GitAuthor,
	message = "Update vault from Tolaria mobile",
) {
	if (!message.trim()) throw new Error("emptyCommitMessage");
	const { changed, workspaceChanged } = await refreshedChanges(context);
	for (const { filepath, deleted } of changed) {
		if (deleted) await git.remove({ ...context, filepath });
	}
	const oid = changed.length
		? await git.commit({ ...context, author, message: message.trim() })
		: await git.resolveRef({ ...context, ref: "HEAD" });
	return { changedFiles: changed.length, oid, workspaceChanged };
}

async function relationship(
	context: GitVaultContext,
	remoteOid: string,
): Promise<GitRelationship> {
	const head = await git.resolveRef({ ...context, ref: "HEAD" });
	if (head === remoteOid) return "equal";
	if (await git.isDescendent({ ...context, oid: head, ancestor: remoteOid }))
		return "ahead";
	if (await git.isDescendent({ ...context, oid: remoteOid, ancestor: head }))
		return "behind";
	return "diverged";
}

async function integrate(
	context: GitVaultContext,
	remoteOid: string,
	author?: GitAuthor,
	checkpointed = false,
) {
	await recoverGitCheckout(context);
	if (!checkpointed && (await hasGitWorkingTreeChanges(context)))
		throw new Error("dirtyWorkingCopy");
	const state = await relationship(context, remoteOid);
	if (state === "diverged")
		return integrateDivergence(context, remoteOid, author);
	if (state !== "behind") return state;
	await advanceHead(context, remoteOid);
	return "updated" as const;
}

async function integrateDivergence(
	context: GitVaultContext,
	remoteOid: string,
	author?: GitAuthor,
) {
	if (!author) return "diverged" as const;
	const target = await mergeGitHeads(context, remoteOid, author);
	if (!target) return "diverged" as const;
	await advanceHead(context, target);
	return "merged" as const;
}

async function advanceHead(context: GitVaultContext, target: string) {
	const branch = await git.currentBranch(context);
	if (!branch) throw new Error("detachedHead");
	await checkoutGitFastForward(context, branch, target);
}
