import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installTooltipTouchGate, tooltipMayOpen } from "./tooltipTouchGate";

function pointer(type: string, pointerType: string): void {
	const event = new MouseEvent(type, { bubbles: true });
	Object.defineProperty(event, "pointerType", { value: pointerType });
	document.body.dispatchEvent(event);
}

function focusButton(keyboard: boolean): HTMLButtonElement {
	const button = document.createElement("button");
	document.body.append(button);
	button.matches = (selector: string) =>
		selector === ":focus-visible" ? keyboard : false;
	button.focus();
	return button;
}

describe("tooltipTouchGate", () => {
	let uninstall: () => void;

	beforeEach(() => {
		uninstall = installTooltipTouchGate(window);
	});
	afterEach(() => {
		uninstall();
		document.body.innerHTML = "";
	});

	it("lets tooltips open before any pointer and with a mouse", () => {
		expect(tooltipMayOpen()).toBe(true);
		pointer("pointermove", "mouse");
		focusButton(false);
		expect(tooltipMayOpen()).toBe(true);
	});

	it("keeps a tooltip closed on the focus a tap leaves behind", () => {
		pointer("pointerdown", "touch");
		focusButton(false);
		expect(tooltipMayOpen()).toBe(false);
	});

	it("opens for keyboard focus after a tap", () => {
		pointer("pointerdown", "touch");
		focusButton(true);
		expect(tooltipMayOpen()).toBe(true);
	});

	it("opens again once a trackpad pointer moves after a tap", () => {
		pointer("pointerdown", "touch");
		pointer("pointermove", "mouse");
		expect(tooltipMayOpen()).toBe(true);
	});

	it("stays closed after a tap with nothing focused, and forgets the finger once uninstalled", () => {
		pointer("pointerdown", "touch");
		expect(tooltipMayOpen()).toBe(false);
		uninstall();
		expect(tooltipMayOpen()).toBe(true);
		uninstall = installTooltipTouchGate(window);
	});

	it("treats a selector the browser cannot match as no keyboard focus", () => {
		pointer("pointerdown", "touch");
		const button = focusButton(true);
		button.matches = () => {
			throw new SyntaxError("unsupported selector");
		};
		expect(tooltipMayOpen()).toBe(false);
	});
});
