import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { VaultEntry } from '../../types'
import { translate, type AppLocale } from '../../lib/i18n'
import { extractFrontmatterTitleFromContent, extractH1TitleFromContent } from '../../utils/noteTitle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { slugify } from '../../hooks/useNoteCreation'
import { isPortableName } from '../../utils/portableName'
import { useBreadcrumbTooltipControl } from './breadcrumbTooltip'
import type { BreadcrumbBarProps } from './breadcrumbBarProps'

interface BreadcrumbDisplayTitleState {
  hasH1: boolean
  title: string
}

interface FilenameDisplayProps {
  content?: string | null
  entry: VaultEntry
  filenameStem: string
  syncStem: string | null
  locale?: AppLocale
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  onStartEditing: () => void
}

function focusFilenameInput(
  isEditing: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  if (!isEditing) return
  inputRef.current?.focus()
  inputRef.current?.select()
}

function beginFilenameEditing(
  onRenameFilename: BreadcrumbBarProps['onRenameFilename'],
  filenameStem: string,
  setDraftStem: (value: string) => void,
  setIsEditing: (value: boolean) => void,
) {
  if (!onRenameFilename) return
  setDraftStem(filenameStem)
  setIsEditing(true)
}

/** The stem to rename to, or null; a stem that could leave the folder or break on another desktop is refused here as well as by the backend. */
function resolveFilenameRenameTarget(draftStem: string, filenameStem: string): string | null {
  const nextStem = normalizeFilenameStemInput(draftStem)
  if (nextStem === filenameStem || !isPortableName(nextStem)) return null
  return nextStem
}

function handleFilenameInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  submitRename: () => void,
  cancelEditing: () => void,
) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault()
      submitRename()
      return
    case 'Escape':
      event.preventDefault()
      cancelEditing()
      return
    default:
      return
  }
}

function normalizeFilenameStemInput(value: string): string {
  const trimmed = value.trim()
  return trimmed.replace(/\.md$/i, '').trim()
}

function deriveSyncStem(entry: VaultEntry, content?: string | null): string | null {
  const titleState = deriveContentDisplayTitleState(content) ?? deriveEntryDisplayTitleState(entry)
  const expectedStem = slugify(titleState.title.trim())
  const filenameStem = entry.filename.replace(/\.md$/, '')
  if (expectedStem === filenameStem || !isPortableName(expectedStem)) return null
  return expectedStem
}

function deriveContentDisplayTitleState(content?: string | null): BreadcrumbDisplayTitleState | null {
  if (typeof content !== 'string') return null
  const h1Title = extractH1TitleFromContent(content)
  if (h1Title) return { title: h1Title, hasH1: true }

  const frontmatterTitle = extractFrontmatterTitleFromContent(content)
  return frontmatterTitle ? { title: frontmatterTitle, hasH1: false } : null
}

function deriveEntryDisplayTitleState(entry: VaultEntry): BreadcrumbDisplayTitleState {
  return {
    title: entry.title.trim(),
    hasH1: entry.hasH1,
  }
}

function deriveBreadcrumbDisplayTitle(entry: VaultEntry, filenameStem: string, content?: string | null): string | null {
  const displayState = deriveContentDisplayTitleState(content) ?? deriveEntryDisplayTitleState(entry)
  const displayTitle = displayState.title.trim()
  if (!displayTitle || displayState.hasH1) return null
  if (slugify(displayTitle) === slugify(filenameStem)) return null
  return displayTitle
}

function FilenameInput({
  inputRef,
  draftStem,
  locale = 'en',
  onDraftStemChange,
  onBlur,
  onKeyDown,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  draftStem: string
  locale?: AppLocale
  onDraftStemChange: (nextValue: string) => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <Input
      ref={inputRef}
      value={draftStem}
      onChange={(event) => onDraftStemChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-7 w-[180px] text-sm"
      data-testid="breadcrumb-filename-input"
      aria-label={translate(locale, 'editor.filename.rename')}
    />
  )
}

function FilenameTrigger({
  filenameStem,
  locale = 'en',
  onStartEditing,
}: {
  filenameStem: string
  locale?: AppLocale
  onStartEditing: () => void
}) {
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onStartEditing()
  }, [onStartEditing])

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="h-auto min-w-0 gap-1 px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
      onDoubleClick={onStartEditing}
      onKeyDown={handleKeyDown}
      data-testid="breadcrumb-filename-trigger"
      aria-label={translate(locale, 'editor.filename.trigger', { filename: filenameStem })}
    >
      <span className="breadcrumb-bar__filename-text truncate">{filenameStem}</span>
    </Button>
  )
}

