import type {
	MobileEditorBlock,
	MobileEditorInline,
	MobileNote,
	MobileRelationship,
	MobileRelationshipKind,
	MobileRelationshipValue,
	MobileSavedView,
	MobileSidebarFolder,
	MobileSidebarIcon,
	MobileSidebarItem,
	MobileSidebarSection,
	MobileSyncStatus,
	MobileTone,
	MobileTypeDefinitions,
	MobileWorkspaceSnapshot,
} from "../workspace/mobileWorkspaceModel";
import {
	fixtureEditorBlocks,
	fixtureEditorBullets,
	longTitleEditorBlocks,
	markdownHeavyEditorBlocks,
	propertyHeavyEditorBlocks,
} from "./workspaceEditorFixtures";

export type FixtureNote = MobileNote;

import {
	fixtureNotes,
	longTitleNote,
	markdownHeavyNote,
	propertyHeavyNote,
	searchAndPropertiesNote,
} from "./workspaceFixtureNotes";

export { fixtureNotes } from "./workspaceFixtureNotes";

export type FixtureRelationshipKind = MobileRelationshipKind;

export type FixtureRelationship = MobileRelationship;

export type FixtureRelationshipValue = MobileRelationshipValue;

export type FixtureTone = MobileTone;

export type FixtureSidebarIcon = MobileSidebarIcon;

export type FixtureSidebarItem = MobileSidebarItem;

export type FixtureSidebarSection = MobileSidebarSection;

export type FixtureSidebarFolder = MobileSidebarFolder;

export type FixtureSavedView = MobileSavedView;

export type FixtureSyncStatus = MobileSyncStatus;

export type FixtureEditorInline = MobileEditorInline;

export type FixtureEditorBlock = MobileEditorBlock;

export type WorkspaceScenario = MobileWorkspaceSnapshot & {
	id: WorkspaceScenarioId;
};

export type WorkspaceScenarioId =
	| "default"
	| "empty-inbox"
	| "folder-tree"
	| "long-title"
	| "markdown-heavy"
	| "property-heavy"
	| "search-and-properties";

const defaultSidebarSections: FixtureSidebarSection[] = [
	{
		id: "primary",
		items: [
			{ id: "inbox", active: true, count: "7", icon: "inbox", label: "Inbox" },
			{ id: "all-notes", count: "8846", icon: "file", label: "All Notes" },
			{ id: "archive", count: "276", icon: "archive", label: "Archive" },
		],
	},
	{
		id: "favorites",
		label: "Favorites",
		items: [
			{ id: "personal-journal", icon: "star", label: "Personal Journal" },
			{ id: "tolaria-mvp", icon: "folder", label: "Tolaria MVP" },
		],
	},
	{
		id: "views",
		label: "Views",
		items: [
			{
				id: "view-active-procedures",
				count: "1",
				icon: "view",
				label: "Active Procedures",
				tone: "purple",
				viewId: "view-active-procedures",
			},
		],
	},
	{
		count: "517",
		id: "types",
		label: "Types",
		items: [
			{
				id: "essays",
				count: "448",
				icon: "file",
				label: "Essays",
				tone: "green",
				typeName: "Essay",
			},
			{
				id: "procedures",
				count: "51",
				icon: "procedure",
				label: "Procedures",
				tone: "purple",
				typeName: "Procedure",
			},
			{
				id: "responsibilities",
				count: "18",
				icon: "tag",
				label: "Responsibilities",
				tone: "orange",
				typeName: "Responsibility",
			},
		],
	},
	{
		id: "folders",
		label: "Folders",
		folders: [
			{
				id: "Writing",
				name: "Writing",
				expanded: true,
				children: [
					{ id: "Writing/Essays", name: "Essays", children: [] },
					{ id: "Writing/Drafts", name: "Drafts", children: [] },
				],
			},
			{
				id: "Tolaria",
				name: "Tolaria",
				expanded: true,
				active: true,
				children: [
					{ id: "Tolaria/Mobile UI", name: "Mobile UI", children: [] },
					{ id: "Tolaria/Releases", name: "Releases", children: [] },
				],
			},
		],
	},
];

const fixtureViews: FixtureSavedView[] = [
	{
		filename: "active-procedures.yml",
		id: "view-active-procedures",
		definition: {
			color: "purple",
			filters: {
				all: [
					{ field: "type", op: "equals", value: "Procedure" },
					{ field: "status", op: "equals", value: "Active" },
				],
			},
			icon: null,
			listPropertiesDisplay: ["belongs_to", "tags"],
			name: "Active Procedures",
			sort: "modified:desc",
		},
	},
];

const fixtureTypeDefinitions: MobileTypeDefinitions = {
	Essay: {
		icon: "file",
		path: "essay.md",
		properties: { Priority: "Medium" },
		rawContent: "---\ntype: Type\ncolor: green\nicon: file\n---\n# Essay\n",
		tone: "green",
	},
	Procedure: {
		icon: "stack",
		path: "procedure.md",
		properties: { Cadence: "Weekly" },
		rawContent:
			"---\ntype: Type\ncolor: purple\nicon: stack\n---\n# Procedure\n",
		tone: "purple",
	},
	Release: {
		icon: "archive",
		path: "release.md",
		properties: { Date: "2026-05-02" },
		rawContent:
			"---\ntype: Type\ncolor: orange\nicon: archive\n---\n# Release\n",
		tone: "orange",
	},
};

