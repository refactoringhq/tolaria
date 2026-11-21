import type { AppLocale } from "@/lib/i18n";
import type { VaultEntry, WorkspaceIdentity } from "@/types";
import type { parseFrontmatter } from "@/utils/frontmatter";
import { normalizeNotePathForIdentity } from "@/utils/notePathIdentity";
import { DynamicPropertiesPanel } from "./DynamicPropertiesPanel";
import type { FrontmatterValue } from "./Inspector";
import { DynamicRelationshipsPanel } from "./InspectorPanels";
import { Separator } from "./ui/separator";

type InspectorFrontmatterPanelOptions = {
	entry: VaultEntry;
	entries: VaultEntry[];
	frontmatter: ReturnType<typeof parseFrontmatter>;
	typeEntryMap: Record<string, VaultEntry>;
	vaultPath?: string;
	onNavigate: (target: string) => void;
	onCreateAndOpenNote?: (title: string) => Promise<boolean>;
	onUpdateProperty?: (key: string, value: FrontmatterValue) => void;
	onUpdatePropertyAfterCreate?: (key: string, value: FrontmatterValue) => void;
	onDeleteProperty?: (key: string) => void;
	onAddProperty?: (key: string, value: FrontmatterValue) => void;
	onAddPropertyAfterCreate?: (key: string, value: FrontmatterValue) => void;
	onCreateMissingType?: (typeName: string) => Promise<boolean | undefined>;
	onChangeWorkspace?: (
		entry: VaultEntry,
		workspace: WorkspaceIdentity,
	) => Promise<void> | void;
	workspaces?: WorkspaceIdentity[];
	locale: AppLocale;
};

type InspectorPropertiesPanelOptions = Pick<
	InspectorFrontmatterPanelOptions,
	| "entry"
	| "entries"
	| "frontmatter"
	| "onNavigate"
	| "onUpdateProperty"
	| "onDeleteProperty"
	| "onAddProperty"
	| "onCreateMissingType"
	| "onChangeWorkspace"
	| "workspaces"
	| "locale"
>;

function pathBelongsToWorkspace(
	path: string,
	workspace: WorkspaceIdentity,
): boolean {
	const normalizedPath = normalizeNotePathForIdentity(path);
	const normalizedWorkspacePath = normalizeNotePathForIdentity(workspace.path);
	if (!normalizedWorkspacePath) return false;
	return (
		normalizedPath === normalizedWorkspacePath ||
		normalizedPath.startsWith(`${normalizedWorkspacePath}/`)
	);
}

function entryWithInferredWorkspace(
	entry: VaultEntry,
	workspaces: WorkspaceIdentity[] | undefined,
): VaultEntry {
	if (entry.workspace) return entry;
	const workspace = workspaces
		?.filter((candidate) => pathBelongsToWorkspace(entry.path, candidate))
		.sort((left, right) => right.path.length - left.path.length)
		.at(0);
	return workspace ? { ...entry, workspace } : entry;
}

function InspectorPropertiesPanel(options: InspectorPropertiesPanelOptions) {
	const {
		entry,
		entries,
		frontmatter,
		onNavigate,
		onUpdateProperty,
		onDeleteProperty,
		onAddProperty,
		onCreateMissingType,
		onChangeWorkspace,
		workspaces,
		locale,
	} = options;
	const entryForWorkspaceActions = entryWithInferredWorkspace(
		entry,
		workspaces,
	);
	return (
		<DynamicPropertiesPanel
			entry={entryForWorkspaceActions}
			frontmatter={frontmatter}
			entries={entries}
			onUpdateProperty={onUpdateProperty}
			onDeleteProperty={onDeleteProperty}
			onAddProperty={onAddProperty}
			onNavigate={onNavigate}
			onCreateMissingType={onCreateMissingType}
			onChangeWorkspace={
				onChangeWorkspace
					? (workspace) =>
							onChangeWorkspace(entryForWorkspaceActions, workspace)
					: undefined
			}
			workspaces={workspaces}
			locale={locale}
		/>
	);
}

type InspectorRelationshipsPanelOptions = Pick<
	InspectorFrontmatterPanelOptions,
	| "entry"
	| "entries"
	| "frontmatter"
	| "typeEntryMap"
	| "vaultPath"
	| "onNavigate"
	| "onCreateAndOpenNote"
	| "onUpdateProperty"
	| "onUpdatePropertyAfterCreate"
	| "onDeleteProperty"
	| "onAddProperty"
	| "onAddPropertyAfterCreate"
	| "locale"
>;

function InspectorRelationshipsPanel(
	options: InspectorRelationshipsPanelOptions,
) {
	return <DynamicRelationshipsPanel {...options} />;
}

export function ValidFrontmatterPanels(
	options: InspectorFrontmatterPanelOptions,
) {
	return (
		<>
			<InspectorPropertiesPanel {...options} />
			<Separator data-testid="inspector-properties-relationships-separator" />
			<InspectorRelationshipsPanel {...options} />
		</>
	);
}
