import { useState } from 'react'
import type { NoteWidthMode, VaultEntry } from '../../types'
import { translate, type AppLocale } from '../../lib/i18n'
import { isHtmlFileEntry } from '../../utils/filePreview'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Archive,
  ArrowUUpLeft,
  ArrowsInLineHorizontal,
  ArrowsOutLineHorizontal,
  ClipboardText,
  FilePdf,
  FolderOpen,
  GitBranch,
  Link,
  ListBullets,
  MapTrifold,
  Trash,
} from '@phosphor-icons/react'
import { BreadcrumbOverflowMenuTrigger } from '../BreadcrumbOverflowMenuTrigger'
import { NoteHistoryMenuItem } from '../note-history/NoteHistoryMenuItem'
import { useBreadcrumbTooltipControl } from './breadcrumbTooltip'
import type { BreadcrumbBarProps } from './breadcrumbBarProps'

function availableDiffAction(showDiffToggle: boolean, onToggleDiff: () => void): (() => void) | undefined {
  return showDiffToggle ? onToggleDiff : undefined
}

function noteWidthLabelKey(noteWidth: NoteWidthMode = 'normal'): Parameters<typeof translate>[1] {
  return noteWidth === 'wide' ? 'editor.toolbar.noteWidthNormal' : 'editor.toolbar.noteWidthWide'
}

function NoteWidthMenuIcon({ noteWidth = 'normal' }: { noteWidth?: NoteWidthMode }) {
  return noteWidth === 'wide' ? <ArrowsInLineHorizontal size={16} /> : <ArrowsOutLineHorizontal size={16} />
}

function archiveLabelKey(archived: boolean): Parameters<typeof translate>[1] {
  return archived ? 'editor.toolbar.restoreArchived' : 'editor.toolbar.archive'
}

function archiveAction(
  archived: boolean,
  onArchive?: () => void,
  onUnarchive?: () => void,
): (() => void) | undefined {
  return archived ? onUnarchive : onArchive
}

function pathAction(action: ((path: string) => void) | undefined, path: string): (() => void) | undefined {
  return action ? () => action(path) : undefined
}

function entryAction(action: ((entry: VaultEntry) => void) | undefined, entry: VaultEntry): (() => void) | undefined {
  return action ? () => action(entry) : undefined
}

function ArchiveMenuIcon({ archived }: { archived: boolean }) {
  return archived ? <ArrowUUpLeft size={16} /> : <Archive size={16} />
}

function neighborhoodAction(
  entry: VaultEntry,
  onEnterNeighborhood?: (entry: VaultEntry) => void,
): (() => void) | undefined {
  return onEnterNeighborhood ? () => onEnterNeighborhood(entry) : undefined
}

type BreadcrumbOverflowMenuProps = Pick<
  BreadcrumbBarProps,
  | 'entry'
  | 'showDiffToggle'
  | 'onToggleDiff'
  | 'noteWidth'
  | 'onToggleNoteWidth'
  | 'showTableOfContents'
  | 'onToggleTableOfContents'
  | 'onRevealFile'
  | 'onCopyFilePath'
  | 'onCopyDeepLink'
  | 'onCopyGitUrl'
  | 'onExportPdf'
  | 'onArchive'
  | 'onUnarchive'
  | 'onDelete'
  | 'onEnterNeighborhood'
> & {
  showResponsiveActions: boolean
  locale: AppLocale
}

