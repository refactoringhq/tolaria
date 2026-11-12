import type { MobileViewMoveDirection } from "./mobileSavedViews";
import {
	type MobileTypeDefinitionPatch,
	mobileTypeDefinitionContent,
	mobileTypeDefinitionPath,
	typeDefinitionsWithPatch,
} from "./mobileTypeDefinitions";
import type {
	MobileWorkspaceEdit,
	MobileWorkspaceEditResult,
} from "./mobileWorkspaceEditing";
import type { NoteId } from "./mobileWorkspaceEditing.types";
import type {
	MobileNote,
	MobileSidebarItem,
	MobileTypeDefinitions,
	MobileWorkspaceSnapshot,
} from "./mobileWorkspaceModel";
import { noteWritePath } from "./mobileWorkspacePathRewrites";
import { renameMobileTypeDefinition } from "./mobileWorkspaceTypeRename";

type NoteTitle = string;
type MobileTypeEdit = Extract<
	MobileWorkspaceEdit,
	{
		type:
			| "createTypeDefinition"
			| "deleteTypeDefinition"
			| "moveTypeSection"
			| "renameTypeDefinition"
			| "updateTypeDefinition";
	}
>;
type RebuildMobileWorkspaceSnapshot = (
	snapshot: MobileWorkspaceSnapshot,
	notes: MobileNote[],
	allNotes?: MobileNote[],
	hydrationId?: NoteId | null,
) => MobileWorkspaceSnapshot;
const defaultTypeCanonicalCase = new Map([
	["event", "Event"],
	["note", "Note"],
	["person", "Person"],
	["project", "Project"],
]);
const typeCreationAliases = new Map([["notes", "Note"]]);

