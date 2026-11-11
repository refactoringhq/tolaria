export function changedMotionRenderInputs(
	previous: Record<string, unknown> | undefined,
	next: Record<string, unknown>,
) {
	if (!previous) return Object.keys(next);
	return Object.keys(next).flatMap((key) => {
		if (previous[key] === next[key]) return [];
		if (key !== "note") return [key];
		const changedNoteFields = changedFields(previous[key], next[key]);
		if (!changedNoteFields) return [key];
		return changedNoteFields.length
			? changedNoteFields.map((field) => `note.${field}`)
			: ["note.identity"];
	});
}

function changedFields(previous: unknown, next: unknown) {
	if (!isRecord(previous) || !isRecord(next)) return null;
	return Object.keys(next).filter((field) => previous[field] !== next[field]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
