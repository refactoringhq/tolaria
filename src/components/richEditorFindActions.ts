import type { useCreateBlockNote } from "@blocknote/react";
import { useCallback } from "react";
import {
	type EditorFindMatch,
	type EditorFindOptions,
	nextEditorFindIndex,
	replacementForEditorFindMatch,
} from "../utils/editorFind";

type Editor = ReturnType<typeof useCreateBlockNote>["_tiptapEditor"];
type SetActiveIndex = React.Dispatch<React.SetStateAction<number>>;

export function useRichEditorFindActions({
	editor,
	matches,
	activeIndex,
	activeMatch,
	find,
	actions,
}: {
	editor: Editor;
	matches: readonly EditorFindMatch[];
	activeIndex: number;
	activeMatch?: EditorFindMatch;
	find: {
		query: string;
		replacement: string;
		options: EditorFindOptions;
	};
	actions: {
		setActiveIndex: SetActiveIndex;
		selectMatch: (match: EditorFindMatch) => void;
	};
}) {
	const { query, replacement, options } = find;
	const { setActiveIndex, selectMatch } = actions;
	const moveMatch = useCallback(
		(direction: 1 | -1) => {
			const index = nextEditorFindIndex(activeIndex, matches.length, direction);
			setActiveIndex(index);
			const match = matches[index];
			if (match) selectMatch(match);
		},
		[activeIndex, matches, selectMatch, setActiveIndex],
	);

	const replaceMatch = useCallback(
		(match: EditorFindMatch) => {
			const text = replacementForEditorFindMatch(
				match,
				query,
				replacement,
				options,
			);
			editor.view.dispatch(
				editor.state.tr.insertText(text, match.from, match.to),
			);
		},
		[editor, options, query, replacement],
	);

	const replaceCurrent = useCallback(
		(match?: EditorFindMatch) => {
			if (match) replaceMatch(match);
		},
		[replaceMatch],
	);

	const replaceActive = useCallback(
		() => replaceCurrent(activeMatch),
		[activeMatch, replaceCurrent],
	);
	const moveNext = useCallback(() => moveMatch(1), [moveMatch]);
	const movePrevious = useCallback(() => moveMatch(-1), [moveMatch]);

	const replaceAll = useCallback(() => {
		const transaction = createReplaceAllTransaction({
			editor,
			matches,
			query,
			replacement,
			options,
		});
		if (!transaction) return;
		editor.view.dispatch(transaction);
		setActiveIndex(0);
	}, [editor, matches, options, query, replacement, setActiveIndex]);

	return {
		moveMatch,
		moveNext,
		movePrevious,
		replaceActive,
		replaceAll,
		replaceCurrent,
	};
}

function createReplaceAllTransaction({
	editor,
	matches,
	query,
	replacement,
	options,
}: {
	editor: Editor;
	matches: readonly EditorFindMatch[];
	query: string;
	replacement: string;
	options: EditorFindOptions;
}) {
	if (!matches.length) return null;
	return matches
		.slice()
		.reverse()
		.reduce((transaction, match) => {
			const text = replacementForEditorFindMatch(
				match,
				query,
				replacement,
				options,
			);
			return transaction.insertText(text, match.from, match.to);
		}, editor.state.tr);
}
