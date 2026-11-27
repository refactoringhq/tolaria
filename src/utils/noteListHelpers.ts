import type { AppLocale } from "../lib/i18n";
import type {
	InboxPeriod,
	SidebarSelection,
	VaultEntry,
	ViewFile,
} from "../types";
import {
	type AllNotesFileVisibility,
	DEFAULT_ALL_NOTES_FILE_VISIBILITY,
	isOptionalAllNotesFileVisible,
} from "./allNotesFileVisibility";
import {
	type DateDisplayFormat,
	DEFAULT_DATE_DISPLAY_FORMAT,
	formatTimestampForDateDisplay,
} from "./dateDisplay";
import {
	buildTypeVisibilityLookup,
	isSectionEntryVisibleForType,
} from "./typeVisibility";
import { evaluateView } from "./viewFilters";
import { viewMatchesSelection } from "./viewIdentity";

export {
	DEFAULT_SORT_OPTIONS,
	getDefaultDirection,
	getSortOptionLabel,
	parseSortConfig,
	SORT_OPTIONS,
	type SortConfig,
	type SortDirection,
	type SortOption,
	serializeSortConfig,
} from "./noteSort";

export type NoteListFilter = "open" | "archived";

export interface FilterEntriesOptions {
	subFilter?: NoteListFilter;
	views?: ViewFile[];
	allNotesFileVisibility?: AllNotesFileVisibility;
}

export function relativeDate(
	ts: number | null,
	dateDisplayFormat: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
	appLocale: AppLocale = "en",
): string {
	if (!ts) return "";
	const diff = Math.floor(Date.now() / 1000) - ts;
	if (isOutsideRelativeDateRange(diff))
		return formatTimestampForDateDisplay(ts, dateDisplayFormat, appLocale);
	return formatRecentRelativeDate(diff);
}

function isOutsideRelativeDateRange(diff: number): boolean {
	return diff < 0 || diff >= 604800;
}

function formatRecentRelativeDate(diff: number): string {
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	return `${Math.floor(diff / 86400)}d ago`;
}

export function getDisplayDate(entry: VaultEntry): number | null {
	return entry.modifiedAt ?? entry.createdAt;
}

export function formatSubtitle(
	entry: VaultEntry,
	dateDisplayFormat: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
	appLocale: AppLocale = "en",
): string {
	const parts: string[] = [];
	const date = getDisplayDate(entry);
	if (date)
		parts.push(
			formatTimestampForDateDisplay(date, dateDisplayFormat, appLocale),
		);
	appendWordAndLinkParts(parts, entry);
	return parts.join(" \u00b7 ");
}

function appendWordAndLinkParts(parts: string[], entry: VaultEntry): void {
	if (entry.wordCount > 0)
		parts.push(`${entry.wordCount.toLocaleString("en-US")} words`);
	else parts.push("Empty");

	if (entry.outgoingLinks.length > 0)
		parts.push(
			`${entry.outgoingLinks.length} ${entry.outgoingLinks.length === 1 ? "link" : "links"}`,
		);
}

function wasCreatedBeforeLastModification(entry: VaultEntry): boolean {
	return !!(
		entry.createdAt &&
		entry.modifiedAt &&
		entry.createdAt !== entry.modifiedAt
	);
}

export function formatSearchSubtitle(
	entry: VaultEntry,
	dateDisplayFormat: DateDisplayFormat = DEFAULT_DATE_DISPLAY_FORMAT,
	appLocale: AppLocale = "en",
): string {
	const parts: string[] = [];
	const modified = entry.modifiedAt ?? entry.createdAt;
	if (modified)
		parts.push(
			formatTimestampForDateDisplay(modified, dateDisplayFormat, appLocale),
		);
	const created = entry.createdAt;
	if (created && wasCreatedBeforeLastModification(entry)) {
		parts.push(
			`Created ${formatTimestampForDateDisplay(created, dateDisplayFormat, appLocale)}`,
		);
	}
	appendWordAndLinkParts(parts, entry);
	return parts.join(" \u00b7 ");
}

