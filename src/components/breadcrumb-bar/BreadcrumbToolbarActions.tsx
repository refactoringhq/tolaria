import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { translate, type AppLocale } from '../../lib/i18n'
import { isHtmlFileEntry } from '../../utils/filePreview'
import { APP_COMMAND_IDS, formatShortcutDisplay, getAppCommandShortcutDisplay } from '../../hooks/appCommandCatalog'
import {
  ArrowsInLineHorizontal,
  ArrowsOutLineHorizontal,
  CheckCircle,
  ClipboardText,
  Code,
  FolderOpen,
  ListBullets,
  MapTrifold,
  SidebarSimple,
  Star,
} from '@phosphor-icons/react'
import { BREADCRUMB_ICON_CLASS } from './breadcrumbTooltip'
import { IconActionButton } from './IconActionButton'
import type { BreadcrumbBarProps } from './breadcrumbBarProps'

interface ToggleActionConfig {
  activeClassName: string
  activeLabelKey: Parameters<typeof translate>[1]
  inactiveLabelKey: Parameters<typeof translate>[1]
  shortcut: string
  renderIcon: (active: boolean) => ReactNode
}

const TOGGLE_ACTION_CONFIGS = {
  raw: {
    activeClassName: 'text-foreground',
    activeLabelKey: 'editor.toolbar.rawReturn',
    inactiveLabelKey: 'editor.toolbar.rawOpen',
    shortcut: '⌘\\',
    renderIcon: () => <Code size={16} className={BREADCRUMB_ICON_CLASS} />,
  },
  favorite: {
    activeClassName: 'text-[var(--accent-yellow)]',
    activeLabelKey: 'editor.toolbar.removeFavorite',
    inactiveLabelKey: 'editor.toolbar.addFavorite',
    shortcut: '⌘D',
    renderIcon: (active: boolean) => <Star size={16} weight={active ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />,
  },
  organized: {
    activeClassName: 'text-[var(--accent-green)]',
    activeLabelKey: 'editor.toolbar.markUnorganized',
    inactiveLabelKey: 'editor.toolbar.markOrganized',
    shortcut: '⌘E',
    renderIcon: (active: boolean) => <CheckCircle size={16} weight={active ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />,
  },
} satisfies Record<string, ToggleActionConfig>

interface ConfiguredToggleActionProps {
  active: boolean
  config: ToggleActionConfig
  locale?: AppLocale
  onClick?: () => void
}

function ConfiguredToggleAction({ active, config, locale = 'en', onClick }: ConfiguredToggleActionProps) {
  const labelKey = active ? config.activeLabelKey : config.inactiveLabelKey
  return (
    <IconActionButton
      copy={{ label: translate(locale, labelKey), shortcut: formatShortcutDisplay({ display: config.shortcut }) }}
      onClick={onClick}
      className={active ? config.activeClassName : 'hover:text-foreground'}
    >
      {config.renderIcon(active)}
    </IconActionButton>
  )
}

function RawToggleButton({ rawMode, locale = 'en', onToggleRaw }: { rawMode?: boolean; locale?: AppLocale; onToggleRaw?: () => void }) {
  return <ConfiguredToggleAction active={!!rawMode} config={TOGGLE_ACTION_CONFIGS.raw} locale={locale} onClick={onToggleRaw} />
}

function NoteWidthAction({
  noteWidth = 'normal',
  locale = 'en',
  onToggleNoteWidth,
}: Pick<BreadcrumbBarProps, 'noteWidth' | 'locale' | 'onToggleNoteWidth'>) {
  if (!onToggleNoteWidth) return null

  const isWide = noteWidth === 'wide'
  const NoteWidthIcon = isWide ? ArrowsInLineHorizontal : ArrowsOutLineHorizontal
  return (
    <IconActionButton
      copy={{ label: translate(locale, isWide ? 'editor.toolbar.noteWidthNormal' : 'editor.toolbar.noteWidthWide') }}
      onClick={onToggleNoteWidth}
      className={isWide ? 'text-foreground' : 'hover:text-foreground'}
    >
      <NoteWidthIcon size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function NeighborhoodAction({
  entry,
  locale = 'en',
  onEnterNeighborhood,
}: Pick<BreadcrumbBarProps, 'entry' | 'locale' | 'onEnterNeighborhood'>) {
  if (!onEnterNeighborhood) return null

  return (
    <IconActionButton
      copy={{ label: translate(locale, 'editor.toolbar.openNeighborhood') }}
      onClick={() => onEnterNeighborhood(entry)}
      className="hover:text-foreground"
    >
      <MapTrifold size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function TableOfContentsAction({
  showTableOfContents,
  locale = 'en',
  onToggleTableOfContents,
}: Pick<BreadcrumbBarProps, 'showTableOfContents' | 'locale' | 'onToggleTableOfContents'>) {
  if (!onToggleTableOfContents) return null

  return (
    <IconActionButton
      copy={{
        label: translate(locale, showTableOfContents ? 'editor.toolbar.closeTableOfContents' : 'editor.toolbar.openTableOfContents'),
        shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.viewToggleTableOfContents),
      }}
      onClick={onToggleTableOfContents}
      className={cn(showTableOfContents ? 'text-foreground' : 'hover:text-foreground')}
    >
      <ListBullets size={16} weight={showTableOfContents ? 'bold' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function FilePathActions({
  entry,
  locale = 'en',
  onRevealFile,
  onCopyFilePath,
}: Pick<BreadcrumbBarProps, 'entry' | 'locale' | 'onRevealFile' | 'onCopyFilePath'>) {
  return (
    <>
      {onRevealFile && (
        <IconActionButton
          copy={{ label: translate(locale, 'editor.toolbar.revealFile') }}
          onClick={() => onRevealFile(entry.path)}
          className="hover:text-foreground"
          testId="breadcrumb-reveal-file"
        >
          <FolderOpen size={16} className={BREADCRUMB_ICON_CLASS} />
        </IconActionButton>
      )}
      {onCopyFilePath && (
        <IconActionButton
          copy={{ label: translate(locale, 'editor.toolbar.copyFilePath') }}
          onClick={() => onCopyFilePath(entry.path)}
          className="hover:text-foreground"
          testId="breadcrumb-copy-file-path"
        >
          <ClipboardText size={16} className={BREADCRUMB_ICON_CLASS} />
        </IconActionButton>
      )}
    </>
  )
}

export function InspectorAction({
  inspectorCollapsed,
  locale = 'en',
  onToggleInspector,
}: Pick<BreadcrumbBarProps, 'inspectorCollapsed' | 'locale' | 'onToggleInspector'>) {
  if (!inspectorCollapsed) return null
  return (
    <IconActionButton
      copy={{
        label: translate(locale, 'editor.toolbar.openProperties'),
        shortcut: formatShortcutDisplay({ display: '⌘⇧I' }),
      }}
      onClick={onToggleInspector}
      className="hover:text-foreground"
      testId="breadcrumb-properties-button"
      tooltipAlign="end"
    >
      <SidebarSimple size={16} weight="regular" className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function OverflowToolbarAction({ children }: { children: ReactNode }) {
  return <span className="breadcrumb-bar__overflowable-action flex items-center gap-2">{children}</span>
}

type NoteToolbarActionsProps = Pick<
  BreadcrumbBarProps,
  | 'entry'
  | 'rawMode'
  | 'onToggleRaw'
  | 'forceRawMode'
  | 'noteWidth'
  | 'onToggleNoteWidth'
  | 'showTableOfContents'
  | 'onToggleTableOfContents'
  | 'onToggleFavorite'
  | 'onToggleOrganized'
  | 'onRevealFile'
  | 'onCopyFilePath'
  | 'onEnterNeighborhood'
> & { locale: AppLocale }

/** HTML files are not notes: they get no favorite, organized, neighborhood, width or outline toggles. */
function noteOnlyActions(options: NoteToolbarActionsProps) {
  if (isHtmlFileEntry(options.entry)) return {}
  return {
    onToggleFavorite: options.onToggleFavorite,
    onToggleOrganized: options.onToggleOrganized,
    onEnterNeighborhood: options.onEnterNeighborhood,
    onToggleNoteWidth: options.onToggleNoteWidth,
    onToggleTableOfContents: options.onToggleTableOfContents,
  }
}

/** The note's toolbar buttons; the overflowable ones hide when the bar is too narrow. */
export function NoteToolbarActions(options: NoteToolbarActionsProps) {
  const { entry, locale } = options
  const actions = noteOnlyActions(options)
  return (
    <>
      {actions.onToggleFavorite && (
        <ConfiguredToggleAction active={entry.favorite} config={TOGGLE_ACTION_CONFIGS.favorite} locale={locale} onClick={actions.onToggleFavorite} />
      )}
      {actions.onToggleOrganized && (
        <ConfiguredToggleAction active={entry.organized} config={TOGGLE_ACTION_CONFIGS.organized} locale={locale} onClick={actions.onToggleOrganized} />
      )}
      <OverflowToolbarAction>
        <NeighborhoodAction entry={entry} locale={locale} onEnterNeighborhood={actions.onEnterNeighborhood} />
      </OverflowToolbarAction>
      {!options.forceRawMode && <RawToggleButton rawMode={options.rawMode} locale={locale} onToggleRaw={options.onToggleRaw} />}
      <OverflowToolbarAction>
        <NoteWidthAction noteWidth={options.noteWidth} locale={locale} onToggleNoteWidth={actions.onToggleNoteWidth} />
      </OverflowToolbarAction>
      <OverflowToolbarAction>
        <TableOfContentsAction
          showTableOfContents={options.showTableOfContents}
          locale={locale}
          onToggleTableOfContents={actions.onToggleTableOfContents}
        />
      </OverflowToolbarAction>
      <OverflowToolbarAction>
        <FilePathActions entry={entry} locale={locale} onRevealFile={options.onRevealFile} onCopyFilePath={options.onCopyFilePath} />
      </OverflowToolbarAction>
    </>
  )
}
