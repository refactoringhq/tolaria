import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/webBuild", () => ({ isWebBuild: () => true }));

import { readLayouts, writeLayout } from "./collectionLayoutStorage";

describe("collection layout storage", () => {
	afterEach(() => window.localStorage.clear());

	it("keeps layout settings isolated by collection and readable after reload", async () => {
		await writeLayout(undefined, "builtin:all", {
			type: "calendar",
			dateProperty: "due",
		});
		await writeLayout(undefined, "folder:root:work", {
			type: "kanban",
			groupBy: "status",
		});

		expect((await readLayouts())["builtin:all"]).toEqual({
			type: "calendar",
			dateProperty: "due",
		});
		expect((await readLayouts())["folder:root:work"]).toEqual({
			type: "kanban",
			groupBy: "status",
		});
	});

	it("ignores malformed stored data", async () => {
		window.localStorage.setItem("tolaria:web-collection-layouts", "{");

		expect((await readLayouts())["builtin:all"]).toBeUndefined();
	});

	it("stores collection identifiers without treating special object keys as prototypes", async () => {
		await writeLayout(undefined, "__proto__", { type: "graph" });

		expect(Object.entries(await readLayouts())).toContainEqual([
			"__proto__",
			{ type: "graph" },
		]);
	});
});
