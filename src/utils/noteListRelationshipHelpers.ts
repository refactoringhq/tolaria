import {
	APP_STORAGE_KEYS,
	getAppStorageItem,
	LEGACY_APP_STORAGE_KEYS,
} from "../constants/appStorage";
import type { VaultEntry } from "../types";
import {
	resolveInverseRelationshipLabel,
	orderInverseRelationshipLabels as sortInverseRelationshipLabels,
} from "./inverseRelationshipLabels";
import {
	compareSortableValues,
	getDefaultDirection,
	type SortConfig,
	type SortDirection,
	type SortOption,
	statusSortRank,
} from "./noteSort";
import { resolveEntry, wikilinkTarget } from "./wikilink";

export interface RelationshipGroup {
	label: string;
	entries: VaultEntry[];
}

function refMatchesEntry(ref: string, entry: VaultEntry): boolean {
	const target = wikilinkTarget(ref).trim();
	if (!target) return false;

	if (target.includes("/")) {
		const normalizedTarget = target
			.replace(/^\/+/, "")
			.replace(/\.md$/, "")
			.toLowerCase();
		return entry.path.toLowerCase().endsWith(`/${normalizedTarget}.md`);
	}

	return resolveEntry([entry], target) !== undefined;
}

function refsMatch(refs: string[], entry: VaultEntry): boolean {
	return refs.some((ref) => refMatchesEntry(ref, entry));
}

function resolveRefs(refs: string[], entries: VaultEntry[]): VaultEntry[] {
	return refs
		.map((ref) => resolveEntry(entries, wikilinkTarget(ref)))
		.filter((e): e is VaultEntry => e !== undefined);
}

export function sortByModified(a: VaultEntry, b: VaultEntry): number {
	return modifiedTimestamp(b) - modifiedTimestamp(a);
}

function modifiedTimestamp(entry: VaultEntry): number {
	return entry.modifiedAt ?? entry.createdAt ?? 0;
}

/** Extract sortable custom property keys from a list of entries. */
export function extractSortableProperties(entries: VaultEntry[]): string[] {
	const keys = new Set<string>();
	for (const entry of entries) {
		for (const key of Object.keys(entry.properties)) keys.add(key);
	}
	return [...keys].sort((a, b) => a.localeCompare(b));
}

function compareNullishValues(a: unknown, b: unknown): number | null {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return null;
}

function makePropertyComparator(
	key: string,
	flip: number,
): (a: VaultEntry, b: VaultEntry) => number {
	return (a, b) => {
		const va = Reflect.get(a.properties, key) ?? null;
		const vb = Reflect.get(b.properties, key) ?? null;
		const nullishComparison = compareNullishValues(va, vb);
		if (nullishComparison !== null) return nullishComparison;
		return flip * compareSortableValues(va, vb);
	};
}

function makeBuiltinComparator(
	option: string,
	flip: number,
): (a: VaultEntry, b: VaultEntry) => number {
	const comparators: Record<string, (a: VaultEntry, b: VaultEntry) => number> =
		{
			title: (a, b) =>
				flip * stringField(a.title).localeCompare(stringField(b.title)),
			created: (a, b) => flip * (creationTimestamp(a) - creationTimestamp(b)),
			status: (a, b) => compareEntryStatuses(a, b, flip),
		};
	return (
		comparators[option] ??
		((a, b) => flip * (modifiedTimestamp(a) - modifiedTimestamp(b)))
	);
}

function creationTimestamp(entry: VaultEntry) {
	return entry.createdAt ?? entry.modifiedAt ?? 0;
}

function compareEntryStatuses(a: VaultEntry, b: VaultEntry, flip: number) {
	const left = statusSortRank(a.status),
		right = statusSortRank(b.status);
	return flip * (left - right) || sortByModified(a, b);
}

export function getSortComparator(
	option: SortOption,
	direction?: SortDirection,
): (a: VaultEntry, b: VaultEntry) => number {
	const flip = (direction ?? getDefaultDirection(option)) === "asc" ? 1 : -1;
	if (option.startsWith("property:"))
		return makePropertyComparator(option.slice("property:".length), flip);
	return makeBuiltinComparator(option, flip);
}

export function loadSortPreferences(): Record<string, SortConfig> {
	try {
		const raw = getAppStorageItem("sortPreferences");
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		const result: Record<string, SortConfig> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "string") {
				// Migrate old format: bare SortOption string → SortConfig
				const opt = value as SortOption;
				Reflect.set(result, key, {
					option: opt,
					direction: getDefaultDirection(opt),
				});
			} else {
				Reflect.set(result, key, value as SortConfig);
			}
		}
		return result;
	} catch {
		return {};
	}
}

export function saveSortPreferences(prefs: Record<string, SortConfig>) {
	try {
		localStorage.setItem(
			APP_STORAGE_KEYS.sortPreferences,
			JSON.stringify(prefs),
		);
		localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.sortPreferences);
	} catch {
		/* ignore */
	}
}

/** Remove the `__list__` key from localStorage sort preferences (used during migration). */
export function clearListSortFromLocalStorage(): void {
	try {
		const raw = getAppStorageItem("sortPreferences");
		if (!raw) return;
		const parsed = JSON.parse(raw);
		delete parsed.__list__;
		if (Object.keys(parsed).length === 0) {
			localStorage.removeItem(APP_STORAGE_KEYS.sortPreferences);
			localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.sortPreferences);
		} else {
			localStorage.setItem(
				APP_STORAGE_KEYS.sortPreferences,
				JSON.stringify(parsed),
			);
			localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.sortPreferences);
		}
	} catch {
		/* ignore */
	}
}

