import { MagnifyingGlass, X } from "phosphor-react-native";
import { useState } from "react";
import {
	type NativeSyntheticEvent,
	Pressable,
	type TextInputKeyPressEventData,
	View,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileQuickOpenSnippetParts } from "../../workspace/mobileQuickOpen";
import type {
	MobileNote,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { Input } from "../ui/input";
import { Text } from "../ui/text";
import { createThemeStyles } from "./MobileQuickOpenSheetStyles";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";

export function QuickOpenSearchField({
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
				<MagnifyingGlass color={mobileColors.textMuted} size={18} />
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
						<X color={mobileColors.textMuted} size={17} />
					</Pressable>
				) : null}
			</View>
			<Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
				<Text style={styles.cancelText}>{mobileText("common.cancel")}</Text>
			</Pressable>
		</View>
	);
}

export function QuickOpenHistory({
	searches,
	onSelectSearch,
}: {
	onSelectSearch: (query: string) => void;
	searches: string[];
}) {
	const { styles } = useMobileStyles(createThemeStyles);
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

export function QuickOpenResultRow({
	note,
	query,
	selected,
	typeDefinitions,
	onPress,
}: {
	note: MobileNote;
	onPress: () => void;
	query: string;
	selected: boolean;
	typeDefinitions?: MobileTypeDefinitions;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	const [pressed, setPressed] = useState(false);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			style={[
				styles.resultRow,
				selected && styles.resultSelected,
				pressed && styles.resultPressed,
			]}
			testID={`workspace-search-result-${note.id}`}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			onPress={onPress}
		>
			<View
				style={styles.resultIcon}
				testID={`workspace-search-result-icon-${note.id}`}
			>
				<MobileTypeIcon
					fileKind={note.fileKind}
					size={16}
					tone="gray"
					type={note.type}
					typeDefinitions={typeDefinitions}
				/>
			</View>
			<QuickOpenResultText note={note} query={query} styles={styles} />
		</Pressable>
	);
}

function QuickOpenResultText({
	note,
	query,
	styles,
}: {
	note: MobileNote;
	query: string;
	styles: ReturnType<typeof createThemeStyles>["styles"];
}) {
	const snippet = mobileQuickOpenSnippetParts(note.snippet, query);
	return (
		<View style={styles.resultText}>
			<Text
				numberOfLines={1}
				style={styles.resultTitle}
				testID={`workspace-search-result-title-${note.id}`}
			>
				{note.title}
			</Text>
			<Text
				numberOfLines={1}
				style={styles.resultSnippet}
				testID={`workspace-search-result-snippet-${note.id}`}
			>
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
	);
}

export function QuickOpenEmptyState() {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Text style={styles.emptyText}>{mobileText("noteList.noResults")}</Text>
	);
}
