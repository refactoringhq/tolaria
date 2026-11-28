import type { useCreateBlockNote } from "@blocknote/react";
import type { ReactNode } from "react";
import {
	APP_COMMAND_IDS,
	getAppCommandShortcutDisplay,
} from "../hooks/appCommandCatalog";
import type { FrontmatterOpOptions } from "../hooks/frontmatterOps";
import { useDragRegion } from "../hooks/useDragRegion";
import { useTouchInput } from "../hooks/useTouchInput";
import type { AiAgentId, AiAgentReadiness } from "../lib/aiAgents";
import type { AiTarget } from "../lib/aiTargets";
import { type AppLocale, translate } from "../lib/i18n";
import type {
	GitCommit,
	NoteStatus,
	NoteWidthMode,
	VaultEntry,
	WorkspaceIdentity,
} from "../types";
import type { NoteListItem } from "../utils/ai-context";
import type { NotePdfExportSource } from "../utils/notePdfExport";
import { EditorContent } from "./EditorContent";
import { EditorMemoryProbe } from "./EditorMemoryProbe";
import { EditorRightPanel } from "./EditorRightPanel";
import { FilePreview } from "./FilePreview";
import type { FrontmatterValue } from "./Inspector";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import { ResizeHandle } from "./ResizeHandle";
import { TouchEmptyState } from "./TouchEmptyState";

import type { ImageImportErrorHandler, Tab } from "./useEditorSetup";

function KeyboardEmptyState({ locale }: { locale: AppLocale }) {
	// The web build shows its browser-safe shortcuts (TOL-194).
	const quickOpenShortcut = getAppCommandShortcutDisplay(
		APP_COMMAND_IDS.fileQuickOpen,
	) ?? "";
	const newNoteShortcut = getAppCommandShortcutDisplay(
		APP_COMMAND_IDS.fileNewNote,
	) ?? "";

	return (
		<>
			<p className="m-0 text-[15px]">
				{translate(locale, "editor.empty.selectNote")}
			</p>
			<span className="text-xs text-muted-foreground">
				{translate(locale, "editor.empty.shortcuts", {
					quickOpen: quickOpenShortcut,
					newNote: newNoteShortcut,
				})}
			</span>
		</>
	);
}

function EditorEmptyState({ locale = "en" }: { locale?: AppLocale }) {
	const breadcrumbBarHeight = 52;
	const { onMouseDown } = useDragRegion();
	// A finger on the web build gets buttons instead of chords (TOL-24).
	const touchInput = useTouchInput();

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div
				aria-hidden="true"
				data-tauri-drag-region
				data-testid="editor-empty-state-drag-region"
				className="shrink-0"
				onMouseDown={onMouseDown}
				style={{ height: breadcrumbBarHeight }}
			/>
			<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
				{touchInput ? (
					<TouchEmptyState locale={locale} />
				) : (
					<KeyboardEmptyState locale={locale} />
				)}
			</div>
		</div>
	);
}

