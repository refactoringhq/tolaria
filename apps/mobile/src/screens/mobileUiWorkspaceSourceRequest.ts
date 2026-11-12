import {
	nativeWorkspacePersistenceProbeRepository,
	nativeWorkspacePersistenceProbeRequest,
} from "../qa/nativeWorkspacePersistenceProbeRepository";
import {
	nativeWysiwygPersistenceProbeRepository,
	nativeWysiwygPersistenceProbeRequest,
} from "../qa/nativeWysiwygPersistenceProbeRepository";
import type { NativeWorkspaceSelection } from "../workspace/nativeWorkspacePicker";
import {
	type ReadOnlyWorkspaceRequest,
	readOnlyWorkspaceRepository,
} from "../workspace/readOnlyWorkspaceRepository";
import type { WorkspaceSnapshotPreview } from "../workspace/workspaceSnapshotPreview";
import { mobileUiRequestedWorkspaceSource } from "./mobileUiLabWorkspaceResolution";

type PersistenceProbes = {
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
};

type MobileUiWorkspaceRequest = Omit<
	ReadOnlyWorkspaceRequest,
	"scenarioId" | "source" | "vaultAlias" | "vaultLabel" | "vaultRootUri"
> & {
	scenarioId: string | null;
	source: NonNullable<ReadOnlyWorkspaceRequest["source"]>;
	vaultAlias: string | null;
	vaultLabel: string | null;
	vaultRootUri: string | null;
};

export function mobileUiWorkspaceSourceRequest(
	searchParams: URLSearchParams,
	nativeWorkspace: NativeWorkspaceSelection | null,
	startupPreview: WorkspaceSnapshotPreview | null = null,
): { devVaultUrl: string | null; request: MobileUiWorkspaceRequest } {
	const previewWorkspace =
		nativeWorkspace ?? startupPreviewSelection(startupPreview);
	const devVaultUrl =
		searchParams.get("devVaultUrl") ||
		envValue("EXPO_PUBLIC_TOLARIA_DEV_VAULT_URL");
	const source = mobileUiRequestedWorkspaceSource({
		hasDevVaultUrl: devVaultUrl !== null,
		hasNativeWorkspace: previewWorkspace !== null,
		requestedSource:
			searchParams.get("source") ??
			envValue("EXPO_PUBLIC_TOLARIA_WORKSPACE_SOURCE"),
		searchParams,
	});
	return {
		devVaultUrl,
		request: workspaceRequest(searchParams, source, previewWorkspace),
	};
}

function workspaceRequest(
	searchParams: URLSearchParams,
	source: NonNullable<ReadOnlyWorkspaceRequest["source"]>,
	previewWorkspace: NativeWorkspaceSelection | null,
): MobileUiWorkspaceRequest {
	return {
		scenarioId:
			searchParams.get("scenario") || envValue("EXPO_PUBLIC_TOLARIA_SCENARIO"),
		source,
		vaultAlias: previewWorkspace
			? previewWorkspace.vaultAlias
			: queryOrEnv(
					searchParams,
					"vaultAlias",
					"EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_ALIAS",
				),
		vaultLabel: previewWorkspace
			? previewWorkspace.vaultLabel
			: queryOrEnv(
					searchParams,
					"vaultLabel",
					"EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_LABEL",
				),
		vaultRootUri: previewWorkspace
			? previewWorkspace.vaultRootUri
			: queryOrEnv(
					searchParams,
					"vaultUri",
					"EXPO_PUBLIC_TOLARIA_NATIVE_VAULT_URI",
				),
		workspaceIndex: previewWorkspace?.index,
	};
}

function startupPreviewSelection(
	preview: WorkspaceSnapshotPreview | null,
): NativeWorkspaceSelection | null {
	const source = preview?.source;
	if (!source?.vaultPath) return null;
	return {
		vaultAlias: source.alias ?? null,
		vaultLabel: source.label,
		vaultRootUri: source.vaultPath,
	};
}

export function mobileRepositoryForProbes({
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: PersistenceProbes) {
	if (workspacePersistenceProbe)
		return nativeWorkspacePersistenceProbeRepository(
			readOnlyWorkspaceRepository,
		);
	if (wysiwygPersistenceProbe)
		return nativeWysiwygPersistenceProbeRepository(readOnlyWorkspaceRepository);
	return readOnlyWorkspaceRepository;
}

export function mobileRepositoryRequestForProbes(
	request: ReadOnlyWorkspaceRequest,
	{ workspacePersistenceProbe, wysiwygPersistenceProbe }: PersistenceProbes,
) {
	if (workspacePersistenceProbe)
		return nativeWorkspacePersistenceProbeRequest(request);
	if (wysiwygPersistenceProbe)
		return nativeWysiwygPersistenceProbeRequest(request);
	return request;
}

function queryOrEnv(searchParams: URLSearchParams, query: string, env: string) {
	return searchParams.get(query) || envValue(env);
}

function envValue(name: string) {
	const processGlobal = globalThis as {
		process?: { env?: Record<string, string | undefined> };
	};
	return processGlobal.process?.env?.[name] ?? null;
}
