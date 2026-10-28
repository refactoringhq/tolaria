import { getSchema, Node } from "@tiptap/core";
import { expect, it, vi } from "vitest";
import { tiptapJsonToMobileMarkdown } from "../../workspace/mobileDocumentContent";
import { mobileMarkdownBodyToTentapHtml } from "../../workspace/mobileMarkdownHtmlBlocks";
import { MobileWysiwygSlashBridge } from "./MobileWysiwygSlashBridge";

vi.mock("@10play/tentap-editor/web", () => {
	const linkBridge = {
		name: "link",
		tiptapExtension: {
			extend: (config: unknown) => ({ name: "link", config }),
		},
	};

	class BridgeExtension {
		name: string;
		tiptapExtension: unknown;

		constructor({ tiptapExtension }: { tiptapExtension: { name: string } }) {
			this.name = tiptapExtension.name;
			this.tiptapExtension = tiptapExtension;
		}
	}

	return {
		BridgeExtension,
		LinkBridge: linkBridge,
		TenTapStartKit: [linkBridge],
	};
});

import { mobileWikilinkStartKit } from "./MobileWysiwygLinkBridge.web";

it.each(["---", "***", "___"])(
	"parses %s as an editor horizontal rule",
	(markdown) => {
		expect(mobileMarkdownBodyToTentapHtml(markdown)).toBe("<hr>");
	},
);

it("round-trips a schema horizontal rule to Markdown", () => {
	const webBridge = registeredHorizontalRule();
	expect(webBridge.name).toBe("horizontalRule");
	const nativeNode =
		MobileWysiwygSlashBridge.configureTiptapExtensionsOnRunTime().find(
			(extension) => extension.name === "horizontalRule",
		);
	if (!nativeNode)
		throw new Error(
			"The native editor did not register a horizontal-rule node",
		);
	const schema = getSchema([
		Node.create({ name: "doc", topNode: true, content: "block+" }),
		Node.create({ name: "paragraph", group: "block", content: "inline*" }),
		Node.create({ name: "text", group: "inline" }),
		nativeNode,
	]);
	const document = schema.nodeFromJSON({
		type: "doc",
		content: [
			{ type: "paragraph", content: [{ type: "text", text: "Before" }] },
			{ type: "horizontalRule" },
			{ type: "paragraph", content: [{ type: "text", text: "After" }] },
		],
	});

	expect(document.child(1).type.name).toBe("horizontalRule");
	expect(tiptapJsonToMobileMarkdown(document.toJSON())).toBe(
		"Before\n\n---\n\nAfter",
	);
});

function registeredHorizontalRule() {
	const extension = mobileWikilinkStartKit().find(
		(bridge) => bridge.name === "horizontalRule",
	);
	if (!extension?.tiptapExtension) {
		throw new Error(
			"The mobile editor did not register a horizontal-rule bridge",
		);
	}
	return extension;
}
