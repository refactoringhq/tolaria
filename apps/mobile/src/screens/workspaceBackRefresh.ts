import type { MobileWorkspaceSnapshot } from "../workspace/mobileWorkspaceModel";
import { useTabletWorkspaceNavigation } from "./tabletWorkspaceNavigation";

export function createWorkspaceBackAction(
	goBack: () => void,
	canGoBack: () => boolean,
	refresh?: () => unknown,
) {
	return () => {
		const returningToPreviousView = canGoBack();
		goBack();
		if (returningToPreviousView) void refresh?.();
	};
}

export function useWorkspaceBackRefreshNavigation(
	workspaceSnapshot: MobileWorkspaceSnapshot,
	searchQuery: string,
	refresh?: () => unknown,
) {
	const navigation = useTabletWorkspaceNavigation(
		workspaceSnapshot,
		searchQuery,
	);
	const goBack = createWorkspaceBackAction(
		navigation.goBack,
		() => navigation.canGoBack,
		refresh,
	);
	return { ...navigation, goBack, onGoBack: goBack };
}
