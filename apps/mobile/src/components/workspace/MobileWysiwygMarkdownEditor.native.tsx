import { RichText } from "@10play/tentap-editor";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { probeProps } from "../../qa/mobileLayoutProbe";
import { MobileKeyboardAvoidingView } from "../../ui/MobileKeyboardAvoidingView";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import {
	useMobileColors,
	useMobileMetrics,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import { isMobileImageAttachment } from "../../workspace/mobileAttachments";
import { useRegisteredMobileEditorCommands } from "../../workspace/mobileEditorCommands";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import type {
	MobileWysiwygMarkdownEditorProps,
	NativeTentapEditorSurfaceActionProps,
	NativeTentapEditorSurfaceActions,
	NativeTentapEditorSurfaceProps,
	NativeWysiwygExternalLinkSheetState,
	NativeWysiwygPickerState,
} from "./MobileNativeEditor.types";
import { MobileWysiwygExternalLinkSheet } from "./MobileWysiwygExternalLinkSheet";
import { MobileWysiwygFind } from "./MobileWysiwygFind.native";
import {
	applyNativeWysiwygFormat,
	isNativeWysiwygMarkdownBlockAction,
	type NativeWysiwygCommandBridge,
	nativeWysiwygFormattingActions,
} from "./MobileWysiwygFormatCommands";
import { MobileWysiwygFormattingToolbar } from "./MobileWysiwygFormattingToolbar.native";
import { mobileTentapEditorCss } from "./MobileWysiwygMarkdownEditorCss";
import { MobileWysiwygSlashMenu } from "./MobileWysiwygSlashMenu.native";
import type {
	NativeWysiwygPlainTextPayload,
	NativeWysiwygWikilinkPayload,
} from "./MobileWysiwygWikilinkBridgeModel";
import { MobileWysiwygWikilinkPicker } from "./MobileWysiwygWikilinkPicker";
import { useMobileEditorFileSource } from "./mobileEditorFileSource.native";
import {
	applyNativeWysiwygExternalLink,
	insertClipboardPlainText,
	insertImportedAttachment,
} from "./mobileNativeEditorOperations";
import {
	type NativeEditorRecoveryHandlers,
	useNativeEditorRecovery,
} from "./useNativeEditorRecovery";
import { useNativeEditorSurfaceSession } from "./useNativeEditorSurfaceSession";

type SessionProps = MobileWysiwygMarkdownEditorProps &
	NativeEditorRecoveryHandlers;
type SurfaceProps = NativeTentapEditorSurfaceProps &
	NativeEditorRecoveryHandlers;

export function MobileWysiwygMarkdownEditor(
	props: MobileWysiwygMarkdownEditorProps,
) {
	const recovery = useNativeEditorRecovery();
	return (
		<NativeEditorSession
			key={recovery.generation}
			{...props}
			onProcessLoss={recovery.onProcessLoss}
		/>
	);
}

function NativeEditorSession(props: SessionProps) {
	const session = useNativeEditorSurfaceSession(props);
	return <NativeTentapEditorSurface {...session} />;
}

function NativeTentapEditorSurface(props: SurfaceProps) {
	const colors = useMobileColors();
	const metrics = useMobileMetrics();
	const appearance = useMemo(
		() => ({
			css: mobileTentapEditorCss(
				props.compact,
				props.sourceNote.noteWidth,
				colors,
				metrics,
			),
		}),
		[colors, metrics, props.compact, props.sourceNote.noteWidth],
	);
	return (
		<NativeTentapEditorSurfaceSession
			key={props.vaultRootUri ?? ""}
			{...props}
			appearance={appearance}
		/>
	);
}

type SurfaceSessionProps = SurfaceProps & { appearance: { css: string } };

function NativeTentapEditorSurfaceSession(props: SurfaceSessionProps) {
	const { nativeEditorStyles } = useMobileStyles(createThemeStyles);
	const fileSource = useMobileEditorFileSource(
		props.vaultRootUri,
		props.previewMarkdown,
		props.appearance,
	);
	const actions = useRegisteredNativeSurfaceActions(props, fileSource);
	return (
		<MobileKeyboardAvoidingView
			{...probeProps(props.layoutProbe, "editor.wysiwyg.form")}
			style={nativeEditorStyles.container}
			testID="editor-wysiwyg-form"
			onTouchStart={props.activateEditorChanges}
		>
			<MobileWysiwygFind
				editor={props.editor}
				register={props.onRegisterEditorCommands}
				onBeforeReplace={props.activateEditorChanges}
			/>
			{fileSource.ready && (
				<RichText
					editor={props.editor}
					{...fileSource.webViewProps}
					{...probeProps(props.layoutProbe, "editor.wysiwyg.richText")}
					style={nativeEditorStyles.richText}
					testID="editor-wysiwyg-input"
					onLoadEnd={props.injectEditorCss}
					onContentProcessDidTerminate={() =>
						props.onProcessLoss("contentProcessTerminated")
					}
					onRenderProcessGone={() => props.onProcessLoss("renderProcessGone")}
				/>
			)}
			<MobileWysiwygSlashMenu editor={props.editor} />
			<NativeEditorToolbar
				editor={props.editor}
				layoutProbe={props.layoutProbe}
				onFormat={actions.handleFormat}
			/>
			<NativeWysiwygPickerOverlay
				actions={actions}
				notes={props.notes}
				pickerState={props.pickerState}
				sourceNote={props.sourceNote}
				typeDefinitions={props.typeDefinitions}
				onClose={props.onCloseWikilinkPicker}
			/>
			<NativeWysiwygExternalLinkOverlay
				actions={actions}
				externalLinkState={props.externalLinkState}
				onClose={props.onCloseExternalLinkSheet}
			/>
		</MobileKeyboardAvoidingView>
	);
}

type ToolbarProps = Pick<SurfaceProps, "editor" | "layoutProbe"> & {
	onFormat: NativeTentapEditorSurfaceActions["handleFormat"];
};
function NativeEditorToolbar(props: ToolbarProps) {
	const { nativeEditorStyles } = useMobileStyles(createThemeStyles);
	return (
		<View
			{...probeProps(props.layoutProbe, "editor.wysiwyg.toolbarHost")}
			style={nativeEditorStyles.toolbarHost}
		>
			<MobileWysiwygFormattingToolbar
				editor={props.editor}
				actions={nativeWysiwygFormattingActions}
				layoutProbe={props.layoutProbe}
				metricId="editor.wysiwyg.toolbar"
				onFormat={props.onFormat}
			/>
		</View>
	);
}

function useRegisteredNativeSurfaceActions(
	props: SurfaceProps,
	fileSource: ReturnType<typeof useMobileEditorFileSource>,
) {
	const actionProps: NativeTentapEditorSurfaceActionProps = {
		...props,
		onImportAttachment: async () => {
			const attachment = await props.onImportAttachment?.();
			if (attachment && isMobileImageAttachment(attachment))
				await fileSource.prepareAttachment?.(attachment.path);
			return attachment ?? null;
		},
	};
	const actions = useNativeTentapEditorSurfaceActions(actionProps);
	useRegisteredMobileEditorCommands(props.onRegisterEditorCommands, {
		blur: () => props.editor.blur(),
		pastePlainText: actions.handlePastePlainText,
		save: props.flushEditorDocument,
	});
	return actions;
}

function useNativeTentapEditorSurfaceActions(
	props: NativeTentapEditorSurfaceActionProps,
): NativeTentapEditorSurfaceActions {
	const {
		editor,
		externalLinkState,
		flushEditorDocument,
		insertAttachment,
		insertMarkdownBlock,
		insertPlainText,
		insertWikilink,
		onCloseExternalLinkSheet,
		onCloseWikilinkPicker,
		onImportAttachment,
		onOpenExternalLinkSheet,
		onOpenToolbarWikilinkPicker,
		pickerState,
	} = props;
	const handleFormat = useNativeWysiwygToolbarHandler({
		editor,
		insertAttachment,
		insertMarkdownBlock,
		insertPlainText,
		onImportAttachment,
		onOpenExternalLinkSheet,
		onOpenToolbarWikilinkPicker,
	});
	const handlePastePlainText = useCallback(() => {
		void handleFormat("pastePlainText");
	}, [handleFormat]);
	const replacementRange = pickerState?.replacementRange;
	const handleInsertWikilink = useCallback(
		(payload: NativeWysiwygWikilinkPayload) => {
			insertWikilink(payload, replacementRange);
			onCloseWikilinkPicker();
		},
		[insertWikilink, onCloseWikilinkPicker, replacementRange],
	);
	const handleInsertEmoji = useCallback(
		(payload: NativeWysiwygPlainTextPayload) => {
			insertPlainText(payload, replacementRange);
			onCloseWikilinkPicker();
		},
		[insertPlainText, onCloseWikilinkPicker, replacementRange],
	);
	const externalLinkSelection = externalLinkState?.selection;
	const handleApplyExternalLink = useCallback(
		(url: string) => {
			applyNativeWysiwygExternalLink(
				editor,
				url,
				flushEditorDocument,
				externalLinkSelection,
			);
			onCloseExternalLinkSheet();
		},
		[
			editor,
			externalLinkSelection,
			flushEditorDocument,
			onCloseExternalLinkSheet,
		],
	);
	const handleRemoveExternalLink = useCallback(() => {
		applyNativeWysiwygExternalLink(
			editor,
			null,
			flushEditorDocument,
			externalLinkSelection,
		);
		onCloseExternalLinkSheet();
	}, [
		editor,
		externalLinkSelection,
		flushEditorDocument,
		onCloseExternalLinkSheet,
	]);

	return {
		handleApplyExternalLink,
		handleFormat,
		handleInsertEmoji,
		handleInsertWikilink,
		handlePastePlainText,
		handleRemoveExternalLink,
	};
}

function NativeWysiwygPickerOverlay({
	actions,
	notes,
	pickerState,
	sourceNote,
	typeDefinitions,
	onClose,
}: {
	actions: NativeTentapEditorSurfaceActions;
	notes: MobileNote[];
	pickerState: NativeWysiwygPickerState | null;
	sourceNote: MobileNote;
	typeDefinitions: MobileTypeDefinitions | null | undefined;
	onClose: () => void;
}) {
	if (!pickerState) return null;

	return (
		<MobileWysiwygWikilinkPicker
			initialQuery={pickerState.query}
			key={wikilinkPickerKey(pickerState)}
			kind={pickerState.kind}
			notes={notes}
			sourceNote={sourceNote}
			typeDefinitions={typeDefinitions}
			onClose={onClose}
			onSelect={actions.handleInsertWikilink}
			onSelectEmoji={actions.handleInsertEmoji}
		/>
	);
}

function NativeWysiwygExternalLinkOverlay({
	actions,
	externalLinkState,
	onClose,
}: {
	actions: NativeTentapEditorSurfaceActions;
	externalLinkState: NativeWysiwygExternalLinkSheetState | null;
	onClose: () => void;
}) {
	if (!externalLinkState) return null;

	return (
		<MobileWysiwygExternalLinkSheet
			initialUrl={externalLinkState.initialUrl}
			onApply={actions.handleApplyExternalLink}
			onClose={onClose}
			onRemove={actions.handleRemoveExternalLink}
		/>
	);
}

function useNativeWysiwygToolbarHandler({
	editor,
	insertAttachment,
	insertMarkdownBlock,
	insertPlainText,
	onImportAttachment,
	onOpenExternalLinkSheet,
	onOpenToolbarWikilinkPicker,
}: Pick<
	NativeTentapEditorSurfaceProps,
	| "editor"
	| "insertAttachment"
	| "insertMarkdownBlock"
	| "insertPlainText"
	| "onImportAttachment"
	| "onOpenExternalLinkSheet"
	| "onOpenToolbarWikilinkPicker"
>) {
	return useCallback(
		async (action: Parameters<typeof applyNativeWysiwygFormat>[1]) => {
			if (action === "attachment")
				return insertImportedAttachment(onImportAttachment, insertAttachment);
			if (action === "link") return onOpenExternalLinkSheet();
			if (action === "pastePlainText")
				return insertClipboardPlainText(insertPlainText);
			if (action === "wikilink") return onOpenToolbarWikilinkPicker();
			if (isNativeWysiwygMarkdownBlockAction(action))
				return insertMarkdownBlock({ action });

			applyNativeWysiwygFormat(editor as NativeWysiwygCommandBridge, action);
		},
		[
			editor,
			insertAttachment,
			insertMarkdownBlock,
			insertPlainText,
			onImportAttachment,
			onOpenExternalLinkSheet,
			onOpenToolbarWikilinkPicker,
		],
	);
}

function wikilinkPickerKey(state: NativeWysiwygPickerState): string {
	return [
		state.source,
		state.kind,
		state.query,
		state.replacementRange?.from ?? "selection",
		state.replacementRange?.to ?? "selection",
	].join(":");
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	const nativeEditorStyles = StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: mobileColors.editor,
		},
		richText: {
			flex: 1,
			backgroundColor: mobileColors.editor,
		},
		toolbarHost: {
			backgroundColor: mobileColors.editor,
			borderTopColor: mobileColors.border,
			borderTopWidth: StyleSheet.hairlineWidth,
			paddingHorizontal: mobileSpace.md,
		},
	});
	return { mobileColors, nativeEditorStyles };
}
