import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import { MobileButton } from "../../ui/MobileButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileNoteEditableContent } from "../../workspace/mobileDocumentContent";
import {
	type MobileMarkdownEditableSourceBlock,
	readMobileMarkdownEditableSourceBlocks,
	updateMobileMarkdownEditableSourceBlock,
} from "../../workspace/mobileMarkdownSourceBlocksEditing";
import type {
	MobileEditorBlock,
	MobileNote,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

type MobileSourceBlockMoreActionsProps = {
	editorBlocks: MobileEditorBlock[];
	editorBullets: string[];
	note: MobileNote;
	onClose: () => void;
	onUpdateNoteContent: (noteId: string, content: string) => void;
};

export function MobileSourceBlockMoreActions({
	editorBlocks,
	editorBullets,
	note,
	onClose,
	onUpdateNoteContent,
}: MobileSourceBlockMoreActionsProps) {
	const sourceContent = useMemo(
		() =>
			mobileNoteEditableContent({
				...note,
				editorBlocks: note.editorBlocks ?? editorBlocks,
				editorBullets: note.editorBullets ?? editorBullets,
			}),
		[editorBlocks, editorBullets, note],
	);
	const blocks = useMemo(
		() => readMobileMarkdownEditableSourceBlocks({ markdown: sourceContent }),
		[sourceContent],
	);
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const action = sourceBlockAction(blocks, editingKey);
	if (action.kind === "empty") return null;
	if (action.kind === "collapsed")
		return (
			<CollapsedSourceBlockAction
				onPress={() => setEditingKey(action.firstKey)}
			/>
		);

	return (
		<MobileSourceBlockEditor
			key={action.block.key}
			block={action.block}
			blocks={blocks}
			noteId={note.id}
			sourceContent={sourceContent}
			onClose={onClose}
			onSelectBlock={setEditingKey}
			onUpdateNoteContent={onUpdateNoteContent}
		/>
	);
}

function sourceBlockAction(
	blocks: MobileMarkdownEditableSourceBlock[],
	editingKey: string | null,
):
	| { kind: "empty" }
	| { kind: "collapsed"; firstKey: string }
	| { kind: "editor"; block: MobileMarkdownEditableSourceBlock } {
	if (blocks.length === 0) return { kind: "empty" };
	const selectedBlock = blocks.find((block) => block.key === editingKey);
	return selectedBlock
		? { kind: "editor", block: selectedBlock }
		: { kind: "collapsed", firstKey: blocks[0].key };
}

function CollapsedSourceBlockAction({ onPress }: { onPress: () => void }) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<Pressable
			accessibilityLabel={mobileText("editor.sourceBlock.edit")}
			accessibilityRole="button"
			style={({ pressed }) => [
				styles.actionRow,
				pressed ? styles.rowPressed : null,
			]}
			testID="workspace-action-edit-source-block"
			onPress={onPress}
		>
			<View style={styles.actionRowContent}>
				<View style={styles.actionIcon}>
					<ChromeSymbol
						name="clipboard"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				</View>
				<Text numberOfLines={1} style={styles.actionText}>
					{mobileText("editor.sourceBlock.edit")}
				</Text>
			</View>
		</Pressable>
	);
}

function MobileSourceBlockEditor({
	block,
	blocks,
	noteId,
	onClose,
	onSelectBlock,
	onUpdateNoteContent,
	sourceContent,
}: {
	block: MobileMarkdownEditableSourceBlock;
	blocks: MobileMarkdownEditableSourceBlock[];
	noteId: string;
	onClose: () => void;
	onSelectBlock: (key: string) => void;
	onUpdateNoteContent: (noteId: string, content: string) => void;
	sourceContent: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const [content, setContent] = useState(block.content);
	const [infoSuffix, setInfoSuffix] = useState(block.infoSuffix);
	const [language, setLanguage] = useState(block.language);
	const languageEditable = block.kind === "codeBlock";
	const metadataEditable = block.kind !== "mathBlock";

	const saveBlock = () => {
		const result = updateMobileMarkdownEditableSourceBlock({
			markdown: sourceContent,
			update: {
				content,
				infoSuffix,
				key: block.key,
				kind: block.kind,
				language,
			},
		});
		if (result.updated) onUpdateNoteContent(noteId, result.markdown);
		onClose();
	};

	return (
		<View style={styles.editor} testID="workspace-source-block-editor">
			<EditorHeader block={block} />
			<SourceBlockPicker
				block={block}
				blocks={blocks}
				onSelectBlock={onSelectBlock}
			/>
			{languageEditable ? (
				<MobileTextInput
					label={mobileText("editor.sourceBlock.language")}
					testID="workspace-source-block-language-input"
					value={language}
					onChangeText={setLanguage}
				/>
			) : null}
			{metadataEditable ? (
				<MobileTextInput
					label={mobileText("editor.sourceBlock.metadata")}
					testID="workspace-source-block-metadata-input"
					value={infoSuffix}
					onChangeText={setInfoSuffix}
				/>
			) : null}
			<MobileTextInput
				multiline
				label={mobileText("editor.sourceBlock.content")}
				scrollEnabled
				style={styles.contentInput}
				testID="workspace-source-block-content-input"
				textAlignVertical="top"
				value={content}
				onChangeText={setContent}
			/>
			<View style={styles.footer}>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={onClose}
				/>
				<MobileButton label={mobileText("common.save")} onPress={saveBlock} />
			</View>
		</View>
	);
}

function EditorHeader({ block }: { block: MobileMarkdownEditableSourceBlock }) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.header}>
			<ChromeSymbol
				name="clipboard"
				color={mobileColors.textMuted}
				size={desktopToolbarActionParity.iconSize}
			/>
			<Text style={styles.title}>{sourceBlockKindLabel(block)}</Text>
		</View>
	);
}

