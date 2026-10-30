import { describe, expect, it, vi } from "vitest";
import type { TiptapJsonNode } from "../../workspace/mobileDocumentContent";
import {
	nativeWysiwygDocumentContentFromJson,
	nativeWysiwygShouldPublishMutationProof,
	persistAcceptedNativeEditorSerialization,
} from "./MobileWysiwygDocumentSerialization";

describe("native WYSIWYG document serialization", () => {
	it("does not persist editor serialization until a content edit is accepted", () => {
		const persist = vi.fn();
		const acceptedChange = { current: false };

		persistAcceptedNativeEditorSerialization(acceptedChange.current, persist);
		expect(persist).not.toHaveBeenCalled();

		acceptedChange.current = true;
		const acceptedAtRead = acceptedChange.current;
		acceptedChange.current = false;
		persistAcceptedNativeEditorSerialization(acceptedAtRead, persist);
		expect(persist).toHaveBeenCalledOnce();
	});

	it("preserves raw frontmatter while replacing the editable document body", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: [
				"---",
				"# Desktop comments and formatting stay untouched.",
				"type: Essay",
				'aliases: ["Mobile, UI", "Tablet"]',
				"---",
				"# Old title",
				"",
			].join("\n"),
			initialBodyHasContent: true,
			isFirstSerialization: false,
			json: documentNode(
				headingNode(1, "Workflow Orchestration Essay"),
				paragraphNode("Updated body."),
			),
		});

		expect(result).toEqual({
			content: [
				"---",
				"# Desktop comments and formatting stay untouched.",
				"type: Essay",
				'aliases: ["Mobile, UI", "Tablet"]',
				"---",
				"# Workflow Orchestration Essay",
				"",
				"Updated body.",
				"",
			].join("\n"),
			markdown: ["# Workflow Orchestration Essay", "", "Updated body."].join(
				"\n",
			),
			skipped: false,
		});
	});

	it("does not invent a title when the native editor saves body-only notes", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: "Paragraph without title.\n",
			initialBodyHasContent: true,
			isFirstSerialization: false,
			json: documentNode(paragraphNode("Body still has no H1.")),
		});

		expect(result.content).toBe("Body still has no H1.\n");
	});

	it("preserves portable attachment links when native TenTap saves file URIs", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: "Original body.\n",
			initialBodyHasContent: true,
			isFirstSerialization: false,
			json: documentNode({
				type: "paragraph",
				content: [
					{
						marks: [
							{
								attrs: {
									href: "file:///vault/root/attachments/project%20brief.pdf",
								},
								type: "link",
							},
						],
						text: "project brief.pdf",
						type: "text",
					},
				],
			}),
			vaultRootUri: "file:///vault/root/",
		});

		expect(result.content).toBe(
			"[project brief.pdf](<attachments/project brief.pdf>)\n",
		);
	});

	it("saves native aligned table cells without losing desktop divider syntax", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: alignedTableDocumentSource(),
			initialBodyHasContent: true,
			isFirstSerialization: false,
			json: documentNode({
				content: [
					{
						content: [
							{
								attrs: { tolariaAlignment: "left" },
								content: [{ text: "Surface", type: "text" }],
								type: "tableHeader",
							},
							{
								attrs: { tolariaAlignment: "right" },
								content: [{ text: "Target", type: "text" }],
								type: "tableHeader",
							},
						],
						type: "tableRow",
					},
					{
						content: [
							{
								attrs: { tolariaAlignment: "left" },
								content: [{ text: "Editor", type: "text" }],
								type: "tableCell",
							},
							{
								attrs: { tolariaAlignment: "right" },
								content: [{ text: "WYSIWYG", type: "text" }],
								type: "tableCell",
							},
						],
						type: "tableRow",
					},
				],
				type: "table",
			}),
		});

		expect(result.content).toBe(alignedTableDocumentSource());
		expect(result.markdown).toBe(
			["| Surface | Target |", "| :--- | ---: |", "| Editor | WYSIWYG |"].join(
				"\n",
			),
		);
	});

	it("keeps source-backed horizontal rules editable as markdown lines", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: "---\n",
			initialBodyHasContent: true,
			isFirstSerialization: false,
			json: documentNode(paragraphNode("---")),
		});

		expect(result.content).toBe("---\n");
	});

	it("skips the first empty native serialization for hydrated documents", () => {
		const result = nativeWysiwygDocumentContentFromJson({
			currentContent: "# Existing body\n\nKeep me.\n",
			initialBodyHasContent: true,
			isFirstSerialization: true,
			json: documentNode(),
		});

		expect(result).toEqual({
			content: "# Existing body\n\nKeep me.\n",
			markdown: "",
			skipped: true,
		});
	});

	it.each([
		{
			currentBody: "Existing body",
			currentTitle: "Existing title",
			expected: {
				content: "# Existing title\n\nExisting body",
				markdown: "# Existing title\n\nExisting body",
				skipped: true,
			},
			nextBody: "Existing body",
			nextTitle: "Existing title",
			scenario: "preserves exact source when only a terminal newline differs",
		},
		{
			currentBody: "Existing body",
			currentTitle: "Existing title",
			expected: {
				content: "# Updated title\n\nUpdated body\n",
				markdown: "# Updated title\n\nUpdated body",
				skipped: false,
			},
			nextBody: "Updated body",
			nextTitle: "Updated title",
			scenario: "serializes real edits immediately",
		},
	])(
		"$scenario on first serialization",
		({ currentBody, currentTitle, expected, nextBody, nextTitle }) => {
			expect(
				serializeInitialDocument({
					currentTitle,
					currentBody,
					nextTitle,
					nextBody,
				}),
			).toEqual(expected);
		},
	);

	it("publishes mutation QA proofs for every non-skipped serialization", () => {
		expect(
			nativeWysiwygShouldPublishMutationProof({
				mutationProbeEnabled: true,
				skipped: false,
			}),
		).toBe(true);
		expect(
			nativeWysiwygShouldPublishMutationProof({
				mutationProbeEnabled: true,
				skipped: true,
			}),
		).toBe(false);
		expect(
			nativeWysiwygShouldPublishMutationProof({
				mutationProbeEnabled: false,
				skipped: false,
			}),
		).toBe(false);
	});
});

function documentNode(...content: TiptapJsonNode[]): TiptapJsonNode {
	return { content, type: "doc" };
}

function serializeInitialDocument({
	currentBody,
	currentTitle,
	nextBody,
	nextTitle,
}: {
	currentBody: string;
	currentTitle: string;
	nextBody: string;
	nextTitle: string;
}) {
	return nativeWysiwygDocumentContentFromJson({
		currentContent: `# ${currentTitle}\n\n${currentBody}`,
		initialBodyHasContent: true,
		isFirstSerialization: true,
		json: documentNode(headingNode(1, nextTitle), paragraphNode(nextBody)),
	});
}

function headingNode(level: number, text: string): TiptapJsonNode {
	return {
		attrs: { level },
		content: [{ text, type: "text" }],
		type: "heading",
	};
}

function paragraphNode(...lines: string[]): TiptapJsonNode {
	return {
		content: lines.flatMap((line, index): TiptapJsonNode[] => [
			...(index > 0 ? [{ type: "hardBreak" }] : []),
			...(line ? [{ text: line, type: "text" }] : []),
		]),
		type: "paragraph",
	};
}

function alignedTableDocumentSource(): string {
	return [
		"| Surface | Target |",
		"| :--- | ---: |",
		"| Editor | WYSIWYG |",
		"",
	].join("\n");
}
