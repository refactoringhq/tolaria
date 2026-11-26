import { describe, expect, it } from "vitest";
import { makeEntry } from "../test-utils/noteListTestUtils";
import { filterEntries } from "./noteListHelpers";

describe("application settings files in folder lists", () => {
	it("hides root layout and view settings while keeping user YAML", () => {
		const entries = [
			makeEntry({
				path: "/vault/layouts/YnVpbHRpbjphbGw.yml",
				title: "layout",
			}),
			makeEntry({ path: "/vault/views/active-projects.yml", title: "view" }),
			makeEntry({ path: "/vault/layouts/my-config.yml", title: "user config" }),
			makeEntry({
				path: "/vault/notes/layouts/user-layout.yml",
				title: "nested config",
			}),
		];

		const result = filterEntries(entries, {
			kind: "folder",
			path: "layouts",
			rootPath: "/vault",
		});

		expect(result.map((entry) => entry.path)).toEqual([
			"/vault/layouts/my-config.yml",
		]);
	});
});
