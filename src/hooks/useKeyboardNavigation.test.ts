import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry, SidebarSelection } from '../types'
import { useKeyboardNavigation } from './useKeyboardNavigation'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

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

interface Tab {
  entry: VaultEntry
  content: string
}

describe('useKeyboardNavigation', () => {
  const onSwitchTab = vi.fn()
  const onReplaceActiveTab = vi.fn()
  const onSelectNote = vi.fn()

  const entries = [
    makeEntry({ path: '/vault/a.md', title: 'A', modifiedAt: 1700000003 }),
    makeEntry({ path: '/vault/b.md', title: 'B', modifiedAt: 1700000002 }),
    makeEntry({ path: '/vault/c.md', title: 'C', modifiedAt: 1700000001 }),
  ]

  const tabs: Tab[] = [
    { entry: entries[0], content: '# A' },
    { entry: entries[1], content: '# B' },
    { entry: entries[2], content: '# C' },
  ]

  const selection: SidebarSelection = { kind: 'filter', filter: 'all' }
  const allContent: Record<string, string> = {}

  let addedListeners: { type: string; handler: EventListenerOrEventListenerObject }[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    addedListeners = []
    // Track added listeners for cleanup verification
    const origAdd = window.addEventListener
    const origRemove = window.removeEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
      addedListeners.push({ type, handler })
      origAdd.call(window, type, handler, opts)
    })
    vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) => {
      origRemove.call(window, type, handler, opts)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers keydown listener on mount', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/a.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    expect(addedListeners.some(l => l.type === 'keydown')).toBe(true)
  })

  it('switches to next tab on Cmd+Shift+ArrowRight (browser mode)', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/a.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', metaKey: true, shiftKey: true, bubbles: true,
      }))
    })

    expect(onSwitchTab).toHaveBeenCalledWith('/vault/b.md')
  })

  it('switches to previous tab on Cmd+Shift+ArrowLeft (browser mode)', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/b.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowLeft', metaKey: true, shiftKey: true, bubbles: true,
      }))
    })

    expect(onSwitchTab).toHaveBeenCalledWith('/vault/a.md')
  })

  it('wraps around when navigating past last tab', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/c.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', metaKey: true, shiftKey: true, bubbles: true,
      }))
    })

    expect(onSwitchTab).toHaveBeenCalledWith('/vault/a.md')
  })

  it('navigates to next note on Cmd+Alt+ArrowDown', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/a.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onReplaceActiveTab).toHaveBeenCalled()
  })

  it('navigates to previous note on Cmd+Alt+ArrowUp', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/b.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onReplaceActiveTab).toHaveBeenCalled()
  })

  it('selects first note when no active tab', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs: [], activeTabPath: null, entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', metaKey: true, altKey: true, bubbles: true,
      }))
    })

    expect(onSelectNote).toHaveBeenCalled()
  })

  it('does nothing without modifier keys', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs, activeTabPath: '/vault/a.md', entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', bubbles: true,
      }))
    })

    expect(onSwitchTab).not.toHaveBeenCalled()
    expect(onReplaceActiveTab).not.toHaveBeenCalled()
    expect(onSelectNote).not.toHaveBeenCalled()
  })

  it('does nothing with empty tabs for tab navigation', () => {
    renderHook(() =>
      useKeyboardNavigation({
        tabs: [], activeTabPath: null, entries, selection, allContent,
        onSwitchTab, onReplaceActiveTab, onSelectNote,
      })
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', metaKey: true, shiftKey: true, bubbles: true,
      }))
    })

    expect(onSwitchTab).not.toHaveBeenCalled()
  })
})
