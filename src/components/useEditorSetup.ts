import { useCreateBlockNote } from "@blocknote/react";
import { useCallback, useEffect, useRef } from "react";
import { type CommitDiffRequest, useDiffMode } from "../hooks/useDiffMode";
import { useEditorFocus } from "../hooks/useEditorFocus";
import { useEditorTabSwap } from "../hooks/useEditorTabSwap";
import {
	emptyImageUploadResult,
	type ImageImportError,
	isUnsupportedImageFormatError,
	type UploadImageFileResult,
	uploadImageFile,
} from "../hooks/useImageDrop";
import { localPresenceUser } from "../lib/presenceIdentity";
import { RUNTIME_STYLE_NONCE } from "../lib/runtimeStyleNonce";
import { markStartupPhase } from "../lib/startupPerformance";
import type { NoteStatus, VaultEntry } from "../types";
import { installRichEditorMarkdownSerializer } from "../utils/richEditorMarkdown";
import { renderCollabCursor } from "./collabCursor";
import {
	type CollabEditorBinding,
	useLiveTitleReporter,
} from "./collabEditorBinding";
import {
	applyBlockNoteLocale,
	createBlockNoteDictionary,
} from "./editorLocalization";
import {
	type PendingRawExitContent,
	resolvePendingRawExitContent,
	resolveRawModeContent,
} from "./editorRawModeSync";
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
import { useFilenameAutolinkGuard } from "./useFilenameAutolinkGuard";
import { useLiveRawContentSource } from "./useLiveRawContentSource";
import { useRawModeWithFlush } from "./useRawModeWithFlush";
import {
	useRichEditorContentReadiness,
	useRichEditorSheetSwapState,
} from "./useRichEditorSheetTransition";

const RICH_EDITOR_BIDI_DOM_ATTRIBUTES = {
	blockContent: { dir: "auto" },
	inlineContent: { dir: "auto" },
};

export interface Tab {
	entry: VaultEntry;
	content: string;
}

export type ImageImportErrorHandler = (error: ImageImportError) => void;

export function useEditorModeExclusion({
	diffMode,
	rawMode,
	handleToggleDiff,
	handleToggleRaw,
	rawToggleRef,
	diffToggleRef,
}: {
	diffMode: boolean;
	rawMode: boolean;
	handleToggleDiff: () => void | Promise<void>;
	handleToggleRaw: () => void;
	rawToggleRef?: React.MutableRefObject<() => void>;
	diffToggleRef?: React.MutableRefObject<() => void>;
}) {
	const handleToggleDiffExclusive = useCallback(async () => {
		if (!diffMode && rawMode) handleToggleRaw();
		await handleToggleDiff();
	}, [diffMode, rawMode, handleToggleDiff, handleToggleRaw]);

	const handleToggleRawExclusive = useCallback(() => {
		if (!rawMode && diffMode) handleToggleDiff();
		handleToggleRaw();
	}, [rawMode, diffMode, handleToggleDiff, handleToggleRaw]);

	useEffect(() => {
		if (rawToggleRef) rawToggleRef.current = handleToggleRawExclusive;
	}, [rawToggleRef, handleToggleRawExclusive]);

	useEffect(() => {
		if (diffToggleRef) diffToggleRef.current = handleToggleDiffExclusive;
	}, [diffToggleRef, handleToggleDiffExclusive]);

	return { handleToggleDiffExclusive, handleToggleRawExclusive };
}

interface EditorSetupParams {
	tabs: Tab[];
	activeTabPath: string | null;
	vaultPath?: string;
	collabBinding: CollabEditorBinding;
	onContentChange?: (path: string, content: string) => void;
	onLoadDiff?: (path: string) => Promise<string>;
	onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>;
	pendingCommitDiffRequest?: CommitDiffRequest | null;
	onPendingCommitDiffHandled?: (requestId: number) => void;
	getNoteStatus?: (path: string) => NoteStatus;
	rawToggleRef?: React.MutableRefObject<() => void>;
	diffToggleRef?: React.MutableRefObject<() => void>;
	onImageImportError?: ImageImportErrorHandler;
	locale?: import("../lib/i18n").AppLocale;
}

const NO_SWAP_TABS: Tab[] = [];

