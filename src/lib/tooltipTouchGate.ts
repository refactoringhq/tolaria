/**
 * Tooltips under a finger (TOL-419). iOS Safari focuses a tapped button only once the finger has
 * lifted, and a tooltip opens on a focus that no press preceded: it then stayed on screen after
 * the tap. While the last pointer was a finger, a tooltip opens only for keyboard focus. A mouse
 * or a trackpad keeps its hover tooltips, and a desktop that never sees a finger is unchanged.
 */
/** `pointerover` arrives before `pointerenter`, which opens the editor toolbar's tooltips. */
const TRACKED_POINTER_EVENTS = [
	"pointerover",
	"pointerdown",
	"pointermove",
] as const;
let lastPointerType: string | null = null;

function rememberPointer(event: PointerEvent): void {
	lastPointerType = event.pointerType;
}

function hasKeyboardFocus(doc: Document): boolean {
	const active = doc.activeElement;
	if (!active || active === doc.body) return false;
	try {
		return active.matches(":focus-visible");
	} catch {
		return false;
	}
}

/** Whether a tooltip may open now: always with a mouse, only for keyboard focus after a tap. */
export function tooltipMayOpen(doc: Document = document): boolean {
	return lastPointerType !== "touch" || hasKeyboardFocus(doc);
}

/** Follows which pointer the user last used; returns the uninstaller. */
export function installTooltipTouchGate(win: Window = window): () => void {
	for (const type of TRACKED_POINTER_EVENTS)
		win.addEventListener(type, rememberPointer, true);
	return () => {
		for (const type of TRACKED_POINTER_EVENTS)
			win.removeEventListener(type, rememberPointer, true);
		lastPointerType = null;
	};
}
