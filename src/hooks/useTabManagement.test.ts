import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { VaultEntry } from '../types'
import { useTabManagement } from './useTabManagement'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
  mockInvoke: vi.fn().mockResolvedValue('# Mock content'),
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
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  template: null,
  outgoingLinks: [],
  ...overrides,
})

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useTabManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it('starts with no tabs and no active tab', () => {
    const { result } = renderHook(() => useTabManagement())
    expect(result.current.tabs).toEqual([])
    expect(result.current.activeTabPath).toBeNull()
  })

  describe('handleSelectNote', () => {
    it('opens a new tab and sets it active', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/note/a.md' })

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].entry.path).toBe('/vault/note/a.md')
      expect(result.current.activeTabPath).toBe('/vault/note/a.md')
    })

    it('switches to existing tab without duplicating', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/note/a.md' })

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/note/b.md', title: 'B' }))
      })
      // Select first entry again
      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      expect(result.current.tabs).toHaveLength(2)
      expect(result.current.activeTabPath).toBe('/vault/note/a.md')
    })

    it('handles load content failure gracefully', async () => {
      const { mockInvoke } = await import('../mock-tauri')
      vi.mocked(mockInvoke).mockRejectedValueOnce(new Error('fail'))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry()

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      // Tab still opens with empty content on failure
      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].content).toBe('')
      warnSpy.mockRestore()
    })
  })

  describe('handleCloseTab', () => {
    it('removes the tab', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/note/a.md' })

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      act(() => {
        result.current.handleCloseTab('/vault/note/a.md')
      })

      expect(result.current.tabs).toHaveLength(0)
    })

    it('selects next tab when active tab is closed', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/c.md', title: 'C' }))
      })

      // Close middle tab B, should switch to C (same index)
      act(() => {
        result.current.handleSwitchTab('/vault/b.md')
      })
      act(() => {
        result.current.handleCloseTab('/vault/b.md')
      })

      expect(result.current.tabs).toHaveLength(2)
      expect(result.current.activeTabPath).toBe('/vault/c.md')
    })

    it('sets null active when last tab is closed', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md' }))
      })

      act(() => {
        result.current.handleCloseTab('/vault/a.md')
      })

      expect(result.current.activeTabPath).toBeNull()
    })
  })

  describe('handleSwitchTab', () => {
    it('changes the active tab path', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      act(() => {
        result.current.handleSwitchTab('/vault/a.md')
      })

      expect(result.current.activeTabPath).toBe('/vault/a.md')
    })
  })

  describe('handleReorderTabs', () => {
    it('moves a tab from one position to another', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/c.md', title: 'C' }))
      })

      act(() => {
        result.current.handleReorderTabs(2, 0)
      })

      expect(result.current.tabs.map(t => t.entry.title)).toEqual(['C', 'A', 'B'])
    })

    it('preserves active tab after reorder', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/c.md', title: 'C' }))
      })

      // C is active (last opened). Move it to the front.
      act(() => {
        result.current.handleReorderTabs(2, 0)
      })

      expect(result.current.tabs.map(t => t.entry.title)).toEqual(['C', 'A', 'B'])
      expect(result.current.activeTabPath).toBe('/vault/c.md')
    })

    it('persists tab order to localStorage', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      act(() => {
        result.current.handleReorderTabs(1, 0)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'laputa-tab-order',
        expect.any(String),
      )
    })
  })

  describe('handleReplaceActiveTab', () => {
    it('replaces the active tab with a new entry', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })

      const replacement = makeEntry({ path: '/vault/b.md', title: 'B' })
      await act(async () => {
        await result.current.handleReplaceActiveTab(replacement)
      })

      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].entry.path).toBe('/vault/b.md')
      expect(result.current.activeTabPath).toBe('/vault/b.md')
    })

    it('does nothing when replacing with same entry', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/a.md' })

      await act(async () => {
        await result.current.handleSelectNote(entry)
      })

      await act(async () => {
        await result.current.handleReplaceActiveTab(entry)
      })

      expect(result.current.tabs).toHaveLength(1)
    })

    it('falls back to handleSelectNote when no active tab', async () => {
      const { result } = renderHook(() => useTabManagement())
      const entry = makeEntry({ path: '/vault/a.md' })

      await act(async () => {
        await result.current.handleReplaceActiveTab(entry)
      })

      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.activeTabPath).toBe('/vault/a.md')
    })

    it('switches to existing tab instead of replacing when note is already open', async () => {
      const { result } = renderHook(() => useTabManagement())

      // Open two tabs: A (active) and B
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md', title: 'A' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      // Switch back to A
      act(() => { result.current.handleSwitchTab('/vault/a.md') })

      // Replace active tab with B — but B is already open, so it should just switch
      await act(async () => {
        await result.current.handleReplaceActiveTab(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      // Should still have 2 tabs (not replace A), and B should be active
      expect(result.current.tabs).toHaveLength(2)
      expect(result.current.activeTabPath).toBe('/vault/b.md')
      expect(result.current.tabs.map(t => t.entry.title)).toEqual(['A', 'B'])
    })
  })

  describe('closeAllTabs', () => {
    it('clears all tabs and active path', async () => {
      const { result } = renderHook(() => useTabManagement())

      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/a.md' }))
      })
      await act(async () => {
        await result.current.handleSelectNote(makeEntry({ path: '/vault/b.md', title: 'B' }))
      })

      act(() => {
        result.current.closeAllTabs()
      })

      expect(result.current.tabs).toHaveLength(0)
      expect(result.current.activeTabPath).toBeNull()
    })
  })
})
