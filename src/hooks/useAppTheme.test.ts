import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { APP_STORAGE_KEYS, LEGACY_APP_STORAGE_KEYS } from '../constants/appStorage'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// matchMedia mock
// ---------------------------------------------------------------------------
let mediaQueryMatches = false
const mediaListeners: Array<(e: MediaQueryListEvent) => void> = []

function mockMatchMedia(query: string) {
  return {
    matches: mediaQueryMatches,
    media: query,
    onchange: null,
    addEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
      mediaListeners.push(handler)
    },
    removeEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
      const idx = mediaListeners.indexOf(handler)
      if (idx !== -1) mediaListeners.splice(idx, 1)
    },
    dispatchEvent: vi.fn(),
  }
}

Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(mockMatchMedia) })

function fireMediaChange(matches: boolean) {
  mediaQueryMatches = matches
  vi.mocked(window.matchMedia).mockImplementation(mockMatchMedia)
  mediaListeners.forEach(handler => handler({ matches } as MediaQueryListEvent))
}

describe('useAppTheme', () => {
  beforeEach(() => {
    localStorageMock.clear()
    mediaQueryMatches = false
    mediaListeners.splice(0)
    document.documentElement.classList.remove('dark')
    vi.resetModules()
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('defaults to "system" when nothing is stored', async () => {
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.theme).toBe('system')
  })

  it('loads persisted "light" from localStorage', async () => {
    localStorageMock.setItem(APP_STORAGE_KEYS.theme, 'light')
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.theme).toBe('light')
  })

  it('loads persisted "dark" from localStorage', async () => {
    localStorageMock.setItem(APP_STORAGE_KEYS.theme, 'dark')
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('falls back to "system" for unknown stored values', async () => {
    localStorageMock.setItem(APP_STORAGE_KEYS.theme, 'invalid')
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.theme).toBe('system')
  })

  it('persists to APP_STORAGE_KEYS.theme on setTheme', async () => {
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    act(() => result.current.setTheme('dark'))
    expect(localStorageMock.getItem(APP_STORAGE_KEYS.theme)).toBe('dark')
  })

  it('removes the legacy key when persisting', async () => {
    localStorageMock.setItem(LEGACY_APP_STORAGE_KEYS.theme, 'dark')
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    act(() => result.current.setTheme('light'))
    expect(localStorageMock.getItem(LEGACY_APP_STORAGE_KEYS.theme)).toBeNull()
  })

  it('adds "dark" class to <html> when theme is set to "dark"', async () => {
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes "dark" class from <html> when theme is set to "light"', async () => {
    document.documentElement.classList.add('dark')
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    act(() => result.current.setTheme('light'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('resolvedTheme is "light" when system preference is light', async () => {
    mediaQueryMatches = false
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('resolvedTheme is "dark" when system preference is dark and theme is "system"', async () => {
    mediaQueryMatches = true
    vi.mocked(window.matchMedia).mockImplementation(mockMatchMedia)
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('updates <html> class when OS preference changes while in "system" mode', async () => {
    mediaQueryMatches = false
    const { useAppTheme } = await import('./useAppTheme')
    renderHook(() => useAppTheme())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    act(() => fireMediaChange(true))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not change <html> class on OS change when theme is "light"', async () => {
    mediaQueryMatches = false
    const { useAppTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useAppTheme())
    act(() => result.current.setTheme('light'))
    act(() => fireMediaChange(true))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setTheme is a stable callback across re-renders', async () => {
    const { useAppTheme } = await import('./useAppTheme')
    const { result, rerender } = renderHook(() => useAppTheme())
    const first = result.current.setTheme
    rerender()
    expect(result.current.setTheme).toBe(first)
  })
})

describe('useResolvedTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    vi.resetModules()
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('returns "light" when html does not have dark class', async () => {
    const { useResolvedTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')
  })

  it('returns "dark" when html has dark class', async () => {
    document.documentElement.classList.add('dark')
    const { useResolvedTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('dark')
  })

  it('updates when dark class is added to html', async () => {
    const { useResolvedTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')
    act(() => { document.documentElement.classList.add('dark') })
    await waitFor(() => expect(result.current).toBe('dark'))
  })

  it('updates when dark class is removed from html', async () => {
    document.documentElement.classList.add('dark')
    const { useResolvedTheme } = await import('./useAppTheme')
    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('dark')
    act(() => { document.documentElement.classList.remove('dark') })
    await waitFor(() => expect(result.current).toBe('light'))
  })
})
