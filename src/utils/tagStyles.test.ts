import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getTagStyle,
  getTagColorKey,
  setTagColor,
  initTagColors,
} from './tagStyles'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from './vaultConfigStore'

describe('tagStyles — color overrides', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    // Reset module-level cache
    initTagColors({})
  })

  it('returns a hash-based style when no override exists', () => {
    const style = getTagStyle('SomeTag')
    // Should have bg and color properties from the accent palette
    expect(style.bg).toMatch(/^var\(--accent-\w+-light\)$/)
    expect(style.color).toMatch(/^var\(--accent-\w+-text\)$/)
  })

  it('getTagColorKey returns null when no override set', () => {
    expect(getTagColorKey('React')).toBeNull()
  })

  it('setTagColor persists a color override', () => {
    setTagColor('React', 'blue')
    expect(getTagColorKey('React')).toBe('blue')
    const stored = getVaultConfig().tag_colors as Record<string, string>
    expect(stored).toBeTruthy()
    expect(stored.React).toBe('blue')
  })

  it('getTagStyle uses override when set', () => {
    setTagColor('React', 'green')
    const style = getTagStyle('React')
    expect(style.color).toBe('var(--accent-green-text)')
    expect(style.bg).toBe('var(--accent-green-light)')
  })

  it('setTagColor with null removes the override', () => {
    setTagColor('React', 'red')
    expect(getTagColorKey('React')).toBe('red')
    setTagColor('React', null)
    expect(getTagColorKey('React')).toBeNull()
    // Falls back to hash-based color (no longer DEFAULT_TAG_STYLE)
    const style = getTagStyle('React')
    expect(style.bg).toMatch(/^var\(--accent-\w+-light\)$/)
  })

  it('applies different overrides for different tags', () => {
    setTagColor('React', 'blue')
    setTagColor('TypeScript', 'purple')
    expect(getTagStyle('React').color).toBe('var(--accent-blue-text)')
    expect(getTagStyle('TypeScript').color).toBe('var(--accent-purple-text)')
  })

  it('returns deterministic hash-based color when no override exists', () => {
    const style1 = getTagStyle('React')
    const style2 = getTagStyle('React')
    // Same tag → same color every time
    expect(style1).toEqual(style2)
    // Should NOT be the old default (all-blue) — should vary by tag name
    const styleA = getTagStyle('React')
    const styleB = getTagStyle('TypeScript')
    const styleC = getTagStyle('Tauri')
    // At least two of three should differ (hash distribution)
    const colors = [styleA.color, styleB.color, styleC.color]
    const unique = new Set(colors)
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })

  it('ignores invalid color key in override', () => {
    setTagColor('React', 'nonexistent-color')
    // Falls back to hash-based color since "nonexistent-color" isn't a valid ACCENT_COLOR key
    const style = getTagStyle('React')
    expect(style.bg).toMatch(/^var\(--accent-\w+-light\)$/)
  })

  it('persists multiple overrides to vault config', () => {
    setTagColor('React', 'blue')
    setTagColor('Tauri', 'orange')
    const stored = getVaultConfig().tag_colors as Record<string, string>
    expect(stored).toEqual({ React: 'blue', Tauri: 'orange' })
  })
})