export function EditorLayout(options: {
	tabs: Tab[];
	activeTabPath: string | null;
	activeTab: Tab | null;
	isLoadingNewTab: boolean;
	isVaultLoading?: boolean;
	entries: VaultEntry[];
	editor: ReturnType<typeof useCreateBlockNote>;
	diffMode: boolean;
	diffContent: string | null;
	diffLoading: boolean;
	richEditorContentReady: boolean;
	handleToggleDiffExclusive: () => void | Promise<void>;
	rawMode: boolean;
	handleToggleRawExclusive: () => void;
	/** Saves raw edits: `onContentChange`, or the live document of a bound note. */
	rawContentChange?: (path: string, content: string) => void;
	onSave?: () => void;
	activeStatus: NoteStatus;
	showDiffToggle: boolean;
	showAIChat?: boolean;
	onToggleAIChat?: () => void;
	aiWorkspaceSurface?: ReactNode;
	showTableOfContents?: boolean;
	onToggleTableOfContents?: () => void;
	inspectorCollapsed: boolean;
	onToggleInspector: () => void;
	onNavigateWikilink: (target: string) => void;
	handleEditorChange: () => void;
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
	vaultPath?: string;
	vaultPaths?: string[];
	rawModeContent: string | null;
	findRequest?: RawEditorFindRequest | null;
	rawLatestContentRef: React.MutableRefObject<string | null>;
	sheetFlushRef: React.MutableRefObject<((path: string) => void) | null>;
	onRenameFilename?: (path: string, newFilenameStem: string) => void;
	noteWidth?: NoteWidthMode;
	onToggleNoteWidth?: () => void;
	isConflicted?: boolean;
	onKeepMine?: (path: string) => void;
	onKeepTheirs?: (path: string) => void;
	onInspectorResize: (delta: number) => void;
	inspectorWidth: number;
	defaultAiAgent: AiAgentId;
	defaultAiTarget?: AiTarget;
	defaultAiAgentReadiness?: AiAgentReadiness;
	defaultAiAgentReady: boolean;
	inspectorEntry: VaultEntry | null;
	inspectorContent: string | null;
	gitHistory: GitCommit[];
	noteList?: NoteListItem[];
	noteListFilter?: { type: string | null; query: string };
	handleViewCommitDiff: (commitHash: string) => Promise<void>;
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
	onFileCreated?: (relativePath: string) => void;
	onFileModified?: (relativePath: string) => void;
	onVaultChanged?: () => void;
	workspaces?: WorkspaceIdentity[];
	onUnsupportedAiPaste?: (message: string) => void;
	onImageImportError?: ImageImportErrorHandler;
	locale?: AppLocale;
	onExportPdf?: (source?: NotePdfExportSource) => void;
}) {
	const {
		tabs,
		activeTabPath,
		activeTab,
		isLoadingNewTab,
		isVaultLoading,
		entries,
		editor,
		diffMode,
		diffContent,
		diffLoading,
		richEditorContentReady,
		handleToggleDiffExclusive,
		rawMode,
		handleToggleRawExclusive,
		rawContentChange,
		onSave,
		activeStatus,
		showDiffToggle,
		showAIChat,
		onToggleAIChat,
		aiWorkspaceSurface,
		showTableOfContents,
		onToggleTableOfContents,
		inspectorCollapsed,
		onToggleInspector,
		onNavigateWikilink,
		handleEditorChange,
		onToggleFavorite,
		onToggleOrganized,
		onEnterNeighborhood,
		onRevealFile,
		onCopyFilePath,
		onCopyDeepLink,
		onCopyGitUrl,
		onExportPdf,
		onOpenExternalFile,
		onDeleteNote,
		onArchiveNote,
		onUnarchiveNote,
		vaultPath,
		vaultPaths,
		rawModeContent,
		findRequest,
		rawLatestContentRef,
		sheetFlushRef,
		onRenameFilename,
		noteWidth,
		onToggleNoteWidth,
		isConflicted,
		onKeepMine,
		onKeepTheirs,
		onInspectorResize,
		inspectorWidth,
		defaultAiAgent,
		defaultAiTarget,
		defaultAiAgentReadiness,
		defaultAiAgentReady,
		inspectorEntry,
		inspectorContent,
		gitHistory,
		noteList,
		noteListFilter,
		handleViewCommitDiff,
		onUpdateFrontmatter,
		onDeleteProperty,
		onAddProperty,
		onCreateMissingType,
		onCreateAndOpenNote,
		onChangeWorkspace,
		onInitializeProperties,
		onFileCreated,
		onFileModified,
		onVaultChanged,
		workspaces,
		onUnsupportedAiPaste,
		onImageImportError,
		locale,
	} = options;
	const activeBinaryTab =
		activeTab?.entry.fileKind === "binary" ? activeTab : null;
	const showEmptyState =
		tabs.length === 0 && activeTabPath === null && !isVaultLoading;

	return (
		<div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
			<div className="relative flex flex-1 min-h-0">
				{showEmptyState ? (
					<EditorEmptyState locale={locale} />
				) : activeBinaryTab ? (
					<FilePreview
						key={activeBinaryTab.entry.path}
						entry={activeBinaryTab.entry}
						locale={locale}
						onCopyFilePath={onCopyFilePath}
						onCopyDeepLink={onCopyDeepLink}
						onOpenExternalFile={onOpenExternalFile}
						onRevealFile={onRevealFile}
					/>
				) : (
					<EditorContent
						activeTab={activeTab}
						activeTabPath={activeTabPath}
						isLoadingNewTab={isLoadingNewTab}
						isVaultLoading={isVaultLoading}
						entries={entries}
						editor={editor}
						diffMode={diffMode}
						diffContent={diffContent}
						diffLoading={diffLoading}
						richEditorContentReady={richEditorContentReady}
						onToggleDiff={handleToggleDiffExclusive}
						rawMode={rawMode}
						onToggleRaw={handleToggleRawExclusive}
						onRawContentChange={rawContentChange}
						onSave={onSave}
						activeStatus={activeStatus}
						showDiffToggle={showDiffToggle}
						showAIChat={showAIChat}
						onToggleAIChat={onToggleAIChat}
						showTableOfContents={showTableOfContents}
						onToggleTableOfContents={onToggleTableOfContents}
						inspectorCollapsed={inspectorCollapsed}
						onToggleInspector={onToggleInspector}
						onNavigateWikilink={onNavigateWikilink}
						onEditorChange={handleEditorChange}
						onToggleFavorite={onToggleFavorite}
						onToggleOrganized={onToggleOrganized}
						onEnterNeighborhood={onEnterNeighborhood}
						onRevealFile={onRevealFile}
						onCopyFilePath={onCopyFilePath}
						onCopyDeepLink={onCopyDeepLink}
						onCopyGitUrl={onCopyGitUrl}
						onExportPdf={() => onExportPdf?.("breadcrumb")}
						onDeleteNote={onDeleteNote}
						onArchiveNote={onArchiveNote}
						onUnarchiveNote={onUnarchiveNote}
						vaultPath={vaultPath}
						rawModeContent={rawModeContent}
						findRequest={findRequest}
						rawLatestContentRef={rawLatestContentRef}
						sheetFlushRef={sheetFlushRef}
						onRenameFilename={onRenameFilename}
						noteWidth={noteWidth}
						onToggleNoteWidth={onToggleNoteWidth}
						isConflicted={isConflicted}
						onKeepMine={onKeepMine}
						onKeepTheirs={onKeepTheirs}
						onImageImportError={onImageImportError}
						locale={locale}
					/>
				)}
				{(showTableOfContents || !inspectorCollapsed) && (
					<ResizeHandle onResize={onInspectorResize} />
				)}
				<EditorRightPanel
					showAIChat={false}
					showTableOfContents={showTableOfContents}
					inspectorCollapsed={inspectorCollapsed}
					inspectorWidth={inspectorWidth}
					editor={editor}
					defaultAiAgent={defaultAiAgent}
					defaultAiTarget={defaultAiTarget}
					defaultAiAgentReadiness={defaultAiAgentReadiness}
					defaultAiAgentReady={defaultAiAgentReady}
					onUnsupportedAiPaste={onUnsupportedAiPaste}
					inspectorEntry={inspectorEntry}
					inspectorContent={inspectorContent}
					entries={entries}
					gitHistory={gitHistory}
					vaultPath={vaultPath ?? ""}
					vaultPaths={vaultPaths}
					noteList={noteList}
					noteListFilter={noteListFilter}
					onToggleInspector={onToggleInspector}
					onToggleAIChat={onToggleAIChat}
					onToggleTableOfContents={onToggleTableOfContents}
					onNavigateWikilink={onNavigateWikilink}
					onViewCommitDiff={handleViewCommitDiff}
					onUpdateFrontmatter={onUpdateFrontmatter}
					onDeleteProperty={onDeleteProperty}
					onAddProperty={onAddProperty}
					onCreateMissingType={onCreateMissingType}
					onCreateAndOpenNote={onCreateAndOpenNote}
					onChangeWorkspace={onChangeWorkspace}
					onInitializeProperties={onInitializeProperties}
					onToggleRawEditor={handleToggleRawExclusive}
					onOpenNote={onNavigateWikilink}
					onFileCreated={onFileCreated}
					onFileModified={onFileModified}
					onVaultChanged={onVaultChanged}
					workspaces={workspaces}
					locale={locale}
				/>
				{showAIChat && aiWorkspaceSurface}
			</div>
			<EditorMemoryProbe
				entries={entries}
				vaultPath={vaultPath}
				locale={locale}
			/>
		</div>
	);
}
