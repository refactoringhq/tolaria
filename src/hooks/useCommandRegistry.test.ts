import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCommandRegistry, buildTypeCommands, extractVaultTypes, pluralizeType, groupSortKey } from './useCommandRegistry'
import type { CommandAction } from './useCommandRegistry'

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    activeTabPath: '/vault/test.md',
    entries: [],
    modifiedCount: 0,
    onQuickOpen: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateNoteOfType: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onDeleteNote: vi.fn(),
    onArchiveNote: vi.fn(),
    onUnarchiveNote: vi.fn(),
    onToggleOrganized: vi.fn(),
    onCommitPush: vi.fn(),
    onResolveConflicts: vi.fn(),
    onSetViewMode: vi.fn(),
    onToggleInspector: vi.fn(),
    onToggleDiff: vi.fn(),
    onToggleRawEditor: vi.fn(),
    onToggleAIChat: vi.fn(),
    onOpenVault: vi.fn(),
    activeNoteModified: false,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    zoomLevel: 100,
    onSelect: vi.fn(),
    onOpenDailyNote: vi.fn(),
    onCloseTab: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    canGoBack: false,
    canGoForward: false,
    onCheckForUpdates: vi.fn(),
    onCreateType: vi.fn(),
    ...overrides,
  }
}

function findCommand(commands: CommandAction[], id: string): CommandAction | undefined {
  return commands.find(c => c.id === id)
}

describe('useCommandRegistry', () => {
  it('includes resolve-conflicts command in Git group', () => {
    const config = makeConfig()
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'resolve-conflicts')
    expect(cmd).toBeDefined()
    expect(cmd!.group).toBe('Git')
    expect(cmd!.label).toBe('Resolve Conflicts')
  })

  it('resolve-conflicts is always enabled', () => {
    const config = makeConfig()
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'resolve-conflicts')
    expect(cmd!.enabled).toBe(true)
  })

  it('resolve-conflicts executes onResolveConflicts callback', () => {
    const onResolveConflicts = vi.fn()
    const config = makeConfig({ onResolveConflicts })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'resolve-conflicts')
    cmd!.execute()
    expect(onResolveConflicts).toHaveBeenCalled()
  })

  it('resolve-conflicts has searchable keywords', () => {
    const config = makeConfig()
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'resolve-conflicts')
    expect(cmd!.keywords).toContain('conflict')
    expect(cmd!.keywords).toContain('merge')
  })

  it('commit-push is enabled when modifiedCount > 0', () => {
    const config = makeConfig({ modifiedCount: 5 })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'commit-push')
    expect(cmd!.enabled).toBe(true)
  })

  it('commit-push is disabled when modifiedCount is 0', () => {
    const config = makeConfig({ modifiedCount: 0 })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'commit-push')
    expect(cmd!.enabled).toBe(false)
  })

  it('resolve-conflicts stays enabled across rerenders', () => {
    const config = makeConfig()
    const { result, rerender } = renderHook(
      (props) => useCommandRegistry(props),
      { initialProps: config },
    )
    expect(findCommand(result.current, 'resolve-conflicts')!.enabled).toBe(true)

    rerender(makeConfig())
    expect(findCommand(result.current, 'resolve-conflicts')!.enabled).toBe(true)
  })

  it('includes set-note-icon command in Note group', () => {
    const config = makeConfig({ onSetNoteIcon: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'set-note-icon')
    expect(cmd).toBeDefined()
    expect(cmd!.group).toBe('Note')
    expect(cmd!.label).toBe('Set Note Icon')
  })

  it('set-note-icon is enabled when active note and callback exist', () => {
    const config = makeConfig({ onSetNoteIcon: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'set-note-icon')
    expect(cmd!.enabled).toBe(true)
  })

  it('set-note-icon is disabled when no active note', () => {
    const config = makeConfig({ activeTabPath: null, onSetNoteIcon: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'set-note-icon')
    expect(cmd!.enabled).toBe(false)
  })

  it('remove-note-icon is enabled when active note has icon', () => {
    const config = makeConfig({ onRemoveNoteIcon: vi.fn(), activeNoteHasIcon: true })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'remove-note-icon')
    expect(cmd!.enabled).toBe(true)
  })

  it('remove-note-icon is disabled when active note has no icon', () => {
    const config = makeConfig({ onRemoveNoteIcon: vi.fn(), activeNoteHasIcon: false })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'remove-note-icon')
    expect(cmd!.enabled).toBe(false)
  })

  it('set-note-icon executes callback', () => {
    const onSetNoteIcon = vi.fn()
    const config = makeConfig({ onSetNoteIcon })
    const { result } = renderHook(() => useCommandRegistry(config))
    findCommand(result.current, 'set-note-icon')!.execute()
    expect(onSetNoteIcon).toHaveBeenCalled()
  })

  it('includes restore deleted note command when provided', () => {
    const config = makeConfig({ onRestoreDeletedNote: vi.fn(), canRestoreDeletedNote: true })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'restore-deleted-note')
    expect(cmd).toBeDefined()
    expect(cmd!.enabled).toBe(true)
  })

  it('disables restore deleted note when there is no deleted preview', () => {
    const config = makeConfig({ onRestoreDeletedNote: vi.fn(), canRestoreDeletedNote: false })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'restore-deleted-note')
    expect(cmd!.enabled).toBe(false)
  })

  it('includes Customize Inbox columns when the Inbox action is available', () => {
    const onCustomizeInboxColumns = vi.fn()
    const config = makeConfig({
      selection: { kind: 'filter', filter: 'inbox' },
      onCustomizeInboxColumns,
      canCustomizeInboxColumns: true,
    })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'customize-inbox-columns')
    expect(cmd).toBeDefined()
    expect(cmd!.enabled).toBe(true)

    cmd!.execute()
    expect(onCustomizeInboxColumns).toHaveBeenCalled()
  })

  it('disables Customize Inbox columns outside the Inbox view', () => {
    const config = makeConfig({
      selection: { kind: 'filter', filter: 'all' },
      onCustomizeInboxColumns: vi.fn(),
      canCustomizeInboxColumns: false,
    })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'customize-inbox-columns')
    expect(cmd!.enabled).toBe(false)
  })

  it('shows Cmd+E on toggle organized and removes it from archive note', () => {
    const config = makeConfig()
    const { result } = renderHook(() => useCommandRegistry(config))
    expect(findCommand(result.current, 'toggle-organized')?.shortcut).toBe('⌘E')
    expect(findCommand(result.current, 'archive-note')?.shortcut).toBeUndefined()
  })

  it('includes Give Feedback in the Settings group when available', () => {
    const onOpenFeedback = vi.fn()
    const config = makeConfig({ onOpenFeedback })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'give-feedback')
    expect(cmd).toBeDefined()
    expect(cmd!.group).toBe('Settings')
    expect(cmd!.enabled).toBe(true)

    cmd!.execute()
    expect(onOpenFeedback).toHaveBeenCalledOnce()
  })
})

