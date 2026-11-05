import { describe, expect, it } from "vitest";
import { mobileParityInventory } from "./mobileParityInventory";

describe("mobileParityInventory", () => {
	it("covers every visible iPad implementation component with a desktop source", () => {
		expect(inventoriedFiles()).toEqual(visibleIpadImplementationFiles());
	});

	it("keeps every inventory entry tied to contracts and assertions", () => {
		for (const entry of mobileParityInventory) {
			expect(entry.desktopSource.length).toBeGreaterThan(0);
			expect(entry.contracts.length).toBeGreaterThan(0);
			expect(entry.assertions.length).toBeGreaterThan(0);
		}
	});
});

function inventoriedFiles() {
	return mobileParityInventory.map((entry) => entry.mobileFile).sort();
}

function visibleIpadImplementationFiles() {
	return Object.keys(visibleIpadModules()).sort();
}

function visibleIpadModules() {
	return {
		...modulesWithPrefix("src/ui/", import.meta.glob("./*.tsx")),
		...modulesWithPrefix(
			"src/components/workspace/",
			import.meta.glob("../components/workspace/*.tsx"),
		),
		...modulesWithPrefix(
			"src/screens/",
			import.meta.glob("../screens/Tablet*.tsx"),
		),
	};
}

function modulesWithPrefix(prefix: string, modules: Record<string, unknown>) {
	return Object.fromEntries(
		Object.keys(modules)
			.filter((path) => !path.endsWith(".internal.tsx"))
			.map((path) => `${prefix}${fileNameFromPath(path)}`)
			.filter((path) => !path.includes("Mock"))
			.map((path) => [path, true]),
	);
}

function fileNameFromPath(path: string) {
	return path.slice(path.lastIndexOf("/") + 1);
}
