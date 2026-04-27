import { useMemo, type RefObject } from 'react'
import {
  Archive,
  ArrowSquareOut,
  ArrowUUpLeft,
  CheckCircle,
  ClipboardText,
  FolderOpen,
  StackSimple,
  Star,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate, type AppLocale } from '../../lib/i18n'
import { APP_COMMAND_IDS, getAppCommandShortcutDisplay } from '../../hooks/appCommandCatalog'
import type { VaultEntry } from '../../types'
import type { NoteContextMenuState } from './useNoteContextMenu'

export interface NoteContextMenuActions {
  canChangeNoteType?: (entry: VaultEntry) => boolean
  canMoveNoteToFolder?: (entry: VaultEntry) => boolean
  onArchiveNote?: (path: string) => void
  onChangeNoteType?: (entry: VaultEntry) => void
  onCopyFilePath?: (path: string) => void
  onDeleteNote?: (path: string) => void
  onMoveNoteToFolder?: (entry: VaultEntry) => void
  onOpenExternalFile?: (path: string) => void
  onOpenInNewWindow?: (entry: VaultEntry) => void
  onRevealFile?: (path: string) => void
  onToggleFavorite?: (path: string) => void
  onToggleOrganized?: (path: string) => void
  onUnarchiveNote?: (path: string) => void
}

interface NoteContextMenuItem {
  destructive?: boolean
  disabled?: boolean
  icon: Icon
  iconWeight?: 'bold' | 'fill' | 'regular'
  label: string
  onSelect: () => void
  shortcut?: string
  testId: string
}

interface NoteContextMenuProps {
  actions: NoteContextMenuActions
  locale?: AppLocale
  menu: NoteContextMenuState | null
  menuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}

function runAndClose(run: () => void, onClose: () => void) {
  onClose()
  run()
}

function buildPrimaryItems(
  entry: VaultEntry,
  actions: NoteContextMenuActions,
  locale: AppLocale,
  onClose: () => void,
): NoteContextMenuItem[] {
  return [
    {
      icon: ArrowSquareOut,
      label: translate(locale, 'command.note.openNewWindow'),
      onSelect: () => runAndClose(() => actions.onOpenInNewWindow?.(entry), onClose),
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteOpenInNewWindow),
      testId: 'note-context-open-window',
      disabled: !actions.onOpenInNewWindow,
    },
    {
      icon: Star,
      iconWeight: entry.favorite ? 'fill' : 'regular',
      label: translate(locale, entry.favorite ? 'command.note.removeFavorite' : 'command.note.addFavorite'),
      onSelect: () => runAndClose(() => actions.onToggleFavorite?.(entry.path), onClose),
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteToggleFavorite),
      testId: 'note-context-toggle-favorite',
      disabled: !actions.onToggleFavorite,
    },
    {
      icon: CheckCircle,
      iconWeight: entry.organized ? 'fill' : 'regular',
      label: translate(locale, entry.organized ? 'command.note.markUnorganized' : 'command.note.markOrganized'),
      onSelect: () => runAndClose(() => actions.onToggleOrganized?.(entry.path), onClose),
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteToggleOrganized),
      testId: 'note-context-toggle-organized',
      disabled: !actions.onToggleOrganized,
    },
  ]
}

function buildRetargetItems(
  entry: VaultEntry,
  actions: NoteContextMenuActions,
  locale: AppLocale,
  onClose: () => void,
): NoteContextMenuItem[] {
  return [
    {
      icon: StackSimple,
      label: translate(locale, 'command.note.changeType'),
      onSelect: () => runAndClose(() => actions.onChangeNoteType?.(entry), onClose),
      testId: 'note-context-change-type',
      disabled: !actions.onChangeNoteType || actions.canChangeNoteType?.(entry) === false,
    },
    {
      icon: FolderOpen,
      label: translate(locale, 'command.note.moveToFolder'),
      onSelect: () => runAndClose(() => actions.onMoveNoteToFolder?.(entry), onClose),
      testId: 'note-context-move-folder',
      disabled: !actions.onMoveNoteToFolder || actions.canMoveNoteToFolder?.(entry) === false,
    },
  ]
}