export function BreadcrumbOverflowMenu(options: BreadcrumbOverflowMenuProps) {
  const { entry, onExportPdf, locale } = options
  const showMarkdownActions = !isHtmlFileEntry(entry)
  const runDiffAction = availableDiffAction(options.showDiffToggle, options.onToggleDiff)
  const moreActionsLabel = translate(locale, 'editor.toolbar.moreActions')
  const tooltipControl = useBreadcrumbTooltipControl(moreActionsLabel)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <BreadcrumbOverflowMenuTrigger label={moreActionsLabel} setMenuOpen={setMenuOpen} tooltipControl={tooltipControl} />
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem disabled={!runDiffAction} onSelect={runDiffAction}>
          <GitBranch size={16} />
          {translate(locale, 'editor.toolbar.gitDiff')}
        </DropdownMenuItem>
        <NoteHistoryMenuItem path={entry.path} visible={showMarkdownActions} locale={locale} />
        <DropdownMenuItem disabled={!onExportPdf} onSelect={onExportPdf}>
          <FilePdf size={16} />
          {translate(locale, 'editor.toolbar.exportPdf')}
        </DropdownMenuItem>
        <ResponsiveOverflowItems {...options} visible={options.showResponsiveActions} showMarkdownActions={showMarkdownActions} />
        <NoteManagementMenuItems {...options} showMarkdownActions={showMarkdownActions} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Link copying, archiving and deleting: the menu's closing group. */
function NoteManagementMenuItems(options: BreadcrumbOverflowMenuProps & { showMarkdownActions: boolean }) {
  const { entry, onDelete, locale } = options
  const runCopyDeepLinkAction = entryAction(options.onCopyDeepLink, entry)
  const runArchiveAction = archiveAction(entry.archived, options.onArchive, options.onUnarchive)
  return (
    <>
      <DropdownMenuItem disabled={!runCopyDeepLinkAction} onSelect={runCopyDeepLinkAction}>
        <Link size={16} />
        {translate(locale, 'editor.toolbar.copyNoteDeepLink')}
      </DropdownMenuItem>
      <CopyGitUrlMenuItem action={entryAction(options.onCopyGitUrl, entry)} locale={locale} />
      {options.showMarkdownActions && (
        <DropdownMenuItem disabled={!runArchiveAction} onSelect={runArchiveAction}>
          <ArchiveMenuIcon archived={entry.archived} />
          {translate(locale, archiveLabelKey(entry.archived))}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem disabled={!onDelete} variant="destructive" onSelect={onDelete}>
        <Trash size={16} />
        {translate(locale, 'editor.toolbar.delete')}
      </DropdownMenuItem>
    </>
  )
}

/** The toolbar actions that move into the menu when the bar is too narrow to show them. */
function ResponsiveOverflowItems(options: Pick<
  BreadcrumbBarProps,
  | 'entry'
  | 'noteWidth'
  | 'onToggleNoteWidth'
  | 'showTableOfContents'
  | 'onToggleTableOfContents'
  | 'onRevealFile'
  | 'onCopyFilePath'
  | 'onEnterNeighborhood'
> & {
  visible: boolean
  showMarkdownActions: boolean
  locale: AppLocale
}) {
  const { entry, visible, showMarkdownActions, noteWidth, onToggleNoteWidth, showTableOfContents, onToggleTableOfContents, locale } = options
  if (!visible) return null
  const runNeighborhoodAction = neighborhoodAction(entry, options.onEnterNeighborhood)
  const tableOfContentsKey = showTableOfContents ? 'editor.toolbar.closeTableOfContents' : 'editor.toolbar.openTableOfContents'
  return (
    <>
      {showMarkdownActions && (
        <>
          <DropdownMenuItem disabled={!runNeighborhoodAction} onSelect={runNeighborhoodAction}>
            <MapTrifold size={16} />
            {translate(locale, 'editor.toolbar.openNeighborhood')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!onToggleNoteWidth} onSelect={onToggleNoteWidth}>
            <NoteWidthMenuIcon noteWidth={noteWidth} />
            {translate(locale, noteWidthLabelKey(noteWidth))}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!onToggleTableOfContents} onSelect={onToggleTableOfContents}>
            <ListBullets size={16} />
            {translate(locale, tableOfContentsKey)}
          </DropdownMenuItem>
        </>
      )}
      <FilePathMenuItems entry={entry} onRevealFile={options.onRevealFile} onCopyFilePath={options.onCopyFilePath} locale={locale} />
    </>
  )
}

function FilePathMenuItems({ entry, onRevealFile, onCopyFilePath, locale }: Pick<BreadcrumbBarProps, 'entry' | 'onRevealFile' | 'onCopyFilePath'> & {
  locale: AppLocale
}) {
  const runRevealAction = pathAction(onRevealFile, entry.path)
  const runCopyPathAction = pathAction(onCopyFilePath, entry.path)
  return (
    <>
      <DropdownMenuItem disabled={!runRevealAction} onSelect={runRevealAction}>
        <FolderOpen size={16} />
        {translate(locale, 'editor.toolbar.revealFile')}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!runCopyPathAction} onSelect={runCopyPathAction}>
        <ClipboardText size={16} />
        {translate(locale, 'editor.toolbar.copyFilePath')}
      </DropdownMenuItem>
    </>
  )
}

function CopyGitUrlMenuItem({
  action,
  locale,
}: {
  action: (() => void) | undefined
  locale: AppLocale
}) {
  if (!action) return null
  return (
    <DropdownMenuItem onSelect={action}>
      <GitBranch size={16} />
      {translate(locale, 'editor.toolbar.copyNoteGitUrl')}
    </DropdownMenuItem>
  )
}
