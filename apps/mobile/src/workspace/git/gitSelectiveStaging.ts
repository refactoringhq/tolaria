import git, { type WalkerEntry, type WalkerIterate } from "isomorphic-git";
import { coalesceUnicodeEquivalentEntries } from "./gitUnicodePathEntries";
import type { GitVaultContext } from "./gitVault";

const smallBatchLimit = 16;
type Scan = {
	context: GitVaultContext;
	files: string[];
	fallback: boolean;
	clean: boolean;
	read: (filepath: string) => Promise<Uint8Array>;
};
type Entry = {
	filepath: string;
	worktree: WalkerEntry | null;
	stage: WalkerEntry | null;
	head: WalkerEntry | null;
};

/** Fresh-byte verification; true only when working tree, index and HEAD all match. */
export async function stageVerifiedGitChanges(context: GitVaultContext) {
	const scan = await changedPaths(context);
	if (!scan) {
		await git.add({ ...context, filepath: ".", parallel: false });
		return false;
	}
	// Arrays passed to git.add run concurrently even with parallel:false.
	for (const filepath of scan.files)
		await git.add({ ...context, filepath, parallel: false });
	return scan.clean;
}

async function changedPaths(context: GitVaultContext): Promise<Scan | null> {
	if (!("promises" in context.fs)) return null;
	const autocrlf = await git.getConfig({ ...context, path: "core.autocrlf" });
	if (autocrlf && autocrlf !== "false") return null;
	const fs = context.fs.promises;
	const scan: Scan = {
		context,
		files: [],
		fallback: false,
		clean: true,
		read: async (filepath) => fs.readFile(`${context.dir}/${filepath}`),
	};
	const records = await collectRecords(context, scan);
	await inspectUnicodeRecords(scan, records);
	return scan.fallback ? null : scan;
}

async function collectRecords(context: GitVaultContext, scan: Scan) {
	const records: { filepath: string; entries: (WalkerEntry | null)[] }[] = [];
	await git.walk({
		...context,
		trees: [
			git.WORKDIR({ refresh: false }),
			git.STAGE(),
			git.TREE({ ref: "HEAD" }),
		],
		iterate: serially(scan),
		map: (filepath, entries) =>
			collectEntry(context, records, filepath, entries),
	});
	return records;
}

async function collectEntry(
	context: GitVaultContext,
	records: { filepath: string; entries: (WalkerEntry | null)[] }[],
	filepath: string,
	entries: (WalkerEntry | null)[],
) {
	if (await ignoredUntrackedEntry(context, { filepath, stage: entries[1] }))
		return null;
	records.push({ filepath, entries });
}

async function inspectUnicodeRecords(
	scan: Scan,
	records: { filepath: string; entries: (WalkerEntry | null)[] }[],
) {
	const paths = coalesceUnicodeEquivalentEntries(records, 0, [1, 2]);
	for (const record of paths) {
		await inspectEntry(scan, {
			filepath: record.filepath,
			worktree: record.entries[0],
			stage: record.entries[1],
			head: record.entries[2],
		});
		if (scan.fallback) break;
	}
}

async function inspectEntry(scan: Scan, entry: Entry) {
	const { filepath, worktree, stage, head } = entry;
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
	if (await ignoredUntrackedEntry(scan.context, entry)) return null;
	if ((await worktree.type()) === "tree") {
		scan.fallback = await incompatibleDirectory(stage);
		return;
	}
	recordChange(scan, filepath, await blobDiffers(scan, entry));
	scan.clean &&= await matchesHead(head, stage);
}

async function ignoredUntrackedEntry(
	context: GitVaultContext,
	{ filepath, stage }: Pick<Entry, "filepath" | "stage">,
) {
	return !stage && (await git.isIgnored({ ...context, filepath }));
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

async function blobDiffers(scan: Scan, { filepath, worktree, stage }: Entry) {
	if (!worktree) return false;
	const mode = await worktree.mode();
	if (mode !== 0o100644 && mode !== 0o100755) return null;
	if (!stage) return true;
	if ((await stage.type()) !== "blob") return null;
	// Read directly so filesystem errors propagate instead of becoming a library null.
	const { oid } = await git.hashBlob({ object: await scan.read(filepath) });
	return oid !== (await stage.oid()) || mode !== (await stage.mode());
}

const serially =
	(scan: Scan): WalkerIterate =>
	async (walk, children) => {
		const results: unknown[] = [];
		for (const child of children) {
			if (scan.fallback) break;
			results.push(await walk(child));
		}
		return results;
	};
