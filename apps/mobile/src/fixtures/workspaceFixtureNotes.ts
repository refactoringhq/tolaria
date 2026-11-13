import type { MobileNote } from "../workspace/mobileWorkspaceModel";

export const fixtureNotes: MobileNote[] = [
	{
		id: "workflow-orchestration",
		path: "Tolaria/Mobile UI/Workflow Orchestration Essay.md",
		title: "Workflow Orchestration Essay",
		snippet:
			"The current narrative and temptation: everything routed through an LLM.",
		type: "Essay",
		typeTone: "green",
		tags: ["Design", "AI"],
		status: "Draft",
		date: "May 13, 2026",
		modified: "9h ago",
		created: "5d ago",
		favorite: true,
		links: 12,
		relationships: [
			{
				kind: "belongsTo",
				values: [
					{ title: "LLM Workflow", type: "Essay", typeTone: "green" },
					{ title: "Tolaria MVP", type: "Project", typeTone: "purple" },
				],
			},
			{
				kind: "relatedTo",
				values: [
					{ title: "Release Notes", type: "Release", typeTone: "orange" },
				],
			},
			{
				kind: "custom",
				label: "Mentions",
				values: [
					{ title: "AI Ops Guide", type: "Procedure", typeTone: "purple" },
				],
			},
		],
		workspace: "TV",
	},
	{
		id: "open-source-project",
		path: "Tolaria/Mobile UI/How I Run an Open Source Project.md",
		title: "How I Run an Open Source Project",
		snippet:
			"Tolaria unexpected success: various sources of input, requests, and bugs.",
		type: "Procedure",
		typeTone: "purple",
		tags: ["Process", "Public"],
		status: "Active",
		date: "May 12, 2026",
		modified: "10h ago",
		created: "10h ago",
		favorite: false,
		links: 8,
		relationships: [
			{
				kind: "has",
				values: [
					{ title: "Contributor Guide", type: "Procedure", typeTone: "purple" },
					{ title: "Community Forum", type: "Essay", typeTone: "green" },
				],
			},
			{
				kind: "belongsTo",
				values: [
					{ title: "Project Board", type: "Project", typeTone: "purple" },
				],
			},
		],
		workspace: "TV",
	},
	{
		id: "release-2026-05-02",
		path: "Tolaria/Releases/v2026-05-02.md",
		title: "v2026-05-02",
		snippet: "Release cleanup date, bug fixes, and mobile planning notes.",
		type: "Release",
		typeTone: "orange",
		tags: ["Tolaria MVP"],
		status: "Shipped",
		date: "May 2, 2026",
		modified: "12h ago",
		created: "1d ago",
		favorite: false,
		links: 18,
		relationships: [
			{
				kind: "relatedTo",
				values: [
					{ title: "QA Checklist", type: "Procedure", typeTone: "purple" },
					{ title: "Mobile Planning", type: "Essay", typeTone: "green" },
				],
			},
			{
				kind: "has",
				values: [
					{ title: "Release Notes", type: "Release", typeTone: "orange" },
					{ title: "Postmortem", type: "Essay", typeTone: "green" },
				],
			},
		],
		workspace: "TV",
	},
];

export const longTitleNote: MobileNote = {
	id: "long-title-layout-pressure",
	path: "Writing/Essays/A Very Long Note Title.md",
	title:
		"A Very Long Note Title That Should Stay Readable Without Pushing Type Icons or Property Controls Out of Alignment",
	snippet:
		"Used to verify row truncation, editor title wrapping, and toolbar stability.",
	type: "Essay",
	typeTone: "green",
	tags: ["Design", "Mobile", "Layout"],
	status: "Draft",
	date: "June 3, 2026",
	modified: "14m ago",
	created: "2d ago",
	favorite: false,
	links: 6,
	relationships: [
		{
			kind: "relatedTo",
			values: [
				{ title: "Tablet Shell", type: "Project", typeTone: "purple" },
				{ title: "Properties Panel", type: "Procedure", typeTone: "purple" },
			],
		},
	],
	workspace: "TV",
};