/** The collaboration option of a bound editor: BlockNote edits the live document. */
function blockNoteCollaboration(binding: CollabEditorBinding) {
	if (binding.kind !== "bound") return undefined;
	return {
		fragment: binding.doc.fragment,
		provider: binding.doc.provider,
		user: localPresenceUser(binding.doc.doc.clientID),
		// A name shows while its person types or moves, then folds back to the caret.
		showCursorLabels: "activity" as const,
		renderCursor: renderCollabCursor,
	};
}

type EditorTabSwapOptions = Parameters<typeof useEditorTabSwap>[0];

/**
 * The content raw mode leaves behind stands in for the tab until the tab catches up. A bound
 * note's tab never does: its edits went into the live document, which the editor shows.
 */
function useDropLiveRawExitContent(
	binding: CollabEditorBinding,
	pendingRawExitContent: PendingRawExitContent | null,
	setPendingRawExitContent: (next: PendingRawExitContent | null) => void,
): void {
	const bound = binding.kind === "bound";
	useEffect(() => {
		if (bound && pendingRawExitContent) setPendingRawExitContent(null);
	}, [bound, pendingRawExitContent, setPendingRawExitContent]);
}

/**
 * Where the rich editor's content comes from. A live document owns a bound note's
 * content: the tab swap loads nothing into the editor and edits are not saved through
 * onContentChange, or both would write the shared fragment; its changes only report the title.
 */
function useEditorContentSource({
	collabBinding,
	activeTab,
	activeTabIsSheet,
	...swapOptions
}: EditorTabSwapOptions & {
	collabBinding: CollabEditorBinding;
	activeTab: Tab | null;
	activeTabIsSheet: boolean;
}) {
	const live = collabBinding.kind !== "local";
	const swap = useEditorTabSwap({
		...swapOptions,
		tabs: live ? NO_SWAP_TABS : swapOptions.tabs,
		activeTabPath: live ? null : swapOptions.activeTabPath,
	});
	const reportLiveTitle = useLiveTitleReporter(
		collabBinding,
		swapOptions.editor,
		swapOptions.activeTabPath,
	);
	const localContentReady = useRichEditorContentReadiness({
		activeTab,
		activeTabIsSheet,
		editorContentPath: swap.editorContentPath,
	});
	return {
		...swap,
		handleEditorChange: live ? reportLiveTitle : swap.handleEditorChange,
		richEditorContentReady: live
			? collabBinding.kind === "bound"
			: localContentReady,
	};
}

function handleEditorImageUploadFailure(
	file: File,
	error: unknown,
	onImageImportError: ImageImportErrorHandler | undefined,
): UploadImageFileResult {
	if (!isUnsupportedImageFormatError(error)) throw error;

	onImageImportError?.(error);
	return emptyImageUploadResult(file);
}

