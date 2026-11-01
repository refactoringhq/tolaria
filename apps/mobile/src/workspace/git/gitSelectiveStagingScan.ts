import git, { type WalkerEntry } from "isomorphic-git";
import { type GitStatusEntry, walkGitStatus } from "./gitStatusWalk";
import type { GitVaultContext } from "./gitVault";

const smallBatchLimit = 16;
type Scan = {
	context: GitVaultContext;
	files: string[];
	fallback: boolean;
	clean: boolean;
	read: (filepath: string) => Promise<Uint8Array>;
};

export async function scanChangedPaths(context: GitVaultContext) {
	if (!("promises" in context.fs)) return null;
	return scanFilesystemPaths(context, context.fs.promises);
}

async function scanFilesystemPaths(
	context: GitVaultContext,
	fs: Extract<GitVaultContext["fs"], { promises: unknown }>["promises"],
) {
	if (await usesAutocrlf(context)) return null;
	const scan: Scan = {
		context,
		files: [],
		fallback: false,
		clean: true,
		read: async (filepath) => fs.readFile(`${context.dir}/${filepath}`),
	};
	await collectChangedPaths(context, scan);
	return scan.fallback ? null : scan;
}

async function usesAutocrlf(context: GitVaultContext) {
	const value = await git.getConfig({ ...context, path: "core.autocrlf" });
	return Boolean(value && value !== "false");
}

async function collectChangedPaths(context: GitVaultContext, scan: Scan) {
	await walkGitStatus(context, {
		stopIf: () => scan.fallback,
		visit: async (entry) => {
			await inspectEntry(scan, entry);
		},
	});
}

async function inspectEntry(scan: Scan, entry: GitStatusEntry) {
	const { worktree, stage, head } = entry;
	if (scan.fallback) return null;
	if (!worktree) {
		scan.clean = false;
		return null;
	}
	// Preserve library handling of a staged removal that still exists on disk.
	if (head && !stage) {
		scan.fallback = true;
		return null;
	}
	await inspectWorktree(scan, { ...entry, worktree });
}

async function inspectWorktree(
	scan: Scan,
	entry: GitStatusEntry & { worktree: WalkerEntry },
) {
	const { filepath, worktree, stage, head } = entry;
	if ((await worktree.type()) === "tree") {
		scan.fallback = await incompatibleDirectory(stage);
		return;
	}
	recordChange(scan, filepath, await blobDiffers(scan, entry));
	scan.clean &&= await matchesHead(head, stage);
}

async function incompatibleDirectory(stage: WalkerEntry | null) {
	return stage ? (await stage.type()) !== "tree" : false;
}

function recordChange(scan: Scan, filepath: string, changed: boolean | null) {
	if (changed) scan.files.push(filepath);
	if (changed !== false) scan.clean = false;
	scan.fallback = changed === null || scan.files.length > smallBatchLimit;
}

async function matchesHead(
	head: WalkerEntry | null,
	stage: WalkerEntry | null,
) {
	if (!head || !stage) return false;
	if ((await head.type()) !== "blob") return false;
	return (
		(await head.oid()) === (await stage.oid()) &&
		(await head.mode()) === (await stage.mode())
	);
}

async function blobDiffers(
	scan: Scan,
	{ filepath, worktree, stage }: GitStatusEntry,
) {
	if (!worktree) return false;
	const mode = await worktree.mode();
	if (mode !== 0o100644 && mode !== 0o100755) return null;
	if (!stage) return true;
	if ((await stage.type()) !== "blob") return null;
	// Read directly so filesystem errors propagate instead of becoming a library null.
	const { oid } = await git.hashBlob({ object: await scan.read(filepath) });
	return oid !== (await stage.oid()) || mode !== (await stage.mode());
}
