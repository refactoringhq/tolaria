import { MagnifyingGlass, X } from 'phosphor-react-native'
import type { ReactElement } from 'react'
import { useDeferredValue, useMemo, useState } from 'react'
import {
  FlatList,
  type FlatListProps,
  type ListRenderItem,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  type TextInputKeyPressEventData,
  useWindowDimensions,
  View,
} from 'react-native'
import { mobileText } from '../../i18n/mobileText'
import type { MobileMetrics } from '../../ui/mobileMetrics'
import type { MobileColors } from '../../ui/theme/mobilePalette'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import {
  type MobileQuickOpenRecentState,
  mobileQuickOpenMoveIndex,
  mobileQuickOpenRecentNotes,
  mobileQuickOpenResults,
  mobileQuickOpenSelectedNote,
  mobileQuickOpenSnippetParts,
  rememberMobileQuickOpenNote,
  rememberMobileQuickOpenSearch,
} from '../../workspace/mobileQuickOpen'
import type { MobileNote, MobileTypeDefinitions } from '../../workspace/mobileWorkspaceModel'
import { Input } from '../ui/input'
import { Text } from '../ui/text'
import { MobileTypeIcon } from './MobileWorkspaceIcons'
import { mobileSearchResultsScrollProps } from './mobileSearchResultsScrollProps'

type MobileQuickOpenSheetProps = {
  notes: MobileNote[]
  selectedNoteId?: string | null
  onClearWorkspaceSearch: () => void
  onClose: () => void
  onSelectNote: (noteId: string) => void
  typeDefinitions?: MobileTypeDefinitions
}

const emptyRecents: MobileQuickOpenRecentState = { noteIds: [], searches: [] }
let sessionRecents = emptyRecents

export function MobileQuickOpenSheet(props: MobileQuickOpenSheetProps) {
  const { styles, metrics } = useMobileStyles(createThemeStyles)
  const controller = useQuickOpenController(props, metrics)
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
  )
}

function useQuickOpenController(props: MobileQuickOpenSheetProps, metrics: MobileMetrics) {
  const { height: windowHeight } = useWindowDimensions()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [selected, setSelected] = useState({ index: 0, query: '' })
  const [recents, setRecents] = useState(sessionRecents)
  const results = useMemo(
    () =>
      deferredQuery.trim()
        ? mobileQuickOpenResults(props.notes, deferredQuery)
        : mobileQuickOpenRecentNotes(props.notes, recents, props.selectedNoteId),
    [deferredQuery, props.notes, props.selectedNoteId, recents],
  )
  const selectedIndex = selected.query === query ? selected.index : 0
  const showHistory = query.trim().length === 0 && deferredQuery.trim().length === 0
  const listHeight = quickOpenListHeight({
    history: showHistory,
    noteCount: results.length,
    recentSearchCount: recents.searches.length,
    rowHeight: metrics.size(quickOpenRowLayout.minHeight),
    windowHeight,
  })
  const actions = useQuickOpenActions({
    props,
    query,
    recents,
    results,
    selectedIndex,
    setQuery,
    setRecents,
    setSelected,
  })
  return { ...actions, listHeight, query, recents, results, selectedIndex, showHistory }
}

function useQuickOpenActions(state: {
  props: MobileQuickOpenSheetProps
  query: string
  recents: MobileQuickOpenRecentState
  results: MobileNote[]
  selectedIndex: number
  setQuery: (query: string) => void
  setRecents: (recent: MobileQuickOpenRecentState) => void
  setSelected: (selected: { index: number; query: string }) => void
}) {
  const { props, query, recents, results, selectedIndex, setQuery, setRecents, setSelected } = state
  const close = () => {
    props.onClearWorkspaceSearch()
    props.onClose()
  }
  const rememberSearch = (value: string) => {
    sessionRecents = rememberMobileQuickOpenSearch(sessionRecents, value)
    setRecents(sessionRecents)
  }
  const openNote = (note: MobileNote) => {
    if (query.trim()) rememberSearch(query)
    sessionRecents = rememberMobileQuickOpenNote(sessionRecents, note.id)
    setRecents(sessionRecents)
    props.onSelectNote(note.id)
    close()
  }
  const submit = () => {
    const currentResults = query.trim()
      ? mobileQuickOpenResults(props.notes, query)
      : mobileQuickOpenRecentNotes(props.notes, recents, props.selectedNoteId)
    const note = mobileQuickOpenSelectedNote(currentResults, selectedIndex)
    if (note) openNote(note)
    else if (query.trim()) rememberSearch(query)
  }
  const handleKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === 'ArrowDown') {
      setSelected({
        index: mobileQuickOpenMoveIndex(selectedIndex, results.length, 'next'),
        query,
      })
    } else if (event.nativeEvent.key === 'ArrowUp') {
      setSelected({
        index: mobileQuickOpenMoveIndex(selectedIndex, results.length, 'previous'),
        query,
      })
    } else if (event.nativeEvent.key === 'Enter') submit()
    else if (event.nativeEvent.key === 'Escape') close()
  }
  return { close, handleKeyPress, openNote, setQuery, submit }
}

