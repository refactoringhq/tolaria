import { ArrowsClockwise, DiscordLogo, GearSix, MagnifyingGlass, Megaphone, NotePencil, type Icon } from '@phosphor-icons/react'
import { useEffect, useState, type MouseEventHandler } from 'react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { rememberFeedbackDialogOpener } from '../../lib/feedbackDialogOpener'
import { translate, type AppLocale, type TranslationKey } from '../../lib/i18n'
import type { SyncStatus } from '../../types'
import type { GitRepositoryOption } from '../../utils/gitRepositories'
import { VaultMenu } from '../status-bar/VaultMenu'
import type { VaultMenuProps } from '../status-bar/vaultMenuTypes'

const ICON_BUTTON_CLASS = 'size-7 shrink-0 rounded-lg text-sidebar-foreground'
const UTILITY_BUTTON_CLASS = 'floating-pane-control relative w-8 shrink-0 rounded-full text-sidebar-foreground'

function SidebarIconButton({ icon: Icon, label, onClick, floating = false, testId }: {
  icon: Icon
  label: string
  onClick: MouseEventHandler<HTMLButtonElement>
  floating?: boolean
  testId: string
}) {
  return (
    <ActionTooltip copy={{ label }} side={floating ? 'top' : 'bottom'}>
      <Button type="button" size="icon-sm" variant="ghost"
        className={floating ? UTILITY_BUTTON_CLASS : ICON_BUTTON_CLASS}
        aria-label={label} onClick={onClick} data-testid={testId}>
        <Icon size={16} />
      </Button>
    </ActionTooltip>
  )
}

export function SidebarWorkspaceHeader({ vaultMenu, onSearch, onCreateNote, locale }: {
  vaultMenu: VaultMenuProps
  onSearch: () => void
  onCreateNote: () => void
  locale: AppLocale
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 pb-2 pl-[6px] pr-[15px]" data-testid="sidebar-workspace-header">
      <VaultMenu {...vaultMenu} sidebar />
      <SidebarIconButton icon={MagnifyingGlass} label={translate(locale, 'command.navigation.searchNotes')}
        onClick={onSearch} testId="sidebar-global-search" />
      <SidebarIconButton icon={NotePencil} label={translate(locale, 'command.note.newNote')}
        onClick={onCreateNote} testId="sidebar-new-note" />
    </div>
  )
}

interface SidebarSyncMenuProps {
  locale: AppLocale
  count: number
  status: SyncStatus
  lastSyncTime: number | null
  canViewGit: boolean
  canSync: boolean
  offline: boolean
  conflictCount: number
  repositories: GitRepositoryOption[]
  selectedRepositoryPath?: string
  onRepositoryChange: (path: string) => void
  onViewChanges: () => void
  onSyncNow: () => void
  onViewHistory: () => void
}

const SYNC_STATUS_LABELS: Partial<Record<SyncStatus, TranslationKey>> = {
  syncing: 'status.sync.syncing',
  conflict: 'status.sync.conflict',
  error: 'status.sync.failed',
  pull_required: 'status.sync.pullRequired',
}

function syncStatusLabel(
  { locale, lastSyncTime, status, offline }: SidebarSyncMenuProps,
  now: number,
): string {
  if (offline) return translate(locale, 'status.offline.label')
  const statusKey = SYNC_STATUS_LABELS[status]
  if (statusKey) return translate(locale, statusKey)
  if (!lastSyncTime) return translate(locale, 'sidebar.chrome.noSync')
  const minutes = Math.floor((now - lastSyncTime) / 60_000)
  return minutes > 0
    ? translate(locale, 'sidebar.chrome.syncMinutesAgo', { minutes })
    : translate(locale, 'sidebar.chrome.syncJustNow')
}

function useSyncClock(lastSyncTime: number | null) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (lastSyncTime === null) return
    const tick = () => setNow(Date.now())
    const refresh = window.setInterval(tick, 15_000)
    return () => window.clearInterval(refresh)
  }, [lastSyncTime])
  return now
}

function sidebarSyncStatusLabel(props: SidebarSyncMenuProps, now: number): string {
  const { conflictCount, locale, status } = props
  if (status !== 'conflict' || conflictCount === 0) return syncStatusLabel(props, now)
  return translate(locale, 'status.conflict.count', { count: conflictCount, plural: conflictCount === 1 ? '' : 's' })
}

function SidebarSyncCount({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground"
      data-testid="sidebar-sync-count">{count > 99 ? '99+' : count}</span>
  )
}

function SidebarSyncMenu(props: SidebarSyncMenuProps) {
  const {
    locale, count, status, canViewGit, canSync, repositories,
    selectedRepositoryPath, onRepositoryChange, onViewChanges, onSyncNow, onViewHistory,
  } = props
  const now = useSyncClock(props.lastSyncTime)
  const label = translate(locale, 'sidebar.chrome.sync')
  const syncing = status === 'syncing'
  const hasConflicts = status === 'conflict'
  const statusLabel = sidebarSyncStatusLabel(props, now)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-sm" variant="ghost" className={`${UTILITY_BUTTON_CLASS} w-auto min-w-0 shrink gap-1.5 px-2.5`}
          aria-label={`${label}: ${statusLabel}`} title={statusLabel} data-testid="sidebar-sync">
          <ArrowsClockwise size={16} className={syncing ? 'motion-safe:animate-spin' : undefined} />
          <span className="truncate text-xs font-medium">{statusLabel}</span>
          <SidebarSyncCount count={count} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="z-[12000] min-w-44" data-testid="sidebar-sync-menu">
        {repositories.length > 1 && (
          <>
            <DropdownMenuLabel>{translate(locale, 'sidebar.chrome.syncRepository')}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={selectedRepositoryPath} onValueChange={onRepositoryChange}>
              {repositories.map((repository) => (
                <DropdownMenuRadioItem key={repository.path} value={repository.path}>{repository.label}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onViewChanges} disabled={!canViewGit}>{translate(locale, 'sidebar.chrome.viewChanges')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSyncNow} disabled={!canSync || syncing}>
          <span className="flex flex-col">
            <span>{translate(locale, hasConflicts ? 'status.sync.resolveConflicts' : 'status.sync.now')}</span>
            {repositories.length <= 1 && (
              <span className="text-xs text-muted-foreground">{syncStatusLabel({ ...props, status: 'idle', offline: false }, now)}</span>
            )}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onViewHistory} disabled={!canViewGit}>{translate(locale, 'sidebar.chrome.viewHistory')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SidebarUtilities({ sync, onOpenSettings, onContribute, onDiscord }: {
  sync: SidebarSyncMenuProps
  onOpenSettings: () => void
  onContribute: () => void
  onDiscord: () => void
}) {
  const { locale } = sync
  return (
    <div className="sidebar-utilities pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 px-3 [&_button]:pointer-events-auto" data-testid="sidebar-utilities">
      <SidebarSyncMenu {...sync} />
      <SidebarIconButton floating icon={GearSix} label={translate(locale, 'status.settings.open')}
        onClick={onOpenSettings} testId="status-settings" />
      <SidebarIconButton floating icon={Megaphone} label={translate(locale, 'status.feedback.contribute')}
        onClick={(event) => {
          rememberFeedbackDialogOpener(event.currentTarget)
          onContribute()
        }} testId="sidebar-contribute" />
      <SidebarIconButton floating icon={DiscordLogo} label={translate(locale, 'feedback.community.title')}
        onClick={onDiscord} testId="sidebar-discord" />
    </div>
  )
}