function SyncFilenameButton({
  entryPath,
  syncStem,
  locale = 'en',
  onRenameFilename,
}: {
  entryPath: string
  syncStem: string | null
  locale?: AppLocale
  onRenameFilename?: (path: string, newFilenameStem: string) => void
}) {
  const tooltipLabel = translate(locale, 'editor.filename.renameToTitle')
  const tooltipControl = useBreadcrumbTooltipControl(tooltipLabel)

  if (!syncStem || !onRenameFilename) return null
  return (
    <ActionTooltip
      copy={{ label: tooltipLabel }}
      side="bottom"
      open={tooltipControl.open}
      onOpenChange={tooltipControl.onOpenChange}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => onRenameFilename(entryPath, syncStem)}
        data-testid="breadcrumb-sync-button"
        aria-label={tooltipLabel}
        onPointerEnter={tooltipControl.onPointerEnter}
        onPointerLeave={tooltipControl.onPointerLeave}
        onFocus={tooltipControl.onFocus}
        onBlur={tooltipControl.onBlur}
      >
        <ArrowsClockwise size={14} />
      </Button>
    </ActionTooltip>
  )
}

function FilenameDisplay(props: FilenameDisplayProps) {
  const { content, entry, filenameStem, syncStem, locale, onRenameFilename, onStartEditing } = props
  const displayTitle = deriveBreadcrumbDisplayTitle(entry, filenameStem, content)

  return (
    <div className="flex min-w-0 items-center gap-1">
      {displayTitle && (
        <>
          <span
            className="min-w-0 max-w-[min(24rem,45vw)] truncate text-foreground"
            data-testid="breadcrumb-display-title"
            title={displayTitle}
          >
            {displayTitle}
          </span>
          <span aria-hidden="true" className="shrink-0 text-border">·</span>
        </>
      )}
      <FilenameTrigger filenameStem={filenameStem} locale={locale} onStartEditing={onStartEditing} />
      <SyncFilenameButton entryPath={entry.path} syncStem={syncStem} locale={locale} onRenameFilename={onRenameFilename} />
    </div>
  )
}

export function FilenameCrumb({ content, entry, locale = 'en', onRenameFilename }: Pick<BreadcrumbBarProps, 'content' | 'entry' | 'locale' | 'onRenameFilename'>) {
  const filenameStem = useMemo(() => entry.filename.replace(/\.md$/, ''), [entry.filename])
  const syncStem = useMemo(() => deriveSyncStem(entry, content), [entry, content])
  const [isEditing, setIsEditing] = useState(false)
  const [draftStem, setDraftStem] = useState(filenameStem)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    focusFilenameInput(isEditing, inputRef)
  }, [isEditing])

  const startEditing = useCallback(() => {
    beginFilenameEditing(onRenameFilename, filenameStem, setDraftStem, setIsEditing)
  }, [onRenameFilename, filenameStem])

  const cancelEditing = useCallback(() => {
    setDraftStem(filenameStem)
    setIsEditing(false)
  }, [filenameStem])

  const submitRename = useCallback(() => {
    setIsEditing(false)
    const nextStem = resolveFilenameRenameTarget(draftStem, filenameStem)
    if (!nextStem) return
    onRenameFilename?.(entry.path, nextStem)
  }, [draftStem, filenameStem, onRenameFilename, entry.path])

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    handleFilenameInputKeyDown(event, submitRename, cancelEditing)
  }, [submitRename, cancelEditing])

  if (isEditing) {
    return (
      <FilenameInput
        inputRef={inputRef}
        draftStem={draftStem}
        locale={locale}
        onDraftStemChange={setDraftStem}
        onBlur={submitRename}
        onKeyDown={handleInputKeyDown}
      />
    )
  }

  return (
    <FilenameDisplay
      content={content}
      entry={entry}
      filenameStem={filenameStem}
      syncStem={syncStem}
      locale={locale}
      onRenameFilename={onRenameFilename}
      onStartEditing={startEditing}
    />
  )
}
