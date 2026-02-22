import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewMode } from './useViewMode'

vi.mock('../mock-tauri', () => ({
  isTauri: () => false,
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('useViewMode', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('defaults to "all" when no stored value', () => {
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('all')
    expect(result.current.sidebarVisible).toBe(true)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('loads persisted view mode from localStorage', () => {
    localStorageMock.setItem('laputa-view-mode', 'editor-only')
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('editor-only')
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(false)
  })

  it('setViewMode updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-list'))
    expect(result.current.viewMode).toBe('editor-list')
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(true)
    expect(localStorageMock.getItem('laputa-view-mode')).toBe('editor-list')
  })

  it('editor-only hides both sidebar and note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-only'))
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(false)
  })

  it('editor-list hides sidebar but shows note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-list'))
    expect(result.current.sidebarVisible).toBe(false)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('all mode shows both sidebar and note list', () => {
    const { result } = renderHook(() => useViewMode())
    act(() => result.current.setViewMode('editor-only'))
    act(() => result.current.setViewMode('all'))
    expect(result.current.sidebarVisible).toBe(true)
    expect(result.current.noteListVisible).toBe(true)
  })

  it('ignores invalid localStorage values', () => {
    localStorageMock.setItem('laputa-view-mode', 'garbage')
    const { result } = renderHook(() => useViewMode())
    expect(result.current.viewMode).toBe('all')
  })
})
