import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type MediaQueriesStub,
	stubMediaQueries,
} from "../test-utils/mediaQueries";
import {
	installTouchInput,
	LONG_PRESS_MS,
	TOUCH_INPUT_ATTRIBUTE,
	TOUCH_INPUT_QUERY,
} from "./touchInput";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("./telemetry", () => ({ trackEvent }));

interface PointerInit {
	pointerType?: string;
	pointerId?: number;
	isPrimary?: boolean;
	x?: number;
	y?: number;
}

const DEFAULT_POINTER: Required<PointerInit> = {
	pointerType: "touch",
	pointerId: 1,
	isPrimary: true,
	x: 10,
	y: 20,
};

function pointer(target: Element, type: string, init: PointerInit = {}): void {
	const { pointerType, pointerId, isPrimary, x, y } = {
		...DEFAULT_POINTER,
		...init,
	};
	const event = new MouseEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
	});
	Object.defineProperties(event, {
		pointerType: { value: pointerType },
		pointerId: { value: pointerId },
		isPrimary: { value: isPrimary },
	});
	target.dispatchEvent(event);
}

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	parent: Element,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.className = className;
	parent.append(node);
	return node;
}

/** The shell's panes: a note in the list, a search field and the editor. */
function mountShell(): {
	item: HTMLElement;
	editor: HTMLElement;
	search: HTMLInputElement;
} {
	const app = element("div", "app", element("div", "app-shell", document.body));
	const list = element("div", "app__note-list", app);
	const item = element("div", "note", list);
	const search = element("input", "search", list);
	const editor = element("div", "text", element("div", "app__editor", app));
	return { item, editor, search };
}

function recordContextMenus(target: Element): MouseEvent[] {
	const events: MouseEvent[] = [];
	target.addEventListener("contextmenu", (event) => {
		events.push(event as MouseEvent);
	});
	return events;
}

describe("installTouchInput", () => {
	let media: MediaQueriesStub;
	let uninstall: () => void;
	let opened: string[];

	beforeEach(() => {
		vi.useFakeTimers();
		media = stubMediaQueries({ [TOUCH_INPUT_QUERY]: true });
		opened = [];
		uninstall = installTouchInput(window, (surface) => {
			opened.push(surface);
		});
	});

	afterEach(() => {
		uninstall();
		vi.useRealTimers();
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it("marks the page while a finger is the primary pointer", () => {
		expect(document.documentElement.hasAttribute(TOUCH_INPUT_ATTRIBUTE)).toBe(
			true,
		);
		media.set(TOUCH_INPUT_QUERY, false);
		expect(document.documentElement.hasAttribute(TOUCH_INPUT_ATTRIBUTE)).toBe(
			false,
		);
		media.set(TOUCH_INPUT_QUERY, true);
		uninstall();
		expect(document.documentElement.hasAttribute(TOUCH_INPUT_ATTRIBUTE)).toBe(
			false,
		);
	});

	it("opens the context menu at the finger after a long press", () => {
		const { item } = mountShell();
		const menus = recordContextMenus(item);
		pointer(item, "pointerdown", { x: 30, y: 40 });
		vi.advanceTimersByTime(LONG_PRESS_MS - 1);
		expect(menus).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(menus).toHaveLength(1);
		expect([menus[0].clientX, menus[0].clientY, menus[0].button]).toEqual([
			30, 40, 2,
		]);
		expect(opened).toEqual(["note_list"]);
	});

	it("swallows the click the lifted finger sends after the menu opened", () => {
		const { item, editor } = mountShell();
		const clicks = vi.fn();
		const tapsBeside = vi.fn();
		item.addEventListener("click", clicks);
		editor.addEventListener("mousedown", tapsBeside);
		pointer(item, "pointerdown");
		vi.advanceTimersByTime(LONG_PRESS_MS);
		pointer(item, "pointerup");
		item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).not.toHaveBeenCalled();
		// A tap beside the menu right away still reaches the page and closes the menu.
		editor.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		expect(tapsBeside).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(1000);
		item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toHaveBeenCalledTimes(1);
	});

	it("leaves a tap, a scroll and a mouse alone", () => {
		const { item } = mountShell();
		const menus = recordContextMenus(item);
		const clicks = vi.fn();
		item.addEventListener("click", clicks);

		pointer(item, "pointerdown");
		pointer(item, "pointerup");
		item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(clicks).toHaveBeenCalledTimes(1);

		pointer(item, "pointerdown", { y: 20 });
		pointer(item, "pointermove", { y: 60 });
		pointer(item, "pointerdown", { pointerType: "mouse" });
		pointer(item, "pointerdown", { isPrimary: false });
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(menus).toHaveLength(0);
	});

	it("keeps long presses in the editor and in text fields for the browser", () => {
		const { editor, search } = mountShell();
		const menus = [
			...recordContextMenus(editor),
			...recordContextMenus(search),
		];
		pointer(editor, "pointerdown");
		vi.advanceTimersByTime(LONG_PRESS_MS);
		pointer(search, "pointerdown");
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(menus).toHaveLength(0);
	});

	it("lets the browser’s own long-press contextmenu open the menu once", () => {
		const { item } = mountShell();
		const delivered = vi.fn();
		item.addEventListener("contextmenu", delivered);
		const native = () => {
			item.dispatchEvent(
				new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
			);
		};

		pointer(item, "pointerdown");
		native();
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(delivered).toHaveBeenCalledTimes(1);
		pointer(item, "pointerup");

		pointer(item, "pointerdown", { pointerId: 2 });
		vi.advanceTimersByTime(LONG_PRESS_MS);
		native();
		expect(delivered).toHaveBeenCalledTimes(2);
	});
});

it("does nothing without matchMedia", () => {
	vi.stubGlobal("matchMedia", undefined);
	const uninstall = installTouchInput(window, () => {});
	expect(document.documentElement.hasAttribute(TOUCH_INPUT_ATTRIBUTE)).toBe(
		false,
	);
	uninstall();
	vi.unstubAllGlobals();
});

it("reports a long-press menu to product analytics by default", async () => {
	vi.useFakeTimers();
	stubMediaQueries({ [TOUCH_INPUT_QUERY]: true });
	const uninstall = installTouchInput();
	const { item } = mountShell();
	pointer(item, "pointerdown");
	vi.advanceTimersByTime(LONG_PRESS_MS);
	uninstall();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	await vi.waitFor(() => {
		expect(trackEvent).toHaveBeenCalledWith(
			"web_touch_long_press_menu_opened",
			{ surface: "note_list" },
		);
	});
});
