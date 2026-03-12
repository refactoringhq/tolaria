import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppNavigation } from './useAppNavigation'
import type { VaultEntry } from '../types'

function makeEntry(path: string): VaultEntry {
  return { path, filename: path.split('/').pop()!, title: path, isA: null, aliases: [] } as VaultEntry
}

function makeTab(entry: VaultEntry) {
  return { entry, content: '' }
}

describe('useAppNavigation', () => {
  let onSelectNote: ReturnType<typeof vi.fn>
  let onSwitchTab: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSelectNote = vi.fn()
    onSwitchTab = vi.fn()
  })

  function renderNav(overrides: {
    entries?: VaultEntry[]
    tabs?: Array<{ entry: VaultEntry; content: string }>
    activeTabPath?: string | null
  } = {}) {
    const entries = overrides.entries ?? [makeEntry('/a.md'), makeEntry('/b.md'), makeEntry('/c.md')]
    const tabs = overrides.tabs ?? []
    const activeTabPath = overrides.activeTabPath ?? null
    return renderHook(() =>
      useAppNavigation({ entries, tabs, activeTabPath, onSelectNote, onSwitchTab }),
    )
  }

  // --- entriesByPath ---

  describe('entriesByPath', () => {
    it('builds a Map from entries for O(1) lookup', () => {
      const entries = [makeEntry('/a.md'), makeEntry('/b.md')]
      const { result } = renderNav({ entries })
      expect(result.current.entriesByPath.get('/a.md')).toBe(entries[0])
      expect(result.current.entriesByPath.get('/b.md')).toBe(entries[1])
      expect(result.current.entriesByPath.get('/missing.md')).toBeUndefined()
    })
  })

  // --- canGoBack / canGoForward initial state ---

  describe('initial state', () => {
    it('starts with canGoBack=false and canGoForward=false', () => {
      const { result } = renderNav()
      expect(result.current.canGoBack).toBe(false)
      expect(result.current.canGoForward).toBe(false)
    })
  })

  // --- navigation history integration ---

  describe('navigation via activeTabPath changes', () => {
    it('pushes to history when activeTabPath changes, enabling goBack', () => {
      const entries = [makeEntry('/a.md'), makeEntry('/b.md')]
      const tabA = makeTab(entries[0])
      const tabB = makeTab(entries[1])

      const { result, rerender } = renderHook(
        ({ activeTabPath, tabs }) =>
          useAppNavigation({ entries, tabs, activeTabPath, onSelectNote, onSwitchTab }),
        { initialProps: { activeTabPath: '/a.md' as string | null, tabs: [tabA] } },
      )

      // Navigate to /b.md
      rerender({ activeTabPath: '/b.md', tabs: [tabA, tabB] })

      expect(result.current.canGoBack).toBe(true)
      expect(result.current.canGoForward).toBe(false)
    })

    it('handleGoBack switches to the tab if it is open', () => {
      const entries = [makeEntry('/a.md'), makeEntry('/b.md')]
      const tabA = makeTab(entries[0])
      const tabB = makeTab(entries[1])

      const { result, rerender } = renderHook(
        ({ activeTabPath, tabs }) =>
          useAppNavigation({ entries, tabs, activeTabPath, onSelectNote, onSwitchTab }),
        { initialProps: { activeTabPath: '/a.md' as string | null, tabs: [tabA, tabB] } },
      )

      rerender({ activeTabPath: '/b.md', tabs: [tabA, tabB] })

      act(() => { result.current.handleGoBack() })

      expect(onSwitchTab).toHaveBeenCalledWith('/a.md')
    })

    it('handleGoBack opens entry via onSelectNote if not in tabs', () => {
      const entries = [makeEntry('/a.md'), makeEntry('/b.md')]
      const tabB = makeTab(entries[1])

      const { result, rerender } = renderHook(
        ({ activeTabPath, tabs }) =>
          useAppNavigation({ entries, tabs, activeTabPath, onSelectNote, onSwitchTab }),
        { initialProps: { activeTabPath: '/a.md' as string | null, tabs: [tabB] } },
      )

      rerender({ activeTabPath: '/b.md', tabs: [tabB] })

      act(() => { result.current.handleGoBack() })

      expect(onSelectNote).toHaveBeenCalledWith(entries[0])
    })

    it('handleGoForward works after going back', () => {
      const entries = [makeEntry('/a.md'), makeEntry('/b.md')]
      const tabA = makeTab(entries[0])
      const tabB = makeTab(entries[1])

      const { result, rerender } = renderHook(
        ({ activeTabPath, tabs }) =>
          useAppNavigation({ entries, tabs, activeTabPath, onSelectNote, onSwitchTab }),
        { initialProps: { activeTabPath: '/a.md' as string | null, tabs: [tabA, tabB] } },
      )

      rerender({ activeTabPath: '/b.md', tabs: [tabA, tabB] })
      act(() => { result.current.handleGoBack() })

      expect(result.current.canGoForward).toBe(true)
      act(() => { result.current.handleGoForward() })

      expect(onSwitchTab).toHaveBeenCalledWith('/b.md')
    })
  })
})
