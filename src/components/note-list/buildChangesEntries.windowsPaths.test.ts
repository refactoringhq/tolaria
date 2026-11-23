import { describe, expect, it } from "vitest";
import { makeEntry } from "../../test-utils/noteListTestUtils";
import type { ModifiedFile } from "../../types";
import { buildChangesEntries } from "./noteListUtils";

describe("buildChangesEntries Windows paths", () => {
	it("matches nested entries when Git returns backslash separators", () => {
		const entry = makeEntry({
			path: "/vault/notes/nested/changed.md",
			title: "Changed note",
		});
		const modifiedFile: ModifiedFile = {
			path: String.raw`C:\vault\notes\nested\changed.md`,
			relativePath: String.raw`notes\nested\changed.md`,
			status: "modified",
		};

		expect(buildChangesEntries([entry], [modifiedFile])).toEqual([
			expect.objectContaining({ title: "Changed note" }),
		]);
	});
});
