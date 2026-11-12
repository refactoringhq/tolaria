import type { ReactNode } from "react";
import type { WorkspaceSnapshotPreview } from "../../workspace/workspaceSnapshotPreview";
import { MobileWorkspaceStartupPreviewContext } from "./MobileWorkspaceStartupContext";

export function MobileWorkspaceStartup({
	children,
	preview,
}: {
	children: ReactNode;
	preview: WorkspaceSnapshotPreview | null;
}) {
	return (
		<MobileWorkspaceStartupPreviewContext.Provider value={preview}>
			{children}
		</MobileWorkspaceStartupPreviewContext.Provider>
	);
}
