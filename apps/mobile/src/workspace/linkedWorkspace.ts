import { withLinkedWorkspaceSync } from "./git/workspaceOperationQueue";
import { withSavedWorkspace } from "./git/workspaceWriteQueue";
import {
	type NativeWorkspaceAccessModule,
	optionalNativeWorkspaceAccessModule,
} from "./nativeWorkspaceAccess";

export function isWorkspaceLinked(
	root: string | undefined,
	native = optionalNativeWorkspaceAccessModule(),
) {
	if (!root) return false;
	return native?.isWorkspaceLinked?.(root) ?? false;
}

export async function syncLinkedWorkspace(
	root: string,
	native: NativeWorkspaceAccessModule | null = optionalNativeWorkspaceAccessModule(),
) {
	const sync = native?.syncLinkedWorkspace;
	if (!sync) throw new Error("linkedFolderUnavailable");
	try {
		return await withSavedWorkspace(root, () =>
			withLinkedWorkspaceSync(root, () => sync(root)),
		);
	} catch {
		throw new Error("linkedFolderUnavailable");
	}
}
