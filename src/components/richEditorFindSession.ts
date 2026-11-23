import type { useCreateBlockNote } from "@blocknote/react";
import type { Mapping } from "@tiptap/pm/transform";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import {
	createRichEditorFindPlugin,
	setRichEditorFindMatches,
} from "./richEditorFind";

type Editor = ReturnType<typeof useCreateBlockNote>["_tiptapEditor"];
type SelectionBookmark = ReturnType<
	ReturnType<
		typeof useCreateBlockNote
	>["_tiptapEditor"]["state"]["selection"]["getBookmark"]
>;

export function useRichEditorFindSession(
	editor: Editor,
	path: string,
	request?: RawEditorFindRequest | null,
) {
	const bookmarkRef = useRef<SelectionBookmark | null>(null);
	const [closedRequestId, setClosedRequestId] = useState<number | null>(null);
	const open = isFindRequestOpen(request, path, closedRequestId);
	useFindPlugin(editor);
	useMapFindBookmark(editor, bookmarkRef);
	useCaptureFindSelection({ editor, bookmarkRef, open, path, request });
	const close = useCloseFind({
		editor,
		bookmarkRef,
		request,
		setClosedRequestId,
	});

	return { bookmarkRef, close, open };
}

function isFindRequestOpen(
	request: RawEditorFindRequest | null | undefined,
	path: string,
	closedId: number | null,
): boolean {
	return Boolean(request && request.path === path && request.id !== closedId);
}

function useFindPlugin(editor: Editor): void {
	useEffect(() => {
		const plugin = createRichEditorFindPlugin();
		editor.registerPlugin(plugin);
		return () => {
			editor.unregisterPlugin(plugin);
		};
	}, [editor]);
}

function useMapFindBookmark(
	editor: Editor,
	bookmarkRef: React.MutableRefObject<SelectionBookmark | null>,
): void {
	useEffect(() => {
		const onTransaction = ({
			transaction,
		}: {
			transaction: { docChanged: boolean; mapping: Mapping };
		}) => {
			if (transaction.docChanged && bookmarkRef.current)
				bookmarkRef.current = bookmarkRef.current.map(transaction.mapping);
		};
		editor.on("transaction", onTransaction);
		return () => editor.off("transaction", onTransaction);
	}, [bookmarkRef, editor]);
}

function useCaptureFindSelection({
	editor,
	bookmarkRef,
	open,
	path,
	request,
}: {
	editor: Editor;
	bookmarkRef: React.MutableRefObject<SelectionBookmark | null>;
	open: boolean;
	path: string;
	request?: RawEditorFindRequest | null;
}): void {
	useEffect(() => {
		if (open && request?.path === path)
			bookmarkRef.current = editor.state.selection.getBookmark();
	}, [bookmarkRef, editor, open, path, request]);
}

function useCloseFind({
	editor,
	bookmarkRef,
	request,
	setClosedRequestId,
}: {
	editor: Editor;
	bookmarkRef: React.MutableRefObject<SelectionBookmark | null>;
	request?: RawEditorFindRequest | null;
	setClosedRequestId: React.Dispatch<React.SetStateAction<number | null>>;
}) {
	return useCallback(() => {
		setRichEditorFindMatches(editor, [], -1);
		if (request) setClosedRequestId(request.id);
		if (bookmarkRef.current) restoreBookmark(editor, bookmarkRef.current);
		editor.view.focus();
		bookmarkRef.current = null;
	}, [bookmarkRef, editor, request, setClosedRequestId]);
}

function restoreBookmark(editor: Editor, bookmark: SelectionBookmark): void {
	try {
		editor.view.dispatch(
			editor.state.tr.setSelection(bookmark.resolve(editor.state.doc)),
		);
	} catch {
		// A stale selection can occur after a remote change; the editor still receives focus.
	}
}
