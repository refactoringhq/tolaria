import type { ReactNode } from "react";
import type {
	LayoutChangeEvent,
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollView,
} from "react-native";
import type { MobileFilenameRename } from "../components/workspace/MobileEditorFileIdentity";
import type { MobileLayoutProbe } from "../qa/mobileLayoutProbe";
import type { NativeTableOfContentsProof } from "../qa/nativeTableOfContentsProbe";
import type { MobileAttachmentImporter } from "../workspace/mobileAttachmentImport";
import type { MobileAttachmentLinkOpener } from "../workspace/mobileAttachmentOpen";
import type { RegisterMobileEditorCommands } from "../workspace/mobileEditorCommands";
import type { MobileNoteReadState } from "../workspace/mobileNoteRead";
import type { MobileTableOfContentsTarget } from "../workspace/mobileTableOfContents";
import type {
	MobileEditorBlock,
	MobileNote,
	MobileTypeDefinitions,
} from "../workspace/mobileWorkspaceModel";

export type EditorEditingMode = "source" | "wysiwyg";
export type EditorFileMode = "binary" | "markdown" | "text";

export type TabletEditorPanelProps = {
	blocks: MobileEditorBlock[];
	bullets: string[];
	compact: boolean;
	initialEditing?: boolean;
	initialEditingMode?: EditorEditingMode;
	layoutProbe?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
	note: MobileNote | null;
	noteRead?: MobileNoteReadState;
	notes: MobileNote[];
	onNavigateWikilink: (target: string) => void;
	onOpenMoreActions: () => void;
	onOpenTableOfContents?: () => void;
	onRegisterEditorCommands?: RegisterMobileEditorCommands;
	onTableOfContentsScrollProof?: (proof: NativeTableOfContentsProof) => void;
	onToggleProperties?: () => void;
	onToggleFavorite: () => void;
	onUpdateContent: (noteId: string, content: string) => void;
	onEditorBodyReady?: () => void;
	propertiesVisible?: boolean;
	renameFilename?: MobileFilenameRename;
	sourceIdleSave?: boolean;
	sourceSelectionProbe?: boolean;
	tableOfContentsTarget?: MobileTableOfContentsTarget | null;
	typeDefinitions?: MobileTypeDefinitions;
	vaultRootUri?: string | null;
	wysiwygAutocompleteProbe?: boolean;
	wysiwygExternalLinkProbe?: boolean;
	wysiwygFormatCommandProbe?: boolean;
	wysiwygInputTransformProbe?: boolean;
	wysiwygMarkdownBlockProbe?: boolean;
	wysiwygMathEditProbe?: boolean;
	wysiwygTableCommandMutationProbe?: boolean;
	wysiwygWikilinkInsertProbe?: boolean;
	wysiwygMutationProbe?: boolean;
};

export type EditorToolbarProps = {
	editing: boolean;
	editingMode: EditorEditingMode;
	fileMode: EditorFileMode;
	leading?: ReactNode;
	trailing?: ReactNode;
	note: MobileNote;
	onOpenMoreActions: () => void;
	onOpenTableOfContents?: () => void;
	onToggleProperties?: () => void;
	onToggleSourceMode: () => void;
	onToggleFavorite: () => void;
	propertiesVisible?: boolean;
	renameFilename?: MobileFilenameRename;
	typeDefinitions?: MobileTypeDefinitions;
};

export type EditorPanelBodyProps = {
	compact: boolean;
	contentProps: EditorContentProps;
	fileMode: EditorFileMode;
	note: MobileNote;
	noteRead?: MobileNoteReadState;
	onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
	onScrollViewRef: (node: ScrollView | null) => void;
};

export type EditorContentProps = {
	blocks: MobileEditorBlock[];
	bullets: string[];
	compact: boolean;
	editing: boolean;
	editingMode: EditorEditingMode;
	note: MobileNote;
	notes: MobileNote[];
	layoutProbe: MobileLayoutProbe;
	plainText: boolean;
	typeDefinitions?: MobileTypeDefinitions;
	onNavigateWikilink: (target: string) => void;
	onImportAttachment?: MobileAttachmentImporter;
	onOpenLink: MobileAttachmentLinkOpener;
	onRegisterEditorCommands?: RegisterMobileEditorCommands;
	onTableOfContentsScrollProof?: (proof: NativeTableOfContentsProof) => void;
	onUpdateContent: (noteId: string, content: string) => void;
	onEditorBodyReady?: () => void;
	onTableOfContentsTargetLayout: (
		targetId: string,
		event: LayoutChangeEvent,
	) => void;
	sourceIdleSave: boolean;
	sourceSelectionProbe?: boolean;
	tableOfContentsTarget?: MobileTableOfContentsTarget | null;
	vaultRootUri?: string | null;
	wysiwygAutocompleteProbe?: boolean;
	wysiwygExternalLinkProbe?: boolean;
	wysiwygFormatCommandProbe?: boolean;
	wysiwygInputTransformProbe?: boolean;
	wysiwygMarkdownBlockProbe?: boolean;
	wysiwygMathEditProbe?: boolean;
	wysiwygTableCommandMutationProbe?: boolean;
	wysiwygWikilinkInsertProbe?: boolean;
	wysiwygMutationProbe?: boolean;
};

export type TableOfContentsScroll = {
	onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
	onTargetLayout: (targetId: string, event: LayoutChangeEvent) => void;
	setScrollViewNode: (node: ScrollView | null) => void;
};