import {
	buildRelationshipGroups,
	clearListSortFromLocalStorage,
	extractSortableProperties,
	getSortComparator,
	loadSortPreferences,
	type RelationshipGroup,
	saveSortPreferences,
	sortByModified,
} from "./noteListRelationshipHelpers";

export {
	buildRelationshipGroups,
	clearListSortFromLocalStorage,
	extractSortableProperties,
	getSortComparator,
	loadSortPreferences,
	type RelationshipGroup,
	saveSortPreferences,
	sortByModified,
};

const isActive = (e: VaultEntry) => !e.archived;
const isMarkdown = (e: VaultEntry) => e.fileKind === "markdown" || !e.fileKind;
const ATTACHMENTS_FOLDER = "attachments";

function applySubFilter(
	entries: VaultEntry[],
	subFilter: NoteListFilter,
): VaultEntry[] {
	if (subFilter === "archived") return entries.filter((e) => e.archived);
	return entries.filter(isActive);
}

function isInFolder(entryPath: string, folderRelPath: string): boolean {
	const folderPath = normalizeFolderPath(folderRelPath);
	if (!folderPath) return false;
	const normalizedEntryPath = normalizeFolderPath(entryPath);
	return (
		normalizedEntryPath.includes(`/${folderPath}/`) ||
		normalizedEntryPath.startsWith(`${folderPath}/`)
	);
}

function normalizeFolderPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function isVisibleMarkdownNote(entry: VaultEntry): boolean {
	return isMarkdown(entry) && !isInFolder(entry.path, ATTACHMENTS_FOLDER);
}

export function isAllNotesEntry(
	entry: VaultEntry,
	allNotesFileVisibility: AllNotesFileVisibility = DEFAULT_ALL_NOTES_FILE_VISIBILITY,
): boolean {
	if (isMarkdown(entry)) return isVisibleMarkdownNote(entry);
	return isOptionalAllNotesFileVisible(entry, allNotesFileVisibility);
}

export function filterEntriesForViewFile(
	entries: VaultEntry[],
	view: ViewFile,
): VaultEntry[] {
	return evaluateView(view.definition, entries.filter(isMarkdown));
}

function filterViewEntries(
	entries: VaultEntry[],
	selection: Extract<SidebarSelection, { kind: "view" }>,
	views?: ViewFile[],
): VaultEntry[] {
	const view = views?.find((candidate) =>
		viewMatchesSelection(candidate, selection),
	);
	if (!view) return [];
	return filterEntriesForViewFile(entries, view);
}

function isDirectRootEntry(entryPath: string, rootPath?: string): boolean {
	const normalizedEntryPath = normalizeFolderPath(entryPath);
	const normalizedRootPath = rootPath ? normalizeFolderPath(rootPath) : "";
	if (!normalizedRootPath) return !normalizedEntryPath.includes("/");
	if (!normalizedEntryPath.startsWith(`${normalizedRootPath}/`)) return false;
	const relativePath = normalizedEntryPath.slice(normalizedRootPath.length + 1);
	return relativePath.length > 0 && !relativePath.includes("/");
}

function pathRelativeToRoot(
	entryPath: string,
	rootPath?: string,
): string | null {
	const normalizedRootPath = rootPath ? normalizeFolderPath(rootPath) : "";
	if (!normalizedRootPath) return normalizeFolderPath(entryPath);

	const normalizedEntryPath = normalizeFolderPath(entryPath);
	if (!normalizedEntryPath.startsWith(`${normalizedRootPath}/`)) return null;
	return normalizedEntryPath.slice(normalizedRootPath.length + 1);
}