function SourceBlockPicker({
	block,
	blocks,
	onSelectBlock,
}: {
	block: MobileMarkdownEditableSourceBlock;
	blocks: MobileMarkdownEditableSourceBlock[];
	onSelectBlock: (key: string) => void;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	if (blocks.length <= 1) return null;

	return (
		<View style={styles.picker} testID="workspace-source-block-picker">
			{blocks.map((candidate, index) => (
				<Pressable
					accessibilityLabel={sourceBlockLabel(candidate, index)}
					accessibilityRole="button"
					key={candidate.key}
					style={({ pressed }) => [
						styles.pickerRow,
						candidate.key === block.key ? styles.pickerRowSelected : null,
						pressed ? styles.rowPressed : null,
					]}
					testID={`workspace-source-block-option-${index}`}
					onPress={() => onSelectBlock(candidate.key)}
				>
					<Text numberOfLines={1} style={styles.pickerTitle}>
						{sourceBlockLabel(candidate, index)}
					</Text>
				</Pressable>
			))}
		</View>
	);
}

function sourceBlockLabel(
	block: MobileMarkdownEditableSourceBlock,
	index: number,
): string {
	const suffix =
		block.kind === "codeBlock" && block.language.trim()
			? block.language.trim()
			: `${index + 1}`;
	return `${sourceBlockKindLabel(block)} ${suffix}`;
}

function sourceBlockKindLabel(
	block: MobileMarkdownEditableSourceBlock,
): string {
	if (block.kind === "mathBlock")
		return mobileText("editor.formatting.mathBlock");
	if (block.kind === "mermaid") return mobileText("editor.formatting.mermaid");
	return mobileText("editor.formatting.codeBlock");
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...sourceActionStyles(mobileColors, metrics),
		...sourceEditorStyles(mobileColors, metrics),
		...sourcePickerStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function sourceActionStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const {
		toolbarAction: desktopToolbarActionParity,
		space: mobileSpace,
		type: mobileType,
	} = metrics;
	return StyleSheet.create({
		actionIcon: {
			width: desktopToolbarActionParity.iconSize,
			alignItems: "center",
		},
		actionRow: {
			minWidth: 0,
			borderRadius: 6,
		},
		actionRowContent: {
			minHeight: 44,
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			paddingHorizontal: mobileSpace.sm,
		},
		actionText: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
		rowPressed: {
			backgroundColor: mobileColors.graySoft,
		},
	});
}

function sourceEditorStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		contentInput: {
			minHeight: 180,
		},
		editor: {
			gap: mobileSpace.md,
			borderColor: mobileColors.border,
			borderTopWidth: StyleSheet.hairlineWidth,
			paddingTop: mobileSpace.md,
		},
		footer: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: mobileSpace.sm,
		},
		header: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
		},
		title: {
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
	});
}

function sourcePickerStyles(
	mobileColors: MobileColors,
	metrics: MobileMetrics,
) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		picker: {
			gap: mobileSpace.xs,
		},
		pickerRow: {
			minHeight: 34,
			alignItems: "center",
			flexDirection: "row",
			borderRadius: 6,
			paddingHorizontal: mobileSpace.sm,
			paddingVertical: mobileSpace.xs,
		},
		pickerRowSelected: {
			backgroundColor: mobileColors.selected,
		},
		pickerTitle: {
			minWidth: 0,
			flex: 1,
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
	});
}
