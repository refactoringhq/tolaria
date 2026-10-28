import {
	BridgeExtension,
	LinkBridge,
	TenTapStartKit,
} from "@10play/tentap-editor/web";
import { Node } from "@tiptap/core";
import { mobileWikilinkHref } from "../../workspace/mobileWikilinks";

type LinkValidationContext = { defaultValidate: (url: string) => boolean };

function allowsMobileLink(url: string, context: LinkValidationContext) {
	const prefix = mobileWikilinkHref("");
	return (
		(url.startsWith(prefix) && url.length > prefix.length) ||
		context.defaultValidate(url)
	);
}

const horizontalRule = new BridgeExtension({
	tiptapExtension: Node.create({
		name: "horizontalRule",
		group: "block",
		atom: true,
		parseHTML: () => [{ tag: "hr" }],
		renderHTML: () => ["hr"],
	}),
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