function buildFileItems(
  entry: VaultEntry,
  actions: NoteContextMenuActions,
  locale: AppLocale,
  onClose: () => void,
): NoteContextMenuItem[] {
  return [
    {
      icon: FolderOpen,
      label: translate(locale, 'editor.toolbar.revealFile'),
      onSelect: () => runAndClose(() => actions.onRevealFile?.(entry.path), onClose),
      testId: 'note-context-reveal-file',
      disabled: !actions.onRevealFile,
    },
    {
      icon: ClipboardText,
      label: translate(locale, 'editor.toolbar.copyFilePath'),
      onSelect: () => runAndClose(() => actions.onCopyFilePath?.(entry.path), onClose),
      testId: 'note-context-copy-file-path',
      disabled: !actions.onCopyFilePath,
    },
    {
      icon: ArrowSquareOut,
      label: 'Open in Default App',
      onSelect: () => runAndClose(() => actions.onOpenExternalFile?.(entry.path), onClose),
      testId: 'note-context-open-default-app',
      disabled: (entry.fileKind ?? 'markdown') === 'markdown' || !actions.onOpenExternalFile,
    },
  ]
}

function buildStateItems(
  entry: VaultEntry,
  actions: NoteContextMenuActions,
  locale: AppLocale,
  onClose: () => void,
): NoteContextMenuItem[] {
  return [
    {
      icon: entry.archived ? ArrowUUpLeft : Archive,
      label: translate(locale, entry.archived ? 'command.note.unarchiveNote' : 'command.note.archiveNote'),
      onSelect: () => runAndClose(() => {
        if (entry.archived) actions.onUnarchiveNote?.(entry.path)
        else actions.onArchiveNote?.(entry.path)
      }, onClose),
      testId: 'note-context-toggle-archive',
      disabled: entry.archived ? !actions.onUnarchiveNote : !actions.onArchiveNote,
    },
    {
      destructive: true,
      icon: Trash,
      label: translate(locale, 'command.note.deleteNote'),
      onSelect: () => runAndClose(() => actions.onDeleteNote?.(entry.path), onClose),
      shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.noteDelete),
      testId: 'note-context-delete',
      disabled: !actions.onDeleteNote,
    },
  ]
}

function visibleItems(items: NoteContextMenuItem[]): NoteContextMenuItem[] {
  return items.filter((item) => !item.disabled)
}

function NoteContextMenuButton({ item }: { item: NoteContextMenuItem }) {
  const Icon = item.icon
  return (
    <Button
      type="button"
      variant="ghost"
      className={`flex h-auto w-full cursor-default items-center justify-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${item.destructive ? 'text-destructive hover:text-destructive' : ''}`}
      onClick={item.onSelect}
      data-testid={item.testId}
    >
      <Icon size={14} weight={item.iconWeight} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {item.shortcut && <span className="ml-4 text-xs text-muted-foreground">{item.shortcut}</span>}
    </Button>
  )
}

function NoteContextMenuGroup({ items }: { items: NoteContextMenuItem[] }) {
  if (items.length === 0) return null
  return (
    <>
      {items.map((item) => <NoteContextMenuButton key={item.testId} item={item} />)}
    </>
  )
}

export function NoteContextMenu({
  actions,
  locale = 'en',
  menu,
  menuRef,
  onClose,
}: NoteContextMenuProps) {
  const groups = useMemo(() => {
    if (!menu) return []
    return [
      visibleItems(buildPrimaryItems(menu.entry, actions, locale, onClose)),
      visibleItems(buildRetargetItems(menu.entry, actions, locale, onClose)),
      visibleItems(buildFileItems(menu.entry, actions, locale, onClose)),
      visibleItems(buildStateItems(menu.entry, actions, locale, onClose)),
    ].filter((group) => group.length > 0)
  }, [actions, locale, menu, onClose])

  if (!menu || groups.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
      style={{ left: menu.x, top: menu.y, minWidth: 220 }}
      data-testid="note-context-menu"
    >
      {groups.map((items, index) => (
        <div key={items[0]?.testId ?? index}>
          {index > 0 && <div className="my-1 h-px bg-border" role="separator" />}
          <NoteContextMenuGroup items={items} />
        </div>
      ))}
    </div>
  )
}
