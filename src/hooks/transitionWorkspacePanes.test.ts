import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { transitionWorkspacePanes } from "./transitionWorkspacePanes";

function captureTransition() {
	const skipTransition = vi.fn();
	let commit: ViewTransitionUpdateCallback | undefined;
	const start = vi.fn((update: ViewTransitionUpdateCallback) => {
		commit = update;
		const settled = Promise.resolve();
		return {
			ready: settled,
			updateCallbackDone: settled,
			finished: settled,
			skipTransition,
		};
	});
	Object.defineProperty(document, "startViewTransition", {
		value: start,
		configurable: true,
	});
	return { start, skipTransition, apply: () => commit?.() };
}

describe("workspace pane motion", () => {
	beforeEach(() => {
		document.body.innerHTML =
			'<div class="app" data-desktop-sidebar-chrome></div>';
		vi.stubGlobal("isTauri", true);
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
	});

	afterEach(() => {
		Reflect.deleteProperty(document, "startViewTransition");
		document.body.replaceChildren();
		vi.unstubAllGlobals();
	});

	it("skips animation and commits immediately with Reduce Motion", () => {
		const { start } = captureTransition();
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		const update = vi.fn();

		transitionWorkspacePanes("properties", update);

		expect(start).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledOnce();
	});

	it("applies rapid commands in order and skips their stale animation", async () => {
		const { start, skipTransition, apply } = captureTransition();
		const applied: string[] = [];

		transitionWorkspacePanes("left", () => applied.push("hide"));
		transitionWorkspacePanes("left", () => applied.push("show"));
		expect(start).toHaveBeenCalledOnce();
		expect(skipTransition).toHaveBeenCalledOnce();
		expect(applied).toEqual([]);
		apply();

		expect(applied).toEqual(["hide", "show"]);
		await expect
			.poll(() => document.documentElement.dataset.workspaceMotion)
			.toBeUndefined();
	});

	it("applies changes immediately when the webview lacks transition support", () => {
		const update = vi.fn();
		transitionWorkspacePanes("ai", update);
		expect(update).toHaveBeenCalledOnce();
	});
});
