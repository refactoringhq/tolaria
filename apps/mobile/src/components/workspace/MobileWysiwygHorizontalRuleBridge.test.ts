import { getSchema, Node } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { expect, it, vi } from "vitest";
import {
	mobileDocumentBody,
	tiptapJsonToMobileMarkdown,
} from "../../workspace/mobileDocumentContent";
import { mobileMarkdownBodyToTentapHtml } from "../../workspace/mobileMarkdownHtmlBlocks";
import { createMobileEditorDocumentBridge } from "./MobileWysiwygDocumentReads.native";
import {
	nativeWysiwygDocumentContentFromJson,
	nativeWysiwygShouldPublishMutationProof,
} from "./MobileWysiwygDocumentSerialization";
import { MobileWysiwygHorizontalRule } from "./MobileWysiwygHorizontalRule";
import { MobileWysiwygHorizontalRuleBridge } from "./MobileWysiwygHorizontalRuleBridge.native";

vi.mock("@10play/tentap-editor", () => {
	class BridgeExtension {
		name: string;
		tiptapExtension: unknown;

		constructor({
			tiptapExtension,
			forceName,
		}: { tiptapExtension?: { name: string }; forceName?: string }) {
			this.name = forceName ?? tiptapExtension?.name ?? "BridgeExtension";
			this.tiptapExtension = tiptapExtension;
		}

		configureTiptapExtensionsOnRunTime() {
			return [this.tiptapExtension];
		}
	}

	return {
		BridgeExtension,
		CoreBridge: { name: "core", extendEditorInstance: () => ({}) },
		CoreEditorActionType: { EditorReady: "editor-ready" },
	};
});

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
	const [nativeNode] =
		MobileWysiwygHorizontalRuleBridge.configureTiptapExtensionsOnRunTime(
			undefined,
			undefined,
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

it("registers the native allowlist name for the WebView horizontal-rule bridge", () => {
	const nativeNames = createMobileEditorDocumentBridge([]).extensions.map(
		(bridge) => bridge.name,
	);

	expect(nativeNames).toContain(registeredHorizontalRule().name);
});

it("has an input rule that converts a typed horizontal-rule marker", () => {
	const document = applyTypedHorizontalRuleRule();
	expect(document.child(0).type.name).toBe("horizontalRule");
});

it("preserves frontmatter and does not publish a mutation when opening a separator", () => {
	const source = [
		"---",
		"type: Note",
		"---",
		"",
		"Before",
		"",
		"---",
		"",
		"After",
		"",
	].join("\n");
	const body = mobileDocumentBody(source);
	const json = {
		content: [
			{ content: [{ text: "Before", type: "text" }], type: "paragraph" },
			{ type: "horizontalRule" },
			{ content: [{ text: "After", type: "text" }], type: "paragraph" },
		],
		type: "doc",
	};

	expect(body).toBe("\nBefore\n\n---\n\nAfter\n");
	expect(mobileMarkdownBodyToTentapHtml(body)).toContain("<hr>");

	const result = nativeWysiwygDocumentContentFromJson({
		currentContent: source,
		initialBodyHasContent: true,
		isFirstSerialization: true,
		json,
	});

	expect(result.content).toBe(source);
	expect(result.skipped).toBe(true);
	expect(
		nativeWysiwygShouldPublishMutationProof({
			mutationProbeEnabled: true,
			skipped: result.skipped,
		}),
	).toBe(false);
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

function applyTypedHorizontalRuleRule() {
	const schema = getSchema([
		Node.create({ name: "doc", topNode: true, content: "block+" }),
		Node.create({ name: "paragraph", group: "block", content: "inline*" }),
		Node.create({ name: "text", group: "inline" }),
		MobileWysiwygHorizontalRule,
	]);
	const state = EditorState.create({
		doc: schema.node("doc", null, [
			schema.node("paragraph", null, schema.text("---")),
		]),
		schema,
	});
	const rule = createHorizontalRuleInputRule(schema.nodes.horizontalRule);
	const match = rule.find instanceof RegExp ? rule.find.exec("---") : null;
	if (!match) throw new Error("The horizontal-rule marker did not match");
	const transaction = state.tr;
	rule.handler({
		state: { tr: transaction } as EditorState,
		range: { from: 1, to: 4 },
		match,
		commands: {} as never,
		chain: () => ({}) as never,
		can: () => ({}) as never,
	});
	return state.apply(transaction).doc;
}

function createHorizontalRuleInputRule(type: unknown) {
	const addInputRules = MobileWysiwygHorizontalRule.config.addInputRules;
	if (!addInputRules)
		throw new Error("The horizontal-rule input rule is missing");
	const [rule] = addInputRules.call({ type } as never);
	if (!rule) throw new Error("The horizontal-rule input rule is missing");
	return rule;
}
