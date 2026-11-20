import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { DOC_FRONTMATTER_FIELD } from "../../packages/protocol/src/index";
import { UnsafeFrontmatterEditError } from "./frontmatterText";
import { registerLiveNoteDocument } from "./liveNoteDocuments";
import {
	editRemoteFrontmatter,
	FRONTMATTER_EDIT_ORIGIN,
	NotAMarkdownNoteError,
	RemoteFrontmatterConflictError,
} from "./remoteFrontmatter";
import type {
	VaultFile,
	VaultFileOps,
	VaultWriteResult,
} from "./vaultBackend/types";

const PATH = "projects/alpha.md";
const FRONTMATTER = "---\ntitle: Alpha\nStatus: Draft\nowner: Ana\n---\n";
const BODY = "# Alpha\n\nSome text.\n";
const FILE: VaultFile = {
	path: PATH,
	content: `${FRONTMATTER}${BODY}`,
	revision: "rev-1",
};

function fakeFiles(
	file: VaultFile = FILE,
	writeResult: VaultWriteResult = { status: "written", revision: "rev-2" },
) {
	return {
		read: vi.fn(async () => file),
		write: vi.fn(async () => writeResult),
	};
}

function asFileOps(files: ReturnType<typeof fakeFiles>): VaultFileOps {
	return files as unknown as VaultFileOps;
}

/** The lines between the common prefix and suffix of two texts: everything a diff could show. */
function changedLines(
	before: string,
	after: string,
): { removed: string[]; added: string[] } {
	const old = before.split("\n");
	const next = after.split("\n");
	let start = 0;
	while (start < old.length && old.at(start) === next.at(start)) start++;
	let end = 0;
	const shared = Math.min(old.length, next.length) - start;
	while (end < shared && old.at(-1 - end) === next.at(-1 - end)) end++;
	return {
		removed: old.slice(start, old.length - end),
		added: next.slice(start, next.length - end),
	};
}

function liveDocument(frontmatter = FRONTMATTER) {
	const doc = new Y.Doc();
	doc.getText(DOC_FRONTMATTER_FIELD).insert(0, frontmatter);
	const document = { path: PATH, doc };
	const unregister = registerLiveNoteDocument(document);
	unregisters.push(unregister);
	return { doc, document, unregister };
}

const unregisters: (() => void)[] = [];

afterEach(() => {
	for (const unregister of unregisters.splice(0)) unregister();
});

describe("editRemoteFrontmatter on a note open as a live document", () => {
	it("edits the frontmatter text in one transaction and touches only the changed value", async () => {
		const { doc } = liveDocument();
		const files = fakeFiles();
		const transactions: unknown[] = [];
		const deltas: unknown[] = [];
		doc.on("afterTransaction", (transaction: Y.Transaction) => {
			if (transaction.changed.size > 0) transactions.push(transaction.origin);
		});
		doc
			.getText(DOC_FRONTMATTER_FIELD)
			.observe((event) => deltas.push(event.delta));

		const content = await editRemoteFrontmatter(asFileOps(files), {
			path: PATH,
			key: "Status",
			value: "Active",
		});

		expect(doc.getText(DOC_FRONTMATTER_FIELD).toString()).toBe(
			"---\ntitle: Alpha\nStatus: Active\nowner: Ana\n---\n",
		);
		expect(content).toBe(
			`---\ntitle: Alpha\nStatus: Active\nowner: Ana\n---\n${BODY}`,
		);
		expect(transactions).toEqual([FRONTMATTER_EDIT_ORIGIN]);
		expect(deltas).toEqual([
			[{ retain: 25 }, { delete: 5 }, { insert: "Active" }],
		]);
		expect(files.write).not.toHaveBeenCalled();
	});

	it("deletes a key from the document", async () => {
		const { doc } = liveDocument();
		await editRemoteFrontmatter(asFileOps(fakeFiles()), {
			path: PATH,
			key: "owner",
			value: undefined,
		});
		expect(doc.getText(DOC_FRONTMATTER_FIELD).toString()).toBe(
			"---\ntitle: Alpha\nStatus: Draft\n---\n",
		);
	});

	it("adds frontmatter to a document that has none", async () => {
		const { doc } = liveDocument("");
		const files = fakeFiles({ ...FILE, content: BODY });
		const content = await editRemoteFrontmatter(asFileOps(files), {
			path: PATH,
			key: "type",
			value: "Project",
		});
		expect(doc.getText(DOC_FRONTMATTER_FIELD).toString()).toBe(
			"---\ntype: Project\n---\n",
		);
		expect(content).toBe(`---\ntype: Project\n---\n${BODY}`);
	});

	it("writes the file instead when the document closes while the file is read", async () => {
		const { doc, unregister } = liveDocument();
		const files = fakeFiles();
		files.read.mockImplementationOnce(async () => {
			unregister();
			return FILE;
		});

		await editRemoteFrontmatter(asFileOps(files), {
			path: PATH,
			key: "Status",
			value: "Active",
		});

		expect(doc.getText(DOC_FRONTMATTER_FIELD).toString()).toBe(FRONTMATTER);
		expect(files.write).toHaveBeenCalledWith(
			PATH,
			expect.stringContaining("Status: Active"),
			{ baseRevision: "rev-1" },
		);
	});
});

