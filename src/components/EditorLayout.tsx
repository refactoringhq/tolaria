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

interface EditorLayoutProps {
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
}

type EditorPanelResizeProps = Pick<
	EditorLayoutProps,
	| "showTableOfContents"
	| "inspectorCollapsed"
	| "onInspectorResize"
	| "onToggleInspector"
>;

function EditorPanelResize({
	showTableOfContents,
	inspectorCollapsed,
	onInspectorResize,
	onToggleInspector,
}: EditorPanelResizeProps) {
	if (!showTableOfContents && inspectorCollapsed) return null;

	return (
		<ResizeHandle
			onResize={onInspectorResize}
			collapse={
				showTableOfContents
					? undefined
					: { label: "inspector.title.closePropertiesShortcut", action: onToggleInspector }
			}
		/>
	);
}

function editorNoteActions(options: EditorLayoutProps) {
	return {
		onSave: options.onSave,
		onNavigateWikilink: options.onNavigateWikilink,
		onEditorChange: options.handleEditorChange,
		onToggleFavorite: options.onToggleFavorite,
		onToggleOrganized: options.onToggleOrganized,
		onEnterNeighborhood: options.onEnterNeighborhood,
		onRevealFile: options.onRevealFile,
		onCopyFilePath: options.onCopyFilePath,
		onCopyDeepLink: options.onCopyDeepLink,
		onCopyGitUrl: options.onCopyGitUrl,
		onExportPdf: () => options.onExportPdf?.("breadcrumb"),
		onDeleteNote: options.onDeleteNote,
		onArchiveNote: options.onArchiveNote,
		onUnarchiveNote: options.onUnarchiveNote,
		onRenameFilename: options.onRenameFilename,
		onToggleNoteWidth: options.onToggleNoteWidth,
		onKeepMine: options.onKeepMine,
		onKeepTheirs: options.onKeepTheirs,
		onImageImportError: options.onImageImportError,
	};
}

function EditorMainSurface({ options }: { options: EditorLayoutProps }) {
	const { activeTab, activeTabPath, isVaultLoading, locale, tabs } = options;
	const showEmptyState = tabs.length === 0 && activeTabPath === null && !isVaultLoading;
	if (showEmptyState) return <EditorEmptyState locale={locale} />;

	if (activeTab?.entry.fileKind === "binary") {
		return (
			<FilePreview
				key={activeTab.entry.path}
				entry={activeTab.entry}
				locale={locale}
				onCopyFilePath={options.onCopyFilePath}
				onCopyDeepLink={options.onCopyDeepLink}
				onOpenExternalFile={options.onOpenExternalFile}
				onRevealFile={options.onRevealFile}
			/>
		);
	}
	return <EditorNoteSurface options={options} />;
}

function EditorNoteSurface({ options }: { options: EditorLayoutProps }) {
	return (
		<EditorContent
			activeTab={options.activeTab}
			activeTabPath={options.activeTabPath}
			isLoadingNewTab={options.isLoadingNewTab}
			isVaultLoading={options.isVaultLoading}
			entries={options.entries}
			editor={options.editor}
			diffMode={options.diffMode}
			diffContent={options.diffContent}
			diffLoading={options.diffLoading}
			richEditorContentReady={options.richEditorContentReady}
			onToggleDiff={options.handleToggleDiffExclusive}
			rawMode={options.rawMode}
			onToggleRaw={options.handleToggleRawExclusive}
			onRawContentChange={options.rawContentChange}
			activeStatus={options.activeStatus}
			showDiffToggle={options.showDiffToggle}
			showAIChat={options.showAIChat}
			onToggleAIChat={options.onToggleAIChat}
			showTableOfContents={options.showTableOfContents}
			onToggleTableOfContents={options.onToggleTableOfContents}
			inspectorCollapsed={options.inspectorCollapsed}
			onToggleInspector={options.onToggleInspector}
			vaultPath={options.vaultPath}
			rawModeContent={options.rawModeContent}
			findRequest={options.findRequest}
			rawLatestContentRef={options.rawLatestContentRef}
			sheetFlushRef={options.sheetFlushRef}
			noteWidth={options.noteWidth}
			isConflicted={options.isConflicted}
			locale={options.locale}
			{...editorNoteActions(options)}
		/>
	);
}

function EditorInspector({ options }: { options: EditorLayoutProps }) {
	return (
		<EditorRightPanel
			showAIChat={false}
			showTableOfContents={options.showTableOfContents}
			inspectorCollapsed={options.inspectorCollapsed}
			inspectorWidth={options.inspectorWidth}
			editor={options.editor}
			defaultAiAgent={options.defaultAiAgent}
			defaultAiTarget={options.defaultAiTarget}
			defaultAiAgentReadiness={options.defaultAiAgentReadiness}
			defaultAiAgentReady={options.defaultAiAgentReady}
			onUnsupportedAiPaste={options.onUnsupportedAiPaste}
			inspectorEntry={options.inspectorEntry}
			inspectorContent={options.inspectorContent}
			entries={options.entries}
			gitHistory={options.gitHistory}
			vaultPath={options.vaultPath ?? ""}
			vaultPaths={options.vaultPaths}
			noteList={options.noteList}
			noteListFilter={options.noteListFilter}
			onToggleInspector={options.onToggleInspector}
			onToggleAIChat={options.onToggleAIChat}
			onToggleTableOfContents={options.onToggleTableOfContents}
			onNavigateWikilink={options.onNavigateWikilink}
			onViewCommitDiff={options.handleViewCommitDiff}
			onUpdateFrontmatter={options.onUpdateFrontmatter}
			onDeleteProperty={options.onDeleteProperty}
			onAddProperty={options.onAddProperty}
			onCreateMissingType={options.onCreateMissingType}
			onCreateAndOpenNote={options.onCreateAndOpenNote}
			onChangeWorkspace={options.onChangeWorkspace}
			onInitializeProperties={options.onInitializeProperties}
			onToggleRawEditor={options.handleToggleRawExclusive}
			onOpenNote={options.onNavigateWikilink}
			onFileCreated={options.onFileCreated}
			onFileModified={options.onFileModified}
			onVaultChanged={options.onVaultChanged}
			workspaces={options.workspaces}
			locale={options.locale}
		/>
	);
}

export function EditorLayout(options: EditorLayoutProps) {
	return (
		<div className="editor flex flex-col min-h-0 overflow-hidden bg-background text-foreground">
			<div className="relative flex flex-1 min-h-0">
				<EditorMainSurface options={options} />
				<EditorPanelResize
					showTableOfContents={options.showTableOfContents}
					inspectorCollapsed={options.inspectorCollapsed}
					onInspectorResize={options.onInspectorResize}
					onToggleInspector={options.onToggleInspector}
				/>
				<EditorInspector options={options} />
				{options.showAIChat && options.aiWorkspaceSurface}
			</div>
			<EditorMemoryProbe
				entries={options.entries}
				vaultPath={options.vaultPath}
				locale={options.locale}
			/>
		</div>
	);
}
