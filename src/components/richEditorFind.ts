import type { useCreateBlockNote } from "@blocknote/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
	type EditorFindMatch,
	type EditorFindOptions,
	findEditorMatches,
} from "../utils/editorFind";

type FindPluginState = DecorationSet;
type FindPluginMeta = {
	matches: readonly EditorFindMatch[];
	activeIndex: number;
};
type TiptapEditor = ReturnType<typeof useCreateBlockNote>["_tiptapEditor"];
const richEditorFindKey = new PluginKey<FindPluginState>(
	"tolariaRichEditorFind",
);

export function shouldKeepFindInEditorMode(
	isDesktop: boolean,
	rawMode: boolean,
): boolean {
	return isDesktop && !rawMode;
}

export function shouldSwitchFindToRaw(
	isDesktop: boolean,
	rawMode: boolean,
): boolean {
	return !isDesktop && !rawMode;
}

function decorationsFor(
	doc: ProseMirrorNode,
	{ matches, activeIndex }: FindPluginMeta,
): DecorationSet {
	const decorations = matches.map((match, index) =>
		Decoration.inline(match.from, match.to, {
			class:
				index === activeIndex
					? "rich-editor-find-match rich-editor-find-match--current"
					: "rich-editor-find-match",
			style:
				index === activeIndex
					? "background-color: var(--feedback-warning-bg); color: inherit; outline: 2px solid var(--accent-yellow); border-radius: 2px"
					: "background-color: var(--feedback-warning-bg); color: inherit; border-radius: 2px",
		}),
	);
	return DecorationSet.create(doc, decorations);
}

export function createRichEditorFindPlugin(): Plugin<FindPluginState> {
	return new Plugin({
		key: richEditorFindKey,
		state: {
			init: () => DecorationSet.empty,
			apply(transaction, decorations) {
				const meta = transaction.getMeta(richEditorFindKey) as
					| FindPluginMeta
					| undefined;
				if (meta) return decorationsFor(transaction.doc, meta);
				return decorations.map(transaction.mapping, transaction.doc);
			},
		},
		props: {
			decorations(state) {
				return richEditorFindKey.getState(state) ?? DecorationSet.empty;
			},
		},
	});
}

export function setRichEditorFindMatches(
	editor: TiptapEditor,
	matches: readonly EditorFindMatch[],
	activeIndex: number,
): void {
	editor.view.dispatch(
		editor.state.tr.setMeta(richEditorFindKey, {
			matches,
			activeIndex,
		} satisfies FindPluginMeta),
	);
}

export function findRichEditorMatches(
	doc: ProseMirrorNode,
	query: string,
	options: EditorFindOptions,
): { error: string | null; matches: EditorFindMatch[] } {
	const matches: EditorFindMatch[] = [];
	let error: string | null = null;

	doc.descendants((block, blockPosition) => {
		if (!block.isTextblock) return true;
		const result = findRichEditorBlockMatches(
			block,
			blockPosition,
			query,
			options,
		);
		error ??= result.error;
		matches.push(...result.matches);
		return false;
	});

	return { error, matches };
}

function findRichEditorBlockMatches(
	block: ProseMirrorNode,
	blockPosition: number,
	query: string,
	options: EditorFindOptions,
): { error: string | null; matches: EditorFindMatch[] } {
	const accumulator = {
		blockPosition,
		positions: [] as number[],
		textParts: [] as string[],
	};
	block.descendants((node, position) => {
		appendFindText(node, position, accumulator);
		return false;
	});
	const result = findEditorMatches(
		accumulator.textParts.join(""),
		query,
		options,
	);
	const matches = mapFindMatchPositions(result.matches, accumulator.positions);
	return { error: result.error, matches };
}

function appendFindText(
	node: ProseMirrorNode,
	position: number,
	accumulator: {
		blockPosition: number;
		positions: number[];
		textParts: string[];
	},
): void {
	const nodeText = node.isText
		? (node.text ?? "")
		: node.isInline
			? "\u0000"
			: "";
	accumulator.textParts.push(nodeText);
	for (let offset = 0; offset < nodeText.length; offset += 1) {
		accumulator.positions.push(
			node.isText ? accumulator.blockPosition + 1 + position + offset : -1,
		);
	}
}

function mapFindMatchPositions(
	sourceMatches: readonly EditorFindMatch[],
	positions: readonly number[],
): EditorFindMatch[] {
	return sourceMatches.flatMap((match) => {
		const from = positions[match.from];
		const lastPosition = positions[match.to - 1];
		if (from === undefined || lastPosition === undefined) return [];
		if (isOutsideTextPosition(from) || isOutsideTextPosition(lastPosition))
			return [];
		return [{ from, to: lastPosition + 1, text: match.text }];
	});
}

function isOutsideTextPosition(position: number): boolean {
	return position < 0;
}

export function selectRichEditorFindMatch(
	editor: TiptapEditor,
	match: EditorFindMatch,
	focusEditor = false,
): void {
	editor.view.dispatch(
		editor.state.tr
			.setSelection(
				TextSelection.create(editor.state.doc, match.from, match.to),
			)
			.scrollIntoView(),
	);
	if (focusEditor) editor.view.focus();
}