function stringField(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function filenameStemFromEntry(entry: VaultEntry): string {
	const filename = stringField(entry.filename);
	if (filename) return filename.replace(/\.md$/, "");

	const pathLeaf = stringField(entry.path).split(/[\\/]/u).pop() ?? "";
	return pathLeaf.replace(/\.md$/, "");
}

function relativePathStemFromEntry(entry: VaultEntry): string {
	const normalizedPath = stringField(entry.path).replaceAll("\\", "/");
	return normalizedPath.replace(/^.*\/Laputa\//, "").replace(/\.md$/, "");
}

function linkTargetsForEntry(entry: VaultEntry): Set<string> {
	const title = stringField(entry.title);
	const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
	return new Set(
		[
			title,
			...aliases,
			filenameStemFromEntry(entry),
			relativePathStemFromEntry(entry),
		].filter(Boolean),
	);
}

function findBacklinks(
	entity: VaultEntry,
	allEntries: VaultEntry[],
): VaultEntry[] {
	const targets = linkTargetsForEntry(entity);

	return allEntries.filter((e) => {
		if (e.path === entity.path) return false;
		return e.outgoingLinks.some(
			(link) => targets.has(link) || targets.has(link.split("/").pop() ?? ""),
		);
	});
}

class GroupBuilder {
	readonly groups: RelationshipGroup[] = [];
	private readonly entityPath: string;
	private readonly allEntries: VaultEntry[];

	constructor(entityPath: string, allEntries: VaultEntry[]) {
		this.entityPath = entityPath;
		this.allEntries = allEntries;
	}

	add(label: string, entries: VaultEntry[]) {
		const deduped = new Map<string, VaultEntry>();
		for (const entry of entries) {
			if (entry.path === this.entityPath || deduped.has(entry.path)) continue;
			deduped.set(entry.path, entry);
		}

		if (deduped.size === 0) return;
		this.groups.push({ label, entries: [...deduped.values()] });
	}

	addFromRefs(label: string, refs: string[]) {
		this.add(label, resolveRefs(refs, this.allEntries).sort(sortByModified));
	}

	filterAndAdd(label: string, predicate: (e: VaultEntry) => boolean) {
		this.add(label, this.allEntries.filter(predicate).sort(sortByModified));
	}
}

function appendInverseRelationshipEntries(
	inverseGroups: Map<string, VaultEntry[]>,
	label: string,
	entry: VaultEntry,
) {
	const existing = inverseGroups.get(label);
	if (existing) {
		existing.push(entry);
		return;
	}

	inverseGroups.set(label, [entry]);
}

function appendLegacyInverseRelationshipEntries(
	inverseGroups: Map<string, VaultEntry[]>,
	entity: VaultEntry,
	entry: VaultEntry,
) {
	if (refsMatch(entry.belongsTo, entity)) {
		appendInverseRelationshipEntries(
			inverseGroups,
			resolveInverseRelationshipLabel("Belongs to", entry),
			entry,
		);
	}

	if (refsMatch(entry.relatedTo, entity)) {
		appendInverseRelationshipEntries(
			inverseGroups,
			resolveInverseRelationshipLabel("Related to", entry),
			entry,
		);
	}
}

function appendDynamicInverseRelationshipEntries(
	inverseGroups: Map<string, VaultEntry[]>,
	entity: VaultEntry,
	entry: VaultEntry,
) {
	for (const [key, refs] of Object.entries(entry.relationships)) {
		if (key === "Type" || !refsMatch(refs, entity)) continue;
		appendInverseRelationshipEntries(
			inverseGroups,
			resolveInverseRelationshipLabel(key, entry),
			entry,
		);
	}
}

function orderInverseRelationshipLabels(
	inverseGroups: Map<string, VaultEntry[]>,
): string[] {
	return sortInverseRelationshipLabels(inverseGroups.keys());
}

function collectInverseRelationshipGroups(
	entity: VaultEntry,
	allEntries: VaultEntry[],
): RelationshipGroup[] {
	const inverseGroups = new Map<string, VaultEntry[]>();

	for (const other of allEntries) {
		if (other.path === entity.path) continue;
		appendLegacyInverseRelationshipEntries(inverseGroups, entity, other);
		appendDynamicInverseRelationshipEntries(inverseGroups, entity, other);
	}

	return orderInverseRelationshipLabels(inverseGroups)
		.map((label) => {
			const entries = inverseGroups.get(label);
			if (!entries) return null;
			return { label, entries: [...entries].sort(sortByModified) };
		})
		.filter((group): group is RelationshipGroup => group !== null);
}

export function buildRelationshipGroups(
	entity: VaultEntry,
	allEntries: VaultEntry[],
): RelationshipGroup[] {
	const b = new GroupBuilder(entity.path, allEntries);
	const rels = entity.relationships;

	if (entity.isA === "Type") {
		b.filterAndAdd("Instances", (e) => e.isA === entity.title);
	}

	// Direct relationships first — all keys from entity.relationships take
	// priority so that reverse/computed groups (Children, Events, Referenced by)
	// only show *additional* entries not already covered by a direct property.
	Object.keys(rels)
		.filter((k) => k.toLowerCase() !== "type")
		.sort((a, b) => a.localeCompare(b))
		.forEach((key) => {
			b.addFromRefs(
				key,
				(Reflect.get(rels, key) as string[] | undefined) ?? [],
			);
		});

	for (const group of collectInverseRelationshipGroups(entity, allEntries)) {
		b.add(group.label, group.entries);
	}
	b.add("Backlinks", findBacklinks(entity, allEntries).sort(sortByModified));

	return b.groups;
}
