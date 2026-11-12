import type { MobileNote } from "../workspace/mobileWorkspaceModel";
import type {
	EditorContentProps,
	TabletEditorPanelProps,
} from "./TabletEditorPanel.types";

export function createEditorContentProps(
	props: TabletEditorPanelProps,
	note: MobileNote,
	options: Pick<
		EditorContentProps,
		| "editing"
		| "editingMode"
		| "layoutProbe"
		| "onImportAttachment"
		| "onOpenLink"
		| "onTableOfContentsTargetLayout"
		| "plainText"
	>,
): EditorContentProps {
	return {
		blocks: props.blocks,
		bullets: props.bullets,
		compact: props.compact,
		...options,
		note,
		notes: props.notes,
		onNavigateWikilink: props.onNavigateWikilink,
		onRegisterEditorCommands: props.onRegisterEditorCommands,
		onTableOfContentsScrollProof: props.onTableOfContentsScrollProof,
		onUpdateContent: props.onUpdateContent,
		...createSourceEditorProbeProps(props),
		tableOfContentsTarget: props.tableOfContentsTarget,
		typeDefinitions: props.typeDefinitions,
		vaultRootUri: props.vaultRootUri ?? null,
		...createWysiwygProbeProps(props),
		onEditorBodyReady: props.onEditorBodyReady,
	};
}

function createSourceEditorProbeProps(props: TabletEditorPanelProps) {
	return {
		sourceIdleSave: props.sourceIdleSave ?? true,
		sourceSelectionProbe: props.sourceSelectionProbe ?? false,
	};
}

function createWysiwygProbeProps(props: TabletEditorPanelProps) {
	return {
		...createWysiwygProbeContentProps(props),
		...createWysiwygProbeTableProps(props),
		...createWysiwygProbeInteractionProps(props),
		...createWysiwygProbeLinkProps(props),
	};
}

function createWysiwygProbeContentProps(props: TabletEditorPanelProps) {
	return {
		wysiwygAutocompleteProbe: props.wysiwygAutocompleteProbe ?? false,
		wysiwygExternalLinkProbe: props.wysiwygExternalLinkProbe ?? false,
		wysiwygFormatCommandProbe: props.wysiwygFormatCommandProbe ?? false,
	};
}

function createWysiwygProbeTableProps(props: TabletEditorPanelProps) {
	return {
		wysiwygInputTransformProbe: props.wysiwygInputTransformProbe ?? false,
		wysiwygTableCommandMutationProbe:
			props.wysiwygTableCommandMutationProbe ?? false,
	};
}

function createWysiwygProbeInteractionProps(props: TabletEditorPanelProps) {
	return {
		wysiwygMarkdownBlockProbe: props.wysiwygMarkdownBlockProbe ?? false,
		wysiwygMathEditProbe: props.wysiwygMathEditProbe ?? false,
		wysiwygMutationProbe: props.wysiwygMutationProbe ?? false,
	};
}

function createWysiwygProbeLinkProps(props: TabletEditorPanelProps) {
	return {
		wysiwygWikilinkInsertProbe: props.wysiwygWikilinkInsertProbe ?? false,
	};
}
