export type MobileSwipePrimaryAction = "archive" | "organize";
export type MobileNoteSwipeAction =
	| "delete"
	| "favorite"
	| MobileSwipePrimaryAction;
export const mobileNoteSwipeThreshold = 0.68;

export function mobileNoteSwipeActionOrder(
	primaryAction: MobileSwipePrimaryAction,
): MobileNoteSwipeAction[] {
	return ["favorite", "delete", primaryAction];
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
