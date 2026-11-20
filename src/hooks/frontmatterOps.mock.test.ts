import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type FrontmatterApplyCallbacks,
	runFrontmatterAndApply,
} from "./frontmatterOps";

const PATH = "notes/mock.md";
const original = "---\ntype: Note\ntags:\n  - old\n---\n# Note\n";
const files = vi.hoisted(() => ({
	read: vi.fn(),
	write: vi.fn(),
}));

vi.mock("../lib/vaultBackend", () => ({
	createVaultBackend: () => ({ files }),
	hasRemoteVault: () => false,
}));

vi.mock("../mock-tauri", () => ({
	isTauri: () => false,
	updateMockContent: vi.fn(),
	trackMockChange: vi.fn(),
}));

function callbacks(): FrontmatterApplyCallbacks {
	return { updateTab: vi.fn(), updateEntry: vi.fn(), toast: vi.fn() };
}

describe("runFrontmatterAndApply with the browser mock backend", () => {
	afterEach(() => {
		Reflect.deleteProperty(window, "__mockContent");
		files.read.mockReset();
		files.write.mockReset();
	});

	it("writes list values with the shared frontmatter text format", async () => {
		files.read.mockResolvedValue({ content: original });
		files.write.mockResolvedValue({ status: "written", revision: "next" });
		const apply = callbacks();

		const content = await runFrontmatterAndApply({
			op: "update",
			path: PATH,
			key: "tags",
			value: ["new", 'quoted "value"'],
			callbacks: apply,
		});

		expect(content).toBe(
			'---\ntype: Note\ntags:\n  - new\n  - quoted "value"\n---\n# Note\n',
		);
		expect(files.write).toHaveBeenCalledWith(PATH, content);
		expect(apply.updateTab).toHaveBeenCalledWith(PATH, content);
	});

	it("deletes through the shared frontmatter text writer", async () => {
		files.read.mockResolvedValue({ content: original });
		files.write.mockResolvedValue({ status: "written", revision: "next" });

		const content = await runFrontmatterAndApply({
			op: "delete",
			path: PATH,
			key: "tags",
			callbacks: callbacks(),
		});

		expect(content).toBe("---\ntype: Note\n---\n# Note\n");
	});
});
