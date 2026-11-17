import { CircleNotch as Loader2, MagnifyingGlass, Plus, SidebarSimple, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../../hooks/appCommandDispatcher'
import { useDragRegion } from '../../hooks/useDragRegion'
import { type AppLocale, type TranslationKey, translate } from '../../lib/i18n'
import { trackEvent } from '../../lib/telemetry'
import { TOUCH_TARGET_CLASSNAME } from '../../lib/touchInput'
import type { VaultEntry } from '../../types'
import type { GitRepositoryOption } from '../../utils/gitRepositories'
import type { SortDirection, SortOption } from '../../utils/noteListHelpers'
import { isMac, MACOS_TRAFFIC_LIGHT_SAFE_PADDING } from '../../utils/platform'
import { GitRepositorySelect } from '../GitRepositorySelect'
import { SortDropdown } from '../SortDropdown'
import { ListPropertiesPopover, type ListPropertiesPopoverProps } from './ListPropertiesPopover'

const NOTE_LIST_EXPAND_BUTTON_CLASSNAME = `${TOUCH_TARGET_CLASSNAME} !h-6 !w-6 !min-w-0 !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-4`
export const NOTE_LIST_ACTION_BUTTON_CLASSNAME = `${TOUCH_TARGET_CLASSNAME} !h-auto !w-auto !min-w-0 !rounded-none !p-0 !text-muted-foreground hover:!bg-transparent hover:!text-foreground focus-visible:!bg-transparent data-[state=open]:!bg-transparent data-[state=open]:!text-foreground [&_svg]:!size-4`
const NOTE_LIST_SEARCH_DEBOUNCE_MS = 180
const PROPERTY_TRIGGER_TITLE_KEYS: Record<string, TranslationKey> = {
  'Customize columns': 'noteList.properties.customizeColumns',
  'Customize All Notes columns': 'noteList.properties.customizeAllColumns',
  'Customize Inbox columns': 'noteList.properties.customizeInboxColumns',
}

const localizePropertiesTriggerTitle = (triggerTitle: string, locale: AppLocale): string => {
  const titleKey = PROPERTY_TRIGGER_TITLE_KEYS[triggerTitle]
  if (titleKey) return translate(locale, titleKey)
  return localizeViewPropertiesTriggerTitle(triggerTitle, locale)
}

const localizeViewPropertiesTriggerTitle = (triggerTitle: string, locale: AppLocale): string => {
  return triggerTitle.replace(/^Customize (.+) columns$/, (_match, name: string) => {
    return translate(locale, 'noteList.properties.customizeViewColumns', { name })
  })
}

interface NoteListHeaderProps {
  title: string
  typeDocument: VaultEntry | null
  isEntityView: boolean
  isChangesView?: boolean
  listSort: SortOption
  listDirection: SortDirection
  customProperties: string[]
  sidebarCollapsed?: boolean
  searchVisible: boolean
  search: string
  isSearching: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  propertyPicker?: ListPropertiesPopoverProps | null
  /** Layout menus (List/Kanban and layout-specific settings) shown before the sort control. */
  layoutControls?: React.ReactNode
  gitRepositories?: GitRepositoryOption[]
  selectedGitRepositoryPath?: string
  locale?: AppLocale
  onSortChange: (groupLabel: string, option: SortOption, direction: SortDirection) => void
  onCreateNote: () => void
  onOpenType: (entry: VaultEntry) => void
  onToggleSearch: () => void
  onSearchChange: (value: string) => void
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onGitRepositoryChange?: (path: string) => void
}

function dispatchExpandSidebarFromHeader() {
  trackEvent('sidebar_expanded_from_note_list_header')
  window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
    detail: APP_COMMAND_IDS.viewAll,
  }))
}

function ExpandSidebarButton({ locale }: { locale: AppLocale }) {
  const expandSidebarLabel = translate(locale, 'sidebar.action.expand')

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={NOTE_LIST_EXPAND_BUTTON_CLASSNAME}
      onClick={dispatchExpandSidebarFromHeader}
      title={expandSidebarLabel}
      aria-label={expandSidebarLabel}
      data-no-drag
    >
      <SidebarSimple size={16} weight="regular" />
    </Button>
  )
}

