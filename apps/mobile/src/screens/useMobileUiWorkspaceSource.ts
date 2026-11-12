import { useEffect, useMemo, useState } from "react";
import { mobileText } from "../i18n/mobileText";
import { logMobileMotionEvent } from "../qa/mobileMotionFrameLog";
import {
	type DevVaultWorkspaceState,
	fetchDevVaultWorkspaceState,
} from "../workspace/devVaultWorkspaceRepository";
import type { NativeWorkspaceSelection } from "../workspace/nativeWorkspacePicker";
import {
	mobileSnapshotFromStartupPreview,
	type WorkspaceSnapshotPreview,
} from "../workspace/workspaceSnapshotPreview";
import {
	mobileRepositoryForProbes,
	mobileRepositoryRequestForProbes,
	mobileUiWorkspaceSourceRequest,
} from "./mobileUiWorkspaceSourceRequest";
import { useMobileWorkspaceResolution } from "./useMobileWorkspaceResolution";

export type DevVaultLoadState =
	| { status: "idle" | "loading" }
	| { message: string; status: "error" }
	| { state: DevVaultWorkspaceState; status: "ready" };

export function useMobileUiWorkspaceSource({
	nativeWorkspace,
	searchParams,
	startupPreview,
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: {
	nativeWorkspace: NativeWorkspaceSelection | null;
	searchParams: URLSearchParams;
	startupPreview: WorkspaceSnapshotPreview | null;
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
}) {
	const workspaceSource = useWorkspaceSourceRepository({
		nativeWorkspace,
		searchParams,
		startupPreview,
		workspacePersistenceProbe,
		wysiwygPersistenceProbe,
	});
	return useResolvedWorkspaceSource(
		workspaceSource,
		nativeWorkspace,
		workspacePersistenceProbe || wysiwygPersistenceProbe,
	);
}

function useResolvedWorkspaceSource(
	workspaceSource: ReturnType<typeof useWorkspaceSourceRepository>,
	nativeWorkspace: NativeWorkspaceSelection | null,
	persistenceProbeEnabled: boolean,
) {
	const resolution = useMobileWorkspaceResolution(
		{
			devVaultState:
				workspaceSource.devVault.status === "ready"
					? workspaceSource.devVault.state
					: null,
			persistenceProbeEnabled,
			probeRepository: workspaceSource.repository,
			repositoryRequest: workspaceSource.repositoryRequest,
			source: workspaceSource.source,
		},
		nativeWorkspace,
	);
	return {
		...workspaceSource,
		baseSnapshot: resolution.baseSnapshot,
		repository: resolution.repository,
		repositoryRequest: resolution.repositoryRequest,
	};
}

function useWorkspaceSourceRepository({
	nativeWorkspace,
	searchParams,
	startupPreview,
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: {
	nativeWorkspace: NativeWorkspaceSelection | null;
	searchParams: URLSearchParams;
	startupPreview: WorkspaceSnapshotPreview | null;
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
}) {
	const { request: sourceRequest, devVaultUrl } =
		mobileUiWorkspaceSourceRequest(
			searchParams,
			nativeWorkspace,
			startupPreview,
		);
	const { scenarioId, source } = sourceRequest;
	const devVault = useDevVaultWorkspaceState(source === "dev", devVaultUrl);
	const workspaceRepository = useWorkspaceRepository({
		nativeWorkspace,
		source,
		sourceRequest,
		startupPreview,
		workspacePersistenceProbe,
		wysiwygPersistenceProbe,
	});
	return { ...workspaceRepository, devVault, devVaultUrl, scenarioId, source };
}

function useWorkspaceRepository({
	nativeWorkspace,
	source,
	sourceRequest,
	startupPreview,
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: {
	nativeWorkspace: NativeWorkspaceSelection | null;
	source: string;
	sourceRequest: ReturnType<typeof mobileUiWorkspaceSourceRequest>["request"];
	startupPreview: WorkspaceSnapshotPreview | null;
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
}) {
	const request = mobileRepositoryRequestForProbes(sourceRequest, {
		workspacePersistenceProbe,
		wysiwygPersistenceProbe,
	});
	const probeRepository = useMemo(
		() =>
			mobileRepositoryForProbes({
				workspacePersistenceProbe,
				wysiwygPersistenceProbe,
			}),
		[workspacePersistenceProbe, wysiwygPersistenceProbe],
	);
	const cachedSnapshot = useCachedStartupSnapshot({
		nativeWorkspace,
		source,
		startupPreview,
		workspacePersistenceProbe,
		wysiwygPersistenceProbe,
	});
	const workspaceRepository = useMemo(
		() =>
			cachedSnapshot
				? { ...probeRepository, readSnapshot: () => cachedSnapshot }
				: probeRepository,
		[cachedSnapshot, probeRepository],
	);
	return {
		repository: workspaceRepository,
		repositoryRequest: request,
	};
}

function useCachedStartupSnapshot({
	nativeWorkspace,
	source,
	startupPreview,
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: {
	nativeWorkspace: NativeWorkspaceSelection | null;
	source: string;
	startupPreview: WorkspaceSnapshotPreview | null;
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
}) {
	const snapshot = useMemo(
		() =>
			startupPreview &&
			shouldUseStartupPreview({
				nativeWorkspace,
				source,
				startupPreview,
				workspacePersistenceProbe,
				wysiwygPersistenceProbe,
			})
				? mobileSnapshotFromStartupPreview(startupPreview)
				: null,
		[
			nativeWorkspace,
			source,
			startupPreview,
			workspacePersistenceProbe,
			wysiwygPersistenceProbe,
		],
	);
	useEffect(() => {
		if (!snapshot) return;
		logMobileMotionEvent("startup-preview-consumed", {
			noteCount: snapshot.notes.length,
			hasHamburger: true,
			hasCreateAction: true,
		});
	}, [snapshot]);
	return snapshot;
}

function shouldUseStartupPreview({
	nativeWorkspace,
	source,
	startupPreview,
	workspacePersistenceProbe,
	wysiwygPersistenceProbe,
}: {
	nativeWorkspace: NativeWorkspaceSelection | null;
	source: string;
	startupPreview: WorkspaceSnapshotPreview | null;
	workspacePersistenceProbe: boolean;
	wysiwygPersistenceProbe: boolean;
}) {
	return Boolean(
		startupPreview &&
			!nativeWorkspace &&
			source === "native" &&
			!workspacePersistenceProbe &&
			!wysiwygPersistenceProbe,
	);
}

function useDevVaultWorkspaceState(
	enabled: boolean,
	url: string | null,
): DevVaultLoadState {
	const [state, setState] = useState<DevVaultLoadState>({ status: "idle" });

	useEffect(() => {
		if (!enabled) return scheduleDevVaultState(setState, { status: "idle" });
		if (!url?.trim())
			return scheduleDevVaultState(setState, {
				message: mobileText("status.vault.devBridgeMissingUrl"),
				status: "error",
			});

		const controller = new AbortController();
		const cancelLoadingState = scheduleDevVaultState(setState, {
			status: "loading",
		});
		void fetchDevVaultWorkspaceState(url, controller.signal)
			.then((nextState) => {
				if (!controller.signal.aborted)
					setState({ state: nextState, status: "ready" });
			})
			.catch((error) => {
				if (!controller.signal.aborted)
					setState({ message: devVaultErrorMessage(error), status: "error" });
			});

		return () => {
			cancelLoadingState();
			controller.abort();
		};
	}, [enabled, url]);

	return state;
}

function scheduleDevVaultState(
	setState: (state: DevVaultLoadState) => void,
	state: DevVaultLoadState,
) {
	const timer = setTimeout(() => setState(state), 0);
	return () => clearTimeout(timer);
}

function devVaultErrorMessage(error: unknown): string {
	return error instanceof Error
		? error.message
		: mobileText("status.vault.devBridgeFailed");
}
