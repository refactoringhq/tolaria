import { describe, expect, it } from "vitest";
import type {
	FixtureSidebarFolder,
	WorkspaceScenario,
} from "./workspaceFixtures";
import {
	fixtureEditorBlocks,
	fixtureEditorBullets,
	fixtureNotes,
	workspaceScenarioForId,
	workspaceScenarios,
} from "./workspaceFixtures";

describe("workspaceFixtures", () => {
	it("keeps the tablet UI lab anchored on a selected essay note", () => {
		expect(fixtureNotes[0]).toMatchObject({
			id: "workflow-orchestration",
			type: "Essay",
		});
		expect(fixtureEditorBullets).toHaveLength(3);
		expect(fixtureEditorBlocks.map((block) => block.kind)).toContain("table");
	});

	it("exposes pressure scenarios for screenshot QA", () => {
		expect(workspaceScenarios["empty-inbox"].notes).toHaveLength(0);
		expect(
			workspaceScenarios["property-heavy"].notes[0].relationships[0],
		).toMatchObject({
			kind: "belongsTo",
			values: [
				{ title: "Tolaria Mobile", type: "Project", typeTone: "purple" },
				{ title: "Tablet Workspace", type: "Essay", typeTone: "green" },
			],
		});
		expect(workspaceScenarioForId("missing")).toBe(workspaceScenarios.default);
	});

	it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
		"falls back to the default scenario for inherited key %s",
		(id) => {
			expect(workspaceScenarioForId(id)).toBe(workspaceScenarios.default);
		},
	);

	it("provides a search and duplicate-relationship visual fixture", () => {
		expect(workspaceScenarios["search-and-properties"].notes[0]).toMatchObject({
			id: "newsletter-calendar-view-proposal.md",
			snippet: expect.stringContaining("Luca"),
			relationships: [
				{ key: "Belongs to", label: "Belongs to" },
				{
					key: "Related to",
					label: "Related to",
					values: [
						{ title: "Refactoring Weekly Sponsorships" },
						{ title: "Sponsorships Calendar" },
					],
				},
			],
		});
	});

	it("keeps fixture folder ids aligned with vault-relative paths", () => {
		expect(folderIdsForScenario(workspaceScenarios.default)).toEqual(
			expect.arrayContaining([
				"Writing",
				"Writing/Essays",
				"Tolaria",
				"Tolaria/Mobile UI",
				"Tolaria/Releases",
			]),
		);
		expect(folderIdsForScenario(workspaceScenarios["folder-tree"])).toEqual(
			expect.arrayContaining([
				"Tolaria/Mobile UI/Tablet Shell",
				"Tolaria/Mobile UI/Properties Panel",
				"Attachments/Images",
			]),
		);
	});
});

function folderIdsForScenario(scenario: WorkspaceScenario) {
	const folderSection = scenario.sidebarSections.find(
		(section) => section.id === "folders",
	);
	return flattenFolderIds(folderSection?.folders ?? []);
}

function flattenFolderIds(folders: FixtureSidebarFolder[]): string[] {
	return folders.flatMap((folder) => [
		folder.id,
		...flattenFolderIds(folder.children),
	]);
}
