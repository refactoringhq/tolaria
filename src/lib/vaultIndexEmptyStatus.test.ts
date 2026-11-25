import { describe, expect, it } from "vitest";
import { buildVaultIndex } from "../../packages/vault-index/src/index";

describe("buildVaultIndex", () => {
	it("preserves an empty status value from frontmatter", () => {
		const [entry] = buildVaultIndex([
			{
				relativePath: "projects/heron.md",
				content: "---\ntitle: Heron\nstatus: \n---\n# Heron\n",
				size: 33,
				createdAt: null,
				modifiedAt: null,
			},
		]);

		expect(entry?.status).toBe("");
	});
});
