export function mobileSearchResultsScrollProps() {
	return {
		keyboardDismissMode: "on-drag" as const,
		keyboardShouldPersistTaps: "handled" as const,
	};
}
