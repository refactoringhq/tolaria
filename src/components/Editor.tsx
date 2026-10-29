import { memo, type ReactNode, useCallback, useEffect, useState } from "react";
import "@blocknote/mantine/style.css";
import "katex/dist/katex.min.css";
import type { RemoteBindings } from "../../packages/collab-client/src/remoteVaultBackend";
import type { FrontmatterOpOptions } from "../hooks/frontmatterOps";
import type { CommitDiffRequest } from "../hooks/useDiffMode";
import type { ImageImportError } from "../hooks/useImageDrop";
import {
	type AiAgentId,
	type AiAgentReadiness,
	DEFAULT_AI_AGENT,
} from "../lib/aiAgents";
import type { AiTarget } from "../lib/aiTargets";
import { type AppLocale, translate } from "../lib/i18n";
import type { PlatformCapabilities } from "../lib/platformCapabilities";
import type { VaultBackend } from "../lib/vaultBackend/types";
import type {
	GitCommit,
	NoteStatus,
	NoteWidthMode,
	VaultEntry,
	WorkspaceIdentity,
} from "../types";
import type { NoteListItem } from "../utils/ai-context";
import type { NotePdfExportSource } from "../utils/notePdfExport";
import type { RichEditorBlockTypeDefinition } from "../utils/richEditorBlockTypes";
import {
	type CollabEditorBinding,
	collabEditorKey,
	useCollabEditorBinding,
} from "./collabEditorBinding";
import { EditorLayout } from "./EditorLayout";
import { useRegisterEditorContentFlushes } from "./editorContentFlushRegistration";
import type { FrontmatterValue } from "./Inspector";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import { useEditorPdfExport } from "./useEditorPdfExport";
import {
	type ImageImportErrorHandler,
	type Tab,
	useEditorSetup,
} from "./useEditorSetup";
import { useRightPanelExclusion } from "./useRightPanelExclusion";
import { useTurnCurrentBlockIntoCommand } from "./useTurnCurrentBlockIntoCommand";
import "./Editor.css";
import "./EditorTheme.css";