export function useEditorSetup(options: EditorSetupParams) {
	const {
		tabs,
		activeTabPath,
		vaultPath,
		collabBinding,
		onContentChange,
		onLoadDiff,
		onLoadDiffAtCommit,
		pendingCommitDiffRequest,
		onPendingCommitDiffHandled,
		getNoteStatus,
		rawToggleRef,
		diffToggleRef,
		onImageImportError,
	} = options;
	const vaultPathRef = useRef(vaultPath);
	const activeTabPathRef = useRef(activeTabPath);
	const onImageImportErrorRef = useRef(onImageImportError);
	const flushPendingEditorChangeRef = useRef<(() => boolean) | null>(null);
	const sheetFlushRef = useRef<((path: string) => void) | null>(null);
	useEffect(() => {
		vaultPathRef.current = vaultPath;
		activeTabPathRef.current = activeTabPath;
		onImageImportErrorRef.current = onImageImportError;
	}, [activeTabPath, onImageImportError, vaultPath]);

	const collaboration = blockNoteCollaboration(collabBinding);
	const editor = useCreateBlockNote({
		...RICH_EDITOR_BLOCKNOTE_PERFORMANCE_OPTIONS,
		schema,
		domAttributes: RICH_EDITOR_BIDI_DOM_ATTRIBUTES,
		dictionary: createBlockNoteDictionary(options.locale),
		collaboration,
		uploadFile: async (file: File) => {
			try {
				return await uploadImageFile(file, vaultPathRef.current);
			} catch (error) {
				return handleEditorImageUploadFailure(
					file,
					error,
					onImageImportErrorRef.current,
				);
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
	applyBlockNoteLocale(editor, options.locale);
	installRichEditorMarkdownSerializer(editor);
	useEffect(() => {
		installRichEditorDispatchPerformanceProbe(
			editor,
			() => activeTabPathRef.current,
		);
	}, [editor]);
	useFilenameAutolinkGuard(editor);
	const activeTab = tabs.find((t) => t.entry.path === activeTabPath) ?? null;
	// Raw mode reads and edits a bound note's live document (TOL-221).
	const { contentChange: rawContentChange, entryContent: rawEntryContent } =
		useLiveRawContentSource({
			binding: collabBinding,
			editor,
			onContentChange,
			vaultPath,
		});
	const {
		rawMode,
		handleToggleRaw,
		rawLatestContentRef,
		pendingRawExitContent,
		setPendingRawExitContent,
		rawModeContentOverride,
	} = useRawModeWithFlush(
		editor,
		activeTabPath,
		activeTab?.content ?? null,
		rawContentChange,
		vaultPath,
		flushPendingEditorChangeRef,
		rawEntryContent,
	);
	const rawModeContent = resolveRawModeContent({
		activeTab,
		rawModeContentOverride,
	});

	useEffect(() => {
		setPendingRawExitContent((current) =>
			resolvePendingRawExitContent({
				activeTabPath,
				tabs,
				pendingRawExitContent: current,
			}),
		);
	}, [activeTabPath, setPendingRawExitContent, tabs]);
	useDropLiveRawExitContent(
		collabBinding,
		pendingRawExitContent,
		setPendingRawExitContent,
	);

	const { activeTabIsSheet, richEditorActiveTabPath, tabsForEditorSwap } =
		useRichEditorSheetSwapState({
			activeTab,
			activeTabPath,
			tabs,
			pendingRawExitContent,
		});

	const {
		handleEditorChange,
		flushPendingEditorChange,
		editorMountedRef,
		richEditorContentReady,
	} = useEditorContentSource({
		collabBinding,
		tabs: tabsForEditorSwap,
		activeTabPath: richEditorActiveTabPath,
		activeTab,
		activeTabIsSheet,
		editor,
		onContentChange,
		rawMode,
		vaultPath,
	});
	useEffect(() => {
		if (richEditorContentReady) markStartupPhase("editor_interactive");
	}, [richEditorContentReady]);
	useEffect(() => {
		flushPendingEditorChangeRef.current = flushPendingEditorChange;
		return () => {
			if (flushPendingEditorChangeRef.current === flushPendingEditorChange) {
				flushPendingEditorChangeRef.current = null;
			}
		};
	}, [flushPendingEditorChange]);
	useEditorFocus(editor, editorMountedRef);

	const {
		diffMode,
		diffContent,
		diffLoading,
		handleToggleDiff,
		handleViewCommitDiff,
	} = useDiffMode({
		activeTabPath,
		onLoadDiff,
		onLoadDiffAtCommit,
		pendingCommitDiffRequest,
		onPendingCommitDiffHandled,
	});

	const { handleToggleDiffExclusive, handleToggleRawExclusive } =
		useEditorModeExclusion({
			diffMode,
			rawMode,
			handleToggleDiff,
			handleToggleRaw,
			rawToggleRef,
			diffToggleRef,
		});

	const isLoadingNewTab = activeTabPath !== null && !activeTab;
	const activeStatus = activeTab
		? (getNoteStatus?.(activeTab.entry.path) ?? "clean")
		: "clean";
	const showDiffToggle = !!(
		activeTab &&
		(diffMode || activeStatus === "modified")
	);

	return {
		editor,
		activeTab,
		rawContentChange,
		rawLatestContentRef,
		rawModeContent,
		rawMode,
		diffMode,
		diffContent,
		diffLoading,
		handleToggleDiffExclusive,
		handleToggleRawExclusive,
		handleEditorChange,
		flushPendingEditorChange,
		handleViewCommitDiff,
		isLoadingNewTab,
		activeStatus,
		showDiffToggle,
		sheetFlushRef,
		richEditorContentReady,
	};
}