const folderTreePressureSections: FixtureSidebarSection[] = [
	...defaultSidebarSections.filter((section) => section.id !== "folders"),
	{
		id: "folders",
		label: "Folders",
		folders: [
			{
				id: "Writing",
				name: "Writing",
				expanded: true,
				children: [
					{ id: "Writing/Essays", name: "Essays", children: [] },
					{ id: "Writing/Drafts", name: "Drafts", children: [] },
					{
						id: "Writing/Research Backlog",
						name: "Research Backlog",
						children: [],
					},
				],
			},
			{
				id: "Tolaria",
				name: "Tolaria",
				expanded: true,
				active: true,
				children: [
					{
						id: "Tolaria/Mobile UI",
						name: "Mobile UI",
						expanded: true,
						children: [
							{
								id: "Tolaria/Mobile UI/Tablet Shell",
								name: "Tablet Shell",
								children: [],
							},
							{
								id: "Tolaria/Mobile UI/Properties Panel",
								name: "Properties Panel",
								children: [],
							},
						],
					},
					{ id: "Tolaria/Releases", name: "Releases", children: [] },
				],
			},
			{
				id: "Attachments",
				name: "Attachments",
				expanded: true,
				children: [
					{ id: "Attachments/Images", name: "Images", children: [] },
					{ id: "Attachments/PDFs", name: "PDFs", children: [] },
				],
			},
		],
	},
];

export const defaultWorkspaceScenarioId: WorkspaceScenarioId = "default";

export const workspaceScenarios: Record<
	WorkspaceScenarioId,
	WorkspaceScenario
> = {
	default: {
		editorBlocks: fixtureEditorBlocks,
		editorBullets: fixtureEditorBullets,
		id: "default",
		noteListSubtitle: "7 open notes",
		notes: fixtureNotes,
		selectedNoteId: fixtureNotes[0].id,
		sidebarSections: defaultSidebarSections,
		sync: { kind: "synced", minutesAgo: 2 },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"folder-tree": {
		editorBlocks: fixtureEditorBlocks,
		editorBullets: fixtureEditorBullets,
		id: "folder-tree",
		noteListSubtitle: "7 open notes",
		notes: fixtureNotes,
		selectedNoteId: fixtureNotes[1].id,
		sidebarSections: folderTreePressureSections,
		sync: { kind: "synced", minutesAgo: 8 },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"empty-inbox": {
		editorBlocks: fixtureEditorBlocks,
		editorBullets: fixtureEditorBullets,
		id: "empty-inbox",
		noteListSubtitle: "0 open notes",
		notes: [],
		searchQuery: "Inbox",
		sidebarSections: defaultSidebarSections,
		sync: { kind: "pullRequired" },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"long-title": {
		editorBlocks: longTitleEditorBlocks,
		editorBullets: [
			"This note intentionally uses a title long enough to pressure the row, toolbar, and editor heading.",
			"The title should truncate in narrow slots and wrap only inside the editor content area.",
		],
		id: "long-title",
		noteListSubtitle: "8 open notes",
		notes: [longTitleNote, ...fixtureNotes],
		selectedNoteId: longTitleNote.id,
		sidebarSections: defaultSidebarSections,
		sync: { kind: "synced", minutesAgo: 1 },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"markdown-heavy": {
		editorBlocks: markdownHeavyEditorBlocks,
		editorBullets: [
			"Renderer fixture for H4, ordered lists, tasks, code fences, links, and dividers.",
			"The scenario is isolated from the default screenshot baseline.",
		],
		id: "markdown-heavy",
		noteListSubtitle: "8 open notes",
		notes: [markdownHeavyNote, ...fixtureNotes],
		selectedNoteId: markdownHeavyNote.id,
		sidebarSections: defaultSidebarSections,
		sync: { kind: "synced", minutesAgo: 0 },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"property-heavy": {
		editorBlocks: propertyHeavyEditorBlocks,
		editorBullets: [
			"Property-heavy notes should preserve scanability even when relationships contain several typed groups.",
			"The add-property and add-relationship affordances must remain visible without becoming floating actions.",
		],
		id: "property-heavy",
		noteListSubtitle: "8 open notes",
		notes: [propertyHeavyNote, ...fixtureNotes],
		selectedNoteId: propertyHeavyNote.id,
		sidebarSections: defaultSidebarSections,
		sync: { kind: "conflict" },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
	"search-and-properties": {
		editorBlocks: fixtureEditorBlocks,
		editorBullets: fixtureEditorBullets,
		id: "search-and-properties",
		noteListSubtitle: "1 open note",
		notes: [searchAndPropertiesNote],
		selectedNoteId: searchAndPropertiesNote.id,
		sidebarSections: defaultSidebarSections,
		sync: { kind: "synced", minutesAgo: 0 },
		typeDefinitions: fixtureTypeDefinitions,
		views: fixtureViews,
	},
};

export function workspaceScenarioForId(id: string | null | undefined) {
	if (!id || !Object.hasOwn(workspaceScenarios, id)) {
		return workspaceScenarios[defaultWorkspaceScenarioId];
	}

	return workspaceScenarios[id as WorkspaceScenarioId];
}

export {
	fixtureEditorBlocks,
	fixtureEditorBullets,
} from "./workspaceEditorFixtures";
