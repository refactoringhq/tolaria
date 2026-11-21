import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStatusStyle,
  getStatusColorKey,
  setStatusColor,
  getStatusColorOverrides,
  STATUS_STYLES,
  DEFAULT_STATUS_STYLE,
  initStatusColors,
} from './statusStyles'
import { bindVaultConfigStore, getVaultConfig, resetVaultConfigStore } from './vaultConfigStore'

describe('statusStyles — color overrides', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    // Reset module-level cache by re-initializing with empty overrides
    initStatusColors({})
  })

  it('returns built-in style when no override exists', () => {
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.Active)
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
    const stored = getVaultConfig().status_colors as Record<string, string>
    expect(stored).toBeTruthy()
    expect(stored.Active).toBe('red')
  })

  it('getStatusStyle uses override when set', () => {
    setStatusColor('Active', 'pink')
    const style = getStatusStyle('Active')
    expect(style.color).toBe('var(--accent-pink-text)')
    expect(style.bg).toBe('var(--accent-pink-light)')
  })

  it('setStatusColor with null removes the override', () => {
    setStatusColor('Active', 'red')
    expect(getStatusColorKey('Active')).toBe('red')
    setStatusColor('Active', null)
    expect(getStatusColorKey('Active')).toBeNull()
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.Active)
  })

  it('getStatusColorOverrides returns a copy of all overrides', () => {
    setStatusColor('Draft', 'teal')
    setStatusColor('Blocked', 'orange')
    const overrides = getStatusColorOverrides()
    expect(overrides).toEqual({ Draft: 'teal', Blocked: 'orange' })
    // Verify it's a copy, not a reference
    overrides.Draft = 'blue'
    expect(getStatusColorKey('Draft')).toBe('teal')
  })

  it('applies override to unknown status (not in STATUS_STYLES)', () => {
    setStatusColor('Custom Status', 'purple')
    const style = getStatusStyle('Custom Status')
    expect(style.color).toBe('var(--accent-purple-text)')
    expect(style.bg).toBe('var(--accent-purple-light)')
  })

  it('ignores invalid color key in override', () => {
    setStatusColor('Active', 'nonexistent-color')
    // Falls back to built-in since "nonexistent-color" isn't a valid ACCENT_COLOR key
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.Active)
  })
})
