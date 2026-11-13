import type { ReactElement } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import {
	FlatList,
	type FlatListProps,
	type ListRenderItem,
	type ListRenderItemInfo,
	type NativeSyntheticEvent,
	type TextInputKeyPressEventData,
	useWindowDimensions,
	View,
} from "react-native";
import type { MobileMetrics } from "../../ui/mobileMetrics";
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
import {
	QuickOpenEmptyState,
	QuickOpenHistory,
	QuickOpenResultRow,
	QuickOpenSearchField,
} from "./MobileQuickOpenSheet.internal";
import {
	createThemeStyles,
	quickOpenRowLayout,
} from "./MobileQuickOpenSheetStyles";
import { mobileSearchResultsScrollProps } from "./mobileSearchResultsScrollProps";

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
			<QuickOpenResults controller={controller} props={props} styles={styles} />
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

function QuickOpenResults({
	controller,
	props,
	styles,
}: {
	controller: ReturnType<typeof useQuickOpenController>;
	props: MobileQuickOpenSheetProps;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	const renderItem = ({
		index,
		item: note,
	}: ListRenderItemInfo<MobileNote>) => (
		<QuickOpenResultRow
			note={note}
			query={controller.query}
			selected={index === controller.selectedIndex}
			typeDefinitions={props.typeDefinitions}
			onPress={() => controller.openNote(note)}
		/>
	);
	const header = controller.showHistory ? (
		<QuickOpenHistory
			searches={controller.recents.searches}
			onSelectSearch={controller.setQuery}
		/>
	) : null;
	return (
		<QuickOpenNoteList
			data={controller.results}
			extraData={{
				query: controller.query,
				recents: controller.recents,
				selectedIndex: controller.selectedIndex,
			}}
			header={header}
			listHeight={controller.listHeight}
			renderItem={renderItem}
			styles={styles}
		/>
	);
}

function QuickOpenNoteList({
	data,
	extraData,
	header,
	listHeight,
	renderItem,
	styles,
}: {
	data: MobileNote[];
	extraData: {
		query: string;
		recents: MobileQuickOpenRecentState;
		selectedIndex: number;
	};
	header: ReactElement | null;
	listHeight: number;
	renderItem: ListRenderItem<MobileNote>;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return (
		<FlatList
			{...quickOpenListProps({
				data,
				extraData,
				header,
				listHeight,
				renderItem,
				styles,
			})}
		/>
	);
}

function quickOpenListProps({
	data,
	extraData,
	header,
	listHeight,
	renderItem,
	styles,
}: {
	data: MobileNote[];
	extraData: {
		query: string;
		recents: MobileQuickOpenRecentState;
		selectedIndex: number;
	};
	header: ReactElement | null;
	listHeight: number;
	renderItem: ListRenderItem<MobileNote>;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}): FlatListProps<MobileNote> {
	return {
		...quickOpenListDataProps({
			data,
			extraData,
			ListHeaderComponent: header,
			renderItem,
		}),
		...quickOpenListLayoutProps({ listHeight, styles }),
	};
}

function quickOpenListDataProps({
	data,
	extraData,
	ListHeaderComponent: header,
	renderItem,
}: Pick<
	FlatListProps<MobileNote>,
	"data" | "extraData" | "ListHeaderComponent" | "renderItem"
>) {
	return {
		data,
		extraData,
		initialNumToRender: 10,
		...mobileSearchResultsScrollProps(),
		keyExtractor: (note: MobileNote) => note.id,
		ListEmptyComponent: <QuickOpenEmptyState />,
		ListHeaderComponent: header,
		renderItem,
		windowSize: 5,
	};
}

function quickOpenListLayoutProps({
	listHeight,
	styles,
}: {
	listHeight: number;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	return {
		contentContainerStyle: styles.resultList,
		removeClippedSubviews: true,
		style: [styles.resultScroll, { height: listHeight }],
		testID: "workspace-search-results",
	};
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
