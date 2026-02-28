import { describe, it, expect, beforeEach } from 'vitest'
import {
  getTagStyle,
  getTagColorKey,
  setTagColor,
  DEFAULT_TAG_STYLE,
} from './tagStyles'

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

const STORAGE_KEY = 'laputa:tag-color-overrides'

describe('tagStyles — color overrides', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset module-level cache by clearing known overrides
    // We can't easily list all, but clearing known test keys suffices
    for (const tag of ['React', 'TypeScript', 'Tauri', 'CustomTag']) {
      setTagColor(tag, null)
    }
  })

  it('returns default style when no override exists', () => {
    expect(getTagStyle('SomeTag')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('getTagColorKey returns null when no override set', () => {
    expect(getTagColorKey('React')).toBeNull()
  })

  it('setTagColor persists a color override', () => {
    setTagColor('React', 'blue')
    expect(getTagColorKey('React')).toBe('blue')
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"React":"blue"')
  })

  it('getTagStyle uses override when set', () => {
    setTagColor('React', 'green')
    const style = getTagStyle('React')
    expect(style.color).toBe('var(--accent-green)')
    expect(style.bg).toBe('var(--accent-green-light)')
  })

  it('setTagColor with null removes the override', () => {
    setTagColor('React', 'red')
    expect(getTagColorKey('React')).toBe('red')
    setTagColor('React', null)
    expect(getTagColorKey('React')).toBeNull()
    expect(getTagStyle('React')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('applies different overrides for different tags', () => {
    setTagColor('React', 'blue')
    setTagColor('TypeScript', 'purple')
    expect(getTagStyle('React').color).toBe('var(--accent-blue)')
    expect(getTagStyle('TypeScript').color).toBe('var(--accent-purple)')
  })

  it('ignores invalid color key in override', () => {
    setTagColor('React', 'nonexistent-color')
    // Falls back to default since "nonexistent-color" isn't a valid ACCENT_COLOR key
    expect(getTagStyle('React')).toEqual(DEFAULT_TAG_STYLE)
  })

  it('persists multiple overrides to localStorage', () => {
    setTagColor('React', 'blue')
    setTagColor('Tauri', 'orange')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).toEqual({ React: 'blue', Tauri: 'orange' })
  })
})