export interface EditorProps {
	tabs: Tab[];
	activeTabPath: string | null;
	isVaultLoading?: boolean;
	entries: VaultEntry[];
	onNavigateWikilink: (target: string) => void;
	onUnsupportedAiPaste?: (message: string) => void;
	onLoadDiff?: (path: string) => Promise<string>;
	onLoadDiffAtCommit?: (path: string, commitHash: string) => Promise<string>;
	pendingCommitDiffRequest?: CommitDiffRequest | null;
	onPendingCommitDiffHandled?: (requestId: number) => void;
	getNoteStatus?: (path: string) => NoteStatus;
	onCreateNote?: () => void;
	inspectorCollapsed: boolean;
	onToggleInspector: () => void;
	inspectorWidth: number;
	defaultAiAgent?: AiAgentId;
	defaultAiTarget?: AiTarget;
	defaultAiAgentReadiness?: AiAgentReadiness;
	defaultAiAgentReady?: boolean;
	onInspectorResize: (delta: number) => void;
	inspectorEntry: VaultEntry | null;
	inspectorContent: string | null;
	gitHistory: GitCommit[];
	onUpdateFrontmatter?: (
		path: string,
		key: string,
		value: FrontmatterValue,
		options?: FrontmatterOpOptions,
	) => Promise<void>;
	onDeleteProperty?: (
		path: string,
		key: string,
		options?: FrontmatterOpOptions,
	) => Promise<void>;
	onAddProperty?: (
		path: string,
		key: string,
		value: FrontmatterValue,
		options?: FrontmatterOpOptions,
	) => Promise<void>;
	onCreateMissingType?: (
		path: string,
		missingType: string,
		nextTypeName: string,
	) => Promise<boolean | undefined>;
	onCreateAndOpenNote?: (title: string) => Promise<boolean>;
	onChangeWorkspace?: (
		entry: VaultEntry,
		workspace: WorkspaceIdentity,
	) => Promise<void> | void;
	onInitializeProperties?: (path: string) => void;
	showAIChat?: boolean;
	onToggleAIChat?: () => void;
	aiWorkspaceSurface?: ReactNode;
	vaultPath?: string;
	vaultPaths?: string[];
	noteList?: NoteListItem[];
	noteListFilter?: { type: string | null; query: string };
	onToggleFavorite?: (path: string) => void;
	onToggleOrganized?: (path: string) => void;
	onEnterNeighborhood?: (entry: VaultEntry) => void;
	onRevealFile?: (path: string) => void;
	onCopyFilePath?: (path: string) => void;
	onCopyDeepLink?: (entry: VaultEntry) => void;
	onCopyGitUrl?: (entry: VaultEntry) => void;
	onOpenExternalFile?: (path: string) => void;
	onDeleteNote?: (path: string) => void;
	onArchiveNote?: (path: string) => void;
	onUnarchiveNote?: (path: string) => void;
	onContentChange?: (path: string, content: string) => void;
	onSave?: () => void;
	/** Called when the user explicitly renames the filename from the breadcrumb. */
	onRenameFilename?: (path: string, newFilenameStem: string) => void;
	noteWidth?: NoteWidthMode;
	onToggleNoteWidth?: () => void;
	canGoBack?: boolean;
	canGoForward?: boolean;
	onGoBack?: () => void;
	onGoForward?: () => void;
	leftPanelsCollapsed?: boolean;
	/** Mutable ref that Editor registers its raw-mode toggle into, for command palette access. */
	rawToggleRef?: React.MutableRefObject<() => void>;
	/** Mutable ref that Editor registers editor find commands into, for shortcuts and menus. */
	findInNoteRef?: React.MutableRefObject<
		((options?: { replace?: boolean }) => void) | null
	>;
	/** Mutable ref that Editor registers its diff-mode toggle into, for command palette access. */
	diffToggleRef?: React.MutableRefObject<() => void>;
	/** Mutable ref that Editor registers its table-of-contents toggle into, for app shortcuts and menus. */
	tableOfContentsToggleRef?: React.MutableRefObject<() => void>;
	/** Mutable ref that Editor registers the PDF export command into, for command palette and native menu access. */
	pdfExportRef?: React.MutableRefObject<
		((source?: NotePdfExportSource) => void) | null
	>;
	/** Mutable ref that Editor registers focused-block type changes into, for command palette access. */
	turnCurrentBlockIntoRef?: React.MutableRefObject<
		((target: RichEditorBlockTypeDefinition) => void) | null
	>;
	/** Emits short user-visible messages for editor actions. */
	onToast?: (message: string | null) => void;
	onFileCreated?: (relativePath: string) => void;
	onFileModified?: (relativePath: string) => void;
	onVaultChanged?: () => void;
	workspaces?: WorkspaceIdentity[];
	/** Whether the active note has a merge conflict. */
	isConflicted?: boolean;
	/** Resolve conflict by keeping the local version. */
	onKeepMine?: (path: string) => void;
	/** Resolve conflict by keeping the remote version. */
	onKeepTheirs?: (path: string) => void;
	/** Registers a hook that flushes pending rich-editor changes into app state before external actions. */
	flushPendingEditorContentRef?: React.MutableRefObject<
		((path: string) => void) | null
	>;
	/** Registers a hook that flushes the raw editor buffer into app state before external actions. */
	flushPendingRawContentRef?: React.MutableRefObject<
		((path: string) => void) | null
	>;
	/** Platform capabilities (desktop shows all features, web hides desktop-only features) */
	platformCapabilities?: PlatformCapabilities;
	/** VaultBackend for opening collaborative documents (web only) */
	vaultBackend?: VaultBackend<RemoteBindings> | null;
	locale?: AppLocale;
}

function imageImportErrorMessage(
	error: ImageImportError,
	locale: AppLocale | undefined,
): string {
	if (error.kind === "remote-download") {
		return translate(
			locale ?? "en",
			"editor.imageImport.remoteDownloadFailed",
			{
				failedCount: error.failedCount,
				totalCount: error.totalCount,
			},
		);
	}
	return translate(locale ?? "en", "editor.imageImport.unsupportedHeic", {
		filename: error.fileName,
	});
}

function useEditorFindCommand({
	activeTab,
	findInNoteRef,
	handleToggleRawExclusive,
	rawMode,
}: {
	activeTab: Tab | null;
	findInNoteRef?: EditorProps["findInNoteRef"];
	handleToggleRawExclusive: () => void;
	rawMode: boolean;
}): RawEditorFindRequest | null {
	const [findRequest, setFindRequest] = useState<RawEditorFindRequest | null>(
		null,
	);
	const handleFindInNote = useCallback(
		(options: { replace?: boolean } = {}) => {
			if (!activeTab || activeTab.entry.fileKind === "binary") return;
			if (!rawMode) handleToggleRawExclusive();

			setFindRequest((current) => ({
				id: (current?.id ?? 0) + 1,
				path: activeTab.entry.path,
				replace: options.replace === true,
			}));
		},
		[activeTab, handleToggleRawExclusive, rawMode],
	);

	useEffect(() => {
		if (!findInNoteRef) return;

		findInNoteRef.current = handleFindInNote;
		return () => {
			if (findInNoteRef.current === handleFindInNote) {
				findInNoteRef.current = null;
			}
		};
	}, [findInNoteRef, handleFindInNote]);

	return findRequest;
}

type EditorRuntime = ReturnType<typeof useEditorSetup>;
type EditorLayoutProps = Parameters<typeof EditorLayout>[0];

