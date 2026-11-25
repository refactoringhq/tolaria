const STORAGE_KEY = "tolaria:web-collection-layouts";

type LayoutRecord = Record<string, unknown>;

function readAllLayouts(): Record<string, LayoutRecord> {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (!stored) return {};
		const parsed: unknown = JSON.parse(stored);
		return parsed !== null &&
			typeof parsed === "object" &&
			!Array.isArray(parsed)
			? (parsed as Record<string, LayoutRecord>)
			: {};
	} catch {
		return {};
	}
}

export function readWebLayout(collection: string): LayoutRecord | undefined {
	return Object.entries(readAllLayouts()).find(
		([key]) => key === collection,
	)?.[1];
}

export function writeWebLayout(collection: string, layout: LayoutRecord): void {
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(
				Object.fromEntries([
					...Object.entries(readAllLayouts()).filter(
						([key]) => key !== collection,
					),
					[collection, layout],
				]),
			),
		);
	} catch {
		// A browser storage quota or privacy setting should not interrupt changing views.
	}
}