export function applyMobileTypeEdit(
	snapshot: MobileWorkspaceSnapshot,
	edit: MobileTypeEdit,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceEditResult {
	if (edit.type === "createTypeDefinition")
		return createMobileTypeDefinition(snapshot, edit.typeName, rebuildSnapshot);
	if (edit.type === "deleteTypeDefinition")
		return deleteMobileTypeDefinition(snapshot, edit.typeName, rebuildSnapshot);
	if (edit.type === "moveTypeSection")
		return moveMobileTypeSection(
			snapshot,
			edit.typeName,
			edit.direction,
			rebuildSnapshot,
		);
	if (edit.type === "renameTypeDefinition")
		return renameMobileTypeDefinition(snapshot, edit, rebuildSnapshot);
	return updateMobileTypeDefinition(
		snapshot,
		edit.typeName,
		edit.patch,
		rebuildSnapshot,
	);
}

function createMobileTypeDefinition(
	snapshot: MobileWorkspaceSnapshot,
	typeName: NoteTitle,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceEditResult {
	const cleanType = normalizeCreationTypeName(typeName);
	if (
		!cleanType ||
		equivalentTypeDefinitionName(snapshot.typeDefinitions, cleanType)
	)
		return { snapshot, writes: [] };

	const creationPath = mobileTypeDefinitionPath(cleanType, undefined);
	if (mobileWorkspacePathExists(snapshot, creationPath))
		return { snapshot, writes: [] };

	const typeDefinitions = typeDefinitionsWithPatch(
		snapshot.typeDefinitions,
		cleanType,
		{},
	);
	const definition = typeDefinitions[cleanType];

	return {
		snapshot: snapshotWithTypeDefinitions(
			snapshot,
			typeDefinitions,
			rebuildSnapshot,
		),
		writes: [
			{
				content:
					definition.rawContent ??
					mobileTypeDefinitionContent(cleanType, undefined, {}),
				kind: "createNote",
				path: definition.path ?? creationPath,
			},
		],
	};
}

function deleteMobileTypeDefinition(
	snapshot: MobileWorkspaceSnapshot,
	typeName: NoteTitle,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceEditResult {
	const cleanType = cleanTypeName(typeName);
	const existingDefinition = snapshot.typeDefinitions?.[cleanType];
	if (!cleanType || !existingDefinition) return { snapshot, writes: [] };

	const typeDefinitions = { ...(snapshot.typeDefinitions ?? {}) };
	Reflect.deleteProperty(typeDefinitions, cleanType);

	return {
		snapshot: snapshotWithTypeDefinitions(
			snapshot,
			typeDefinitions,
			rebuildSnapshot,
		),
		writes: [
			{
				kind: "deleteNote",
				path: mobileTypeDefinitionPath(cleanType, existingDefinition),
			},
		],
	};
}

function moveMobileTypeSection(
	snapshot: MobileWorkspaceSnapshot,
	typeName: NoteTitle,
	direction: MobileViewMoveDirection,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceEditResult {
	const orderedItems = reorderedTypeSectionItems(snapshot, typeName, direction);
	if (!orderedItems) return { snapshot, writes: [] };

	let typeDefinitions = snapshot.typeDefinitions ?? {};
	const typeNameToMove = cleanTypeName(typeName);
	const orderUpdates = orderedItems.flatMap((item, order) => {
		const existingDefinition = snapshot.typeDefinitions?.[item.typeName];
		if (!existingDefinition && item.typeName !== typeNameToMove) return [];
		return [{ existingDefinition, order, typeName: item.typeName }];
	});
	const writes = orderUpdates.map(
		({ existingDefinition, order, typeName: orderedTypeName }) => {
			typeDefinitions = typeDefinitionsWithPatch(
				typeDefinitions,
				orderedTypeName,
				{ order },
			);
			return {
				content: mobileTypeDefinitionContent(
					orderedTypeName,
					existingDefinition,
					{ order },
				),
				kind: "saveNote" as const,
				path: mobileTypeDefinitionPath(orderedTypeName, existingDefinition),
			};
		},
	);

	return {
		snapshot: snapshotWithTypeDefinitions(
			snapshot,
			typeDefinitions,
			rebuildSnapshot,
		),
		writes,
	};
}

function updateMobileTypeDefinition(
	snapshot: MobileWorkspaceSnapshot,
	typeName: NoteTitle,
	patch: MobileTypeDefinitionPatch,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceEditResult {
	const cleanType = cleanTypeName(typeName);
	if (!cleanType) return { snapshot, writes: [] };

	const existingDefinition = snapshot.typeDefinitions?.[cleanType];
	const typeDefinitions = typeDefinitionsWithPatch(
		snapshot.typeDefinitions,
		cleanType,
		patch,
	);

	return {
		snapshot: snapshotWithTypeDefinitions(
			snapshot,
			typeDefinitions,
			rebuildSnapshot,
		),
		writes: [
			{
				content: mobileTypeDefinitionContent(
					cleanType,
					existingDefinition,
					patch,
				),
				kind: "saveNote",
				path: mobileTypeDefinitionPath(cleanType, existingDefinition),
			},
		],
	};
}

function snapshotWithTypeDefinitions(
	snapshot: MobileWorkspaceSnapshot,
	typeDefinitions: MobileTypeDefinitions,
	rebuildSnapshot: RebuildMobileWorkspaceSnapshot,
): MobileWorkspaceSnapshot {
	const notes = notesWithTypeDefinitionTones(snapshot.notes, typeDefinitions);
	const allNotes = snapshot.allNotes
		? notesWithTypeDefinitionTones(snapshot.allNotes, typeDefinitions)
		: undefined;
	return rebuildSnapshot(
		{ ...snapshot, typeDefinitions },
		notes,
		allNotes,
		null,
	);
}

function notesWithTypeDefinitionTones(
	notes: MobileNote[],
	typeDefinitions: MobileTypeDefinitions,
): MobileNote[] {
	return notes.map((note) => ({
		...note,
		typeTone: typeDefinitions[note.type]?.tone ?? note.typeTone,
	}));
}

function reorderedTypeSectionItems(
	snapshot: MobileWorkspaceSnapshot,
	typeName: NoteTitle,
	direction: MobileViewMoveDirection,
) {
	const items = typeSectionItems(snapshot);
	const sourceIndex = items.findIndex((item) => item.typeName === typeName);
	const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
	if (!isTypeSectionMoveInBounds(sourceIndex, targetIndex, items.length))
		return null;

	const reordered = [...items];
	const [item] = reordered.splice(sourceIndex, 1);
	reordered.splice(targetIndex, 0, item);
	return reordered;
}

function isTypeSectionMoveInBounds(
	sourceIndex: number,
	targetIndex: number,
	itemCount: number,
) {
	if (sourceIndex === -1) return false;
	if (targetIndex < 0) return false;
	return targetIndex < itemCount;
}

function typeSectionItems(snapshot: MobileWorkspaceSnapshot) {
	return (
		snapshot.sidebarSections.find((section) => section.id === "types")?.items ??
		[]
	).filter((item): item is MobileSidebarItem & { typeName: string } =>
		Boolean(item.typeName),
	);
}

function cleanTypeName(value: string): string {
	return wikilinkTarget(value).replace(/\.md$/, "");
}

function normalizeCreationTypeName(value: string): string {
	const cleanType = cleanTypeName(value);
	const lowerType = cleanType.toLowerCase();
	return (
		typeCreationAliases.get(lowerType) ??
		defaultTypeCanonicalCase.get(lowerType) ??
		cleanType
	);
}

function equivalentTypeDefinitionName(
	definitions: MobileTypeDefinitions | undefined,
	typeName: NoteTitle,
): string | null {
	const typeSlug = slugifyTypeName(typeName);
	return (
		Object.keys(definitions ?? {}).find(
			(candidate) =>
				candidate === typeName || slugifyTypeName(candidate) === typeSlug,
		) ?? null
	);
}

function wikilinkTarget(value: string): string {
	const match = value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	return (match?.[1] ?? value).trim();
}

function mobileWorkspacePathExists(
	snapshot: MobileWorkspaceSnapshot,
	path: string,
): boolean {
	const targetPath = canonicalMobilePath(path);
	return mobileWorkspacePathCandidates(snapshot).some(
		(candidate) => canonicalMobilePath(candidate) === targetPath,
	);
}

function mobileWorkspacePathCandidates(
	snapshot: MobileWorkspaceSnapshot,
): string[] {
	return [
		...workspaceNotePathCandidates(snapshot.allNotes ?? snapshot.notes),
		...typeDefinitionPathCandidates(snapshot.typeDefinitions),
	];
}

function workspaceNotePathCandidates(notes: MobileNote[]): string[] {
	return notes.flatMap((note) => [
		note.id,
		note.path ?? "",
		noteWritePath(note),
	]);
}

function typeDefinitionPathCandidates(
	typeDefinitions: MobileTypeDefinitions | undefined,
): string[] {
	return Object.values(typeDefinitions ?? {}).flatMap((definition) =>
		definition.path ? [definition.path] : [],
	);
}

function canonicalMobilePath(path: string): string {
	return path
		.replaceAll("\\", "/")
		.split("/")
		.filter(Boolean)
		.join("/")
		.toLowerCase();
}

function slugifyTypeName(value: NoteTitle): string {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/['"]/gu, "")
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-|-$/gu, "") || "type"
	);
}
