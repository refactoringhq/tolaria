import { ArrowClockwise, FileText, WarningCircle } from "phosphor-react-native";
import { memo } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "../components/ui/text";
import { MobileEditorBlocks } from "../components/workspace/MobileEditorBlocks";
import { MobileMarkdownSourceEditor } from "../components/workspace/MobileMarkdownSourceEditor";
import { MobileTypeIcon } from "../components/workspace/MobileWorkspaceIcons";
import { MobileWysiwygMarkdownEditor } from "../components/workspace/MobileWysiwygMarkdownEditor";
import { mobileText } from "../i18n/mobileText";
import { useMobileMotionBodyRender } from "../qa/useMobileMotionBodyRender";
import { desktopToolbarActionParity } from "../ui/desktopParity";
import { MobileButton } from "../ui/MobileButton";
import {
	MobilePanel,
	MobileToolbar,
	MobileToolbarTitle,
} from "../ui/MobilePanel";
import {
	useMobileColors,
	useMobileMetrics,
	useMobileStyles,
} from "../ui/theme/useMobileTheme";
import type { MobileNoteReadState } from "../workspace/mobileNoteRead";
import { createMobileTaskToggleHandler } from "../workspace/mobileTaskCheckbox";
import type {
	MobileEditorBlock,
	MobileNote,
	MobileTypeDefinitions,
} from "../workspace/mobileWorkspaceModel";
import type { EditorContentProps } from "./TabletEditorPanel.types";
import { createEditorPanelStyles } from "./TabletEditorPanelStyles";

export function MobileNoteReadFallback({
	note,
	state,
}: {
	note: MobileNote;
	state: MobileNoteReadState;
}) {
	const themeStyles = useMobileStyles(createEditorPanelStyles);
	const { panelStyles } = themeStyles;
	const mobileColors = useMobileColors();
	if (state.status !== "error")
		return <MobileNoteReadLoading note={note} panelStyles={panelStyles} />;
	return (
		<View style={panelStyles.emptyState} testID="note-read-error">
			<View
				style={panelStyles.filePreviewFallback}
				accessibilityLiveRegion="polite"
			>
				<WarningCircle size={24} color={mobileColors.textMuted} />
				<Text style={panelStyles.filePreviewDescription}>
					{mobileText("mobile.editor.readFailed")}
				</Text>
				<MobileButton
					icon={<ArrowClockwise size={16} color={mobileColors.textMuted} />}
					label={mobileText("pulse.retry")}
					onPress={state.retry}
					testID="note-read-retry"
				/>
			</View>
		</View>
	);
}

function MobileNoteReadLoading({
	note,
	panelStyles,
}: {
	note: MobileNote;
	panelStyles: ReturnType<typeof createEditorPanelStyles>["panelStyles"];
}) {
	return (
		<ScrollView
			contentContainerStyle={[panelStyles.content, { flexGrow: 1 }]}
			style={panelStyles.editorHost}
			testID="note-read-loading"
		>
			<Text
				style={[
					panelStyles.filePreviewTitle,
					{ textAlign: "left", width: "100%" },
				]}
			>
				{note.title}
			</Text>
			<Text
				style={[
					panelStyles.filePreviewDescription,
					{ textAlign: "left", width: "100%" },
				]}
			>
				{note.snippet}
			</Text>
		</ScrollView>
	);
}

export function MobileFilePreviewFallback({
	note,
	typeDefinitions,
}: {
	note: MobileNote;
	typeDefinitions?: MobileTypeDefinitions;
}) {
	const themeStyles = useMobileStyles(createEditorPanelStyles);
	const { panelStyles } = themeStyles;
	return (
		<View
			style={panelStyles.filePreviewFallback}
			testID="file-preview-fallback"
		>
			<MobileTypeIcon
				fileKind={note.fileKind}
				size={32}
				tone={note.typeTone}
				type={note.type}
				typeDefinitions={typeDefinitions}
			/>
			<Text style={panelStyles.filePreviewTitle}>
				{mobileText("filePreview.previewUnavailable")}
			</Text>
			<Text style={panelStyles.filePreviewDescription}>
				{mobileText("filePreview.previewUnavailableDescription")}
			</Text>
		</View>
	);
}

export function EmptyEditorPanel() {
	const themeStyles = useMobileStyles(createEditorPanelStyles);
	const { panelStyles } = themeStyles;
	const mobileColors = useMobileColors();
	return (
		<MobilePanel style={panelStyles.panel} testID="editor-panel">
			<MobileToolbar testID="editor-toolbar">
				<FileText
					color={mobileColors.textMuted}
					size={desktopToolbarActionParity.iconSize}
				/>
				<MobileToolbarTitle
					testID="editor-toolbar-title"
					title={mobileText("inspector.empty.noNoteSelected")}
				/>
			</MobileToolbar>
			<View style={panelStyles.emptyState}>
				<Text style={panelStyles.emptyTitle}>
					{mobileText("editor.empty.selectNote")}
				</Text>
			</View>
		</MobilePanel>
	);
}

export function MobileSpreadsheetFallback() {
	const { panelStyles } = useMobileStyles(createEditorPanelStyles);
	const colors = useMobileColors();
	return (
		<View
			style={[panelStyles.emptyState, { backgroundColor: colors.sidebar }]}
			testID="spreadsheet-unsupported"
			accessibilityState={{ disabled: true }}
		>
			<Text style={panelStyles.filePreviewDescription}>
				{mobileText("mobile.editor.spreadsheetUnsupported")}
			</Text>
		</View>
	);
}

