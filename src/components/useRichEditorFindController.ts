import type { useCreateBlockNote } from "@blocknote/react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	clampEditorFindIndex,
	type EditorFindMatch,
	type EditorFindOptions,
} from "../utils/editorFind";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import {
	findRichEditorMatches,
	selectRichEditorFindMatch,
	setRichEditorFindMatches,
} from "./richEditorFind";
import { useRichEditorFindActions } from "./richEditorFindActions";
import { useRichEditorFindSession } from "./richEditorFindSession";

type Editor = ReturnType<typeof useCreateBlockNote>["_tiptapEditor"];

export function useFindResults({
	editor,
	open,
	query,
	options,
	activeIndex,
}: {
	editor: Editor;
	open: boolean;
	query: string;
	options: EditorFindOptions;
	activeIndex: number;
}) {
	const doc = editor.state.doc;
	const result = useMemo(
		() =>
			open
				? findRichEditorMatches(doc, query, options)
				: { matches: [], error: null },
		[doc, open, options, query],
	);
	const currentIndex = clampEditorFindIndex(activeIndex, result.matches.length);
	const activeMatch = result.matches.at(currentIndex);

	useEffect(() => {
		if (!open) return;
		setRichEditorFindMatches(editor, result.matches, currentIndex);
		if (activeMatch) selectRichEditorFindMatch(editor, activeMatch);
	}, [activeMatch, currentIndex, editor, open, result.matches]);

	return {
		activeIndex: currentIndex,
		activeMatch,
		matches: result.matches,
		error: result.error,
	};
}

export function useDocumentRevision(editor: Editor, enabled: boolean): void {
	const [, setRevision] = useState(0);
	useEffect(() => {
		if (!enabled) return;
		const onTransaction = ({
			transaction,
		}: {
			transaction: { docChanged: boolean };
		}) => {
			if (transaction.docChanged) setRevision((value) => value + 1);
		};
		editor.on("transaction", onTransaction);
		return () => editor.off("transaction", onTransaction);
	}, [editor, enabled]);
}

function useFindOptions(
	caseSensitive: boolean,
	regex: boolean,
): EditorFindOptions {
	return useMemo(() => ({ caseSensitive, regex }), [caseSensitive, regex]);
}

function useReplaceControl(request?: RawEditorFindRequest | null) {
	const [override, setOverride] = useState<{
		id: number;
		open: boolean;
	} | null>(null);
	const open = resolveReplaceOpen(request, override);
	const toggle = useCallback(() => {
		if (request) setOverride({ id: request.id, open: !open });
	}, [open, request]);
	return { open, toggle };
}

function resolveReplaceOpen(
	request: RawEditorFindRequest | null | undefined,
	override: { id: number; open: boolean } | null,
): boolean {
	if (!request) return false;
	return override?.id === request.id ? override.open : request.replace;
}

function useFindKeyHandlers(
	actions: ReturnType<typeof useRichEditorFindActions>,
	close: () => void,
) {
	const handleEnter = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key !== "Enter") return;
			event.preventDefault();
			actions.moveMatch(event.shiftKey ? -1 : 1);
		},
		[actions],
	);
	const handleEscape = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			close();
		},
		[close],
	);
	return { handleEnter, handleEscape };
}

type FindActionsInput = {
	editor: Editor;
	results: ReturnType<typeof useFindResults>;
	query: string;
	replacement: string;
	options: EditorFindOptions;
	setQuery: React.Dispatch<React.SetStateAction<string>>;
	setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
	sessionClose: () => void;
	request?: RawEditorFindRequest | null;
};

function useFindActions(input: FindActionsInput) {
	const {
		editor,
		results,
		query,
		replacement,
		options,
		setQuery,
		setActiveIndex,
		sessionClose,
		request,
	} = input;
	const selectMatch = useCallback(
		(match: EditorFindMatch) => selectRichEditorFindMatch(editor, match),
		[editor],
	);
	const actions = useRichEditorFindActions({
		editor,
		matches: results.matches,
		activeIndex: results.activeIndex,
		activeMatch: results.activeMatch,
		find: { query, replacement, options },
		actions: { setActiveIndex, selectMatch },
	});
	const replace = useReplaceControl(request);
	const changeQuery = useCallback(
		(value: string) => {
			setQuery(value);
			setActiveIndex(0);
		},
		[setActiveIndex, setQuery],
	);
	const keys = useFindKeyHandlers(actions, sessionClose);
	return { actions, changeQuery, keys, replace };
}

type FindControllerViewInput = {
	controls: ReturnType<typeof useFindActions>;
	results: ReturnType<typeof useFindResults>;
	query: string;
	replacement: string;
	caseSensitive: boolean;
	setCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>;
	setQuery: React.Dispatch<React.SetStateAction<string>>;
	setRegex: React.Dispatch<React.SetStateAction<boolean>>;
	setReplacement: React.Dispatch<React.SetStateAction<string>>;
	regex: boolean;
	session: ReturnType<typeof useRichEditorFindSession>;
};

function buildFindControllerView(input: FindControllerViewInput) {
	const {
		controls,
		results,
		query,
		replacement,
		caseSensitive,
		setCaseSensitive,
		setQuery,
		setRegex,
		setReplacement,
		regex,
		session,
	} = input;
	return {
		...controls.actions,
		activeIndex: results.activeIndex,
		caseSensitive,
		changeQuery: controls.changeQuery,
		close: session.close,
		error: results.error,
		...controls.keys,
		hasMatches: results.matches.length > 0 && !results.error,
		matches: results.matches,
		moveNext: controls.actions.moveNext,
		movePrevious: controls.actions.movePrevious,
		open: session.open,
		query,
		regex,
		replaceCurrent: controls.actions.replaceActive,
		replaceOpen: controls.replace.open,
		replacement,
		setCaseSensitive,
		setQuery,
		setRegex,
		setReplacement,
		statusCount: results.matches.length,
		toggleReplace: controls.replace.toggle,
	};
}

export function useRichEditorFindController({
	editor,
	path,
	request,
}: {
	editor: ReturnType<typeof useCreateBlockNote>;
	path: string;
	request?: RawEditorFindRequest | null;
}) {
	const tiptap = editor._tiptapEditor;
	const [query, setQuery] = useState("");
	const [replacement, setReplacement] = useState("");
	const [regex, setRegex] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const options = useFindOptions(caseSensitive, regex);
	const session = useRichEditorFindSession(tiptap, path, request);
	useDocumentRevision(tiptap, session.open);
	const results = useFindResults({
		editor: tiptap,
		open: session.open,
		query,
		options,
		activeIndex,
	});
	const controls = useFindActions({
		editor: tiptap,
		results,
		query,
		replacement,
		options,
		setQuery,
		setActiveIndex,
		sessionClose: session.close,
		request,
	});

	return buildFindControllerView({
		controls,
		results,
		query,
		replacement,
		caseSensitive,
		setCaseSensitive,
		setQuery,
		setRegex,
		setReplacement,
		regex,
		session,
	});
}
