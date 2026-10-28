import { Node, nodeInputRule } from "@tiptap/core";

export const MobileWysiwygHorizontalRule = Node.create({
	name: "horizontalRule",
	group: "block",
	atom: true,
	parseHTML: () => [{ tag: "hr" }],
	renderHTML: () => ["hr"],
	addInputRules() {
		return [
			nodeInputRule({ find: /^(?:---|—-|___\s|\*\*\*\s)$/, type: this.type }),
		];
	},
});
