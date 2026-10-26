import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { schema } from "../components/editorSchema";
import {
	installRichEditorMarkdownSerializer,
	serializeRichEditorDocumentToMarkdown,
} from "../utils/richEditorMarkdown";
import { resolveBlocksForTarget } from "./editorBlockResolution";

describe("real editor Markdown list import", () => {
	it("loads emoji and bold lists as flat items and saves original Markdown bytes", async () => {
		const examples = [
			{
				items: [
					"- 📡 **Distribution** — why MCP is how a lot of products get discovered now",
					'- 🧱 **Why this is harder than it looks** — and why "just wrap the API" fails',
					"- 🛠️ **Design** — how MCP tools are not just API endpoints",
					"- 🔄 **Ops** — the non-obvious production lifecycle (different from a normal backend)",
					"- ✅ **Checklist** — what to do with your team next week",
				],
				itemCount: 5,
			},
			{
				items: [
					"- 🎯 **What a manager is for** — the three jobs that haven't moved.",
					"- 🧹 **What AI takes off your plate** — glue work, status, first drafts.",
					"- 📈 **…and what it puts back on it** — more review, slop, and the AI transition itself.",
					"- 🧭 **Who sets the quality bar now** — slop as feedback, measuring what matters, reviewing the harness.",
					"- 📡 **Visibility is not understanding** — why summaries don't replace talking to people.",
					"- 🛠️ **What to do with the space that's left** — a small model for the time AI frees up.",
				],
				itemCount: 6,
			},
		];

		for (const { items, itemCount } of examples) {
			const list = [...items, "", "Let's dive in!"].join("\n");
			const source = `${"Context paragraph for a long note. ".repeat(600)}\n\n${list}`;
			const path = `/vault/list-${itemCount}.md`;
			const editor = BlockNoteEditor.create({ schema });
			installRichEditorMarkdownSerializer(editor);
			const { blocks } = await resolveBlocksForTarget({
				editor,
				cache: new Map(),
				content: source,
				targetPath: path,
			});
			editor.replaceBlocks(editor.document, blocks);

			expect(blocks.slice(-itemCount - 1).map((block) => block.type)).toEqual([
				...Array.from({ length: itemCount }, () => "bulletListItem"),
				"paragraph",
			]);
			expect(
				serializeRichEditorDocumentToMarkdown({
					editor,
					tabContent: source,
					notePath: path,
				}),
			).toBe(source);
		}
	});
});
