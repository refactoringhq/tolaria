/**
 * Web only (TOL-24): touch-first input. While the primary pointer is a finger, `<html>` carries
 * `data-touch-input` (App.css sizes key targets to 44 px from it), and a long press on the
 * sidebar or the note list opens the context menu a right click opens with a mouse, and a tap
 * never opens a tooltip (TOL-419, src/lib/tooltipTouchGate.ts).
 */
import { installTooltipTouchGate } from "./tooltipTouchGate";

export const TOUCH_INPUT_QUERY = "(pointer: coarse)";
export const TOUCH_INPUT_ATTRIBUTE = "data-touch-input";
/**
 * For buttons whose classes force `!min-w-0`: an important utility that App.css cannot outrank
 * without `!important`. With a finger the button is at least 44 px wide, like the other targets.
 */
export const TOUCH_TARGET_CLASSNAME =
	"[html[data-touch-input]_&]:!min-w-[44px]";
/** iOS and Android open their own long-press menus after about half a second. */
export const LONG_PRESS_MS = 500;
/** A finger that moves further is scrolling, not pressing. */
const MOVE_TOLERANCE_PX = 10;
/** After the menu opens, the click the lifted finger sends must not open the note. */
const CLICK_SUPPRESSION_MS = 400;
/** Where a long press opens a menu: [selector, surface reported to analytics]. */
const LONG_PRESS_SURFACES: readonly (readonly [string, string])[] = [
	[".app__sidebar", "sidebar"],
	[".app__note-list", "note_list"],
];
const TEXT_ENTRY_SELECTOR = 'input, textarea, [contenteditable="true"]';
const SUPPRESSED_AFTER_LONG_PRESS = ["mousedown", "mouseup", "click"] as const;
/** The `contextmenu` events a long press dispatched, told apart from the browser's own. */
const longPressMenus = new WeakSet<Event>();

interface Press {
	pointerId: number;
	x: number;
	y: number;
	target: Element;
	surface: string;
	timer: ReturnType<typeof setTimeout>;
	opened: boolean;
}

export type LongPressListener = (surface: string) => void;

function longPressSurface(target: EventTarget | null): string | null {
	if (!(target instanceof Element) || target.closest(TEXT_ENTRY_SELECTOR))
		return null;
	const match = LONG_PRESS_SURFACES.find(([selector]) =>
		target.closest(selector),
	);
	return match ? match[1] : null;
}

function movedTooFar(press: Press, event: PointerEvent): boolean {
	return (
		Math.hypot(event.clientX - press.x, event.clientY - press.y) >
		MOVE_TOLERANCE_PX
	);
}

function openContextMenu(press: Press): void {
	const event = new MouseEvent("contextmenu", {
		bubbles: true,
		cancelable: true,
		button: 2,
		clientX: press.x,
		clientY: press.y,
	});
	longPressMenus.add(event);
	press.target.dispatchEvent(event);
}

function stopEvent(event: Event): void {
	event.preventDefault();
	event.stopPropagation();
}

/** Follows the primary pointer: the attribute is set while it is a finger. */
function followTouchInput(win: Window): () => void {
	const media = win.matchMedia(TOUCH_INPUT_QUERY);
	const root = win.document.documentElement;
	const update = () => {
		root.toggleAttribute(TOUCH_INPUT_ATTRIBUTE, media.matches);
	};
	update();
	media.addEventListener("change", update);
	return () => {
		media.removeEventListener("change", update);
		root.removeAttribute(TOUCH_INPUT_ATTRIBUTE);
	};
}

/**
 * Long press → `contextmenu` at the finger, so every existing menu opens unchanged. Mouse and
 * pen keep the right click. Where the browser sends its own `contextmenu` for the press
 * (Android), that one opens the menu and the timer stands down.
 */
function installLongPress(win: Window, onOpen: LongPressListener): () => void {
	let press: Press | null = null;
	let suppressClicksUntil = 0;
	let pressedTarget: Element | null = null;

	const cancel = () => {
		if (press) clearTimeout(press.timer);
		press = null;
	};
	const open = () => {
		if (!press) return;
		press.opened = true;
		openContextMenu(press);
		onOpen(press.surface);
	};
	const handlePointerDown = (event: PointerEvent) => {
		cancel();
		const surface =
			event.pointerType === "touch" && event.isPrimary
				? longPressSurface(event.target)
				: null;
		if (!surface) return;
		const target = event.target as Element;
		press = {
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			target,
			surface,
			timer: setTimeout(open, LONG_PRESS_MS),
			opened: false,
		};
	};
	const handlePointerMove = (event: PointerEvent) => {
		if (
			press &&
			!press.opened &&
			press.pointerId === event.pointerId &&
			movedTooFar(press, event)
		)
			cancel();
	};
	const handlePointerEnd = (event: PointerEvent) => {
		if (press?.pointerId !== event.pointerId) return;
		if (press.opened) {
			suppressClicksUntil = win.performance.now() + CLICK_SUPPRESSION_MS;
			pressedTarget = press.target;
		}
		cancel();
	};
	// Only the pressed element's own click is swallowed: a tap beside the menu still closes it.
	const isSuppressing = (target: EventTarget | null) => {
		if (press?.opened) return true;
		return (
			win.performance.now() < suppressClicksUntil &&
			target instanceof Node &&
			pressedTarget?.contains(target) === true
		);
	};
	const handleNativeContextMenu = (event: MouseEvent) => {
		if (longPressMenus.has(event) || !press) return;
		if (press.opened) stopEvent(event);
		clearTimeout(press.timer);
		press.opened = true;
	};
	const handleClickAfterLongPress = (event: MouseEvent) => {
		if (isSuppressing(event.target)) stopEvent(event);
	};

	const listeners: [string, EventListener][] = [
		["pointerdown", handlePointerDown as EventListener],
		["pointermove", handlePointerMove as EventListener],
		["pointerup", handlePointerEnd as EventListener],
		["pointercancel", handlePointerEnd as EventListener],
		["contextmenu", handleNativeContextMenu as EventListener],
		...SUPPRESSED_AFTER_LONG_PRESS.map((type): [string, EventListener] => [
			type,
			handleClickAfterLongPress as EventListener,
		]),
	];
	for (const [type, listener] of listeners)
		win.addEventListener(type, listener, true);
	return () => {
		cancel();
		for (const [type, listener] of listeners)
			win.removeEventListener(type, listener, true);
	};
}

function trackLongPressMenu(surface: string): void {
	void import("./telemetry").then(({ trackEvent }) => {
		trackEvent("web_touch_long_press_menu_opened", { surface });
	});
}

/** Installs touch-first input for the web build; returns the uninstaller. */
export function installTouchInput(
	win: Window = window,
	onOpen: LongPressListener = trackLongPressMenu,
): () => void {
	if (typeof win.matchMedia !== "function") return () => {};
	const stopFollowing = followTouchInput(win);
	const stopLongPress = installLongPress(win, onOpen);
	const stopTooltipGate = installTooltipTouchGate(win);
	return () => {
		stopFollowing();
		stopLongPress();
		stopTooltipGate();
	};
}
