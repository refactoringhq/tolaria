import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_MODE_STORAGE_KEY } from '../lib/themeMode'
import { useThemeMode } from './useThemeMode'

function createStorageMock(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: vi.fn(() => { values.clear() }),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
  }
}

describe('useThemeMode', () => {
  const localStorageMock = createStorageMock()

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true })
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    window.localStorage.clear()
  })

  it('waits until settings have loaded', () => {
    renderHook(() => useThemeMode('dark', false))

    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('applies and mirrors the loaded settings mode', () => {
    renderHook(() => useThemeMode('dark', true))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem(THEME_MODE_STORAGE_KEY)).toBe('dark')
  })

  it('uses the storage mirror when persisted settings are empty', () => {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, 'dark')

    renderHook(() => useThemeMode(null, true))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})
