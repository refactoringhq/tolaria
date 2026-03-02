import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCommandRegistry, groupSortKey, pluralizeType, extractVaultTypes } from './useCommandRegistry'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  outgoingLinks: [],
  ...overrides,
})

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    activeTabPath: null as string | null,
    entries: [] as VaultEntry[],
    modifiedCount: 0,
    onQuickOpen: vi.fn(),
    onCreateNote: vi.fn(),
    onCreateNoteOfType: vi.fn(),
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onTrashNote: vi.fn(),
    onRestoreNote: vi.fn(),
    onArchiveNote: vi.fn(),
    onUnarchiveNote: vi.fn(),
    onCommitPush: vi.fn(),
    onSetViewMode: vi.fn(),
    onToggleInspector: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    zoomLevel: 100,
    onSelect: vi.fn(),
    onCloseTab: vi.fn(),
    onOpenDailyNote: vi.fn(),
    ...overrides,
  }
}

describe('useCommandRegistry', () => {
  it('returns all command groups', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig()))
    const groups = new Set(result.current.map(c => c.group))
    expect(groups).toContain('Navigation')
    expect(groups).toContain('Note')
    expect(groups).toContain('Git')
    expect(groups).toContain('View')
    expect(groups).toContain('Settings')
  })

  it('has search-notes command with shortcut', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig()))
    const cmd = result.current.find(c => c.id === 'search-notes')
    expect(cmd).toBeDefined()
    expect(cmd!.shortcut).toBe('⌘P')
    expect(cmd!.enabled).toBe(true)
  })

  it('disables contextual actions when no note is open', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ activeTabPath: null })))
    const trashCmd = result.current.find(c => c.id === 'trash-note')
    expect(trashCmd!.enabled).toBe(false)

    const saveCmd = result.current.find(c => c.id === 'save-note')
    expect(saveCmd!.enabled).toBe(false)

    const closeCmd = result.current.find(c => c.id === 'close-tab')
    expect(closeCmd!.enabled).toBe(false)
  })

  it('enables contextual actions when a note is open', () => {
    const entries = [makeEntry({ path: '/vault/note/test.md' })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries })),
    )
    expect(result.current.find(c => c.id === 'trash-note')!.enabled).toBe(true)
    expect(result.current.find(c => c.id === 'save-note')!.enabled).toBe(true)
    expect(result.current.find(c => c.id === 'close-tab')!.enabled).toBe(true)
  })

  it('shows "Unarchive Note" when active note is archived', () => {
    const entries = [makeEntry({ path: '/vault/note/test.md', archived: true })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries })),
    )
    const archiveCmd = result.current.find(c => c.id === 'archive-note')
    expect(archiveCmd!.label).toBe('Unarchive Note')
  })

  it('shows "Archive Note" when active note is not archived', () => {
    const entries = [makeEntry({ path: '/vault/note/test.md', archived: false })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries })),
    )
    const archiveCmd = result.current.find(c => c.id === 'archive-note')
    expect(archiveCmd!.label).toBe('Archive Note')
  })

  it('shows "Restore Note" when active note is trashed', () => {
    const entries = [makeEntry({ path: '/vault/note/test.md', trashed: true })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries })),
    )
    const trashCmd = result.current.find(c => c.id === 'trash-note')
    expect(trashCmd!.label).toBe('Restore Note')
  })

  it('shows "Trash Note" when active note is not trashed', () => {
    const entries = [makeEntry({ path: '/vault/note/test.md', trashed: false })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries })),
    )
    const trashCmd = result.current.find(c => c.id === 'trash-note')
    expect(trashCmd!.label).toBe('Trash Note')
  })

  it('calls onRestoreNote when trash command executes on trashed note', () => {
    const onRestoreNote = vi.fn()
    const entries = [makeEntry({ path: '/vault/note/test.md', trashed: true })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries, onRestoreNote })),
    )
    result.current.find(c => c.id === 'trash-note')!.execute()
    expect(onRestoreNote).toHaveBeenCalledWith('/vault/note/test.md')
  })

  it('calls onTrashNote when trash command executes on non-trashed note', () => {
    const onTrashNote = vi.fn()
    const entries = [makeEntry({ path: '/vault/note/test.md', trashed: false })]
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', entries, onTrashNote })),
    )
    result.current.find(c => c.id === 'trash-note')!.execute()
    expect(onTrashNote).toHaveBeenCalledWith('/vault/note/test.md')
  })

  it('has toggle-raw-editor command in View group', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig()))
    const cmd = result.current.find(c => c.id === 'toggle-raw-editor')
    expect(cmd).toBeDefined()
    expect(cmd!.group).toBe('View')
  })

  it('disables toggle-raw-editor when no note is open', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ activeTabPath: null })))
    const cmd = result.current.find(c => c.id === 'toggle-raw-editor')
    expect(cmd!.enabled).toBe(false)
  })

  it('enables toggle-raw-editor when a note is open', () => {
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md' })),
    )
    const cmd = result.current.find(c => c.id === 'toggle-raw-editor')
    expect(cmd!.enabled).toBe(true)
  })

  it('calls onToggleRawEditor when toggle-raw-editor executes', () => {
    const onToggleRawEditor = vi.fn()
    const { result } = renderHook(() =>
      useCommandRegistry(makeConfig({ activeTabPath: '/vault/note/test.md', onToggleRawEditor })),
    )
    result.current.find(c => c.id === 'toggle-raw-editor')!.execute()
    expect(onToggleRawEditor).toHaveBeenCalledOnce()
  })

  it('disables commit when no modified files', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ modifiedCount: 0 })))
    expect(result.current.find(c => c.id === 'commit-push')!.enabled).toBe(false)
  })

  it('enables commit when modified files exist', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ modifiedCount: 3 })))
    expect(result.current.find(c => c.id === 'commit-push')!.enabled).toBe(true)
  })

  it('calls onQuickOpen when search-notes executes', () => {
    const onQuickOpen = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onQuickOpen })))
    result.current.find(c => c.id === 'search-notes')!.execute()
    expect(onQuickOpen).toHaveBeenCalled()
  })

  it('calls onSelect with filter when navigation commands execute', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onSelect })))
    result.current.find(c => c.id === 'go-all')!.execute()
    expect(onSelect).toHaveBeenCalledWith({ kind: 'filter', filter: 'all' })
  })

  it('calls onSetViewMode when view commands execute', () => {
    const onSetViewMode = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onSetViewMode })))
    result.current.find(c => c.id === 'view-editor')!.execute()
    expect(onSetViewMode).toHaveBeenCalledWith('editor-only')
  })

  it('zoom-in is enabled when below max zoom', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 100 })))
    expect(result.current.find(c => c.id === 'zoom-in')!.enabled).toBe(true)
  })

  it('zoom-in is disabled at max zoom', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 150 })))
    expect(result.current.find(c => c.id === 'zoom-in')!.enabled).toBe(false)
  })

  it('zoom-out is disabled at min zoom', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 80 })))
    expect(result.current.find(c => c.id === 'zoom-out')!.enabled).toBe(false)
  })

  it('zoom-reset is disabled at 100%', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 100 })))
    expect(result.current.find(c => c.id === 'zoom-reset')!.enabled).toBe(false)
  })

  it('zoom-reset is enabled when not at 100%', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 120 })))
    expect(result.current.find(c => c.id === 'zoom-reset')!.enabled).toBe(true)
  })

  it('zoom-in label shows current zoom level', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ zoomLevel: 120 })))
    expect(result.current.find(c => c.id === 'zoom-in')!.label).toContain('120%')
  })

  it('has toggle-ai-chat command with shortcut', () => {
    const onToggleAIChat = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onToggleAIChat })))
    const cmd = result.current.find(c => c.id === 'toggle-ai-chat')
    expect(cmd).toBeDefined()
    expect(cmd!.shortcut).toBe('⌘I')
    expect(cmd!.group).toBe('View')
    expect(cmd!.enabled).toBe(true)
  })

  it('calls onToggleAIChat when toggle-ai-chat executes', () => {
    const onToggleAIChat = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onToggleAIChat })))
    result.current.find(c => c.id === 'toggle-ai-chat')!.execute()
    expect(onToggleAIChat).toHaveBeenCalled()
  })

  it('has open-daily-note command with shortcut', () => {
    const { result } = renderHook(() => useCommandRegistry(makeConfig()))
    const cmd = result.current.find(c => c.id === 'open-daily-note')
    expect(cmd).toBeDefined()
    expect(cmd!.label).toBe("Open Today's Note")
    expect(cmd!.shortcut).toBe('⌘J')
    expect(cmd!.group).toBe('Note')
    expect(cmd!.enabled).toBe(true)
  })

  it('calls onOpenDailyNote when open-daily-note executes', () => {
    const onOpenDailyNote = vi.fn()
    const { result } = renderHook(() => useCommandRegistry(makeConfig({ onOpenDailyNote })))
    result.current.find(c => c.id === 'open-daily-note')!.execute()
    expect(onOpenDailyNote).toHaveBeenCalled()
  })

  describe('type-aware commands', () => {
    it('generates "New [Type]" commands from vault entries', () => {
      const entries = [
        makeEntry({ path: '/vault/event/birthday.md', isA: 'Event' }),
        makeEntry({ path: '/vault/person/alice.md', isA: 'Person' }),
      ]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries })))
      const newEvent = result.current.find(c => c.id === 'new-event')
      const newPerson = result.current.find(c => c.id === 'new-person')
      expect(newEvent).toBeDefined()
      expect(newEvent!.label).toBe('New Event')
      expect(newEvent!.group).toBe('Note')
      expect(newPerson).toBeDefined()
      expect(newPerson!.label).toBe('New Person')
    })

    it('generates "List [Type]" commands with pluralized names', () => {
      const entries = [
        makeEntry({ path: '/vault/event/birthday.md', isA: 'Event' }),
        makeEntry({ path: '/vault/person/alice.md', isA: 'Person' }),
      ]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries })))
      const listEvents = result.current.find(c => c.id === 'list-event')
      const listPeople = result.current.find(c => c.id === 'list-person')
      expect(listEvents).toBeDefined()
      expect(listEvents!.label).toBe('List Events')
      expect(listEvents!.group).toBe('Navigation')
      expect(listPeople).toBeDefined()
      expect(listPeople!.label).toBe('List People')
    })

    it('calls onCreateNoteOfType when "New [Type]" executes', () => {
      const onCreateNoteOfType = vi.fn()
      const entries = [makeEntry({ path: '/vault/event/birthday.md', isA: 'Event' })]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries, onCreateNoteOfType })))
      result.current.find(c => c.id === 'new-event')!.execute()
      expect(onCreateNoteOfType).toHaveBeenCalledWith('Event')
    })

    it('calls onSelect with sectionGroup when "List [Type]" executes', () => {
      const onSelect = vi.fn()
      const entries = [makeEntry({ path: '/vault/person/alice.md', isA: 'Person' })]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries, onSelect })))
      result.current.find(c => c.id === 'list-person')!.execute()
      expect(onSelect).toHaveBeenCalledWith({ kind: 'sectionGroup', type: 'Person' })
    })

    it('uses default types when vault has no typed notes', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries: [] })))
      expect(result.current.find(c => c.id === 'new-event')).toBeDefined()
      expect(result.current.find(c => c.id === 'new-person')).toBeDefined()
      expect(result.current.find(c => c.id === 'new-project')).toBeDefined()
      expect(result.current.find(c => c.id === 'new-note')).toBeDefined()
    })

    it('excludes Type entries from vault type list', () => {
      const entries = [
        makeEntry({ path: '/vault/type/event.md', isA: 'Type', title: 'Event' }),
        makeEntry({ path: '/vault/event/birthday.md', isA: 'Event' }),
      ]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries })))
      expect(result.current.find(c => c.id === 'new-type')).toBeUndefined()
    })

    it('excludes trashed entries from type extraction', () => {
      const entries = [
        makeEntry({ path: '/vault/event/old.md', isA: 'Event', trashed: true }),
      ]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries })))
      // Should fall back to defaults since the only Event entry is trashed
      expect(result.current.find(c => c.id === 'new-event')).toBeDefined()
      expect(result.current.find(c => c.id === 'new-project')).toBeDefined()
    })

    it('deduplicates types from multiple entries', () => {
      const entries = [
        makeEntry({ path: '/vault/event/a.md', isA: 'Event' }),
        makeEntry({ path: '/vault/event/b.md', isA: 'Event' }),
        makeEntry({ path: '/vault/event/c.md', isA: 'Event' }),
      ]
      const { result } = renderHook(() => useCommandRegistry(makeConfig({ entries })))
      const eventCmds = result.current.filter(c => c.id === 'new-event')
      expect(eventCmds).toHaveLength(1)
    })
  })

  describe('theme commands', () => {
    const themeFixtures = [
      { id: 'default', name: 'Default', description: '', colors: {}, typography: {}, spacing: {} },
      { id: 'dark', name: 'Dark', description: '', colors: {}, typography: {}, spacing: {} },
    ]

    it('generates switch-theme commands for each theme', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onSwitchTheme: vi.fn(),
      })))
      const switchDefault = result.current.find(c => c.id === 'switch-theme-default')
      const switchDark = result.current.find(c => c.id === 'switch-theme-dark')
      expect(switchDefault).toBeDefined()
      expect(switchDefault!.label).toBe('Switch to Default Theme')
      expect(switchDefault!.group).toBe('Appearance')
      expect(switchDark).toBeDefined()
      expect(switchDark!.label).toBe('Switch to Dark Theme')
    })

    it('disables switch command for the currently active theme', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onSwitchTheme: vi.fn(),
      })))
      expect(result.current.find(c => c.id === 'switch-theme-default')!.enabled).toBe(false)
      expect(result.current.find(c => c.id === 'switch-theme-dark')!.enabled).toBe(true)
    })

    it('calls onSwitchTheme when switch command executes', () => {
      const onSwitchTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onSwitchTheme,
      })))
      result.current.find(c => c.id === 'switch-theme-dark')!.execute()
      expect(onSwitchTheme).toHaveBeenCalledWith('dark')
    })

    it('includes new-theme command when onCreateTheme is provided', () => {
      const onCreateTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onCreateTheme,
      })))
      const newTheme = result.current.find(c => c.id === 'new-theme')
      expect(newTheme).toBeDefined()
      expect(newTheme!.group).toBe('Appearance')
      expect(newTheme!.enabled).toBe(true)
    })

    it('omits new-theme command when onCreateTheme is not provided', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default',
      })))
      expect(result.current.find(c => c.id === 'new-theme')).toBeUndefined()
    })

    it('calls onCreateTheme when new-theme executes', () => {
      const onCreateTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onCreateTheme,
      })))
      result.current.find(c => c.id === 'new-theme')!.execute()
      expect(onCreateTheme).toHaveBeenCalled()
    })

    it('includes Appearance in command groups', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onSwitchTheme: vi.fn(),
      })))
      const groups = new Set(result.current.map(c => c.group))
      expect(groups).toContain('Appearance')
    })

    it('generates open-theme commands for each theme when onOpenTheme is provided', () => {
      const onOpenTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onOpenTheme,
      })))
      const openDefault = result.current.find(c => c.id === 'open-theme-default')
      const openDark = result.current.find(c => c.id === 'open-theme-dark')
      expect(openDefault).toBeDefined()
      expect(openDefault!.label).toBe('Edit Default Theme')
      expect(openDefault!.group).toBe('Appearance')
      expect(openDefault!.enabled).toBe(true)
      expect(openDark).toBeDefined()
      expect(openDark!.label).toBe('Edit Dark Theme')
    })

    it('omits open-theme commands when onOpenTheme is not provided', () => {
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default',
      })))
      expect(result.current.find(c => c.id === 'open-theme-default')).toBeUndefined()
      expect(result.current.find(c => c.id === 'open-theme-dark')).toBeUndefined()
    })

    it('calls onOpenTheme with correct themeId when open-theme command executes', () => {
      const onOpenTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onOpenTheme,
      })))
      result.current.find(c => c.id === 'open-theme-dark')!.execute()
      expect(onOpenTheme).toHaveBeenCalledWith('dark')
    })

    it('open-theme command is always enabled regardless of active theme', () => {
      const onOpenTheme = vi.fn()
      const { result } = renderHook(() => useCommandRegistry(makeConfig({
        themes: themeFixtures, activeThemeId: 'default', onOpenTheme,
      })))
      expect(result.current.find(c => c.id === 'open-theme-default')!.enabled).toBe(true)
    })
  })
})

