import { useEffect, useRef } from "react";
import { isTauri } from "../mock-tauri";
import {
	AI_WORKSPACE_FILE_CREATED_EVENT,
	AI_WORKSPACE_FILE_MODIFIED_EVENT,
	AI_WORKSPACE_OPEN_NOTE_REQUESTED_EVENT,
	AI_WORKSPACE_VAULT_CHANGED_EVENT,
} from "../utils/aiPromptBridge";
import {
	cleanupTauriEventListeners,
	type TauriUnlisten,
} from "../utils/tauriEventCleanup";

interface AiWorkspaceWindowBridgeEvents {
	onFileCreated: (path: string) => void;
	onFileModified: (path: string) => void;
	onOpenNote: (path: string) => void;
	onVaultChanged: () => void;
}

export function useAiWorkspaceWindowBridgeEvents({
	onFileCreated,
	onFileModified,
	onOpenNote,
	onVaultChanged,
}: AiWorkspaceWindowBridgeEvents) {
	const handlersRef = useRef({
		onFileCreated,
		onFileModified,
		onOpenNote,
		onVaultChanged,
	});
	handlersRef.current = {
		onFileCreated,
		onFileModified,
		onOpenNote,
		onVaultChanged,
	};

	useEffect(() => {
		if (!isTauri()) return;

		let disposed = false;
		let unlisteners: TauriUnlisten[] = [];

		void import("@tauri-apps/api/event")
			.then(({ listen }) =>
				Promise.all([
					listen<string>(AI_WORKSPACE_OPEN_NOTE_REQUESTED_EVENT, (event) => {
						if (typeof event.payload === "string")
							handlersRef.current.onOpenNote(event.payload);
					}),
					listen<string>(AI_WORKSPACE_FILE_CREATED_EVENT, (event) => {
						if (typeof event.payload === "string")
							handlersRef.current.onFileCreated(event.payload);
					}),
					listen<string>(AI_WORKSPACE_FILE_MODIFIED_EVENT, (event) => {
						if (typeof event.payload === "string")
							handlersRef.current.onFileModified(event.payload);
					}),
					listen(AI_WORKSPACE_VAULT_CHANGED_EVENT, () => {
						handlersRef.current.onVaultChanged();
					}),
				]),
			)
			.then((nextUnlisteners) => {
				if (disposed) {
					cleanupTauriEventListeners(nextUnlisteners);
					return;
				}
				unlisteners = nextUnlisteners;
			})
			.catch(() => undefined);

		return () => {
			disposed = true;
			cleanupTauriEventListeners(unlisteners);
		};
	}, []);
}