export const propertyHeavyNote: MobileNote = {
	id: "mobile-ui-property-heavy",
	path: "Tolaria/Mobile UI/Mobile UI Parity Review.md",
	title: "Mobile UI Parity Review",
	snippet:
		"A dense fixture for multi-value properties, relationship groups, and long metadata sets.",
	type: "Procedure",
	typeTone: "purple",
	tags: [
		"Mobile",
		"Parity",
		"Design QA",
		"Tablet",
		"Inspector",
		"Relationships",
	],
	status: "Active",
	date: "June 9, 2026",
	modified: "3m ago",
	created: "4d ago",
	favorite: true,
	links: 32,
	relationships: [
		{
			kind: "belongsTo",
			values: [
				{ title: "Tolaria Mobile", type: "Project", typeTone: "purple" },
				{ title: "Tablet Workspace", type: "Essay", typeTone: "green" },
			],
		},
		{
			kind: "has",
			values: [
				{ title: "Navigation Pass", type: "Procedure", typeTone: "purple" },
				{
					title: "Property Inspector Pass",
					type: "Procedure",
					typeTone: "purple",
				},
				{ title: "Sync Footer Pass", type: "Procedure", typeTone: "purple" },
				{ title: "Screenshot QA Matrix", type: "Release", typeTone: "orange" },
			],
		},
		{
			kind: "relatedTo",
			values: [
				{ title: "Desktop Inspector", type: "Essay", typeTone: "green" },
				{ title: "Relationship Model", type: "Essay", typeTone: "green" },
				{
					title: "Mobile Design Review",
					type: "Procedure",
					typeTone: "purple",
				},
			],
		},
		{
			kind: "custom",
			label: "Depends on",
			values: [
				{ title: "Fixture Harness", type: "Procedure", typeTone: "purple" },
				{ title: "Expo Web Export", type: "Procedure", typeTone: "purple" },
				{
					title: "Playwright Screenshots",
					type: "Release",
					typeTone: "orange",
				},
			],
		},
	],
	workspace: "TV",
};

export const markdownHeavyNote: MobileNote = {
	id: "markdown-heavy-renderer",
	path: "Tolaria/Mobile UI/Markdown Renderer Parity.md",
	title: "Markdown Renderer Parity",
	snippet:
		"Renderer fixture for H4, ordered lists, tasks, code fences, links, and dividers.",
	type: "Essay",
	typeTone: "green",
	tags: ["Mobile", "Markdown", "Parity"],
	status: "Active",
	date: "June 15, 2026",
	modified: "1m ago",
	created: "Jun 15",
	favorite: false,
	links: 8,
	relationships: [
		{
			kind: "relatedTo",
			values: [
				{
					title: "Workflow Orchestration Essay",
					type: "Essay",
					typeTone: "green",
				},
			],
		},
	],
	workspace: "TV",
};

export const searchAndPropertiesNote: MobileNote = {
	created: "3d ago",
	date: "Nov 12, 2026",
	favorite: false,
	id: "newsletter-calendar-view-proposal.md",
	links: 2,
	modified: "1h ago",
	path: "newsletter-calendar-view-proposal.md",
	properties: [],
	relationships: [
		{
			key: "Belongs to",
			kind: "custom",
			label: "Belongs to",
			values: [
				{ title: "Newsletter Planning", type: "Project", typeTone: "purple" },
			],
		},
		{
			key: "Related to",
			kind: "custom",
			label: "Related to",
			values: [
				{
					title: "Refactoring Weekly Sponsorships",
					type: "Essay",
					typeTone: "green",
				},
				{ title: "Sponsorships Calendar", type: "Project", typeTone: "purple" },
			],
		},
	],
	snippet:
		"Luca review: newsletter calendar view proposal for sponsor planning.",
	status: "Draft",
	tags: ["Newsletter", "Calendar"],
	title: "Newsletter Calendar View Proposal",
	type: "Procedure",
	typeTone: "purple",
	workspace: "QA fixture",
};
