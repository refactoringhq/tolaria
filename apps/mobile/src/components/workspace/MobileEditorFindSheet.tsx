import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { desktopToolbarActionParity } from "../../ui/desktopParity";
import { MobileButton } from "../../ui/MobileButton";
import { MobileIconButton } from "../../ui/MobileIconButton";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileRadius } from "../../ui/tokens";
import { mobileNoteEditableContent } from "../../workspace/mobileDocumentContent";
import {
	type MobileEditorFindOptions,
	type MobileEditorFindSnapshot,
	mobileEditorFindSnapshot,
	nextMobileEditorFindIndex,
	replaceAllMobileEditorFindMatches,
	replaceCurrentMobileEditorFindMatch,
} from "../../workspace/mobileEditorFind";
import type {
	MobileEditorBlock,
	MobileNote,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

export function MobileEditorFindSheet({
	editorBlocks,
	editorBullets,
	note,
	onClose,
	onUpdateContent,
	replace,
}: {
	editorBlocks: MobileEditorBlock[];
	editorBullets: string[];
	note: MobileNote | null;
	onClose: () => void;
	onUpdateContent: (noteId: string, content: string) => void;
	replace: boolean;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const [query, setQuery] = useState("");
	const [replacement, setReplacement] = useState("");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [regex, setRegex] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const content = useMemo(
		() =>
			note
				? mobileNoteEditableContent({
						...note,
						editorBlocks: note.editorBlocks ?? editorBlocks,
						editorBullets,
					})
				: "",
		[editorBlocks, editorBullets, note],
	);
	const options = useMemo<MobileEditorFindOptions>(
		() => ({ caseSensitive, regex }),
		[caseSensitive, regex],
	);
	const snapshot = useMemo(
		() => mobileEditorFindSnapshot(content, query, options, activeIndex),
		[activeIndex, content, options, query],
	);

	if (!note) return null;

	const resetIndex = () => setActiveIndex(0);
	const updateQuery = (value: string) => {
		setQuery(value);
		resetIndex();
	};
	const toggleCaseSensitive = () => {
		setCaseSensitive((value) => !value);
		resetIndex();
	};
	const toggleRegex = () => {
		setRegex((value) => !value);
		resetIndex();
	};
	const moveMatch = (direction: 1 | -1) => {
		setActiveIndex((index) =>
			nextMobileEditorFindIndex(index, snapshot.matchCount, direction),
		);
	};
	const updateNoteContent = (nextContent: string | null) => {
		if (nextContent === null) return;
		onUpdateContent(note.id, nextContent);
	};

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
			style={styles.scrollArea}
		>
			<FindSearchControls
				caseSensitive={caseSensitive}
				noteTitle={note.title}
				query={query}
				regex={regex}
				snapshot={snapshot}
				onMoveMatch={moveMatch}
				onQueryChange={updateQuery}
				onToggleCaseSensitive={toggleCaseSensitive}
				onToggleRegex={toggleRegex}
			/>
			{replace ? (
				<ReplaceControls
					content={content}
					options={options}
					query={query}
					replacement={replacement}
					snapshot={snapshot}
					onReplacementChange={setReplacement}
					onUpdateContent={updateNoteContent}
				/>
			) : null}
			<View style={styles.footer}>
				<MobileButton
					label={mobileText("common.cancel")}
					variant="ghost"
					onPress={onClose}
				/>
			</View>
		</ScrollView>
	);
}

function FindSearchControls(props: {
	caseSensitive: boolean;
	noteTitle: string;
	query: string;
	regex: boolean;
	snapshot: MobileEditorFindSnapshot;
	onMoveMatch: (direction: 1 | -1) => void;
	onQueryChange: (value: string) => void;
	onToggleCaseSensitive: () => void;
	onToggleRegex: () => void;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<>
			<View style={styles.summary} testID="workspace-find-note-summary">
				<Text numberOfLines={1} style={styles.summaryTitle}>
					{props.noteTitle}
				</Text>
				<Text style={styles.summaryStatus} testID="workspace-find-count">
					{mobileEditorFindStatusText(props.snapshot)}
				</Text>
			</View>
			<MobileTextInput
				autoFocus
				label={mobileText("editor.find.findLabel")}
				placeholder={mobileText("editor.find.findPlaceholder")}
				testID="workspace-find-input"
				value={props.query}
				onChangeText={props.onQueryChange}
				onSubmitEditing={() => props.onMoveMatch(1)}
			/>
			<View style={styles.controlRow}>
				<MobileIconButton
					accessibilityLabel={mobileText("editor.find.previousMatch")}
					selected={props.snapshot.hasMatches}
					testID="workspace-find-previous"
					onPress={() => props.onMoveMatch(-1)}
				>
					<ChromeSymbol
						name="findPrevious"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				</MobileIconButton>
				<MobileIconButton
					accessibilityLabel={mobileText("editor.find.nextMatch")}
					selected={props.snapshot.hasMatches}
					testID="workspace-find-next"
					onPress={() => props.onMoveMatch(1)}
				>
					<ChromeSymbol
						name="findNext"
						color={mobileColors.textMuted}
						size={desktopToolbarActionParity.iconSize}
					/>
				</MobileIconButton>
				<FindToggle
					active={props.regex}
					accessibilityLabel={mobileText("editor.find.regex")}
					label=".*"
					testID="workspace-find-regex"
					onPress={props.onToggleRegex}
				/>
				<FindToggle
					active={props.caseSensitive}
					accessibilityLabel={mobileText("editor.find.matchCase")}
					label="Aa"
					testID="workspace-find-case"
					onPress={props.onToggleCaseSensitive}
				/>
			</View>
		</>
	);
}

function ReplaceControls({
	content,
	onReplacementChange,
	onUpdateContent,
	options,
	query,
	replacement,
	snapshot,
}: {
	content: string;
	onReplacementChange: (value: string) => void;
	onUpdateContent: (content: string | null) => void;
	options: MobileEditorFindOptions;
	query: string;
	replacement: string;
	snapshot: MobileEditorFindSnapshot;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const replaceCurrent = () => {
		onUpdateContent(
			replaceCurrentMobileEditorFindMatch({
				activeIndex: snapshot.activeIndex,
				content,
				options,
				query,
				replacement,
			}),
		);
	};
	const replaceAll = () => {
		onUpdateContent(
			replaceAllMobileEditorFindMatches({
				content,
				options,
				query,
				replacement,
			}),
		);
	};

	return (
		<View style={styles.replaceGroup}>
			<MobileTextInput
				label={mobileText("editor.find.replaceLabel")}
				placeholder={mobileText("editor.find.replacePlaceholder")}
				testID="workspace-replace-input"
				value={replacement}
				onChangeText={onReplacementChange}
			/>
			<View style={styles.replaceActions}>
				<MobileButton
					disabled={!snapshot.hasMatches}
					label={mobileText("editor.find.replace")}
					onPress={replaceCurrent}
				/>
				<MobileButton
					disabled={!snapshot.hasMatches}
					label={mobileText("editor.find.replaceAll")}
					onPress={replaceAll}
				/>
			</View>
		</View>
	);
}

function FindToggle({
	accessibilityLabel,
	active,
	label,
	onPress,
	testID,
}: {
	accessibilityLabel: string;
	active: boolean;
	label: string;
	onPress: () => void;
	testID: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Pressable
			accessibilityLabel={accessibilityLabel}
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			style={({ pressed }) => [
				styles.toggle,
				active ? styles.toggleActive : null,
				pressed ? styles.togglePressed : null,
			]}
			testID={testID}
			onPress={onPress}
		>
			<Text
				style={[styles.toggleText, active ? styles.toggleTextActive : null]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function mobileEditorFindStatusText(
	snapshot: MobileEditorFindSnapshot,
): string {
	if (snapshot.error === "Invalid regex")
		return mobileText("editor.find.invalidRegex");
	if (snapshot.error !== null)
		return mobileText("editor.find.regexMustMatchText");
	if (snapshot.matchCount === 0) return mobileText("editor.find.noMatches");

	return mobileText("editor.find.matchCount")
		.replace("{current}", `${snapshot.activeIndex + 1}`)
		.replace("{total}", `${snapshot.matchCount}`);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = {
		...findLayoutStyles(mobileColors, metrics),
		...findToggleStyles(mobileColors, metrics),
	};
	return { mobileColors, styles };
}

function findLayoutStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	return StyleSheet.create({
		content: {
			gap: mobileSpace.md,
			padding: mobileSpace.md,
		},
		controlRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		footer: {
			alignItems: "center",
			flexDirection: "row",
			justifyContent: "flex-end",
		},
		replaceActions: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
			justifyContent: "flex-end",
		},
		replaceGroup: {
			gap: mobileSpace.sm,
		},
		scrollArea: {
			flexShrink: 1,
		},
		summary: {
			minWidth: 0,
			borderBottomColor: mobileColors.border,
			borderBottomWidth: StyleSheet.hairlineWidth,
			gap: mobileSpace.xs,
			paddingBottom: mobileSpace.sm,
		},
		summaryStatus: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
		},
		summaryTitle: {
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
	});
}

function findToggleStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const {
		space: mobileSpace,
		type: mobileType,
		toolbarAction: desktopToolbarActionParity,
	} = metrics;
	return StyleSheet.create({
		toggle: {
			alignItems: "center",
			borderColor: mobileColors.borderStrong,
			borderRadius: mobileRadius.md,
			borderWidth: StyleSheet.hairlineWidth,
			minHeight: desktopToolbarActionParity.iconButtonSize,
			minWidth: 38,
			justifyContent: "center",
			paddingHorizontal: mobileSpace.sm,
		},
		toggleActive: {
			backgroundColor: mobileColors.control,
			borderColor: mobileColors.primary,
		},
		togglePressed: {
			backgroundColor: mobileColors.graySoft,
		},
		toggleText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "500",
		},
		toggleTextActive: {
			color: mobileColors.primary,
		},
	});
}