describe('pluralizeType', () => {
  it('handles regular plurals', () => {
    expect(pluralizeType('Event')).toBe('Events')
    expect(pluralizeType('Project')).toBe('Projects')
    expect(pluralizeType('Note')).toBe('Notes')
    expect(pluralizeType('Topic')).toBe('Topics')
  })

  it('handles special plurals', () => {
    expect(pluralizeType('Person')).toBe('People')
    expect(pluralizeType('Responsibility')).toBe('Responsibilities')
  })

  it('handles words ending in y', () => {
    expect(pluralizeType('Category')).toBe('Categories')
  })

  it('handles words ending in s/x/ch/sh', () => {
    expect(pluralizeType('Process')).toBe('Processes')
    expect(pluralizeType('Box')).toBe('Boxes')
  })

  it('does not double-pluralize words ending in vowel+y', () => {
    expect(pluralizeType('Key')).toBe('Keys')
    expect(pluralizeType('Day')).toBe('Days')
  })
})

describe('extractVaultTypes', () => {
  it('extracts unique types from entries', () => {
    const entries = [
      makeEntry({ isA: 'Event' }),
      makeEntry({ isA: 'Person' }),
      makeEntry({ isA: 'Event' }),
    ]
    const types = extractVaultTypes(entries)
    expect(types).toEqual(['Event', 'Person'])
  })

  it('returns default types when no entries', () => {
    const types = extractVaultTypes([])
    expect(types).toContain('Event')
    expect(types).toContain('Person')
    expect(types).toContain('Project')
    expect(types).toContain('Note')
    expect(types).toHaveLength(4)
  })

  it('excludes Type entries', () => {
    const entries = [
      makeEntry({ isA: 'Type' }),
      makeEntry({ isA: 'Event' }),
    ]
    const types = extractVaultTypes(entries)
    expect(types).toEqual(['Event'])
    expect(types).not.toContain('Type')
  })

  it('excludes trashed entries', () => {
    const entries = [makeEntry({ isA: 'Event', trashed: true })]
    const types = extractVaultTypes(entries)
    // Falls back to defaults since the only typed entry is trashed
    expect(types).toContain('Event')
    expect(types).toContain('Person')
    expect(types).toHaveLength(4)
  })

  it('returns sorted types', () => {
    const entries = [
      makeEntry({ isA: 'Procedure' }),
      makeEntry({ isA: 'Event' }),
      makeEntry({ isA: 'Note' }),
    ]
    expect(extractVaultTypes(entries)).toEqual(['Event', 'Note', 'Procedure'])
  })
})

describe('groupSortKey', () => {
  it('returns ordered keys for all groups', () => {
    expect(groupSortKey('Navigation')).toBeLessThan(groupSortKey('Note'))
    expect(groupSortKey('Note')).toBeLessThan(groupSortKey('Git'))
    expect(groupSortKey('Git')).toBeLessThan(groupSortKey('View'))
    expect(groupSortKey('View')).toBeLessThan(groupSortKey('Appearance'))
    expect(groupSortKey('Appearance')).toBeLessThan(groupSortKey('Settings'))
  })
})
