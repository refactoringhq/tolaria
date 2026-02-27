import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStatusStyle,
  getStatusColorKey,
  setStatusColor,
  getStatusColorOverrides,
  STATUS_STYLES,
  DEFAULT_STATUS_STYLE,
} from './statusStyles'

// Mock localStorage (jsdom's may be incomplete)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const STORAGE_KEY = 'laputa:status-color-overrides'

describe('statusStyles — color overrides', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset module-level cache by clearing all overrides
    for (const key of Object.keys(getStatusColorOverrides())) {
      setStatusColor(key, null)
    }
  })

  it('returns built-in style when no override exists', () => {
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES['Active'])
  })

  it('returns default style for unknown status without override', () => {
    expect(getStatusStyle('MyCustom')).toEqual(DEFAULT_STATUS_STYLE)
  })

  it('getStatusColorKey returns null when no override set', () => {
    expect(getStatusColorKey('Active')).toBeNull()
  })

  it('setStatusColor persists a color override', () => {
    setStatusColor('Active', 'red')
    expect(getStatusColorKey('Active')).toBe('red')
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"Active":"red"')
  })

  it('getStatusStyle uses override when set', () => {
    setStatusColor('Active', 'pink')
    const style = getStatusStyle('Active')
    expect(style.color).toBe('var(--accent-pink)')
    expect(style.bg).toBe('var(--accent-pink-light)')
  })

  it('setStatusColor with null removes the override', () => {
    setStatusColor('Active', 'red')
    expect(getStatusColorKey('Active')).toBe('red')
    setStatusColor('Active', null)
    expect(getStatusColorKey('Active')).toBeNull()
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES['Active'])
  })

  it('getStatusColorOverrides returns a copy of all overrides', () => {
    setStatusColor('Draft', 'teal')
    setStatusColor('Blocked', 'orange')
    const overrides = getStatusColorOverrides()
    expect(overrides).toEqual({ Draft: 'teal', Blocked: 'orange' })
    // Verify it's a copy, not a reference
    overrides['Draft'] = 'blue'
    expect(getStatusColorKey('Draft')).toBe('teal')
  })

  it('applies override to unknown status (not in STATUS_STYLES)', () => {
    setStatusColor('Custom Status', 'purple')
    const style = getStatusStyle('Custom Status')
    expect(style.color).toBe('var(--accent-purple)')
    expect(style.bg).toBe('var(--accent-purple-light)')
  })

  it('ignores invalid color key in override', () => {
    setStatusColor('Active', 'nonexistent-color')
    // Falls back to built-in since "nonexistent-color" isn't a valid ACCENT_COLOR key
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES['Active'])
  })
})
