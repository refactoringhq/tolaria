import { describe, expect, it } from "vitest";
import {
	mobileInspectorPropertySlots,
	mobileInspectorRelationshipSlots,
} from "./mobileInspectorSchema";
import type { MobileNote, MobileTypeDefinitions } from "./mobileWorkspaceModel";

describe("mobile inspector schema slots", () => {
	it("renders type-derived properties before desktop suggested property slots", () => {
		const note = noteFixture({
			properties: [{ key: "URL", label: "URL", value: "https://example.com" }],
			status: "",
			type: "Project",
		});
		const typeDefinitions: MobileTypeDefinitions = {
			Project: {
				properties: {
					Priority: "High",
					URL: "https://example.com/default",
					has: "Milestone",
				},
			},
		};

		expect(mobileInspectorPropertySlots(note, typeDefinitions)).toEqual([
			{ key: "Priority", label: "Priority", source: "typeDerived" },
			{ key: "Status", label: "Status", source: "suggested" },
			{ key: "Date", label: "Date", source: "suggested" },
			{ key: "icon", label: "Icon", source: "suggested" },
		]);
	});

	it("matches desktop suggested property slots including note icons", () => {
		expect(
			mobileInspectorPropertySlots(noteFixture({ status: "" }), undefined),
		).toEqual([
			{ key: "Status", label: "Status", source: "suggested" },
			{ key: "Date", label: "Date", source: "suggested" },
			{ key: "URL", label: "URL", source: "suggested" },
			{ key: "icon", label: "Icon", source: "suggested" },
		]);
	});

	it("does not suggest the desktop icon property when note icon metadata exists", () => {
		expect(
			mobileInspectorPropertySlots(
				noteFixture({ icon: "star", status: "" }),
				undefined,
			),
		).toEqual([
			{ key: "Status", label: "Status", source: "suggested" },
			{ key: "Date", label: "Date", source: "suggested" },
			{ key: "URL", label: "URL", source: "suggested" },
		]);
	});

	it("renders type-derived relationships and suppresses duplicate suggested slots", () => {
		const note = noteFixture({
			relationships: [{ key: "belongs_to", kind: "belongsTo", values: [] }],
			type: "Project",
		});
		const typeDefinitions: MobileTypeDefinitions = {
			Project: {
				properties: { has: "Milestone", "has-part": "Chapter" },
				relationships: {
					depends_on: ["[[Roadmap]]"],
					related_to: ["[[Planning]]"],
				},
			},
		};

		expect(mobileInspectorRelationshipSlots(note, typeDefinitions)).toEqual([
			{ key: "depends_on", label: "Depends on", source: "typeDerived" },
			{ key: "related_to", label: "Related to", source: "typeDerived" },
			{ key: "has", label: "Has", source: "typeDerived" },
			{ key: "has-part", label: "Has part", source: "typeDerived" },
		]);
	});

	it("falls back to the desktop canonical relationship suggestions", () => {
		expect(mobileInspectorRelationshipSlots(noteFixture(), undefined)).toEqual([
			{ key: "belongs_to", label: "Belongs to", source: "suggested" },
			{ key: "related_to", label: "Related to", source: "suggested" },
			{ key: "has", label: "Has", source: "suggested" },
		]);
	});

	it("suppresses suggested relationship slots that match a spaced existing key", () => {
		expect(
			mobileInspectorRelationshipSlots(
				noteFixture({
					relationships: [
						{
							key: "Belongs to",
							kind: "custom",
							label: "Belongs to",
							values: [],
						},
					],
				}),
				undefined,
			),
		).toEqual([
			{ key: "related_to", label: "Related to", source: "suggested" },
			{ key: "has", label: "Has", source: "suggested" },
		]);
	});

	it("preserves desktop Type-derived relationship key spelling before suggested slots", () => {
		expect(
			mobileInspectorRelationshipSlots(noteFixture({ type: "Project" }), {
				Project: {
					relationships: {
						"Belongs to": ["[[Roadmap]]"],
					},
				},
			}),
		).toEqual([
			{ key: "Belongs to", label: "Belongs to", source: "typeDerived" },
			{ key: "related_to", label: "Related to", source: "suggested" },
			{ key: "has", label: "Has", source: "suggested" },
		]);
	});
});

function noteFixture(overrides: Partial<MobileNote> = {}): MobileNote {
	return {
		created: "1d ago",
		date: "14 Jun 2026",
		favorite: false,
		id: "project.md",
		links: 0,
		modified: "1h ago",
		path: "project.md",
		properties: [],
		relationships: [],
		snippet: "",
		status: "Active",
		tags: [],
		title: "Project",
		type: "Note",
		typeTone: "gray",
		workspace: "TV",
		...overrides,
	};
}
