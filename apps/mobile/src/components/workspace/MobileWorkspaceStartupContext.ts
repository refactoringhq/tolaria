import { createContext, useContext } from "react";
import type { WorkspaceSnapshotPreview } from "../../workspace/workspaceSnapshotPreview";

export const MobileWorkspaceStartupPreviewContext =
	createContext<WorkspaceSnapshotPreview | null>(null);

export function useMobileWorkspaceStartupPreview() {
	return useContext(MobileWorkspaceStartupPreviewContext);
}
