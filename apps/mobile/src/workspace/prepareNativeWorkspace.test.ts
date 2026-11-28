import { afterEach, expect, it, vi } from "vitest";
import { expoWorkspaceFileSystem } from "./expoWorkspaceFileSystem";
import type { LocalVaultFile } from "./localVaultSnapshot";
import { takePreparedWorkspaceSnapshot } from "./preparedWorkspaceSnapshot";
import { prepareNativeWorkspace } from "./prepareNativeWorkspace";

afterEach(() => vi.restoreAllMocks());

it("prepares nested Markdown files when the platform has no native workspace index", async () => {
	const files: LocalVaultFile[] = [
		{
			absolutePath: "file:///data/vault/Projects/Field Notes.md",
			content: "---\ntype: Note\n---\n# Field notes",
			createdAt: null,
			fileKind: "markdown",
			modifiedAt: null,
			relativePath: "Projects/Field Notes.md",
			size: 34,
		},
	];
	const readVaultFiles = vi
		.spyOn(expoWorkspaceFileSystem, "readVaultIndex")
		.mockReturnValue({ directories: ["Projects"], files });
	vi.spyOn(expoWorkspaceFileSystem, "readVaultConfig").mockReturnValue(null);
	const selection = {
		vaultAlias: "fixture",
		vaultLabel: "Fixture",
		vaultRootUri: "file:///data/vault",
	};

	const prepared = await prepareNativeWorkspace(selection);

	expect(readVaultFiles).toHaveBeenCalledWith(selection.vaultRootUri);
	expect(prepared?.index?.files).toEqual(files);
	const options = {
		files,
		folderPaths: prepared?.index?.directories ?? [],
		vaultAlias: selection.vaultAlias,
		vaultLabel: selection.vaultLabel,
		vaultPath: selection.vaultRootUri,
		vaultConfig: null,
	};
	const snapshot = takePreparedWorkspaceSnapshot(prepared?.index, options);
	expect(snapshot?.allNotes?.map((note) => note.title)).toContain(
		"Field notes",
	);
});
