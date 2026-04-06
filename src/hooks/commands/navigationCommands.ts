import type { CommandAction } from './types'
import type { SidebarSelection } from '../../types'

interface NavigationCommandsConfig {
  onQuickOpen: () => void
  onSelect: (sel: SidebarSelection) => void
  onOpenDailyNote: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  canGoBack?: boolean
  canGoForward?: boolean
}

export function buildNavigationCommands(config: NavigationCommandsConfig): CommandAction[] {
  const { onQuickOpen, onSelect, onGoBack, onGoForward, canGoBack, canGoForward } = config
  return [
    { id: 'search-notes', label: 'Search Notes', group: 'Navigation', shortcut: '⌘P', keywords: ['find', 'open', 'quick'], enabled: true, execute: onQuickOpen },
    { id: 'go-all', label: 'Go to All Notes', group: 'Navigation', keywords: ['filter'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'all' }) },
    { id: 'go-archived', label: 'Go to Archived', group: 'Navigation', keywords: [], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'archived' }) },
    { id: 'go-changes', label: 'Go to Changes', group: 'Navigation', keywords: ['git', 'modified', 'pending'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'changes' }) },
    { id: 'go-pulse', label: 'Go to Pulse', group: 'Navigation', keywords: ['activity', 'history', 'commits', 'git', 'feed'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'pulse' }) },
    { id: 'go-inbox', label: 'Go to Inbox', group: 'Navigation', keywords: ['inbox', 'unlinked', 'orphan', 'unorganized', 'triage'], enabled: true, execute: () => onSelect({ kind: 'filter', filter: 'inbox' }) },
    { id: 'go-back', label: 'Go Back', group: 'Navigation', shortcut: '⌘[', keywords: ['previous', 'history', 'back'], enabled: !!canGoBack, execute: () => onGoBack?.() },
    { id: 'go-forward', label: 'Go Forward', group: 'Navigation', shortcut: '⌘]', keywords: ['next', 'history', 'forward'], enabled: !!canGoForward, execute: () => onGoForward?.() },
  ]
}
