import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCommandRegistry, groupSortKey } from './useCommandRegistry'
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
  relationships: {},
  icon: null,
  color: null,
  order: null,
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
    onSave: vi.fn(),
    onOpenSettings: vi.fn(),
    onTrashNote: vi.fn(),
    onArchiveNote: vi.fn(),
    onUnarchiveNote: vi.fn(),
    onCommitPush: vi.fn(),
    onSetViewMode: vi.fn(),
    onToggleInspector: vi.fn(),
    onSelect: vi.fn(),
    onCloseTab: vi.fn(),
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
})

describe('groupSortKey', () => {
  it('returns ordered keys for all groups', () => {
    expect(groupSortKey('Navigation')).toBeLessThan(groupSortKey('Note'))
    expect(groupSortKey('Note')).toBeLessThan(groupSortKey('Git'))
    expect(groupSortKey('Git')).toBeLessThan(groupSortKey('View'))
    expect(groupSortKey('View')).toBeLessThan(groupSortKey('Settings'))
  })
})
