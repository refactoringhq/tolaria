import { describe, expect, it } from "vitest";
import { mobileWorkspaceActionFeedback } from "./mobileWorkspaceActionFeedback";

describe("mobile workspace action feedback", () => {
	it.each([
		[{ noteId: "n1", type: "deleteNote" }, "deleted"],
		[{ archived: true, noteId: "n1", type: "setArchived" }, "archived"],
		[{ archived: false, noteId: "n1", type: "setArchived" }, "unarchived"],
		[{ noteId: "n1", organized: true, type: "setOrganized" }, "organized"],
		[{ noteId: "n1", organized: false, type: "setOrganized" }, "unorganized"],
		[
			{
				key: "Related",
				noteId: "n1",
				ref: "[[n2]]",
				type: "removeRelationship",
			},
			"relationshipRemoved",
		],
	] as const)("classifies %j", (edit, action) => {
		expect(mobileWorkspaceActionFeedback(edit)).toBe(action);
	});

	it("classifies uniform and mixed bulk actions", () => {
		expect(
			mobileWorkspaceActionFeedback({
				edits: [
					{ noteId: "n1", type: "deleteNote" },
					{ noteId: "n2", type: "deleteNote" },
				],
				type: "bulkEdit",
			}),
		).toBe("deleted");
		expect(
			mobileWorkspaceActionFeedback({
				edits: [
					{ noteId: "n1", type: "deleteNote" },
					{ archived: true, noteId: "n2", type: "setArchived" },
				],
				type: "bulkEdit",
			}),
		).toBe("multiple");
	});
});
