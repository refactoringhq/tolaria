import {
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { type CommitDiffRequest, useDiffMode } from "../hooks/useDiffMode";
import { useEditorFocus } from "../hooks/useEditorFocus";
import { useEditorTabSwap } from "../hooks/useEditorTabSwap";
import type { ImageImportError } from "../hooks/useImageDrop";
import type { NoteStatus, VaultEntry } from "../types";
import {
	type CollabEditorBinding,
	useLiveTitleReporter,
} from "./collabEditorBinding";
import {
	type PendingRawExitContent,
	resolvePendingRawExitContent,
	resolveRawModeContent,
} from "./editorRawModeSync";
import { useEditorInstance } from "./useEditorInstance";
import { useFilenameAutolinkGuard } from "./useFilenameAutolinkGuard";
import { useLiveRawContentSource } from "./useLiveRawContentSource";
import { useRawModeWithFlush } from "./useRawModeWithFlush";
import {
	useRichEditorContentReadiness,
	useRichEditorSheetSwapState,
} from "./useRichEditorSheetTransition";

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

interface EditorContentStateOptions {
	tabs: Tab[];
	activeTabPath: string | null;
	vaultPath?: string;
	collabBinding: CollabEditorBinding;
	onContentChange?: (path: string, content: string) => void;
	editor: ReturnType<typeof useEditorInstance>;
	flushPendingEditorChangeRef: MutableRefObject<(() => boolean) | null>;
}

function usePendingRawExitContent({
	collabBinding,
	activeTabPath,
	tabs,
	pendingRawExitContent,
	setPendingRawExitContent,
}: {
	collabBinding: CollabEditorBinding;
	activeTabPath: string | null;
	tabs: Tab[];
	pendingRawExitContent: PendingRawExitContent | null;
	setPendingRawExitContent: Dispatch<
		SetStateAction<PendingRawExitContent | null>
	>;
}) {
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
}

interface EditorTabContentOptions {
	collabBinding: CollabEditorBinding;
	sheetState: ReturnType<typeof useRichEditorSheetSwapState>;
	activeTab: Tab | null;
	editor: ReturnType<typeof useEditorInstance>;
	onContentChange?: (path: string, content: string) => void;
	rawMode: boolean;
	vaultPath?: string;
	flushPendingEditorChangeRef: MutableRefObject<(() => boolean) | null>;
}

function useEditorTabContent(options: EditorTabContentOptions) {
	const {
		collabBinding,
		sheetState,
		activeTab,
		editor,
		onContentChange,
		rawMode,
		vaultPath,
		flushPendingEditorChangeRef,
	} = options;
	const editorState = useEditorContentSource({
		collabBinding,
		tabs: sheetState.tabsForEditorSwap,
		activeTabPath: sheetState.richEditorActiveTabPath,
		activeTab,
		activeTabIsSheet: sheetState.activeTabIsSheet,
		editor,
		onContentChange,
		rawMode,
		vaultPath,
	});
	useEffect(() => {
		flushPendingEditorChangeRef.current = editorState.flushPendingEditorChange;
		return () => {
			if (
				flushPendingEditorChangeRef.current ===
				editorState.flushPendingEditorChange
			) {
				flushPendingEditorChangeRef.current = null;
			}
		};
	}, [editorState.flushPendingEditorChange, flushPendingEditorChangeRef]);
	useEditorFocus(editor, editorState.editorMountedRef);
	return editorState;
}

function useRawEditorState(options: EditorContentStateOptions) {
	const {
		tabs,
		activeTabPath,
		vaultPath,
		collabBinding,
		onContentChange,
		editor,
		flushPendingEditorChangeRef,
	} = options;
	const activeTab =
		tabs.find((tab) => tab.entry.path === activeTabPath) ?? null;
	const { contentChange: rawContentChange, entryContent: rawEntryContent } =
		useLiveRawContentSource({
			binding: collabBinding,
			editor,
			onContentChange,
			vaultPath,
		});
	const rawState = useRawModeWithFlush(
		editor,
		activeTabPath,
		activeTab?.content ?? null,
		rawContentChange,
		vaultPath,
		flushPendingEditorChangeRef,
		rawEntryContent,
	);
	return {
		activeTab,
		rawContentChange,
		rawState,
		rawModeContent: resolveRawModeContent({
			activeTab,
			rawModeContentOverride: rawState.rawModeContentOverride,
		}),
	};
}

function useEditorContentState(options: EditorContentStateOptions) {
	const {
		tabs,
		activeTabPath,
		vaultPath,
		collabBinding,
		onContentChange,
		editor,
		flushPendingEditorChangeRef,
	} = options;
	const { activeTab, rawContentChange, rawState, rawModeContent } =
		useRawEditorState(options);
	usePendingRawExitContent({
		collabBinding,
		activeTabPath,
		tabs,
		pendingRawExitContent: rawState.pendingRawExitContent,
		setPendingRawExitContent: rawState.setPendingRawExitContent,
	});
	const sheetState = useRichEditorSheetSwapState({
		activeTab,
		activeTabPath,
		tabs,
		pendingRawExitContent: rawState.pendingRawExitContent,
	});
	const editorState = useEditorTabContent({
		collabBinding,
		sheetState,
		activeTab,
		editor,
		onContentChange,
		rawMode: rawState.rawMode,
		vaultPath,
		flushPendingEditorChangeRef,
	});
	return {
		activeTab,
		rawContentChange,
		rawLatestContentRef: rawState.rawLatestContentRef,
		rawModeContent,
		rawMode: rawState.rawMode,
		handleToggleRaw: rawState.handleToggleRaw,
		...editorState,
	};
}

function useEditorContentAndDiff(
	options: EditorSetupParams & {
		editor: ReturnType<typeof useEditorInstance>;
		flushPendingEditorChangeRef: MutableRefObject<(() => boolean) | null>;
	},
) {
	const contentState = useEditorContentState(options);
	const diffState = useEditorDiffControls({
		activeTabPath: options.activeTabPath,
		onLoadDiff: options.onLoadDiff,
		onLoadDiffAtCommit: options.onLoadDiffAtCommit,
		pendingCommitDiffRequest: options.pendingCommitDiffRequest,
		onPendingCommitDiffHandled: options.onPendingCommitDiffHandled,
		rawMode: contentState.rawMode,
		handleToggleRaw: contentState.handleToggleRaw,
		rawToggleRef: options.rawToggleRef,
		diffToggleRef: options.diffToggleRef,
	});
	return { contentState, diffState };
}

function editorTabStatus(
	activeTabPath: string | null,
	activeTab: Tab | null,
	getNoteStatus: EditorSetupParams["getNoteStatus"],
	diffMode: boolean,
) {
	const activeStatus = activeTab
		? (getNoteStatus?.(activeTab.entry.path) ?? "clean")
		: "clean";
	return {
		activeStatus,
		isLoadingNewTab: activeTabPath !== null && !activeTab,
		showDiffToggle: !!(activeTab && (diffMode || activeStatus === "modified")),
	};
}

interface EditorDiffControlsOptions {
	activeTabPath: string | null;
	onLoadDiff?: (path: string) => Promise<string>;
	onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>;
	pendingCommitDiffRequest?: CommitDiffRequest | null;
	onPendingCommitDiffHandled?: (requestId: number) => void;
	rawMode: boolean;
	handleToggleRaw: () => void;
	rawToggleRef?: React.MutableRefObject<() => void>;
	diffToggleRef?: React.MutableRefObject<() => void>;
}

function useEditorDiffControls({
	rawMode,
	handleToggleRaw,
	...diffOptions
}: EditorDiffControlsOptions) {
	const diff = useDiffMode(diffOptions);
	const exclusive = useEditorModeExclusion({
		diffMode: diff.diffMode,
		rawMode,
		handleToggleDiff: diff.handleToggleDiff,
		handleToggleRaw,
		rawToggleRef: diffOptions.rawToggleRef,
		diffToggleRef: diffOptions.diffToggleRef,
	});
	return { ...diff, ...exclusive };
}

export function useEditorSetup(options: EditorSetupParams) {
	const {
		tabs,
		activeTabPath,
		vaultPath,
		collabBinding,
		onContentChange,
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

	const editor = useEditorInstance({
		collabBinding,
		locale: options.locale,
		vaultPathRef,
		activeTabPathRef,
		onImageImportErrorRef,
	});
	useFilenameAutolinkGuard(editor);
	const { contentState, diffState } = useEditorContentAndDiff({
		tabs,
		activeTabPath,
		vaultPath,
		collabBinding,
		onContentChange,
		editor,
		flushPendingEditorChangeRef,
		rawToggleRef,
		diffToggleRef,
	});

	const status = editorTabStatus(
		activeTabPath,
		contentState.activeTab,
		getNoteStatus,
		diffState.diffMode,
	);

	return { editor, ...contentState, ...diffState, ...status, sheetFlushRef };
}
