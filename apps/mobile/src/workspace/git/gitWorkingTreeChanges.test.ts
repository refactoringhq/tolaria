import fs from "node:fs";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import git from "isomorphic-git";
import { afterEach, expect, it } from "vitest";
import { createGitVault } from "./gitVault";
import { readGitWorkingTreeChanges } from "./gitWorkingTreeChanges";

const author = { name: "Test", email: "qa@example.invalid" };
const roots: string[] = [];
afterEach(async () => {
	for (const root of roots.splice(0))
		await rm(root, { recursive: true, force: true });
});

async function repository() {
	const dir = await mkdtemp(join(tmpdir(), "tolaria-dirty-guard-"));
	roots.push(dir);
	const context = { fs, dir };
	await git.init({ ...context, defaultBranch: "main" });
	for (let index = 0; index < 32; index++)
		await writeFile(join(dir, `note-${index}.md`), `# Note ${index}\n`);
	await mkdir(join(dir, "nested"));
	await writeFile(join(dir, "nested/child.md"), "# Child\n");
	await writeFile(join(dir, ".gitignore"), "ignored/\n");
	await git.add({ ...context, filepath: "." });
	const head = await git.commit({ ...context, author, message: "Fixture" });
	return { ...context, head };
}

function measureFileStats(context: { dir: string }) {
	let pending = 0;
	let peak = 0;
	const measuredFs = {
		promises: {
			...fs.promises,
			lstat: async (path: fs.PathLike) => {
				if (!String(path).startsWith(`${context.dir}/note-`))
					return fs.promises.lstat(path);
				pending++;
				peak = Math.max(peak, pending);
				try {
					await new Promise<void>((resolve) => setImmediate(resolve));
					return await fs.promises.lstat(path);
				} finally {
					pending--;
				}
			},
		},
	};
	return {
		fs: measuredFs,
		get peak() {
			return peak;
		},
	};
}

it("bounds in-flight working-tree stat calls while checking a clean integration", async () => {
	const context = await repository();
	const measured = measureFileStats(context);
	expect(
		await createGitVault({ ...context, fs: measured.fs }).integrate(
			context.head,
		),
	).toBe("equal");
	expect(measured.peak).toBe(1);
});

it("bounds in-flight working-tree stat calls while checkpointing changed notes", async () => {
	const context = await repository();
	await writeFile(join(context.dir, "note-0.md"), "# Edited\n");
	const measured = measureFileStats(context);
	expect(
		(await createGitVault({ ...context, fs: measured.fs }).checkpoint(author))
			.changedFiles,
	).toBe(1);
	expect(measured.peak).toBe(1);
});

it.each(["NFC", "NFD"] as const)(
	"keeps a tracked %s filename when macOS enumerates decomposed Unicode",
	async (normalization) => {
		const dir = await mkdtemp(join(tmpdir(), "tolaria-unicode-path-"));
		roots.push(dir);
		const trackedName = "Matthäus 17.md".normalize(normalization);
		await writeFile(join(dir, trackedName), "# Before\n");
		await git.init({ fs, dir, defaultBranch: "main" });
		await git.add({ fs, dir, filepath: trackedName });
		await git.commit({ fs, dir, author, message: "Unicode fixture" });

		const decomposedFs = {
			promises: {
				...fs.promises,
				readdir: async (path: fs.PathLike) =>
					(await fs.promises.readdir(path)).map((name) =>
						name.normalize("NFD"),
					),
			},
		};
		await writeFile(join(dir, trackedName), "# After\n");

		expect(await readGitWorkingTreeChanges({ fs: decomposedFs, dir })).toEqual([
			{ filepath: trackedName, deleted: false },
		]);
		expect(
			(await createGitVault({ fs: decomposedFs, dir }).checkpoint(author))
				.changedFiles,
		).toBe(1);
		expect(await git.listFiles({ fs: decomposedFs, dir })).toEqual([
			trackedName,
		]);
	},
);