function QuickOpenResults({
  controller,
  props,
  styles,
}: {
  controller: ReturnType<typeof useQuickOpenController>
  props: MobileQuickOpenSheetProps
  styles: ReturnType<typeof createThemeStyles>['styles']
}) {
  const renderItem = ({ index, item: note }: ListRenderItemInfo<MobileNote>) => (
    <QuickOpenResultRow
      note={note}
      query={controller.query}
      selected={index === controller.selectedIndex}
      typeDefinitions={props.typeDefinitions}
      onPress={() => controller.openNote(note)}
    />
  )
  const header = controller.showHistory ? (
    <QuickOpenHistory searches={controller.recents.searches} onSelectSearch={controller.setQuery} />
  ) : null
  return (
    <QuickOpenNoteList
      data={controller.results}
      extraData={{ query: controller.query, recents: controller.recents, selectedIndex: controller.selectedIndex }}
      header={header}
      listHeight={controller.listHeight}
      renderItem={renderItem}
      styles={styles}
    />
  )
}

function QuickOpenNoteList({
  data,
  extraData,
  header,
  listHeight,
  renderItem,
  styles,
}: {
  data: MobileNote[]
  extraData: { query: string; recents: MobileQuickOpenRecentState; selectedIndex: number }
  header: ReactElement | null
  listHeight: number
  renderItem: ListRenderItem<MobileNote>
  styles: ReturnType<typeof createThemeStyles>['styles']
}) {
  return <FlatList {...quickOpenListProps({ data, extraData, header, listHeight, renderItem, styles })} />
}

function quickOpenListProps({
  data,
  extraData,
  header,
  listHeight,
  renderItem,
  styles,
}: {
  data: MobileNote[]
  extraData: { query: string; recents: MobileQuickOpenRecentState; selectedIndex: number }
  header: ReactElement | null
  listHeight: number
  renderItem: ListRenderItem<MobileNote>
  styles: ReturnType<typeof createThemeStyles>['styles']
}): FlatListProps<MobileNote> {
  return {
    ...quickOpenListDataProps({ data, extraData, ListHeaderComponent: header, renderItem }),
    ...quickOpenListLayoutProps({ listHeight, styles }),
  }
}

function quickOpenListDataProps({
  data,
  extraData,
  ListHeaderComponent: header,
  renderItem,
}: Pick<FlatListProps<MobileNote>, 'data' | 'extraData' | 'ListHeaderComponent' | 'renderItem'>) {
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
  }
}

function quickOpenListLayoutProps({
  listHeight,
  styles,
}: {
  listHeight: number
  styles: ReturnType<typeof createThemeStyles>['styles']
}) {
  return {
    contentContainerStyle: styles.resultList,
    removeClippedSubviews: true,
    style: [styles.resultScroll, { height: listHeight }],
    testID: 'workspace-search-results',
  }
}

function QuickOpenSearchField({
  query,
  onCancel,
  onChange,
  onKeyPress,
}: {
  onCancel: () => void
  onChange: (query: string) => void
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void
  query: string
}) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchField}>
        <MagnifyingGlass color={mobileColors.textMuted} size={18} />
        <Input
          accessibilityLabel={mobileText('noteList.mobileSearchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          className="border-0 bg-transparent"
          placeholder={mobileText('noteList.mobileSearchPlaceholder')}
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
            accessibilityLabel={mobileText('noteList.clearSearch')}
            accessibilityRole="button"
            hitSlop={8}
            testID="workspace-search-clear"
            onPress={() => onChange('')}
          >
            <X color={mobileColors.textMuted} size={17} />
          </Pressable>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
        <Text style={styles.cancelText}>{mobileText('common.cancel')}</Text>
      </Pressable>
    </View>
  )
}

