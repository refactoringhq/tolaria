import {
	BridgeExtension,
	LinkBridge,
	TenTapStartKit,
} from "@10play/tentap-editor/web";
import { mobileWikilinkHref } from "../../workspace/mobileWikilinks";
import { MobileWysiwygHorizontalRule } from "./MobileWysiwygHorizontalRule";

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
		}),
	});
	return [
		...TenTapStartKit.map((bridge) =>
			bridge.name === LinkBridge.name ? link : bridge,
		),
		horizontalRule,
	];
}
