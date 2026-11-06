import { type ReactNode, useState } from "react";
import { StyleSheet } from "react-native";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { mobileText } from "../../i18n/mobileText";
import { MobileToolbarTitle } from "../../ui/MobilePanel";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import {
	useMobileColors,
	useMobileMetrics,
	useMobileStyles,
} from "../../ui/theme/useMobileTheme";
import { isMobileMarkdownActionNote } from "../../workspace/mobileNoteActionMode";
import { validateMobileRenameNoteFilePath } from "../../workspace/mobileNotePaths";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import {
	noteFilename,
	noteWritePath,
} from "../../workspace/mobileWorkspacePathRewrites";
import { useMobileModalDismiss } from "../../workspace/useMobileModalDismiss";
import { Button } from "../ui/button";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Input } from "../ui/input";
import { MobileNoteIcon, MobileTypeIcon } from "./MobileWorkspaceIcons";
import { noteTypeColor } from "./mobileWorkspaceTone";

export type MobileFilenameRename = {
	value: string;
	notes: MobileNote[];
	onChange: (value: string) => void;
	onSubmit: () => void;
};

type MobileEditorFileIdentityProps = {
	children?: ReactNode;
	note: MobileNote;
	rename?: MobileFilenameRename;
	typeDefinitions?: MobileTypeDefinitions;
};

export function MobileEditorFileIdentity(props: MobileEditorFileIdentityProps) {
	const analytics = useMobileAnalytics();
	const [renameState, setRenameState] = useState({
		noteId: props.note.id,
		editing: false,
	});
	if (renameState.noteId !== props.note.id)
		setRenameState({ noteId: props.note.id, editing: false });
	const editing = renameState.noteId === props.note.id && renameState.editing;
	const close = () => setRenameState({ noteId: props.note.id, editing: false });
	useMobileModalDismiss(close, editing);
	const filename = noteFilename(noteWritePath(props.note));
	const rename = isMobileMarkdownActionNote(props.note)
		? props.rename
		: undefined;
	const begin = () => {
		rename?.onChange(filename);
		setRenameState({ noteId: props.note.id, editing: true });
		analytics.capture({ name: "mobile_editor_tool_opened", tool: "filename" });
	};
	if (editing && rename)
		return <FilenameForm note={props.note} rename={rename} onClose={close} />;

	return (
		<>
			<EditorFileIcon {...props} />
			<FilenameTitle filename={filename} onPress={rename ? begin : undefined} />
			{props.children}
		</>
	);
}

function FilenameTitle({
	filename,
	onPress,
}: {
	filename: string;
	onPress?: () => void;
}) {
	const { styles } = useMobileStyles(createFilenameStyles);
	const title = (
		<MobileToolbarTitle testID="editor-toolbar-title" title={filename} />
	);
	if (!onPress) return title;
	return (
		<Button
			accessibilityLabel={mobileText("editor.filename.rename")}
			onPress={onPress}
			style={StyleSheet.flatten(styles.trigger)}
			testID="editor-filename-action"
			variant="ghost"
		>
			{title}
		</Button>
	);
}

function FilenameForm({
	note,
	rename,
	onClose,
}: {
	note: MobileNote;
	rename: MobileFilenameRename;
	onClose: () => void;
}) {
	const { styles, colors, iconSize } = useMobileStyles(createFilenameStyles);
	const status = validateMobileRenameNoteFilePath({
		filenameStem: rename.value,
		note,
		notes: rename.notes,
	});
	const valid = status === "ok" || status === "same";
	const submit = () => {
		if (!valid) return;
		onClose();
		if (status === "ok") rename.onSubmit();
	};
	return (
		<>
			<Input
				accessibilityLabel={mobileText("noteList.rename.nameLabel")}
				autoCapitalize="none"
				autoCorrect={false}
				autoFocus
				onChangeText={rename.onChange}
				onKeyPress={(event) => {
					if (event.nativeEvent.key === "Escape") onClose();
				}}
				onSubmitEditing={submit}
				returnKeyType="done"
				selectTextOnFocus
				style={StyleSheet.flatten(styles.input)}
				submitBehavior="submit"
				testID="editor-filename-input"
				value={rename.value}
			/>
			<Button
				accessibilityLabel={mobileText("common.cancel")}
				onPress={onClose}
				size="icon"
				style={StyleSheet.flatten(styles.action)}
				testID="editor-filename-cancel"
				variant="ghost"
			>
				<ChromeSymbol name="close" color={colors.textMuted} size={iconSize} />
			</Button>
			<Button
				accessibilityLabel={mobileText("common.save")}
				disabled={!valid}
				onPress={submit}
				size="icon"
				style={StyleSheet.flatten(styles.action)}
				testID="editor-filename-save"
				variant="ghost"
			>
				<ChromeSymbol
					name="check"
					color={valid ? colors.primary : colors.textMuted}
					size={iconSize}
				/>
			</Button>
		</>
	);
}

function createFilenameStyles(colors: MobileColors, metrics: MobileMetrics) {
	const height = Math.max(44, metrics.size(36));
	const styles = StyleSheet.create({
		trigger: {
			flexShrink: 1,
			minWidth: 0,
			padding: 0,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-start",
			height,
		},
		input: {
			flex: 1,
			minWidth: 0,
			height,
			paddingHorizontal: metrics.size(8),
			paddingVertical: 0,
			color: colors.text,
			backgroundColor: colors.card,
			borderColor: colors.border,
			fontSize: metrics.toolbar.titleFontSize,
		},
		action: {
			width: height,
			height,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: metrics.toolbarAction.borderRadius,
		},
	});
	return { styles, colors, iconSize: metrics.toolbarAction.iconSize };
}

function EditorFileIcon({
	note,
	typeDefinitions,
}: MobileEditorFileIdentityProps) {
	const colors = useMobileColors();
	const { iconSize } = useMobileMetrics().toolbarAction;
	if (isMobileMarkdownActionNote(note) && note.icon?.trim()) {
		return (
			<MobileNoteIcon
				color={noteTypeColor(note.typeTone, colors)}
				icon={note.icon}
				size={iconSize}
				testID="editor-toolbar-note-icon"
			/>
		);
	}

	return (
		<MobileTypeIcon
			fileKind={note.fileKind}
			size={iconSize}
			tone={note.typeTone}
			type={note.type}
			typeDefinitions={typeDefinitions}
		/>
	);
}
