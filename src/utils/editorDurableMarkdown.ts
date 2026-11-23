import {
	hasCalloutBlocks,
	isCalloutBlock,
	serializeCalloutBlock,
} from "./calloutMarkdown";
import {
	hasDurableMarkdownBlocks,
	injectDurableMarkdownBlocks,
	type MarkdownSerializer,
	preProcessDurableMarkdownBlocks,
	serializeDurableMarkdownBlocks,
} from "./durableMarkdownBlocks";
import {
	hasFileAttachmentBlocks,
	injectFileAttachmentBlocks,
	preProcessFileAttachmentMarkdown,
	serializeFileAttachmentBlocks,
} from "./fileAttachmentMarkdown";
import { htmlBlockMarkdownCodec } from "./htmlBlockMarkdown";
import { restoreMarkdownHighlightsInBlocks } from "./markdownHighlightMarkdown";
import { serializeMathAwareBlocks } from "./mathMarkdown";
import { mermaidMarkdownCodec } from "./mermaidMarkdown";
import { tldrawMarkdownCodec } from "./tldrawMarkdown";

const EDITOR_DURABLE_MARKDOWN_CODECS = [
	htmlBlockMarkdownCodec,
	mermaidMarkdownCodec,
	tldrawMarkdownCodec,
] as const;

export function preProcessDurableEditorMarkdown({
	markdown,
	vaultPath,
}: {
	markdown: string;
	vaultPath?: string;
}): string {
	const withDurableBlocks = preProcessDurableMarkdownBlocks({
		markdown,
		codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
	});
	return preProcessFileAttachmentMarkdown({
		markdown: withDurableBlocks,
		vaultPath,
	});
}

export function injectDurableEditorMarkdownBlocks(
	blocks: unknown[],
): unknown[] {
	const withDurableBlocks = injectDurableMarkdownBlocks({
		blocks,
		codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
	});
	return injectFileAttachmentBlocks(withDurableBlocks);
}

function serializeCalloutAndMathAwareBlocks(
	editor: MarkdownSerializer,
	blocks: unknown[],
): string {
	const chunks: string[] = [];
	let pending: unknown[] = [];

	const flushPending = () => {
		if (pending.length === 0) return;
		const restored = restoreMarkdownHighlightsInBlocks(pending);
		const markdown = serializeMathAwareBlocks(editor, restored).trimEnd();
		if (markdown) chunks.push(markdown);
		pending = [];
	};

	for (const block of blocks) {
		if (isCalloutBlock(block as Parameters<typeof isCalloutBlock>[0])) {
			flushPending();
			const [restoredCallout] = restoreMarkdownHighlightsInBlocks([block]);
			chunks.push(
				serializeCalloutBlock(
					editor,
					restoredCallout as Parameters<typeof serializeCalloutBlock>[1],
				),
			);
		} else {
			pending.push(block);
		}
	}
	flushPending();
	return chunks.join("\n\n");
}

export function serializeDurableEditorBlocks(
	editor: MarkdownSerializer,
	blocks: unknown[],
	vaultPath?: string,
): string {
	return serializeFileAttachmentBlocks({
		blocks,
		vaultPath,
		serializeOrdinaryBlocks: (ordinaryBlocks) =>
			serializeDurableMarkdownBlocks({
				blocks: ordinaryBlocks,
				codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
				serializeOrdinaryBlocks: (durableOrdinaryBlocks) =>
					serializeCalloutAndMathAwareBlocks(editor, durableOrdinaryBlocks),
			}),
	});
}

export function hasDurableEditorBlocks(blocks: unknown[]): boolean {
	return (
		hasCalloutBlocks(blocks) ||
		hasFileAttachmentBlocks(blocks) ||
		hasDurableMarkdownBlocks({
			blocks,
			codecs: EDITOR_DURABLE_MARKDOWN_CODECS,
		})
	);
}
