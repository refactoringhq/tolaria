import type { ReactElement } from "react";
import {
	FlatList,
	type FlatListProps,
	type ListRenderItem,
	type ListRenderItemInfo,
	Pressable,
	type StyleProp,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import {
	type MobileQuickOpenRecentState,
	mobileQuickOpenSnippetParts,
} from "../../workspace/mobileQuickOpen";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";
import { mobileSearchResultsScrollProps } from "./mobileSearchResultsScrollProps";

type QuickOpenStyles = {
	styles: {
		emptyText: StyleProp<TextStyle>;
		resultList: StyleProp<ViewStyle>;
		resultPressed: StyleProp<ViewStyle>;
		resultRow: StyleProp<ViewStyle>;
		resultSelected: StyleProp<ViewStyle>;
		resultSnippet: StyleProp<TextStyle>;
		resultText: StyleProp<ViewStyle>;
		resultTitle: StyleProp<TextStyle>;
		resultScroll: StyleProp<ViewStyle>;
		history: StyleProp<ViewStyle>;
		historyRow: StyleProp<ViewStyle>;
		historyText: StyleProp<TextStyle>;
		sectionTitle: StyleProp<TextStyle>;
		matchedTerm: StyleProp<TextStyle>;
	};
};

type QuickOpenController = {
	openNote: (note: MobileNote) => void;
	query: string;
	recents: MobileQuickOpenRecentState;
	results: MobileNote[];
	selectedIndex: number;
	setQuery: (query: string) => void;
	showHistory: boolean;
	listHeight: number;
};

export function QuickOpenResults({
	controller,
	typeDefinitions,
	styles,
}: {
	controller: QuickOpenController;
	typeDefinitions?: MobileTypeDefinitions;
} & QuickOpenStyles) {
	const renderItem = ({
		index,
		item: note,
	}: ListRenderItemInfo<MobileNote>) => (
		<QuickOpenResultRow
			note={note}
			query={controller.query}
			selected={index === controller.selectedIndex}
			typeDefinitions={typeDefinitions}
			styles={styles}
			onPress={() => controller.openNote(note)}
		/>
	);
	const header = controller.showHistory ? (
		<QuickOpenHistory
			searches={controller.recents.searches}
			styles={styles}
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
	styles: QuickOpenStyles["styles"];
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
	styles: QuickOpenStyles["styles"];
}): FlatListProps<MobileNote> {
	return {
		...quickOpenListDataProps({
			data,
			extraData,
			ListHeaderComponent: header,
			renderItem,
			styles,
		}),
		...quickOpenListLayoutProps({ listHeight, styles }),
	};
}

function quickOpenListDataProps({
	data,
	extraData,
	ListHeaderComponent: header,
	renderItem,
	styles,
}: Pick<
	FlatListProps<MobileNote>,
	"data" | "extraData" | "ListHeaderComponent" | "renderItem"
> & { styles: QuickOpenStyles["styles"] }) {
	return {
		data,
		extraData,
		initialNumToRender: 10,
		...mobileSearchResultsScrollProps(),
		keyExtractor: (note: MobileNote) => note.id,
		ListEmptyComponent: <QuickOpenEmptyState styles={styles} />,
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
	styles: QuickOpenStyles["styles"];
}) {
	return {
		contentContainerStyle: styles.resultList,
		removeClippedSubviews: true,
		style: [styles.resultScroll, { height: listHeight }],
		testID: "workspace-search-results",
	};
}

function QuickOpenHistory({
	searches,
	onSelectSearch,
	styles,
}: {
	onSelectSearch: (query: string) => void;
	searches: string[];
	styles: QuickOpenStyles["styles"];
}) {
	return (
		<View style={styles.history}>
			<Text style={styles.sectionTitle}>
				{mobileText("noteList.recentSearches")}
			</Text>
			{searches.map((search) => (
				<Pressable
					accessibilityRole="button"
					key={search}
					style={styles.historyRow}
					testID={`workspace-recent-search-${search}`}
					onPress={() => onSelectSearch(search)}
				>
					<Text numberOfLines={1} style={styles.historyText}>
						{search}
					</Text>
				</Pressable>
			))}
			<Text style={styles.sectionTitle}>
				{mobileText("noteList.recentlyOpened")}
			</Text>
		</View>
	);
}

function QuickOpenResultRow({
	note,
	query,
	selected,
	typeDefinitions,
	onPress,
	styles,
}: {
	note: MobileNote;
	onPress: () => void;
	query: string;
	selected: boolean;
	typeDefinitions?: MobileTypeDefinitions;
	styles: QuickOpenStyles["styles"];
}) {
	const snippet = mobileQuickOpenSnippetParts(note.snippet, query);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			style={({ pressed }) => [
				styles.resultRow,
				selected ? styles.resultSelected : null,
				pressed ? styles.resultPressed : null,
			]}
			testID={`workspace-search-result-${note.id}`}
			onPress={onPress}
		>
			<MobileTypeIcon
				fileKind={note.fileKind}
				size={16}
				tone="gray"
				type={note.type}
				typeDefinitions={typeDefinitions}
			/>
			<View style={styles.resultText}>
				<Text numberOfLines={1} style={styles.resultTitle}>
					{note.title}
				</Text>
				<Text numberOfLines={1} style={styles.resultSnippet}>
					{snippet.map((part, index) => (
						<Text
							key={`${part.text}-${index}`}
							style={part.matched ? styles.matchedTerm : null}
						>
							{part.text}
						</Text>
					))}
				</Text>
			</View>
		</Pressable>
	);
}

function QuickOpenEmptyState({
	styles,
}: {
	styles: QuickOpenStyles["styles"];
}) {
	return (
		<Text style={styles.emptyText}>{mobileText("noteList.noResults")}</Text>
	);
}
