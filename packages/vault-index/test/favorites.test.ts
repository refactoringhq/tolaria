import { describe, expect, it } from "vitest";
import { buildVaultIndex } from "../src";

describe("favorite metadata", () => {
	it("exposes favorite flags and order from note frontmatter", () => {
		const [entry] = buildVaultIndex([
			{
				relativePath: "projects/phone.md",
				content: "---\n_favorite: true\n_favorite_index: 3\n---\n# Phone",
				size: 42,
				createdAt: null,
				modifiedAt: null,
			},
		]);

		expect(entry).toMatchObject({ favorite: true, favoriteIndex: 3 });
	});
});
