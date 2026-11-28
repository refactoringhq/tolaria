import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStatusStyle,
  getStatusColorKey,
  setStatusColor,
  getStatusColorOverrides,
  STATUS_STYLES,
  DEFAULT_STATUS_STYLE,
  initStatusColors,
  getMappedStatusStyle,
  SUGGESTED_STATUSES,
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
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.active)
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
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.active)
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
    expect(getStatusStyle('Active')).toEqual(STATUS_STYLES.active)
  })
})

describe('statusStyles — case-insensitive matching (TOL-466)', () => {
  beforeEach(() => {
    resetVaultConfigStore()
    bindVaultConfigStore(
      { zoom: null, view_mode: null, editor_mode: null, tag_colors: null, status_colors: null, property_display_modes: null },
      vi.fn(),
    )
    initStatusColors({})
  })

  it.each([
    ['active', 'Active'],
    ['done', 'Done'],
    ['in progress', 'In Progress'],
    ['paused', 'PAUSED'],
  ])('gives %s the same known chip color as %s', (lower, cased) => {
    const style = getMappedStatusStyle(lower)
    expect(style).not.toBeNull()
    expect(style).not.toEqual(DEFAULT_STATUS_STYLE)
    expect(getMappedStatusStyle(cased)).toEqual(style)
  })

  it('keeps the existing colors for known statuses', () => {
    expect(getStatusStyle('active')).toEqual({ bg: 'var(--accent-green-light)', color: 'var(--accent-green-text)' })
    expect(getStatusStyle('Done')).toEqual({ bg: 'var(--accent-blue-light)', color: 'var(--accent-blue-text)' })
  })

  it('matches a color override regardless of the status casing', () => {
    initStatusColors({ Active: 'pink' })
    expect(getStatusStyle('active').color).toBe('var(--accent-pink-text)')
    expect(getStatusColorKey('active')).toBe('pink')
  })

  it('prefers the exact-cased override when both exist', () => {
    initStatusColors({ Active: 'pink', active: 'teal' })
    expect(getStatusColorKey('active')).toBe('teal')
    expect(getStatusColorKey('Active')).toBe('pink')
  })

  it('replaces a differently cased override instead of keeping both', () => {
    initStatusColors({ Active: 'pink' })
    setStatusColor('active', 'red')
    expect(getStatusColorOverrides()).toEqual({ active: 'red' })
  })

  it('suggests built-in statuses in lowercase', () => {
    expect(SUGGESTED_STATUSES).toContain('active')
    expect(SUGGESTED_STATUSES).toContain('done')
    for (const status of SUGGESTED_STATUSES) expect(status).toBe(status.toLowerCase())
  })
})
