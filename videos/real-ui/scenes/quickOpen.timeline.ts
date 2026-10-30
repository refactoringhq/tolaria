/** Shared by the in-app director scene and the Remotion composition (30 fps). */
export const QUICK_OPEN = {
	fps: 30,
	startNoteQuery: "writing for clarity",
	query: "sponsor",
	/** Uneven, hand-tuned keystroke frames (no metronome). */
	typeFrames: [66, 70, 73, 78, 81, 85, 88],
	open: 46,
	arrowDown: [122, 134] as number[],
	enter: 168,
	uiEnd: 300,
	endCard: 108,
	viewport: { width: 1600, height: 900 },
} as const;

export const QUICK_OPEN_DURATION = QUICK_OPEN.uiEnd + QUICK_OPEN.endCard;
