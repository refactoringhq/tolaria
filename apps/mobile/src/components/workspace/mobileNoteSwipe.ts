export type MobileSwipePrimaryAction = "archive" | "organize";
export type MobileNoteSwipeAction =
	| "delete"
	| "favorite"
	| MobileSwipePrimaryAction;
export const mobileNoteSwipeThreshold = 0.68;
export const mobileNoteSwipeButtonWidth = 72;

export function mobileNoteSwipeActionOrder(
	primaryAction: MobileSwipePrimaryAction,
): MobileNoteSwipeAction[] {
	return ["favorite", "delete", primaryAction];
}

// Every action row has favorite, delete and one primary action.
export const mobileNoteSwipeActionCount = 3;

// Worklets call this on the UI thread, so it must stay a worklet and must not
// call plain JS helpers. A non-worklet call there crashes the app on launch.
export function mobileNoteSwipeTrayWidth(actionCount?: number) {
	"worklet";
	return (
		(actionCount ?? mobileNoteSwipeActionCount) * mobileNoteSwipeButtonWidth
	);
}

export function fullSwipeNoteAction(
	distance: number,
	width: number,
	primaryAction: MobileSwipePrimaryAction = "archive",
): MobileSwipePrimaryAction | null {
	"worklet";
	if (width <= 0 || distance > -width * mobileNoteSwipeThreshold) return null;
	return primaryAction;
}

export function mobileNoteSwipeRevealedWidth(translation: number) {
	"worklet";
	return Math.abs(Math.min(0, translation));
}

export function mobileNoteSwipeSecondaryActionWidth(
	translation: number,
	width: number,
	primaryAction: MobileSwipePrimaryAction = "archive",
	committed = false,
) {
	"worklet";
	void primaryAction;
	if (committed) return 0;
	const revealed = mobileNoteSwipeRevealedWidth(translation);
	const tray = mobileNoteSwipeTrayWidth();
	if (revealed <= tray) return mobileNoteSwipeButtonWidth;
	const expand = Math.max(width, tray) - tray;
	if (expand <= 0) return 0;
	return Math.max(
		0,
		mobileNoteSwipeButtonWidth * (1 - Math.min(1, (revealed - tray) / expand)),
	);
}

export function mobileNoteSwipePrimaryActionWidth(
	translation: number,
	width: number,
	primaryAction: MobileSwipePrimaryAction = "archive",
	committed = false,
) {
	"worklet";
	if (committed && width > 0) return width;
	const revealed = mobileNoteSwipeRevealedWidth(translation);
	const secondary = mobileNoteSwipeSecondaryActionWidth(
		translation,
		width,
		primaryAction,
		committed,
	);
	const maxWidth =
		width > 0 ? width : Math.max(mobileNoteSwipeTrayWidth(), revealed);
	return Math.min(
		maxWidth,
		Math.max(
			Math.min(mobileNoteSwipeButtonWidth, revealed),
			revealed - 2 * secondary,
		),
	);
}
