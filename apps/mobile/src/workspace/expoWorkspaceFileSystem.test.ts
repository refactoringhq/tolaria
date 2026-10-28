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

import { readWorkspaceTextFileAsync } from "./expoWorkspaceFileSystem";

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
