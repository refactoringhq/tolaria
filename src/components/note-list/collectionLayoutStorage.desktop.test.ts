import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("../../utils/webBuild", () => ({ isWebBuild: () => false }));

import { readLayouts, writeLayout } from "./collectionLayoutStorage";

describe("desktop collection layout storage", () => {
	beforeEach(() => invoke.mockReset());

	it("reads vault layouts through the Tauri command", async () => {
		invoke.mockResolvedValue({ "builtin:all": { type: "kanban" } });

		await expect(readLayouts("/vault")).resolves.toEqual({
			"builtin:all": { type: "kanban" },
		});
		expect(invoke).toHaveBeenCalledWith("list_collection_layouts", {
			vaultPath: "/vault",
		});
	});

	it("writes one record through the Tauri command", async () => {
		invoke.mockResolvedValue(undefined);
		const record = { type: "calendar", dateProperty: "due" };

		await writeLayout("/vault", "builtin:all", record);

		expect(invoke).toHaveBeenCalledWith("save_collection_layout_cmd", {
			vaultPath: "/vault",
			collection: "builtin:all",
			presentation: record,
		});
	});
});