function QuickOpenHistory({
  searches,
  onSelectSearch,
}: {
  onSelectSearch: (query: string) => void
  searches: string[]
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <View style={styles.history}>
      <Text style={styles.sectionTitle}>{mobileText('noteList.recentSearches')}</Text>
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
      <Text style={styles.sectionTitle}>{mobileText('noteList.recentlyOpened')}</Text>
    </View>
  )
}

function QuickOpenResultRow({
  note,
  query,
  selected,
  typeDefinitions,
  onPress,
}: {
  note: MobileNote
  onPress: () => void
  query: string
  selected: boolean
  typeDefinitions?: MobileTypeDefinitions
}) {
  const { styles } = useMobileStyles(createThemeStyles)
  const snippet = mobileQuickOpenSnippetParts(note.snippet, query)
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
            <Text key={`${part.text}-${index}`} style={part.matched ? styles.matchedTerm : null}>
              {part.text}
            </Text>
          ))}
        </Text>
      </View>
    </Pressable>
  )
}

function QuickOpenEmptyState() {
  const { styles } = useMobileStyles(createThemeStyles)
  return <Text style={styles.emptyText}>{mobileText('noteList.noResults')}</Text>
}

function quickOpenListHeight({
  history,
  noteCount,
  recentSearchCount,
  rowHeight,
  windowHeight,
}: {
  history: boolean
  noteCount: number
  recentSearchCount: number
  rowHeight: number
  windowHeight: number
}) {
  const historyHeight = history ? 46 + recentSearchCount * rowHeight : 0
  return Math.min(windowHeight * 0.54, Math.max(rowHeight, historyHeight + noteCount * rowHeight))
}

const quickOpenRowLayout = { minHeight: 62 }

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
  const { space: mobileSpace, type: mobileType } = metrics
  const styles = {
    ...createQuickOpenBaseStyles(mobileColors, mobileSpace, mobileType),
    ...createQuickOpenResultStyles(mobileColors, mobileSpace, mobileType),
    ...createQuickOpenSearchStyles(mobileColors, mobileSpace, mobileType),
  }
  return { mobileColors, metrics, styles }
}

function createQuickOpenBaseStyles(
  mobileColors: MobileColors,
  mobileSpace: MobileMetrics['space'],
  mobileType: MobileMetrics['type'],
) {
  return StyleSheet.create({
    cancelText: { color: mobileColors.primary, fontSize: mobileType.body },
    content: {
      alignSelf: 'stretch',
      flexShrink: 1,
      gap: mobileSpace.sm,
      minHeight: 0,
      padding: mobileSpace.md,
    },
    emptyText: {
      color: mobileColors.textMuted,
      fontSize: mobileType.body,
      paddingVertical: mobileSpace.md,
      textAlign: 'center',
    },
    history: { paddingBottom: mobileSpace.xs },
    historyText: { color: mobileColors.text, fontSize: mobileType.body },
    matchedTerm: { fontWeight: '700' },
    sectionTitle: {
      color: mobileColors.textMuted,
      fontSize: mobileType.caption,
      fontWeight: '600',
      paddingHorizontal: mobileSpace.sm,
      paddingTop: mobileSpace.sm,
    },
  })
}

function createQuickOpenResultStyles(
  mobileColors: MobileColors,
  mobileSpace: MobileMetrics['space'],
  mobileType: MobileMetrics['type'],
) {
  return StyleSheet.create({
    historyRow: {
      justifyContent: 'center',
      minHeight: quickOpenRowLayout.minHeight,
      paddingHorizontal: mobileSpace.sm,
    },
    resultList: { paddingBottom: mobileSpace.md },
    resultPressed: { backgroundColor: mobileColors.control },
    resultRow: {
      alignItems: 'center',
      borderRadius: 8,
      flexDirection: 'row',
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
      fontWeight: '500',
      minWidth: 0,
    },
    resultScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  })
}

function createQuickOpenSearchStyles(
  mobileColors: MobileColors,
  mobileSpace: MobileMetrics['space'],
  mobileType: MobileMetrics['type'],
) {
  return StyleSheet.create({
    searchField: {
      alignItems: 'center',
      backgroundColor: mobileColors.control,
      borderRadius: 10,
      flex: 1,
      flexDirection: 'row',
      gap: mobileSpace.sm,
      minWidth: 0,
      paddingHorizontal: mobileSpace.sm,
    },
    searchInput: {
      backgroundColor: 'transparent',
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
      alignItems: 'center',
      flexDirection: 'row',
      gap: mobileSpace.sm,
    },
  })
}
