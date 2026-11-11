import type { ReactElement } from "react";
import { type RefreshControlProps, ScrollView } from "react-native";
import { MobileFilePreview } from "../components/workspace/MobileFilePreview";
import { MobileLayoutProbeReadout } from "../qa/MobileLayoutProbeReadout";
import { useMobileLayoutProbe } from "../qa/mobileLayoutProbe";
import { MobilePanel } from "../ui/MobilePanel";
import { useMobileStyles } from "../ui/theme/useMobileTheme";
import { useMobileAttachmentImporter } from "../workspace/mobileAttachmentImport";
import { useMobileAttachmentLinkOpener } from "../workspace/mobileAttachmentOpen";
import { useRegisteredMobileEditorCommands } from "../workspace/mobileEditorCommands";
import { mobileNoteActionMode } from "../workspace/mobileNoteActionMode";
import type { MobileNoteReadState } from "../workspace/mobileNoteRead";
import { mobileSpreadsheetNeedsFallback } from "../workspace/mobileSpreadsheetFormat";
import type { MobileNote } from "../workspace/mobileWorkspaceModel";
import { useMobilePullToSync } from "../workspace/useMobilePullToSync";
import { useMobileWikilinkNavigation } from "../workspace/useMobileWikilinkNavigation";
import { MobileEditorToolbar } from "./MobileEditorToolbar";
import type {
	EditorFileMode,
	EditorPanelBodyProps,
	TabletEditorPanelProps,
} from "./TabletEditorPanel.types";
import {
	EditorModeFailure,
	EmptyEditorPanel,
	MobileFilePreviewFallback,
	MobileNoteReadFallback,
	MobileSpreadsheetFallback,
	TabletEditorContent,
} from "./TabletEditorPanelChrome";
import { createEditorContentProps } from "./TabletEditorPanelPropsBuilder";
import { createEditorPanelStyles } from "./TabletEditorPanelStyles";
import { useEditorModeSwitch } from "./useEditorModeSwitch";
import { useNoteEditorMode } from "./useNoteEditorMode";
import { useStableMobileEditorCallback } from "./useStableMobileEditorCallback";
import { useTableOfContentsScroll } from "./useTableOfContentsScroll";

export type { EditorEditingMode } from "./TabletEditorPanel.types";

type EditorPanelBodyViewProps = EditorPanelBodyProps & {
	refreshControl?: ReactElement<RefreshControlProps>;
};

type EditorPanelBodyRendererProps = EditorPanelBodyViewProps & {
	panelStyles: ReturnType<typeof createEditorPanelStyles>["panelStyles"];
	themeStyles: ReturnType<typeof createEditorPanelStyles>;
};

type EditorPanelBodyRenderer = (
	props: EditorPanelBodyRendererProps,
) => ReactElement | null;

export const TabletEditorPanel = (props: TabletEditorPanelProps) => {
	const themeStyles = useMobileStyles(createEditorPanelStyles);
	const { panelStyles } = themeStyles;
	const refreshControl = useMobilePullToSync();
	const {
		compact,
		initialEditing = true,
		initialEditingMode = "wysiwyg",
		layoutProbe: layoutProbeEnabled = false,
		leading,
		trailing,
		note: inputNote,
		noteRead,
		notes,
		onNavigateWikilink,
		onOpenMoreActions,
		onOpenTableOfContents,
		onRegisterEditorCommands,
		onTableOfContentsScrollProof,
		onToggleFavorite,
		tableOfContentsTarget = null,
		typeDefinitions,
		vaultRootUri = null,
	} = props;
	const stableNote = inputNote;
	const updateContent = useStableMobileEditorCallback(props.onUpdateContent);
	const { mode: editingMode, toggle: changeEditingMode } = useNoteEditorMode(
		stableNote?.id,
		initialEditingMode,
	);
	const { onScroll, onTargetLayout, setScrollViewNode } =
		useTableOfContentsScroll(
			tableOfContentsTarget,
			onTableOfContentsScrollProof,
		);
	const importAttachment = useMobileAttachmentImporter(vaultRootUri);
	const openLink = useMobileAttachmentLinkOpener(vaultRootUri);
	const { navigateWikilink, notice: missingWikilinkNotice } =
		useMobileWikilinkNavigation(notes, onNavigateWikilink);
	const layoutProbe = useMobileLayoutProbe(layoutProbeEnabled);
	const { toggle: toggleSourceMode, failed: modeSwitchFailed } =
		useEditorModeSwitch(stableNote?.id, changeEditingMode);
	useRegisteredMobileEditorCommands(onRegisterEditorCommands, {
		toggleRawEditor:
			stableNote && editorFileMode(stableNote) === "markdown"
				? toggleSourceMode
				: undefined,
	});

	if (!stableNote) {
		return <EmptyEditorPanel />;
	}

	const note = stableNote;
	const fileMode = editorFileMode(note);
	const plainText = fileMode === "text";
	const effectiveEditing = canEditCurrentNote(
		fileMode,
		initialEditing,
		noteRead,
	);
	const effectiveEditingMode = plainText ? "source" : editingMode;
	const contentProps = createEditorContentProps(
		{
			...props,
			note,
			onNavigateWikilink: navigateWikilink,
			onUpdateContent: updateContent,
		},
		note,
		{
			editing: effectiveEditing,
			editingMode: effectiveEditingMode,
			layoutProbe: layoutProbe.probe,
			onImportAttachment: importAttachment,
			onOpenLink: openLink,
			onTableOfContentsTargetLayout: onTargetLayout,
			plainText,
		},
	);

	return (
		<MobilePanel
			{...layoutProbe.probe("editor.panel")}
			style={panelStyles.panel}
			testID="editor-panel"
		>
			<MobileEditorToolbar
				editingMode={effectiveEditingMode}
				editing={effectiveEditing}
				fileMode={fileMode}
				leading={leading}
				trailing={trailing}
				note={note}
				renameFilename={props.renameFilename}
				onOpenMoreActions={onOpenMoreActions}
				onOpenTableOfContents={onOpenTableOfContents}
				onToggleSourceMode={toggleSourceMode}
				onToggleFavorite={onToggleFavorite}
				typeDefinitions={typeDefinitions}
			/>
			<EditorModeFailure failed={modeSwitchFailed} />
			<EditorPanelBody
				compact={compact}
				contentProps={contentProps}
				fileMode={fileMode}
				note={note}
				noteRead={noteRead}
				onScroll={onScroll}
				onScrollViewRef={setScrollViewNode}
				refreshControl={refreshControl}
			/>
			{missingWikilinkNotice}
			{layoutProbeEnabled ? (
				<MobileLayoutProbeReadout
					metrics={layoutProbe.metrics}
					testID="editor-layout-metrics"
				/>
			) : null}
		</MobilePanel>
	);
};

