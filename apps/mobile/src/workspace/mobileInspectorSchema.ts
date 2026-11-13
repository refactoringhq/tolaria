import { humanizePropertyKey } from "../../../../src/utils/propertyLabels";
import {
	isRelationshipKey,
	relationshipFrontmatterKey,
} from "../../../../src/utils/relationshipKeys";
import {
	normalizePropertyKey,
	systemMetadataAliases,
} from "../../../../src/utils/systemMetadata";
import {
	SUGGESTED_PROPERTY_SLOTS,
	SUGGESTED_RELATIONSHIP_KEYS,
} from "../../../../src/utils/workspaceSuggestionContracts";
import type {
	MobileNote,
	MobilePropertyValue,
	MobileRelationship,
	MobileTypeDefinition,
	MobileTypeDefinitions,
} from "./mobileWorkspaceModel";

type SlotSource = "suggested" | "typeDerived";

export type MobileInspectorPropertySlot = {
	key: string;
	label: string;
	source: SlotSource;
};

export type MobileInspectorRelationshipSlot = {
	key: string;
	label: string;
	source: SlotSource;
};

const ICON_PROPERTY_KEYS = systemMetadataAliases("_icon");

export function mobileInspectorPropertySlots(
	note: MobileNote,
	typeDefinitions?: MobileTypeDefinitions,
): MobileInspectorPropertySlot[] {
	const existingKeys = existingPropertyKeys(note);
	const typeDerivedSlots = typeDerivedPropertySlots(
		note,
		typeDefinitions,
		existingKeys,
	);
	const suggestedSlots = suggestedPropertySlots(existingKeys);

	return [...typeDerivedSlots, ...suggestedSlots];
}

export function mobileInspectorRelationshipSlots(
	note: MobileNote,
	typeDefinitions?: MobileTypeDefinitions,
): MobileInspectorRelationshipSlot[] {
	const existingCanonicalKeys = existingRelationshipCanonicalKeys(note);
	const typeDerivedSlots = typeDerivedRelationshipSlots(
		note,
		typeDefinitions,
		existingCanonicalKeys,
	);
	const suggestedSlots = suggestedRelationshipSlots(
		canonicalKeysWithSlots(existingCanonicalKeys, typeDerivedSlots),
	);

	return [...typeDerivedSlots, ...suggestedSlots];
}

function typeDerivedPropertySlots(
	note: MobileNote,
	typeDefinitions: MobileTypeDefinitions | undefined,
	existingKeys: Set<string>,
): MobileInspectorPropertySlot[] {
	const definition = typeDefinitionForNote(note, typeDefinitions);
	if (!definition?.properties) return [];

	const slots: MobileInspectorPropertySlot[] = [];
	for (const [key, value] of Object.entries(definition.properties)) {
		const canonicalKey = canonicalSlotKey(key);
		if (!isVisibleTypeDerivedProperty(key, value, existingKeys, slots))
			continue;
		existingKeys.add(canonicalKey);
		slots.push({ key, label: humanizeSlotKey(key), source: "typeDerived" });
	}

	return slots;
}

function typeDerivedRelationshipSlots(
	note: MobileNote,
	typeDefinitions: MobileTypeDefinitions | undefined,
	existingKeys: Set<string>,
): MobileInspectorRelationshipSlot[] {
	const definition = typeDefinitionForNote(note, typeDefinitions);
	if (!definition) return [];

	const slots: MobileInspectorRelationshipSlot[] = [];
	for (const key of typeRelationshipKeys(definition)) {
		pushRelationshipSlot(slots, existingKeys, key);
	}
	return slots;
}

function typeRelationshipKeys(definition: MobileTypeDefinition): string[] {
	const keys = Object.entries(definition.relationships ?? {})
		.filter(([, refs]) => refs.length > 0)
		.map(([key]) => key);

	for (const key of Object.keys(definition.properties ?? {})) {
		if (isRelationshipSchemaKey(key)) keys.push(key);
	}

	return keys;
}

