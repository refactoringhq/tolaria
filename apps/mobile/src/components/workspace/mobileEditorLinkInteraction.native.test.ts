import { describe, expect, it, vi } from "vitest";
import { mobileEditorLinkInteractionScript } from "./mobileEditorLinkInteraction.native";

type Listener = (event: Record<string, unknown>) => void;

function installInteractionBridge() {
	const listeners = new Map<string, Listener>();
	const postMessage = vi.fn();
	const document = {
		addEventListener: vi.fn((type: string, listener: Listener) =>
			listeners.set(type, listener),
		),
	};
	const window = {
		ReactNativeWebView: { postMessage },
		getSelection: () => ({ isCollapsed: true, toString: () => "" }),
	};
	new Function("window", "document", mobileEditorLinkInteractionScript)(
		window,
		document,
	);
	return { listeners, postMessage };
}

function linkEvent(href: string, modifiers: Record<string, boolean> = {}) {
	const preventDefault = vi.fn();
	const stopImmediatePropagation = vi.fn();
	return {
		event: {
			button: 0,
			target: { closest: () => ({ getAttribute: () => href }) },
			preventDefault,
			stopImmediatePropagation,
			...modifiers,
		},
		preventDefault,
		stopImmediatePropagation,
	};
}

describe("native editor link interaction bridge", () => {
	it.each(["https://example.com", "tolaria://wikilink/Note"])(
		"opens %s only with a modifier click",
		(href) => {
			const { listeners, postMessage } = installInteractionBridge();
			const plain = linkEvent(href);
			listeners.get("click")?.(plain.event);
			expect(plain.preventDefault).toHaveBeenCalledOnce();
			expect(plain.stopImmediatePropagation).toHaveBeenCalledOnce();
			expect(postMessage).not.toHaveBeenCalled();

			listeners.get("click")?.(linkEvent(href, { metaKey: true }).event);
			expect(postMessage).toHaveBeenCalledWith(
				expect.stringContaining('"intent":"open"'),
			);
			expect(postMessage).toHaveBeenCalledWith(expect.stringContaining(href));
		},
	);

	it.each(["https://example.com", "tolaria://wikilink/Note"])(
		"offers options for long-pressed %s",
		(href) => {
			const { listeners, postMessage } = installInteractionBridge();
			const longPress = linkEvent(href);
			listeners.get("contextmenu")?.(longPress.event);
			expect(longPress.preventDefault).toHaveBeenCalledOnce();
			expect(longPress.stopImmediatePropagation).toHaveBeenCalledOnce();
			expect(postMessage).toHaveBeenCalledWith(
				expect.stringContaining('"intent":"options"'),
			);
			expect(postMessage).toHaveBeenCalledWith(expect.stringContaining(href));
		},
	);

	it("does not route a modifier click while text selection is active", () => {
		const listeners = new Map<string, Listener>();
		const postMessage = vi.fn();
		const document = {
			addEventListener: (type: string, listener: Listener) =>
				listeners.set(type, listener),
		};
		const window = {
			ReactNativeWebView: { postMessage },
			getSelection: () => ({ isCollapsed: false, toString: () => "selected" }),
		};
		new Function("window", "document", mobileEditorLinkInteractionScript)(
			window,
			document,
		);
		listeners.get("click")?.(
			linkEvent("https://example.com", { metaKey: true }).event,
		);
		expect(postMessage).not.toHaveBeenCalled();
	});
});
