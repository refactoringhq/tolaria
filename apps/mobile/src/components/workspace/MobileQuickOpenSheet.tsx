import { useDeferredValue, useMemo, useState } from "react";
import {
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	type TextInputKeyPressEventData,
	useWindowDimensions,
	View,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import {
	type MobileQuickOpenRecentState,
	mobileQuickOpenMoveIndex,
	mobileQuickOpenRecentNotes,
	mobileQuickOpenResults,
	mobileQuickOpenSelectedNote,
	rememberMobileQuickOpenNote,
	rememberMobileQuickOpenSearch,
} from "../../workspace/mobileQuickOpen";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Input } from "../ui/input";
import { Text } from "../ui/text";
import { QuickOpenResults } from "./MobileQuickOpenResults.internal";

type MobileQuickOpenSheetProps = {
	notes: MobileNote[];
	selectedNoteId?: string | null;
	onClearWorkspaceSearch: () => void;
	onClose: () => void;
	onSelectNote: (noteId: string) => void;
	typeDefinitions?: MobileTypeDefinitions;
};

const emptyRecents: MobileQuickOpenRecentState = { noteIds: [], searches: [] };
let sessionRecents = emptyRecents;

export function MobileQuickOpenSheet(props: MobileQuickOpenSheetProps) {
	const { styles, metrics } = useMobileStyles(createThemeStyles);
	const controller = useQuickOpenController(props, metrics);
	return (
		<View style={styles.content}>
			<QuickOpenSearchField
				query={controller.query}
				onCancel={controller.close}
				onChange={controller.setQuery}
				onKeyPress={controller.handleKeyPress}
			/>
			<QuickOpenResults
				controller={controller}
				typeDefinitions={props.typeDefinitions}
				styles={styles}
			/>
		</View>
	);
}

function useQuickOpenController(
	props: MobileQuickOpenSheetProps,
	metrics: MobileMetrics,
) {
	const { height: windowHeight } = useWindowDimensions();
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const [selected, setSelected] = useState({ index: 0, query: "" });
	const [recents, setRecents] = useState(sessionRecents);
	const results = useMemo(
		() =>
			deferredQuery.trim()
				? mobileQuickOpenResults(props.notes, deferredQuery)
				: mobileQuickOpenRecentNotes(
						props.notes,
						recents,
						props.selectedNoteId,
					),
		[deferredQuery, props.notes, props.selectedNoteId, recents],
	);
	const selectedIndex = selected.query === query ? selected.index : 0;
	const showHistory =
		query.trim().length === 0 && deferredQuery.trim().length === 0;
	const listHeight = quickOpenListHeight({
		history: showHistory,
		noteCount: results.length,
		recentSearchCount: recents.searches.length,
		rowHeight: metrics.size(quickOpenRowLayout.minHeight),
		windowHeight,
	});
	const actions = useQuickOpenActions({
		props,
		query,
		recents,
		results,
		selectedIndex,
		setQuery,
		setRecents,
		setSelected,
	});
	return {
		...actions,
		listHeight,
		query,
		recents,
		results,
		selectedIndex,
		showHistory,
	};
}

function useQuickOpenActions(state: {
	props: MobileQuickOpenSheetProps;
	query: string;
	recents: MobileQuickOpenRecentState;
	results: MobileNote[];
	selectedIndex: number;
	setQuery: (query: string) => void;
	setRecents: (recent: MobileQuickOpenRecentState) => void;
	setSelected: (selected: { index: number; query: string }) => void;
}) {
	const {
		props,
		query,
		recents,
		results,
		selectedIndex,
		setQuery,
		setRecents,
		setSelected,
	} = state;
	const close = () => {
		props.onClearWorkspaceSearch();
		props.onClose();
	};
	const rememberSearch = (value: string) => {
		sessionRecents = rememberMobileQuickOpenSearch(sessionRecents, value);
		setRecents(sessionRecents);
	};
	const openNote = (note: MobileNote) => {
		if (query.trim()) rememberSearch(query);
		sessionRecents = rememberMobileQuickOpenNote(sessionRecents, note.id);
		setRecents(sessionRecents);
		props.onSelectNote(note.id);
		close();
	};
	const submit = () => {
		const currentResults = query.trim()
			? mobileQuickOpenResults(props.notes, query)
			: mobileQuickOpenRecentNotes(props.notes, recents, props.selectedNoteId);
		const note = mobileQuickOpenSelectedNote(currentResults, selectedIndex);
		if (note) openNote(note);
		else if (query.trim()) rememberSearch(query);
	};
	const handleKeyPress = (
		event: NativeSyntheticEvent<TextInputKeyPressEventData>,
	) => {
		if (event.nativeEvent.key === "ArrowDown") {
			setSelected({
				index: mobileQuickOpenMoveIndex(selectedIndex, results.length, "next"),
				query,
			});
		} else if (event.nativeEvent.key === "ArrowUp") {
			setSelected({
				index: mobileQuickOpenMoveIndex(
					selectedIndex,
					results.length,
					"previous",
				),
				query,
			});
		} else if (event.nativeEvent.key === "Enter") submit();
		else if (event.nativeEvent.key === "Escape") close();
	};
	return { close, handleKeyPress, openNote, setQuery, submit };
}