function HeaderTitle({
  title,
  typeDocument,
  onOpenType,
}: Pick<NoteListHeaderProps, 'title' | 'typeDocument' | 'onOpenType'>) {
  const handleClick = typeDocument ? () => onOpenType(typeDocument) : undefined

  if (typeDocument && handleClick) {
    return (
      <button
        type="button"
        className="m-0 min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold"
        onClick={handleClick}
        data-testid="type-header-link"
      >
        {title}
      </button>
    )
  }

  return (
    <h3
      className="m-0 min-w-0 flex-1 truncate text-[14px] font-semibold"
    >
      {title}
    </h3>
  )
}

function HeaderLeading({
  title,
  typeDocument,
  sidebarCollapsed,
  locale,
  onOpenType,
}: Pick<NoteListHeaderProps, 'title' | 'typeDocument' | 'sidebarCollapsed' | 'locale' | 'onOpenType'> & { locale: AppLocale }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 [html[data-touch-input]_&]:!basis-full">
      {sidebarCollapsed && <ExpandSidebarButton locale={locale} />}
      <HeaderTitle title={title} typeDocument={typeDocument} onOpenType={onOpenType} />
    </div>
  )
}

function RepositorySelectorRow({
  isChangesView,
  gitRepositories = [],
  selectedGitRepositoryPath = '',
  locale = 'en',
  onGitRepositoryChange,
}: Pick<
  NoteListHeaderProps,
  | 'isChangesView'
  | 'gitRepositories'
  | 'selectedGitRepositoryPath'
  | 'locale'
  | 'onGitRepositoryChange'
>) {
  if (!isChangesView || !onGitRepositoryChange || gitRepositories.length <= 1) return null

  return (
    <div className="flex h-11 shrink-0 items-center border-b border-border px-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <GitRepositorySelect
        label={translate(locale, 'git.repository.select')}
        repositories={gitRepositories}
        selectedPath={selectedGitRepositoryPath}
        onChange={onGitRepositoryChange}
        testId="changes-repository-select"
      />
    </div>
  )
}

function HeaderActions(options: Pick<
  NoteListHeaderProps,
  | 'isEntityView'
  | 'listSort'
  | 'listDirection'
  | 'customProperties'
  | 'propertyPicker'
  | 'layoutControls'
  | 'locale'
  | 'onSortChange'
  | 'onCreateNote'
  | 'onToggleSearch'
> & {
  locale: AppLocale
}) {
  const {
    isEntityView,
    listSort,
    listDirection,
    customProperties,
    propertyPicker,
    layoutControls,
    locale,
    onSortChange,
    onCreateNote,
    onToggleSearch,
  } = options
  const createNoteRef = useRef(onCreateNote)
  const deferCreateRef = useRef(false)
  useLayoutEffect(() => {
    createNoteRef.current = onCreateNote
  }, [onCreateNote])
  const captureCreateOrigin = useCallback(() => {
    const activeElement = document.activeElement
    deferCreateRef.current = activeElement instanceof Element
      && activeElement.closest('.raw-editor-codemirror') !== null
  }, [])
  const handleCreateNote = useCallback(() => {
    if (!deferCreateRef.current) {
      createNoteRef.current()
      return
    }
    deferCreateRef.current = false
    window.setTimeout(() => createNoteRef.current(), 0)
  }, [])
  return (
    <div className="ml-3 flex shrink-0 items-center justify-end gap-2 [html[data-touch-input]_&]:!ml-0 [html[data-touch-input]_&]:!w-full [html[data-touch-input]_&]:!justify-end" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {layoutControls}
      {!isEntityView && <SortDropdown groupLabel="__list__" current={listSort} direction={listDirection} customProperties={customProperties} locale={locale} iconOnly onChange={onSortChange} />}
      <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onClick={onToggleSearch} title={translate(locale, 'noteList.searchAction')} aria-label={translate(locale, 'noteList.searchAction')}>
        <MagnifyingGlass size={16} />
      </Button>
      {propertyPicker && (
        <ListPropertiesPopover
          {...propertyPicker}
          triggerTitle={localizePropertiesTriggerTitle(propertyPicker.triggerTitle, locale)}
          triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
          locale={locale}
        />
      )}
      <Button type="button" variant="ghost" size="icon-xs" className={NOTE_LIST_ACTION_BUTTON_CLASSNAME} onMouseDown={captureCreateOrigin} onClick={handleCreateNote} title={translate(locale, 'noteList.createNote')} aria-label={translate(locale, 'noteList.createNote')}>
        <Plus size={16} />
      </Button>
    </div>
  )
}

