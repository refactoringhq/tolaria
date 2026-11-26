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
const inputListeners = new Set<() => void>();

function notifyInputListeners(): void {
	for (const listener of inputListeners) listener();
}

function isCompatibilityMouseHover(event: PointerEvent): boolean {
	// iPadOS can emit compatibility mouse pointerover events after a finger tap. A real mouse or
	// trackpad produces pointermove as it enters, so keep the touch gate until that movement.
	if (event.pointerType !== "mouse") return false;
	if (event.type !== "pointerover") return false;
	return lastPointerType === "touch";
}

function rememberPointer(event: PointerEvent): void {
	if (isCompatibilityMouseHover(event)) return;
	lastPointerType = event.pointerType;
	keyboardInputSincePointer = false;
	notifyInputListeners();
}

function rememberKeyboardInput(): void {
	keyboardInputSincePointer = true;
	notifyInputListeners();
}

/** Lets an already-open tooltip respond when the user's input changes. */
export function subscribeTooltipInput(listener: () => void): () => void {
	inputListeners.add(listener);
	return () => inputListeners.delete(listener);
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