export function EditorModeFailure({ failed }: { failed: boolean }) {
	const colors = useMobileColors();
	const metrics = useMobileMetrics();
	if (!failed) return null;
	return (
		<Text
			accessibilityRole="alert"
			style={{
				color: colors.danger,
				fontSize: metrics.type.body,
				padding: metrics.space.md,
			}}
		>
			{mobileText("mobile.editor.readFailed")}
		</Text>
	);
}

export const TabletEditorContent = memo(function TabletEditorContent(
	props: EditorContentProps,
) {
	useMobileMotionBodyRender(
		props.compact,
		props.note.id,
		props.note.rawContent ??
			JSON.stringify({ blocks: props.blocks, bullets: props.bullets }),
		props,
	);
	if (props.editing) return <EditingContent props={props} />;
	return <ReadOnlyContent props={props} />;
}, areEditorContentPropsEqual);

function EditingContent({ props }: { props: EditorContentProps }) {
	return usesSourceEditor(props.plainText, props.editingMode) ? (
		<SourceEditorContent props={props} />
	) : (
		<WysiwygEditorContent props={props} />
	);
}

function SourceEditorContent({ props }: { props: EditorContentProps }) {
	const {
		blocks,
		bullets,
		compact,
		note,
		notes,
		onImportAttachment,
		onRegisterEditorCommands,
		onUpdateContent,
		plainText,
		sourceIdleSave,
		sourceSelectionProbe,
	} = props;
	return (
		<MobileMarkdownSourceEditor
			key={`${note.id}:${plainText ? "text" : "source"}`}
			blocks={blocks}
			bullets={bullets}
			compact={compact}
			note={note}
			notes={notes}
			onImportAttachment={onImportAttachment}
			onRegisterEditorCommands={onRegisterEditorCommands}
			onUpdateContent={onUpdateContent}
			idleSave={sourceIdleSave}
			plainText={plainText}
			sourceSelectionProbe={sourceSelectionProbe}
		/>
	);
}

function WysiwygEditorContent({ props }: { props: EditorContentProps }) {
	return <MobileWysiwygMarkdownEditor {...createWysiwygEditorProps(props)} />;
}

function createWysiwygEditorProps(props: EditorContentProps) {
	return {
		blocks: props.blocks,
		bullets: props.bullets,
		compact: props.compact,
		layoutProbe: props.layoutProbe,
		note: props.note,
		notes: props.notes,
		onNavigateWikilink: props.onNavigateWikilink,
		onImportAttachment: props.onImportAttachment,
		onOpenLink: props.onOpenLink,
		onEditorBodyReady: props.onEditorBodyReady,
		onRegisterEditorCommands: props.onRegisterEditorCommands,
		onTableOfContentsScrollProof: props.onTableOfContentsScrollProof,
		onUpdateContent: props.onUpdateContent,
		tableOfContentsTarget: props.tableOfContentsTarget,
		typeDefinitions: props.typeDefinitions,
		vaultRootUri: props.vaultRootUri,
		wysiwygAutocompleteProbe: props.wysiwygAutocompleteProbe,
		wysiwygExternalLinkProbe: props.wysiwygExternalLinkProbe,
		wysiwygFormatCommandProbe: props.wysiwygFormatCommandProbe,
		wysiwygInputTransformProbe: props.wysiwygInputTransformProbe,
		wysiwygMarkdownBlockProbe: props.wysiwygMarkdownBlockProbe,
		wysiwygMathEditProbe: props.wysiwygMathEditProbe,
		wysiwygTableCommandMutationProbe: props.wysiwygTableCommandMutationProbe,
		wysiwygWikilinkInsertProbe: props.wysiwygWikilinkInsertProbe,
		wysiwygMutationProbe: props.wysiwygMutationProbe,
	};
}

function ReadOnlyContent({ props }: { props: EditorContentProps }) {
	const {
		blocks,
		bullets,
		note,
		onNavigateWikilink,
		onOpenLink,
		onTableOfContentsTargetLayout,
		onUpdateContent,
	} = props;
	const readBlocks = note.editorBlocks ?? blocks;
	const readBullets = note.editorBullets ?? bullets;
	return (
		<MobileEditorBlocks
			blocks={readBlocks}
			fallbackBullets={readBullets}
			renderTitleBlock={shouldRenderReadTitleBlock(note, readBlocks)}
			tableOfContentsTitle={note.title}
			onTableOfContentsTargetLayout={onTableOfContentsTargetLayout}
			interactions={{
				onOpenLink,
				onNavigateWikilink,
				onToggleTask: createMobileTaskToggleHandler(
					note.rawContent,
					note.id,
					onUpdateContent,
				),
			}}
		/>
	);
}

function areEditorContentPropsEqual(
	previous: EditorContentProps,
	next: EditorContentProps,
) {
	const keys = Object.keys(next) as (keyof EditorContentProps)[];
	return keys.every((key) =>
		key === "note"
			? sameEditorNote(previous.note, next.note)
			: previous[key] === next[key],
	);
}

function sameEditorNote(previous: MobileNote, next: MobileNote) {
	return (
		previous.id === next.id &&
		previous.rawContent === next.rawContent &&
		previous.editorBlocks === next.editorBlocks &&
		previous.editorBullets === next.editorBullets &&
		previous.title === next.title &&
		previous.type === next.type
	);
}

function usesSourceEditor(
	plainText: boolean,
	editingMode: EditorContentProps["editingMode"],
) {
	return plainText || editingMode === "source";
}

function shouldRenderReadTitleBlock(
	note: MobileNote,
	blocks: MobileEditorBlock[],
) {
	if (blocks.length === 0) return false;
	if (generatedUntitledTitlePattern.test(note.title)) return false;
	return note.title.trim().length > 0;
}

const generatedUntitledTitlePattern = /^Untitled\s+\S+\s+\d+$/u;
