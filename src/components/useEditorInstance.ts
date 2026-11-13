import { useCreateBlockNote } from "@blocknote/react";
import { type MutableRefObject, useEffect } from "react";
import {
	emptyImageUploadResult,
	isUnsupportedImageFormatError,
	type UploadImageFileResult,
	uploadImageFile,
} from "../hooks/useImageDrop";
import type { AppLocale } from "../lib/i18n";
import { localPresenceUser } from "../lib/presenceIdentity";
import { RUNTIME_STYLE_NONCE } from "../lib/runtimeStyleNonce";
import { installRichEditorMarkdownSerializer } from "../utils/richEditorMarkdown";
import { renderCollabCursor } from "./collabCursor";
import type { CollabEditorBinding } from "./collabEditorBinding";
import {
	applyBlockNoteLocale,
	createBlockNoteDictionary,
} from "./editorLocalization";
import { schema } from "./editorSchema";
import { createImeCompositionKeyGuardExtension } from "./imeCompositionKeyGuardExtension";
import { createMarkdownHighlightShortcutExtension } from "./markdownHighlightShortcutExtension";
import { RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS } from "./richEditorBlockNoteOptions";
import { createRichEditorBlockSelectionExtension } from "./richEditorBlockSelectionExtension";
import { createRichEditorCodeBlockArrowNavigationExtension } from "./richEditorCodeBlockArrowNavigationExtension";
import { createRichEditorCodeBlockShortcutExtension } from "./richEditorCodeBlockShortcutExtension";
import { createRichEditorCodeBlockTabExtension } from "./richEditorCodeBlockTabExtension";
import { installRichEditorDispatchPerformanceProbe } from "./richEditorDispatchPerformance";
import { createRichEditorEmptyListNavigationExtension } from "./richEditorEmptyListNavigationExtension";
import { createRichEditorMarkdownInputTransformExtension } from "./richEditorInputTransformExtension";
import { createRichEditorListTabExtension } from "./richEditorListTabExtension";
import { handleRemoteRichEditorPaste } from "./richEditorPaste";
import { createRichEditorTextDirectionExtension } from "./richEditorTextDirection";
import { createRichEditorTransformErrorRecoveryExtension } from "./richEditorTransformErrorRecoveryExtension";
import { createTodoBlockShortcutExtension } from "./todoBlockShortcutExtension";
import type { ImageImportErrorHandler } from "./useEditorSetup";

const EDITOR_BIDI_DOM_ATTRIBUTES = {
	blockContent: { dir: "auto" },
	inlineContent: { dir: "auto" },
};

function collaborationOptions(binding: CollabEditorBinding) {
	if (binding.kind !== "bound") return undefined;
	return {
		fragment: binding.doc.fragment,
		provider: binding.doc.provider,
		user: localPresenceUser(binding.doc.doc.clientID),
		showCursorLabels: "activity" as const,
		renderCursor: renderCollabCursor,
	};
}

function imageUploadFailure(
	file: File,
	error: unknown,
	onError: ImageImportErrorHandler | undefined,
): UploadImageFileResult {
	if (!isUnsupportedImageFormatError(error)) throw error;
	onError?.(error);
	return emptyImageUploadResult(file);
}

interface EditorInstanceOptions {
	collabBinding: CollabEditorBinding;
	locale?: AppLocale;
	vaultPathRef: MutableRefObject<string | undefined>;
	activeTabPathRef: MutableRefObject<string | null>;
	onImageImportErrorRef: MutableRefObject<ImageImportErrorHandler | undefined>;
}

export function useEditorInstance({
	collabBinding,
	locale,
	vaultPathRef,
	activeTabPathRef,
	onImageImportErrorRef,
}: EditorInstanceOptions) {
	const editor = useCreateBlockNote({
		...RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS,
		schema,
		domAttributes: EDITOR_BIDI_DOM_ATTRIBUTES,
		dictionary: createBlockNoteDictionary(locale),
		collaboration: collaborationOptions(collabBinding),
		uploadFile: async (file: File) => {
			try {
				return await uploadImageFile(file, vaultPathRef.current);
			} catch (error) {
				return imageUploadFailure(file, error, onImageImportErrorRef.current);
			}
		},
		pasteHandler: (context) => {
			const pastePath = activeTabPathRef.current;
			return handleRemoteRichEditorPaste(context, {
				canApply: () => activeTabPathRef.current === pastePath,
				vaultPath: vaultPathRef.current,
				onImportResult: ({ failedCount, totalCount }) => {
					if (failedCount > 0) {
						onImageImportErrorRef.current?.({
							failedCount,
							kind: "remote-download",
							totalCount,
						});
					}
				},
			});
		},
		tabBehavior: "prefer-indent",
		_tiptapOptions: { injectNonce: RUNTIME_STYLE_NONCE },
		extensions: [
			createRichEditorTransformErrorRecoveryExtension(),
			createImeCompositionKeyGuardExtension(),
			createRichEditorCodeBlockArrowNavigationExtension(),
			createRichEditorEmptyListNavigationExtension(),
			createRichEditorCodeBlockTabExtension(),
			createRichEditorListTabExtension(),
			createRichEditorCodeBlockShortcutExtension(),
			createMarkdownHighlightShortcutExtension(),
			createTodoBlockShortcutExtension(),
			createRichEditorMarkdownInputTransformExtension(),
			createRichEditorTextDirectionExtension(),
			createRichEditorBlockSelectionExtension(),
		],
	});
	applyBlockNoteLocale(editor, locale);
	installRichEditorMarkdownSerializer(editor);
	useEffect(() => {
		installRichEditorDispatchPerformanceProbe(
			editor,
			() => activeTabPathRef.current,
		);
	}, [activeTabPathRef, editor]);
	return editor;
}