function EditorPanelBody(props: EditorPanelBodyViewProps) {
	const themeStyles = useMobileStyles(createEditorPanelStyles);
	return selectEditorPanelBodyRenderer(props)({
		...props,
		panelStyles: themeStyles.panelStyles,
		themeStyles,
	});
}

function selectEditorPanelBodyRenderer(
	props: EditorPanelBodyViewProps,
): EditorPanelBodyRenderer {
	if (noteReadFallbackState(props.noteRead, props.note))
		return renderNoteReadBody;
	if (props.fileMode === "binary") return renderBinaryFileBody;
	if (
		mobileSpreadsheetNeedsFallback(props.note, props.contentProps.editingMode)
	)
		return renderSpreadsheetFallbackBody;
	return props.contentProps.editing
		? renderEditableNoteBody
		: renderReadOnlyNoteBody;
}

function renderNoteReadBody({ note, noteRead }: EditorPanelBodyRendererProps) {
	const state = noteReadFallbackState(noteRead, note);
	return state ? <MobileNoteReadFallback note={note} state={state} /> : null;
}

function renderBinaryFileBody({
	note,
	contentProps,
	panelStyles,
}: EditorPanelBodyRendererProps) {
	return (
		<MobileFilePreview
			note={note}
			vaultRootUri={contentProps.vaultRootUri}
			fallback={
				<ScrollView
					contentContainerStyle={panelStyles.filePreviewContent}
					scrollsToTop={false}
					testID="editor-scroll"
				>
					<MobileFilePreviewFallback
						note={note}
						typeDefinitions={contentProps.typeDefinitions}
					/>
				</ScrollView>
			}
		/>
	);
}

function renderSpreadsheetFallbackBody() {
	return <MobileSpreadsheetFallback />;
}

function renderEditableNoteBody({
	contentProps,
	panelStyles,
	refreshControl,
}: EditorPanelBodyRendererProps) {
	return (
		<ScrollView
			contentContainerStyle={{ flexGrow: 1 }}
			nestedScrollEnabled
			refreshControl={refreshControl}
			scrollsToTop={false}
			style={panelStyles.editorHost}
			testID="editor-scroll"
		>
			<TabletEditorContent {...contentProps} />
		</ScrollView>
	);
}

function renderReadOnlyNoteBody({
	compact,
	contentProps,
	note,
	onScroll,
	onScrollViewRef,
	panelStyles,
	refreshControl,
	themeStyles,
}: EditorPanelBodyRendererProps) {
	return (
		<ScrollView
			contentContainerStyle={readModeContentStyle(themeStyles, note, compact)}
			onScroll={onScroll}
			ref={onScrollViewRef}
			refreshControl={refreshControl}
			scrollsToTop={false}
			scrollEventThrottle={16}
			style={panelStyles.editorHost}
			testID="editor-scroll"
		>
			<TabletEditorContent {...contentProps} />
		</ScrollView>
	);
}

function canEditCurrentNote(
	fileMode: EditorFileMode,
	editing: boolean,
	noteRead?: MobileNoteReadState,
) {
	return fileMode !== "binary" && editing && noteRead?.status !== "loading";
}

function noteReadFallbackState(
	noteRead: MobileNoteReadState | undefined,
	note: MobileNote,
) {
	if (!noteRead) return null;
	const hasUsableContent =
		noteRead.status === "ready" ||
		(noteRead.status === "loading" && note.rawContent !== undefined);
	return hasUsableContent ? null : noteRead;
}

function editorFileMode(note: MobileNote): EditorFileMode {
	const actionMode = mobileNoteActionMode(note);
	if (actionMode === "binary-file") return "binary";
	return actionMode === "text-file" ? "text" : "markdown";
}

function readModeContentStyle(
	themeStyles: ReturnType<typeof createEditorPanelStyles>,
	note: MobileNote,
	compact: boolean,
) {
	const { panelStyles } = themeStyles;
	return [
		panelStyles.content,
		note.noteWidth === "wide" ? panelStyles.contentWide : null,
		compact ? panelStyles.contentCompact : null,
	];
}
