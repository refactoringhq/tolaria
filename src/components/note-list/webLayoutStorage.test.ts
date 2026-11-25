import { afterEach, describe, expect, it } from "vitest";
import { readWebLayout, writeWebLayout } from "./webLayoutStorage";

describe("web collection layout storage", () => {
	afterEach(() => window.localStorage.clear());

	it("keeps layout settings isolated by collection and readable after reload", () => {
		writeWebLayout("builtin:all", { type: "calendar", dateProperty: "due" });
		writeWebLayout("folder:root:work", { type: "kanban", groupBy: "status" });

		expect(readWebLayout("builtin:all")).toEqual({
			type: "calendar",
			dateProperty: "due",
		});
		expect(readWebLayout("folder:root:work")).toEqual({
			type: "kanban",
			groupBy: "status",
		});
	});

	it("ignores malformed stored data", () => {
		window.localStorage.setItem("tolaria:web-collection-layouts", "{");

		expect(readWebLayout("builtin:all")).toBeUndefined();
	});
});
