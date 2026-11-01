export type MobileSwipePrimaryAction = "archive" | "organize";
export type MobileNoteSwipeAction = "favorite" | MobileSwipePrimaryAction;
export const mobileNoteSwipeThreshold = 0.68;

export function fullSwipeNoteAction(
	distance: number,
	width: number,
	primaryAction: MobileSwipePrimaryAction = "archive",
): MobileSwipePrimaryAction | null {
	"worklet";
	if (width <= 0 || distance > -width * mobileNoteSwipeThreshold) return null;
	return primaryAction;
}