function QuickOpenSearchField({
	query,
	onCancel,
	onChange,
	onKeyPress,
}: {
	onCancel: () => void;
	onChange: (query: string) => void;
	onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
	query: string;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.searchRow}>
			<View style={styles.searchField}>
				<ChromeSymbol name="search" color={mobileColors.textMuted} size={18} />
				<Input
					accessibilityLabel={mobileText("noteList.mobileSearchPlaceholder")}
					autoCapitalize="none"
					autoCorrect={false}
					autoFocus
					className="border-0 bg-transparent"
					placeholder={mobileText("noteList.mobileSearchPlaceholder")}
					placeholderTextColor={mobileColors.textFaint}
					returnKeyType="search"
					style={styles.searchInput}
					testID="workspace-search-input"
					value={query}
					onChangeText={onChange}
					onKeyPress={onKeyPress}
				/>
				{query ? (
					<Pressable
						accessibilityLabel={mobileText("noteList.clearSearch")}
						accessibilityRole="button"
						hitSlop={8}
						testID="workspace-search-clear"
						onPress={() => onChange("")}
					>
						<ChromeSymbol
							name="close"
							color={mobileColors.textMuted}
							size={17}
						/>
					</Pressable>
				) : null}
			</View>
			<Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
				<Text style={styles.cancelText}>{mobileText("common.cancel")}</Text>
			</Pressable>
		</View>
	);
}

function quickOpenListHeight({
	history,
	noteCount,
	recentSearchCount,
	rowHeight,
	windowHeight,
}: {
	history: boolean;
	noteCount: number;
	recentSearchCount: number;
	rowHeight: number;
	windowHeight: number;
}) {
	const historyHeight = history ? 46 + recentSearchCount * rowHeight : 0;
	return Math.min(
		windowHeight * 0.54,
		Math.max(rowHeight, historyHeight + noteCount * rowHeight),
	);
}

const quickOpenRowLayout = { minHeight: 62 };

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	const styles = {
		...createQuickOpenBaseStyles(mobileColors, mobileSpace, mobileType),
		...createQuickOpenResultStyles(mobileColors, mobileSpace, mobileType),
		...createQuickOpenSearchStyles(mobileColors, mobileSpace, mobileType),
	};
	return { mobileColors, metrics, styles };
}

function createQuickOpenBaseStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		cancelText: { color: mobileColors.primary, fontSize: mobileType.body },
		content: {
			alignSelf: "stretch",
			flexShrink: 1,
			gap: mobileSpace.sm,
			minHeight: 0,
			padding: mobileSpace.md,
		},
		emptyText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.body,
			paddingVertical: mobileSpace.md,
			textAlign: "center",
		},
		history: { paddingBottom: mobileSpace.xs },
		historyText: { color: mobileColors.text, fontSize: mobileType.body },
		matchedTerm: { fontWeight: "700" },
		sectionTitle: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			fontWeight: "600",
			paddingHorizontal: mobileSpace.sm,
			paddingTop: mobileSpace.sm,
		},
	});
}

function createQuickOpenResultStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		historyRow: {
			justifyContent: "center",
			minHeight: quickOpenRowLayout.minHeight,
			paddingHorizontal: mobileSpace.sm,
		},
		resultList: { paddingBottom: mobileSpace.md },
		resultPressed: { backgroundColor: mobileColors.control },
		resultRow: {
			alignItems: "center",
			borderRadius: 8,
			flexDirection: "row",
			gap: mobileSpace.sm,
			minHeight: quickOpenRowLayout.minHeight,
			paddingHorizontal: mobileSpace.sm,
			paddingVertical: mobileSpace.xs,
		},
		resultSelected: { backgroundColor: mobileColors.graySoft },
		resultSnippet: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			minWidth: 0,
		},
		resultText: { flex: 1, gap: 2, minWidth: 0 },
		resultTitle: {
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
			minWidth: 0,
		},
		resultScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
	});
}

function createQuickOpenSearchStyles(
	mobileColors: MobileColors,
	mobileSpace: MobileMetrics["space"],
	mobileType: MobileMetrics["type"],
) {
	return StyleSheet.create({
		searchField: {
			alignItems: "center",
			backgroundColor: mobileColors.control,
			borderRadius: 10,
			flex: 1,
			flexDirection: "row",
			gap: mobileSpace.sm,
			minWidth: 0,
			paddingHorizontal: mobileSpace.sm,
		},
		searchInput: {
			backgroundColor: "transparent",
			borderWidth: 0,
			color: mobileColors.text,
			flex: 1,
			fontSize: mobileType.body,
			minHeight: 40,
			minWidth: 0,
			paddingHorizontal: 0,
			paddingVertical: mobileSpace.xs,
		},
		searchRow: {
			alignItems: "center",
			flexDirection: "row",
			gap: mobileSpace.sm,
		},
	});
}