function buildEditorLayoutProps(
	props: EditorProps,
	runtime: EditorRuntime,
	findRequest: RawEditorFindRequest | null,
): EditorLayoutProps {
	return {
		...props,
		...runtime,
		activeTabPath: props.activeTabPath,
		defaultAiAgent: props.defaultAiAgent ?? DEFAULT_AI_AGENT,
		defaultAiAgentReady: props.defaultAiAgentReady ?? true,
		findRequest,
	};
}

export const Editor = memo(function Editor(props: EditorProps) {
	const { locale, onToast, platformCapabilities } = props;
	const handleImageImportError = useCallback(
		(error: ImageImportError) => {
			onToast?.(imageImportErrorMessage(error, locale));
		},
		[locale, onToast],
	);

	const collabBinding = useCollabEditorBinding(props);

	// When per-note editors are enabled (web), key the editor by active tab path
	// so React creates a new editor instance for each note, and again once the
	// note's live document is ready to bind.
	// When disabled (desktop), use a stable key so the same editor is reused.
	const editorKey = collabEditorKey(
		platformCapabilities?.perNoteEditors,
		props.activeTabPath,
		collabBinding,
	);

	return (
		<EditorInner
			key={editorKey}
			{...props}
			collabBinding={collabBinding}
			onImageImportError={handleImageImportError}
		/>
	);
});

function EditorInner(
	props: EditorProps & {
		collabBinding: CollabEditorBinding;
		onImageImportError: ImageImportErrorHandler;
	},
) {
	const { onImageImportError } = props;
	const runtime = useEditorSetup({
		tabs: props.tabs,
		activeTabPath: props.activeTabPath,
		vaultPath: props.vaultPath,
		collabBinding: props.collabBinding,
		onContentChange: props.onContentChange,
		onLoadDiff: props.onLoadDiff,
		onLoadDiffAtCommit: props.onLoadDiffAtCommit,
		pendingCommitDiffRequest: props.pendingCommitDiffRequest,
		onPendingCommitDiffHandled: props.onPendingCommitDiffHandled,
		getNoteStatus: props.getNoteStatus,
		rawToggleRef: props.rawToggleRef,
		diffToggleRef: props.diffToggleRef,
		onImageImportError,
		locale: props.locale,
	});
	const findRequest = useEditorFindCommand({
		activeTab: runtime.activeTab,
		findInNoteRef: props.findInNoteRef,
		handleToggleRawExclusive: runtime.handleToggleRawExclusive,
		rawMode: runtime.rawMode,
	});
	useTurnCurrentBlockIntoCommand({
		activeTab: runtime.activeTab,
		diffMode: runtime.diffMode,
		editor: runtime.editor,
		rawMode: runtime.rawMode,
		turnCurrentBlockIntoRef: props.turnCurrentBlockIntoRef,
	});
	const handleExportPdf = useEditorPdfExport({
		activeTab: runtime.activeTab,
		diffMode: runtime.diffMode,
		handleToggleDiffExclusive: runtime.handleToggleDiffExclusive,
		handleToggleRawExclusive: runtime.handleToggleRawExclusive,
		locale: props.locale,
		onToast: props.onToast,
		pdfExportRef: props.pdfExportRef,
		rawMode: runtime.rawMode,
	});
	useRegisterEditorContentFlushes({
		activeTab: runtime.activeTab,
		flushPendingEditorChange: runtime.flushPendingEditorChange,
		flushPendingEditorContentRef: props.flushPendingEditorContentRef,
		sheetFlushRef: runtime.sheetFlushRef,
		rawLatestContentRef: runtime.rawLatestContentRef,
		rawMode: runtime.rawMode,
		onContentChange: runtime.rawContentChange,
		flushPendingRawContentRef: props.flushPendingRawContentRef,
	});
	const rightPanel = useRightPanelExclusion(props);
	const { tableOfContentsToggleRef } = props;
	useEffect(() => {
		if (tableOfContentsToggleRef) {
			tableOfContentsToggleRef.current = rightPanel.handleToggleTableOfContents;
		}
	}, [tableOfContentsToggleRef, rightPanel.handleToggleTableOfContents]);

	return (
		<EditorLayout
			{...buildEditorLayoutProps(props, runtime, findRequest)}
			onImageImportError={onImageImportError}
			onToggleInspector={rightPanel.handleToggleInspectorPanel}
			showAIChat={props.showAIChat}
			onToggleAIChat={
				props.onToggleAIChat ? rightPanel.handleToggleAIChatPanel : undefined
			}
			showTableOfContents={rightPanel.showTableOfContents}
			onToggleTableOfContents={rightPanel.handleToggleTableOfContents}
			onExportPdf={handleExportPdf}
		/>
	);
}
