/**
 * Tooltips under a finger (TOL-419). iOS Safari focuses a tapped button only once the finger has
 * lifted, and can mark that focus as keyboard-visible. After touch, require a real keydown before
 * treating focus as keyboard intent. A mouse or trackpad keeps hover tooltips.
 */
/** `pointerover` arrives before `pointerenter`, which opens the editor toolbar's tooltips. */
const TRACKED_POINTER_EVENTS = [
	"pointerover",
	"pointerdown",
	"pointermove",
] as const;
let lastPointerType: string | null = null;
let keyboardInputSincePointer = false;

function rememberPointer(event: PointerEvent): void {
	lastPointerType = event.pointerType;
	keyboardInputSincePointer = false;
}

function rememberKeyboardInput(): void {
	keyboardInputSincePointer = true;
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

/** Whether a tooltip may open now: always with a mouse, or after keyboard input following a tap. */
export function tooltipMayOpen(doc: Document = document): boolean {
	return (
		lastPointerType !== "touch" ||
		(keyboardInputSincePointer && hasKeyboardFocus(doc))
	);
}

/** Follows which pointer the user last used; returns the uninstaller. */
export function installTooltipTouchGate(win: Window = window): () => void {
	for (const type of TRACKED_POINTER_EVENTS)
		win.addEventListener(type, rememberPointer, true);
	win.addEventListener("keydown", rememberKeyboardInput, true);
	return () => {
		for (const type of TRACKED_POINTER_EVENTS)
			win.removeEventListener(type, rememberPointer, true);
		win.removeEventListener("keydown", rememberKeyboardInput, true);
		lastPointerType = null;
		keyboardInputSincePointer = false;
	};
}
