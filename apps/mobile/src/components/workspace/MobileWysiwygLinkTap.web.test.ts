import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@10play/tentap-editor/web", () => ({
	BridgeExtension: class {
		constructor(options: object) {
			Object.assign(this, options);
		}
	},
	LinkBridge: {
		name: "link",
		tiptapExtension: { extend: (options: object) => options },
	},
	Plugin: class {
		constructor(options: object) {
			Object.assign(this, options);
		}
	},
	TenTapStartKit: [{ name: "link" }],
}));

import { mobileWikilinkStartKit } from "./MobileWysiwygLinkBridge.web";

const originalWindow = globalThis.window;

afterEach(() => {
	vi.stubGlobal("window", originalWindow);
});

function tapHandlers() {
	const link = mobileWikilinkStartKit().find(
		(extension) => extension.name === "link",
	) as unknown as {
		tiptapExtension: {
			addProseMirrorPlugins: (this: { parent: () => never[] }) => Array<{
				props: unknown;
			}>;
		};
	};
	return (
		link.tiptapExtension.addProseMirrorPlugins.call({ parent: () => [] })[0]
			.props as {
			handleDOMEvents: Record<
				string,
				(view: { hasFocus: () => boolean }, event: MouseEvent) => boolean
			>;
		}
	).handleDOMEvents;
}

function clickLink(href: string) {
	const postMessage = vi.fn();
	vi.stubGlobal("window", { ReactNativeWebView: { postMessage } });
	const preventDefault = vi.fn();
	const target = {
		closest: () => ({ getAttribute: () => href }),
		parentElement: null,
	};
	return { postMessage, preventDefault, target };
}

describe("mobile WYSIWYG link taps", () => {
	it.each([
		["external URL", "https://example.com"],
		["wikilink", "tolaria://wikilink/Note"],
	])("routes an unfocused %s tap", (_label, href) => {
		const events = tapHandlers();
		const { postMessage, preventDefault, target } = clickLink(href);
		const view = { hasFocus: () => false };

		events.pointerdown(view, { target } as unknown as MouseEvent);
		expect(
			events.click(view, { target, preventDefault } as unknown as MouseEvent),
		).toBe(true);
		expect(postMessage).toHaveBeenCalledWith(expect.stringContaining(href));
		expect(preventDefault).toHaveBeenCalledOnce();
	});

	it("leaves a focused tap to ProseMirror for cursor placement", () => {
		const events = tapHandlers();
		const { postMessage, preventDefault, target } = clickLink(
			"tolaria://wikilink/Note",
		);
		const view = { hasFocus: () => true };

		events.pointerdown(view, { target } as unknown as MouseEvent);
		expect(
			events.click(view, { target, preventDefault } as unknown as MouseEvent),
		).toBe(false);
		expect(postMessage).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
	});
});
