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