function isEntryInSelectedFolder(
	entryPath: string,
	folderRelPath: string,
	rootPath?: string,
): boolean {
	const relativeEntryPath = pathRelativeToRoot(entryPath, rootPath);
	if (!relativeEntryPath) return false;
	if (!rootPath) return isInFolder(relativeEntryPath, folderRelPath);
	const folderPath = normalizeFolderPath(folderRelPath);
	return Boolean(folderPath && relativeEntryPath.startsWith(`${folderPath}/`));
}

function isAppSettingsEntry(entryPath: string, rootPath?: string): boolean {
	if (!rootPath) return false;
	const relativePath = pathRelativeToRoot(entryPath, rootPath);
	if (!relativePath) return false;
	const [folder, filename, ...rest] =
		normalizeFolderPath(relativePath).split("/");
	if (rest.length > 0 || !filename?.endsWith(".yml")) return false;
	if (folder === "views") return true;
	return folder === "layouts" && isEncodedLayoutFilename(filename);
}

function isEncodedLayoutFilename(filename: string): boolean {
	const stem = filename.slice(0, -".yml".length);
	if (!isValidBase64UrlStem(stem)) return false;
	try {
		const base64 = stem.replace(/-/g, "+").replace(/_/g, "/");
		return atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)).length > 0;
	} catch {
		return false;
	}
}

function isValidBase64UrlStem(stem: string): boolean {
	return (
		Boolean(stem) && /^[A-Za-z0-9_-]+$/.test(stem) && stem.length % 4 !== 1
	);
}

function filterRootEntries(
	entries: VaultEntry[],
	rootPath: string | undefined,
	subFilter?: NoteListFilter,
): VaultEntry[] {
	const rootEntries = entries.filter((entry) =>
		isDirectRootEntry(entry.path, rootPath),
	);
	return subFilter
		? applySubFilter(rootEntries, subFilter)
		: rootEntries.filter(isActive);
}

function filterFolderEntries(
	entries: VaultEntry[],
	selection: Extract<SidebarSelection, { kind: "folder" }>,
	subFilter?: NoteListFilter,
): VaultEntry[] {
	if (!selection.path)
		return filterRootEntries(entries, selection.rootPath, subFilter);
	// Folder view shows ALL files (text + binary), not just markdown
	const folderEntries = entries.filter(
		(entry) =>
			isEntryInSelectedFolder(entry.path, selection.path, selection.rootPath) &&
			!isAppSettingsEntry(entry.path, selection.rootPath),
	);
	return subFilter
		? applySubFilter(folderEntries, subFilter)
		: folderEntries.filter(isActive);
}

function filterSectionGroupEntries(
	entries: VaultEntry[],
	type: string,
	subFilter?: NoteListFilter,
): VaultEntry[] {
	const typeVisibility = buildTypeVisibilityLookup(entries);
	const typeEntries = entries.filter((entry) =>
		isSectionEntryVisibleForType(entry, type, typeVisibility),
	);
	return subFilter
		? applySubFilter(typeEntries, subFilter)
		: typeEntries.filter(isActive);
}

function filterTopLevelEntries(
	entries: VaultEntry[],
	selection: Extract<SidebarSelection, { kind: "filter" }>,
	options: FilterEntriesOptions,
): VaultEntry[] {
	const filterableEntries =
		selection.filter === "all"
			? entries.filter((entry) =>
					isAllNotesEntry(entry, options.allNotesFileVisibility),
				)
			: entries.filter(isMarkdown);
	if (selection.filter === "all" && options.subFilter)
		return applySubFilter(filterableEntries, options.subFilter);
	return filterByFilterType(filterableEntries, selection.filter);
}

function filterByKind(
	entries: VaultEntry[],
	selection: SidebarSelection,
	options: FilterEntriesOptions,
): VaultEntry[] {
	if (selection.kind === "entity") return [];
	if (selection.kind === "view")
		return filterViewEntries(entries, selection, options.views);
	if (selection.kind === "folder")
		return filterFolderEntries(entries, selection, options.subFilter);
	if (selection.kind === "sectionGroup")
		return filterSectionGroupEntries(
			entries,
			selection.type,
			options.subFilter,
		);
	return filterTopLevelEntries(entries, selection, options);
}