type Context = Awaited<ReturnType<typeof repository>>;
const scenarios: {
	name: string;
	change: (context: Context) => Promise<unknown>;
}[] = [
	{ name: "clean tree", change: async () => undefined },
	{
		name: "unstaged edit",
		change: ({ dir }) => writeFile(join(dir, "note-0.md"), "# Edited\n"),
	},
	{
		name: "staged edit",
		change: async (context) => {
			await writeFile(join(context.dir, "note-0.md"), "# Edited\n");
			await git.add({ ...context, filepath: "note-0.md" });
		},
	},
	{
		name: "restored worktree with a different index",
		change: async (context) => {
			await writeFile(join(context.dir, "note-0.md"), "# Edited\n");
			await git.add({ ...context, filepath: "note-0.md" });
			await writeFile(join(context.dir, "note-0.md"), "# Note 0\n");
		},
	},
	{
		name: "deleted tracked file",
		change: ({ dir }) => rm(join(dir, "note-0.md")),
	},
	{
		name: "staged removal with the file still present",
		change: (context) => git.remove({ ...context, filepath: "note-0.md" }),
	},
	{
		name: "untracked addition",
		change: ({ dir }) =>
			writeFile(join(dir, "new.bin"), new Uint8Array([255, 0, 10])),
	},
	{
		name: "multiple changes and deletions",
		change: async ({ dir }) => {
			await writeFile(join(dir, "note-0.md"), "# Edited\n");
			await rm(join(dir, "note-1.md"));
			await writeFile(join(dir, "added.bin"), new Uint8Array([0, 255]));
		},
	},
	{
		name: "staged addition subsequently removed",
		change: async (context) => {
			await writeFile(join(context.dir, "added.md"), "# Added\n");
			await git.add({ ...context, filepath: "added.md" });
			await rm(join(context.dir, "added.md"));
		},
	},
	{
		name: "ignored untracked subtree",
		change: async ({ dir }) => {
			await mkdir(join(dir, "ignored"));
			await writeFile(
				join(dir, "ignored/private.bin"),
				new Uint8Array([0, 255]),
			);
		},
	},
	{
		name: "tracked file replaced by a directory",
		change: async ({ dir }) => {
			await rm(join(dir, "note-0.md"));
			await mkdir(join(dir, "note-0.md"));
			await writeFile(join(dir, "note-0.md/child.md"), "# New child\n");
		},
	},
	{
		name: "tracked directory replaced by a file",
		change: async ({ dir }) => {
			await rm(join(dir, "nested"), { recursive: true });
			await writeFile(join(dir, "nested"), "# Replacement\n");
		},
	},
	{
		name: "tracked symlink",
		change: async ({ dir }) => {
			await rm(join(dir, "note-0.md"));
			await symlink("note-1.md", join(dir, "note-0.md"));
		},
	},
	{
		name: "configured line-ending normalization",
		change: async (context) => {
			await git.setConfig({ ...context, path: "core.autocrlf", value: "true" });
			await writeFile(join(context.dir, "note-0.md"), "# Note 0\r\n");
		},
	},
	{
		name: "gitlink directory contents",
		change: async (context) => {
			await git.updateIndex({
				...context,
				filepath: "module",
				oid: context.head,
				mode: 0o160000,
				add: true,
			});
			context.head = await git.commit({
				...context,
				author,
				message: "Gitlink fixture",
			});
			await mkdir(join(context.dir, "module"));
			await writeFile(
				join(context.dir, "module/child.md"),
				"# Submodule worktree\n",
			);
		},
	},
];

it.each(scenarios)(
	"retains library dirty-tree semantics: $name",
	async ({ change }) => {
		const context = await repository();
		await change(context);
		const matrix = await git.statusMatrix({ ...context, refresh: false });
		const expected = matrix
			.filter(
				([, head, worktree, stage]) => head !== worktree || head !== stage,
			)
			.map(([filepath, , worktree]) => ({ filepath, deleted: worktree === 0 }));
		const actual = await readGitWorkingTreeChanges(context);
		const byPath = (a: { filepath: string }, b: { filepath: string }) =>
			a.filepath.localeCompare(b.filepath);
		expect(actual.sort(byPath)).toEqual(expected.sort(byPath));
		const dirty = matrix.some(
			([, head, worktree, stage]) => head !== worktree || head !== stage,
		);
		const action = createGitVault(context).integrate(context.head);
		if (dirty) await expect(action).rejects.toThrow("dirtyWorkingCopy");
		else expect(await action).toBe("equal");
		expect(await git.resolveRef({ ...context, ref: "HEAD" })).toBe(
			context.head,
		);
	},
);

it("does not rewrite the index just because unchanged file timestamps drifted", async () => {
	const context = await repository();
	const index = join(context.dir, ".git/index");
	const before = await readFile(index);
	await utimes(
		join(context.dir, "note-0.md"),
		new Date(1_000_000),
		new Date(1_000_000),
	);
	expect(await createGitVault(context).integrate(context.head)).toBe("equal");
	expect(await readFile(index)).toEqual(before);
});

it("never advances HEAD when working-tree inspection fails", async () => {
	const context = await repository();
	const failingFs = {
		promises: {
			...fs.promises,
			lstat: async (path: fs.PathLike) => {
				if (String(path) === join(context.dir, "note-0.md"))
					throw new Error("metadataUnavailable");
				return fs.promises.lstat(path);
			},
		},
	};
	await expect(
		createGitVault({ ...context, fs: failingFs }).integrate(context.head),
	).rejects.toThrow("metadataUnavailable");
	expect(await git.resolveRef({ ...context, ref: "HEAD" })).toBe(context.head);
	expect(await readFile(join(context.dir, "note-0.md"), "utf8")).toBe(
		"# Note 0\n",
	);
});
