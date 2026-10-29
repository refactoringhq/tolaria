import {
	BridgeExtension,
	LinkBridge,
	Plugin,
	TenTapStartKit,
} from "@10play/tentap-editor/web";
import { mobileWikilinkHref } from "../../workspace/mobileWikilinks";
import { MobileWysiwygHorizontalRule } from "./MobileWysiwygHorizontalRule";
import { mobileWysiwygLinkActionType } from "./mobileWysiwygLinkRouting";

type LinkValidationContext = { defaultValidate: (url: string) => boolean };

function allowsMobileLink(url: string, context: LinkValidationContext) {
	const prefix = mobileWikilinkHref("");
	return (
		(url.startsWith(prefix) && url.length > prefix.length) ||
		context.defaultValidate(url)
	);
}

const horizontalRule = new BridgeExtension({
	tiptapExtension: MobileWysiwygHorizontalRule,
});

// Configure the web schema itself: native bridge configuration is injected separately.
export function mobileWikilinkStartKit() {
	const link = new BridgeExtension({
		...LinkBridge,
		tiptapExtension: LinkBridge.tiptapExtension?.extend({
			addOptions() {
				return { ...this.parent?.(), isAllowedUri: allowsMobileLink };
			},
			addProseMirrorPlugins() {
				return [
					...(this.parent?.() ?? []),
					new Plugin({
						props: {
							handleDOMEvents: {
								contextmenu: (_view, event) => handleMobileLinkContextMenu(event),
							},
						},
					}),
				];
			},
		}),
	});
	return [
		...TenTapStartKit.map((bridge) =>
			bridge.name === LinkBridge.name ? link : bridge,
		),
		horizontalRule,
	];
}

type NativeWebViewWindow = Window & {
	ReactNativeWebView?: { postMessage: (message: string) => void };
};

export function handleMobileLinkContextMenu(event: MouseEvent): boolean {
 const target = event.target as (Element & { parentElement?: Element | null }) | null;
 const anchor = (typeof target?.closest === "function" ? target.closest("a[href]") : null)
  ?? target?.parentElement?.closest("a[href]");
	const href = anchor?.getAttribute("href");
	const webView = (window as NativeWebViewWindow).ReactNativeWebView;
	if (!href || !webView) return false;

	webView.postMessage(JSON.stringify({
		type: "action",
		payload: { type: mobileWysiwygLinkActionType, payload: { href } },
	}));
	event.preventDefault();
	return true;
}
