import { expect, it, vi } from "vitest";

const recovery = vi.hoisted(() => vi.fn(() => false));

vi.mock("./workspaceTextRecovery", () => ({
	nativeWorkspaceTextBatchWriter: () => undefined,
	recoverNativeWorkspaceText: recovery,
	writeNativeWorkspaceText: () => null,
}));

vi.mock("./fileSystemWorkspaceRepository", () => ({
	normalizedWorkspaceRelativePath: (path: string) => path,
}));

vi.mock("./localVaultSnapshot", () => ({
	mobileFileKindForPath: () => "text",
}));

vi.mock("./mobileVaultConfig", () => ({
	parseMobileVaultConfig: () => null,
	serializeMobileVaultConfig: () => "",
}));

import {
	localVaultFile,
	readWorkspaceTextFileAsync,
} from "./expoWorkspaceFileSystem";

it("treats text files with invalid UTF-8 as binary instead of failing the vault read", () => {
	const bytes = new Uint8Array([0x50, 0x72, 0x61, 0x67, 0x75, 0x65, 0xe1]);
	const file = {
		bytesSync: () => bytes,
		info: () => ({ creationTime: 1, modificationTime: 2, size: bytes.length }),
		textSync: () => {
			throw new TypeError("Invalid UTF-8");
		},
		uri: "file:///vault/legacy.txt",
	} as never;

	expect(localVaultFile(file, "legacy.txt")).toMatchObject({
		content: "",
		fileKind: "binary",
		relativePath: "legacy.txt",
		size: bytes.length,
	});
});

it("preserves valid UTF-8 text and still propagates filesystem read failures", () => {
	const file = {
		bytesSync: () => new TextEncoder().encode("Praha áéí"),
		info: () => ({ creationTime: 1, modificationTime: 2, size: 12 }),
		uri: "file:///vault/valid.txt",
	};
	const unreadable = {
		...file,
		bytesSync: () => {
			throw new Error("provider download unavailable");
		},
	};

	expect(localVaultFile(file as never, "valid.txt")).toMatchObject({
		content: "Praha áéí",
		fileKind: "text",
	});
	expect(() => localVaultFile(unreadable as never, "valid.txt")).toThrow(
		"provider download unavailable",
	);
});

it("reads note bytes without synchronously replaying native recovery", async () => {
	const file = { exists: true, text: vi.fn(async () => "# Disk content") };
	const module = {
		File: class {
			exists: boolean;
			text = file.text;

			constructor(_root: string, ...path: string[]) {
				this.exists = path.at(-1) !== "tolaria-checkout.json";
			}
		},
	} as never;

	await expect(
		readWorkspaceTextFileAsync(module, "file:///vault", "note.md"),
	).resolves.toBe("# Disk content");
	expect(recovery).not.toHaveBeenCalled();
	expect(file.text).toHaveBeenCalledOnce();
});