function filterByFilterType(
	entries: VaultEntry[],
	filter: string,
): VaultEntry[] {
	if (filter === "all") return entries.filter(isActive);
	if (filter === "archived") return entries.filter((e) => e.archived);
	if (filter === "favorites")
		return entries.filter((e) => e.favorite && !e.archived);
	if (filter === "pulse") return [];
	return [];
}

export function filterEntries(
	entries: VaultEntry[],
	selection: SidebarSelection,
	options: FilterEntriesOptions = {},
): VaultEntry[] {
	return filterByKind(entries, selection, options);
}

/** Count notes per sub-filter for a given type. */
export function countByFilter(
	entries: VaultEntry[],
	type: string,
): Record<NoteListFilter, number> {
	const typeVisibility = buildTypeVisibilityLookup(entries);
	let open = 0,
		archived = 0;
	for (const e of entries) {
		if (!isSectionEntryVisibleForType(e, type, typeVisibility)) continue;
		if (e.archived) archived++;
		else open++;
	}
	return { open, archived };
}

function countEntriesByArchiveStatus(
	entries: VaultEntry[],
): Record<NoteListFilter, number> {
	let open = 0,
		archived = 0;
	for (const entry of entries) {
		if (entry.archived) archived++;
		else open++;
	}
	return { open, archived };
}

/** Count notes per sub-filter across all entries (no type filter). */
export function countAllByFilter(
	entries: VaultEntry[],
): Record<NoteListFilter, number> {
	return countEntriesByArchiveStatus(entries.filter(isMarkdown));
}

/** Count All Notes-eligible documents per sub-filter using the current file visibility policy. */
export function countAllNotesByFilter(
	entries: VaultEntry[],
	allNotesFileVisibility?: AllNotesFileVisibility,
): Record<NoteListFilter, number> {
	return countEntriesByArchiveStatus(
		entries.filter((entry) => isAllNotesEntry(entry, allNotesFileVisibility)),
	);
}

// --- Inbox ---

/** Check if entry belongs in the Inbox (markdown only, not organized, not archived, not a Type). */
export function isInboxEntry(entry: VaultEntry): boolean {
	if (!isVisibleMarkdownNote(entry)) return false;
	if (entry.archived) return false;
	if (entry.isA === "Type") return false;
	return !entry.organized;
}

const INBOX_PERIOD_DAYS: Record<InboxPeriod, number> = {
	week: 7,
	month: 30,
	quarter: 90,
	all: Infinity,
};
const INBOX_PERIOD_DAYS_LOOKUP = new Map(
	Object.entries(INBOX_PERIOD_DAYS) as Array<[InboxPeriod, number]>,
);

/** Filter entries for the Inbox view: not organized, within the given time period, sorted by createdAt desc. */
export function filterInboxEntries(
	entries: VaultEntry[],
	period: InboxPeriod,
): VaultEntry[] {
	const now = Math.floor(Date.now() / 1000);
	const periodDays = INBOX_PERIOD_DAYS_LOOKUP.get(period) ?? Infinity;
	const cutoff = period === "all" ? 0 : now - periodDays * 86400;

	return entries
		.filter((e) => isInboxEntry(e) && (e.createdAt ?? 0) >= cutoff)
		.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Count inbox entries per period. */
export function countInboxByPeriod(
	entries: VaultEntry[],
): Record<InboxPeriod, number> {
	const inbox = entries.filter((e) => isInboxEntry(e));
	const now = Math.floor(Date.now() / 1000);

	let week = 0,
		month = 0,
		quarter = 0;
	for (const e of inbox) {
		const age = now - (e.createdAt ?? 0);
		if (age <= 7 * 86400) week++;
		if (age <= 30 * 86400) month++;
		if (age <= 90 * 86400) quarter++;
	}

	return { week, month, quarter, all: inbox.length };
}