function pushRelationshipSlot(
	slots: MobileInspectorRelationshipSlot[],
	existingKeys: Set<string>,
	key: string,
) {
	const trimmedKey = key.trim();
	const canonicalKey = canonicalSlotKey(trimmedKey);
	if (!trimmedKey || canonicalKey === "type") return;
	if (existingKeys.has(canonicalKey)) return;

	existingKeys.add(canonicalKey);
	slots.push({
		key: trimmedKey,
		label: humanizeSlotKey(trimmedKey),
		source: "typeDerived",
	});
}

function suggestedPropertySlots(
	existingKeys: Set<string>,
): MobileInspectorPropertySlot[] {
	return SUGGESTED_PROPERTY_SLOTS.filter(
		({ key }) => !hasExistingPropertySlot(existingKeys, key),
	).map(({ key, label }) => ({ key, label, source: "suggested" }));
}

function suggestedRelationshipSlots(
	existingKeys: Set<string>,
): MobileInspectorRelationshipSlot[] {
	return SUGGESTED_RELATIONSHIP_KEYS.filter(
		(key) => !existingKeys.has(canonicalSlotKey(key)),
	).map((key) => ({ key, label: humanizeSlotKey(key), source: "suggested" }));
}

function typeDefinitionForNote(
	note: MobileNote,
	typeDefinitions: MobileTypeDefinitions | undefined,
): MobileTypeDefinition | undefined {
	if (note.type === "Type") return undefined;
	return typeDefinitions?.[note.type];
}

function existingPropertyKeys(note: MobileNote): Set<string> {
	const keys = new Set(
		(note.properties ?? []).map((property) => canonicalSlotKey(property.key)),
	);
	if (note.status) keys.add("status");
	if (note.tags.length > 0) keys.add("tags");
	if (note.icon) addCanonicalSlotKeys(keys, ICON_PROPERTY_KEYS);
	keys.add("type");
	return keys;
}

function hasExistingPropertySlot(
	existingKeys: Set<string>,
	key: string,
): boolean {
	if (key === "icon")
		return ICON_PROPERTY_KEYS.some((alias) =>
			existingKeys.has(canonicalSlotKey(alias)),
		);
	return existingKeys.has(canonicalSlotKey(key));
}

function addCanonicalSlotKeys(keys: Set<string>, aliases: readonly string[]) {
	for (const alias of aliases) keys.add(canonicalSlotKey(alias));
}

function existingRelationshipCanonicalKeys(note: MobileNote): Set<string> {
	return new Set(
		note.relationships.map((relationship) =>
			canonicalSlotKey(rawRelationshipFrontmatterKey(relationship)),
		),
	);
}

function rawRelationshipFrontmatterKey(
	relationship: MobileRelationship,
): string {
	return relationshipFrontmatterKey(relationship);
}

function isVisibleTypeDerivedProperty(
	key: string,
	value: MobilePropertyValue,
	existingKeys: Set<string>,
	slots: MobileInspectorPropertySlot[],
): boolean {
	const canonicalKey = canonicalSlotKey(key);
	return (
		!existingKeys.has(canonicalKey) &&
		!slots.some((slot) => canonicalSlotKey(slot.key) === canonicalKey) &&
		!isRelationshipSchemaKey(key) &&
		isVisiblePlaceholderValue(value)
	);
}

function isRelationshipSchemaKey(key: string): boolean {
	return isRelationshipKey(key);
}

function isVisiblePlaceholderValue(value: MobilePropertyValue): boolean {
	return !(Array.isArray(value) && value.length === 0);
}

function canonicalSlotKey(key: string): string {
	return normalizePropertyKey(key);
}

function canonicalKeysWithSlots(
	existingKeys: Set<string>,
	slots: MobileInspectorRelationshipSlot[],
): Set<string> {
	const next = new Set(existingKeys);
	for (const slot of slots) next.add(canonicalSlotKey(slot.key));
	return next;
}

function humanizeSlotKey(key: string): string {
	return humanizePropertyKey(key);
}