describe('pluralizeType', () => {
  it('pluralizes regular types', () => {
    expect(pluralizeType('Project')).toBe('Projects')
    expect(pluralizeType('Note')).toBe('Notes')
  })

  it('uses overrides for irregular plurals', () => {
    expect(pluralizeType('Person')).toBe('People')
    expect(pluralizeType('Responsibility')).toBe('Responsibilities')
  })

  it('handles sibilant endings', () => {
    expect(pluralizeType('Address')).toBe('Addresses')
  })
})

describe('extractVaultTypes', () => {
  it('returns default types when no entries', () => {
    expect(extractVaultTypes([])).toEqual(['Event', 'Person', 'Project', 'Note'])
  })

  it('extracts unique types from entries', () => {
    const entries = [
      { path: '/a', title: 'A', isA: 'Project' },
      { path: '/b', title: 'B', isA: 'Project' },
      { path: '/c', title: 'C', isA: 'Event' },
    ] as never[]
    const types = extractVaultTypes(entries)
    expect(types).toContain('Project')
    expect(types).toContain('Event')
    expect(types).toHaveLength(2)
  })

  it('includes types from Type definition entries', () => {
    const entries = [
      { path: '/book.md', title: 'Book', isA: 'Type' },
    ] as never[]
    const types = extractVaultTypes(entries)
    expect(types).toContain('Book')
  })

  it('includes types from both definitions and instances', () => {
    const entries = [
      { path: '/book.md', title: 'Book', isA: 'Type' },
      { path: '/hp.md', title: 'Harry Potter', isA: 'Book' },
      { path: '/person.md', title: 'Person', isA: 'Type' },
    ] as never[]
    const types = extractVaultTypes(entries)
    expect(types).toContain('Book')
    expect(types).toContain('Person')
    expect(types).toHaveLength(2)
  })

})

