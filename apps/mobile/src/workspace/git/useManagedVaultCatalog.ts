import { useCallback, useEffect, useState } from "react";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { logMobileMotionEvent } from "../../qa/mobileMotionFrameLog";
import { waitForMotionStartupDelay } from "../mobileMotionStartupDelay";
import { mobileWorkspaceDeepLinkSlug } from "../mobileWorkspaceAlias";
import type { NativeWorkspaceSelection } from "../nativeWorkspacePicker";
import { readNativeWorkspaceStartupPreview } from "../nativeWorkspaceStartupPreview";
import { prepareNativeWorkspace } from "../prepareNativeWorkspace";
import type { WorkspaceSnapshotPreview } from "../workspaceSnapshotPreview";
import {
	managedGitSelection,
	readManagedGitCatalog,
} from "./managedGitStorage";
import type {
	ManagedGitVault,
	ManagedGitVaultCatalog,
} from "./managedGitVaults";
import {
	initializeLocalVaultCatalog,
	managedLocalSelection,
} from "./managedLocalStorage";
import type { ManagedLocalVault } from "./managedLocalVaults";
import { updateCatalogAlias } from "./mobileWorkspaceAliasCatalog";

export type ActiveVault = {
	selection: NativeWorkspaceSelection | null;
	git: ManagedGitVault | null;
};

export type CatalogState = {
	vaults: ManagedGitVault[];
	localVaults: ManagedLocalVault[];
	restored: ActiveVault | null;
	preview: WorkspaceSnapshotPreview | null;
	pending: boolean;
	error: "catalog" | "selection" | null;
};
export type UpdateCatalog = (
	update: (previous: CatalogState) => CatalogState,
) => void;
type CatalogRestoreContext = {
	isActive: () => boolean;
	stage: { value: "catalog" | "selection" };
	update: UpdateCatalog;
	cancellation: AbortController;
};

export function useManagedVaultCatalog() {
	const analytics = useMobileAnalytics();
	const [state, setState] = useState<CatalogState>({
		vaults: [],
		localVaults: [],
		restored: null,
		preview: null,
		pending: true,
		error: null,
	});
	const [attempt, setAttempt] = useState(0);
	useEffect(
		() =>
			restoreCatalogState(setState, () =>
				analytics.capture({ name: "mobile_vault_created", kind: "local" }),
			),
		[analytics, attempt],
	);
	const reload = useCallback(async () => {
		const catalog = await readManagedGitCatalog();
		setState((previous) => ({
			...previous,
			...catalogLists(catalog),
			error: previous.error === "catalog" ? null : previous.error,
		}));
	}, []);
	const updateAlias = useCallback(
		(id: string, value: string) => updateCatalogAlias(id, value, setState),
		[],
	);
	const retry = useCallback(() => {
		setState((previous) => ({ ...previous, pending: true, error: null }));
		setAttempt((value) => value + 1);
	}, []);
	const selectPreviewNote = useCallback((noteId: string) => {
		setState((previous) => selectCachedNote(previous, noteId));
	}, []);
	return { ...state, reload, retry, selectPreviewNote, updateAlias };
}

function selectCachedNote(state: CatalogState, noteId: string): CatalogState {
	if (!state.pending || !state.preview) return state;
	const notes = state.preview.allNotes.length
		? state.preview.allNotes
		: state.preview.notes;
	if (!notes.some((note) => note.id === noteId)) return state;
	return { ...state, preview: { ...state.preview, selectedNoteId: noteId } };
}

function selectedAfterPreparation(
	selection: NativeWorkspaceSelection | null,
	preview: WorkspaceSnapshotPreview | null,
) {
	if (!selection || !preview?.selectedNoteId) return selection;
	return { ...selection, selectedNoteId: preview.selectedNoteId };
}

function restoreCatalogState(
	update: UpdateCatalog,
	onStarterCreated: () => void,
) {
	let active = true;
	const cancellation = new AbortController();
	const stage = { value: "catalog" as "catalog" | "selection" };
	const context = {
		isActive: () => active,
		stage,
		update,
		cancellation,
	};
	void initializeLocalVaultCatalog(onStarterCreated)
		.then((catalog) => restoreCatalogStages(catalog, context))
		.then(
			() => finishCatalogRestoration(active, update),
			() => {
				cancellation.abort();
				finishCatalogRestoration(active, update, stage.value);
			},
		);
	return () => {
		active = false;
		cancellation.abort();
	};
}

async function restoreCatalogStages(
	catalog: ManagedGitVaultCatalog,
	context: CatalogRestoreContext,
) {
	if (!context.isActive()) return;
	context.update((previous) => ({ ...previous, ...catalogLists(catalog) }));
	context.stage.value = "selection";
	const restored = await restoreCatalogSelection(catalog);
	await restoreCatalogPreview(restored, context);
}

async function restoreCatalogPreview(
	restored: ActiveVault,
	context: CatalogRestoreContext,
) {
	if (!context.isActive()) return;
	const preview = await readNativeWorkspaceStartupPreview(
		restored.selection,
		context.cancellation.signal,
		undefined,
		true,
	).catch(() => null);
	if (!context.isActive()) return;
	context.update((previous) => ({
		...previous,
		preview: preview ?? previous.preview,
	}));
	await waitForMotionStartupDelay(context.cancellation.signal);
	if (!context.isActive()) return;
	const selection = await prepareNativeWorkspace(
		restored.selection,
		context.cancellation.signal,
	);
	commitPreparedSelection(selection, restored, context);
}

function commitPreparedSelection(
	selection: NativeWorkspaceSelection | null,
	restored: ActiveVault,
	context: CatalogRestoreContext,
) {
	if (!context.isActive()) return;
	logMobileMotionEvent("native-workspace-prepared", {
		alias: selection?.vaultAlias ?? null,
	});
	context.cancellation.abort();
	context.update((previous) => ({
		...previous,
		restored: {
			...restored,
			selection: selectedAfterPreparation(selection, previous.preview),
		},
		preview: null,
	}));
}

function finishCatalogRestoration(
	active: boolean,
	update: UpdateCatalog,
	error: CatalogState["error"] = null,
) {
	if (active)
		update((previous) => ({
			...previous,
			preview: error ? previous.preview : null,
			pending: false,
			error,
		}));
}

function catalogLists(catalog: ManagedGitVaultCatalog) {
	return { vaults: catalog.vaults, localVaults: catalog.localVaults ?? [] };
}

async function restoreCatalogSelection(
	catalog: ManagedGitVaultCatalog,
): Promise<ActiveVault> {
	const vaults = [...catalog.vaults, ...(catalog.localVaults ?? [])];
	const git = catalog.vaults.find((vault) => vault.id === catalog.activeId);
	if (git)
		return {
			git,
			selection: {
				...(await managedGitSelection(git)),
				vaultAlias: mobileWorkspaceDeepLinkSlug(git, vaults),
			},
		};
	const local = catalog.localVaults?.find(
		(vault) => vault.id === catalog.activeLocalId,
	);
	return {
		git: null,
		selection: local
			? {
					...(await managedLocalSelection(local)),
					vaultAlias: mobileWorkspaceDeepLinkSlug(local, vaults),
				}
			: null,
	};
}