describe("editRemoteFrontmatter on a note that is not open", () => {
	it("rewrites the file at the revision it read, changing only the edited line", async () => {
		const files = fakeFiles();
		const content = await editRemoteFrontmatter(asFileOps(files), {
			path: PATH,
			key: "Status",
			value: "Active",
		});

		expect(content).toBe(
			`---\ntitle: Alpha\nStatus: Active\nowner: Ana\n---\n${BODY}`,
		);
		expect(files.write).toHaveBeenCalledWith(PATH, content, {
			baseRevision: "rev-1",
		});
		expect(changedLines(FILE.content, content)).toEqual({
			removed: ["Status: Draft"],
			added: ["Status: Active"],
		});
	});

	it("does not write when the edit changes nothing", async () => {
		const files = fakeFiles();
		const content = await editRemoteFrontmatter(asFileOps(files), {
			path: PATH,
			key: "missing",
			value: undefined,
		});
		expect(content).toBe(FILE.content);
		expect(files.write).not.toHaveBeenCalled();
	});

	it("fails when the file changed on the server since it was read", async () => {
		const files = fakeFiles(FILE, { status: "conflict", current: null });
		await expect(
			editRemoteFrontmatter(asFileOps(files), {
				path: PATH,
				key: "Status",
				value: "Active",
			}),
		).rejects.toBeInstanceOf(RemoteFrontmatterConflictError);
	});
});

describe("editRemoteFrontmatter with an unsafe key or value", () => {
	it.each([
		["a key with a newline", "Status\ninjected", "x"],
		["a key that would start a mapping line", "a: b\nc", "x"],
		["an empty key", "", "x"],
	])(
		"refuses %s before reading or writing anything",
		async (_name, key, value) => {
			const { doc } = liveDocument();
			const files = fakeFiles();
			await expect(
				editRemoteFrontmatter(asFileOps(files), { path: PATH, key, value }),
			).rejects.toBeInstanceOf(UnsafeFrontmatterEditError);
			expect(doc.getText(DOC_FRONTMATTER_FIELD).toString()).toBe(FRONTMATTER);
			expect(files.read).not.toHaveBeenCalled();
			expect(files.write).not.toHaveBeenCalled();
		},
	);
});

describe("editRemoteFrontmatter with a path that is not a vault note", () => {
	it.each([
		"",
		"/etc/passwd.md",
		"../outside.md",
		"notes/../../outside.md",
		"a//b.md",
		"notes\\a.md",
	])("refuses %j before reading anything", async (path) => {
		const files = fakeFiles();
		await expect(
			editRemoteFrontmatter(asFileOps(files), {
				path,
				key: "Status",
				value: "x",
			}),
		).rejects.toThrow("is not a vault path");
		expect(files.read).not.toHaveBeenCalled();
	});

	it("refuses a file that is not a Markdown note", async () => {
		const files = fakeFiles();
		await expect(
			editRemoteFrontmatter(asFileOps(files), {
				path: "attachments/pixel.png",
				key: "Status",
				value: "x",
			}),
		).rejects.toBeInstanceOf(NotAMarkdownNoteError);
		expect(files.read).not.toHaveBeenCalled();
	});

	it("accepts .markdown notes", async () => {
		const files = fakeFiles({ ...FILE, path: "notes/a.markdown" });
		await expect(
			editRemoteFrontmatter(asFileOps(files), {
				path: "notes/a.markdown",
				key: "Status",
				value: "Active",
			}),
		).resolves.toContain("Status: Active");
	});
});