describe('groupSortKey', () => {
  it('returns correct order for groups', () => {
    expect(groupSortKey('Navigation')).toBeLessThan(groupSortKey('Note'))
    expect(groupSortKey('Note')).toBeLessThan(groupSortKey('Git'))
    expect(groupSortKey('Git')).toBeLessThan(groupSortKey('View'))
  })
})

describe('install-mcp command', () => {
  it('is enabled when mcpStatus is not_installed and handler provided', () => {
    const config = makeConfig({ mcpStatus: 'not_installed', onInstallMcp: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd).toBeDefined()
    expect(cmd!.enabled).toBe(true)
    expect(cmd!.label).toBe('Install MCP Server')
  })

  it('is enabled when mcpStatus is installed and handler provided (restore use case)', () => {
    const config = makeConfig({ mcpStatus: 'installed', onInstallMcp: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd!.enabled).toBe(true)
    expect(cmd!.label).toBe('Restore MCP Server')
  })

  it('is enabled even when mcpStatus is checking', () => {
    const config = makeConfig({ mcpStatus: 'checking', onInstallMcp: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd!.enabled).toBe(true)
  })

  it('is enabled even when no handler provided', () => {
    const config = makeConfig({ mcpStatus: 'not_installed' })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd!.enabled).toBe(true)
  })

  it('has restore keyword for discoverability', () => {
    const config = makeConfig({ mcpStatus: 'installed', onInstallMcp: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd!.keywords).toContain('restore')
    expect(cmd!.keywords).toContain('mcp')
    expect(cmd!.keywords).toContain('claude')
  })

  it('executes onInstallMcp callback', () => {
    const onInstallMcp = vi.fn()
    const config = makeConfig({ mcpStatus: 'installed', onInstallMcp })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    cmd!.execute()
    expect(onInstallMcp).toHaveBeenCalled()
  })

  it('is in Settings group', () => {
    const config = makeConfig({ mcpStatus: 'installed', onInstallMcp: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'install-mcp')
    expect(cmd!.group).toBe('Settings')
  })
})

describe('reload-vault command', () => {
  it('is present in Settings group', () => {
    const config = makeConfig({ onReloadVault: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'reload-vault')
    expect(cmd).toBeDefined()
    expect(cmd!.group).toBe('Settings')
    expect(cmd!.label).toBe('Reload Vault')
  })

  it('is enabled when onReloadVault is provided', () => {
    const config = makeConfig({ onReloadVault: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'reload-vault')
    expect(cmd!.enabled).toBe(true)
  })

  it('is disabled when onReloadVault is not provided', () => {
    const config = makeConfig()
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'reload-vault')
    expect(cmd!.enabled).toBe(false)
  })

  it('executes onReloadVault callback', () => {
    const onReloadVault = vi.fn()
    const config = makeConfig({ onReloadVault })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'reload-vault')
    cmd!.execute()
    expect(onReloadVault).toHaveBeenCalled()
  })

  it('has searchable keywords', () => {
    const config = makeConfig({ onReloadVault: vi.fn() })
    const { result } = renderHook(() => useCommandRegistry(config))
    const cmd = findCommand(result.current, 'reload-vault')
    expect(cmd!.keywords).toContain('reload')
    expect(cmd!.keywords).toContain('refresh')
    expect(cmd!.keywords).toContain('rescan')
  })
})

describe('buildTypeCommands', () => {
  it('creates new and list commands for each type', () => {
    const onCreateNoteOfType = vi.fn()
    const onSelect = vi.fn()
    const commands = buildTypeCommands(['Project', 'Event'], onCreateNoteOfType, onSelect)
    expect(commands).toHaveLength(4)
    expect(commands[0].id).toBe('new-project')
    expect(commands[1].id).toBe('list-project')
    expect(commands[2].id).toBe('new-event')
    expect(commands[3].id).toBe('list-event')
  })
})