function SearchRow({ search, isSearching, searchInputRef, locale, onSearchChange, onSearchKeyDown }: Pick<
  NoteListHeaderProps,
  | 'search'
  | 'isSearching'
  | 'searchInputRef'
  | 'locale'
  | 'onSearchChange'
  | 'onSearchKeyDown'
> & {
  locale: AppLocale
}) {
  const [draft, setDraft] = useState(search)
  const debounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current === null) return
    window.clearTimeout(debounceRef.current)
    debounceRef.current = null
  }, [])

  useEffect(() => cancelDebounce, [cancelDebounce])

  const hasSearch = draft.length > 0
  const isDebouncing = draft.trim().toLowerCase() !== search.trim().toLowerCase()
  const clearLabel = translate(locale, 'noteList.clearSearch')

  const handleClearSearch = () => {
    cancelDebounce()
    setDraft('')
    onSearchChange('')
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  const handleSearchChange = (value: string) => {
    setDraft(value)
    cancelDebounce()

    if (value.trim().length === 0) {
      onSearchChange('')
      return
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      onSearchChange(value)
    }, NOTE_LIST_SEARCH_DEBOUNCE_MS)
  }

  return (
    <div className="border-b border-border px-3 py-2">
      <div className="relative flex-1" aria-live="polite">
        <Input
          ref={searchInputRef}
          placeholder={translate(locale, 'noteList.searchPlaceholder')}
          value={draft}
          onChange={(event) => handleSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
          className="h-8 pr-16 text-[13px]"
        />
        {hasSearch && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute inset-y-1 right-8 !h-6 !w-6 !min-w-0 !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-3"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClearSearch}
            title={clearLabel}
            aria-label={clearLabel}
          >
            <X size={12} />
          </Button>
        )}
        {(isDebouncing || isSearching) && (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
            data-testid="note-list-search-loading"
          >
            <Loader2 size={12} className="animate-spin" />
          </span>
        )}
      </div>
    </div>
  )
}

export function NoteListHeader(options: NoteListHeaderProps) {
  const { title, typeDocument, isEntityView, isChangesView = false, listSort, listDirection, customProperties } = options
  const { sidebarCollapsed, searchVisible, search, isSearching, searchInputRef, propertyPicker, layoutControls } = options
  const { gitRepositories = [], selectedGitRepositoryPath = '', locale = 'en' } = options
  const { onSortChange, onCreateNote, onOpenType, onToggleSearch, onSearchChange, onSearchKeyDown, onGitRepositoryChange } = options
  const { dragRegionRef } = useDragRegion<HTMLDivElement>()
  const collapsedSidebarPadding = sidebarCollapsed && isMac()
    ? `var(--tolaria-macos-traffic-light-padding, ${MACOS_TRAFFIC_LIGHT_SAFE_PADDING}px)`
    : undefined

  return (
    <>
      <div ref={dragRegionRef} className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4 [html[data-touch-input]_&]:!h-auto [html[data-touch-input]_&]:!min-h-[92px] [html[data-touch-input]_&]:!flex-wrap [html[data-touch-input]_&]:!justify-start [html[data-touch-input]_&]:!content-center [html[data-touch-input]_&]:!gap-0 [html[data-touch-input]_&]:!px-1.5" style={{ cursor: 'default', paddingLeft: collapsedSidebarPadding }}>
        <HeaderLeading
          title={title}
          typeDocument={typeDocument}
          sidebarCollapsed={sidebarCollapsed}
          locale={locale}
          onOpenType={onOpenType}
        />
        <HeaderActions
          isEntityView={isEntityView}
          listSort={listSort}
          listDirection={listDirection}
          customProperties={customProperties}
          propertyPicker={propertyPicker}
          layoutControls={layoutControls}
          locale={locale}
          onSortChange={onSortChange}
          onCreateNote={onCreateNote}
          onToggleSearch={onToggleSearch}
        />
      </div>
      <RepositorySelectorRow
        isChangesView={isChangesView}
        gitRepositories={gitRepositories}
        selectedGitRepositoryPath={selectedGitRepositoryPath}
        locale={locale}
        onGitRepositoryChange={onGitRepositoryChange}
      />
      {searchVisible && (
        <SearchRow
          search={search}
          isSearching={isSearching}
          searchInputRef={searchInputRef}
          locale={locale}
          onSearchChange={onSearchChange}
          onSearchKeyDown={onSearchKeyDown}
        />
      )}
    </>
  )
}
