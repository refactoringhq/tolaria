import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { VaultConfig } from '../types'
import { migrateLocalStorageToVaultConfig } from './configMigration'

function makeConfig(overrides: Partial<VaultConfig> = {}): VaultConfig {
  return {
    zoom: null,
    view_mode: null,
    tag_colors: null,
    status_colors: null,
    property_display_modes: null,
    hidden_sections: null,
    ...overrides,
  }
}

describe('migrateLocalStorageToVaultConfig', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { store[key] = val }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
  })

  // 1. Fresh install, no localStorage data
  it('returns default config unchanged when localStorage is empty', () => {
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result).toEqual(makeConfig())
  })

  // 2. Migration flag already set — idempotent
  it('returns config unchanged when migration flag is already set', () => {
    store['laputa:config-migrated-to-vault'] = '1'
    store['laputa:zoom-level'] = '120'

    const config = makeConfig()
    const result = migrateLocalStorageToVaultConfig(config)
    expect(result.zoom).toBeNull()
  })

  // 3. Zoom migration — string percentage to decimal fraction
  it.each([
    ['80', 0.8],
    ['100', 1.0],
    ['150', 1.5],
  ])('migrates zoom "%s" → %s', (raw, expected) => {
    store['laputa:zoom-level'] = raw
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.zoom).toBe(expected)
  })

  it('ignores invalid zoom values', () => {
    store['laputa:zoom-level'] = 'banana'
    expect(migrateLocalStorageToVaultConfig(makeConfig()).zoom).toBeNull()

    store['laputa:zoom-level'] = '50'
    expect(migrateLocalStorageToVaultConfig(makeConfig()).zoom).toBeNull()

    store['laputa:zoom-level'] = '200'
    expect(migrateLocalStorageToVaultConfig(makeConfig()).zoom).toBeNull()
  })

  // 4. View mode migration
  it.each(['editor-only', 'editor-list', 'all'])('migrates view mode "%s"', (mode) => {
    store['laputa-view-mode'] = mode
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.view_mode).toBe(mode)
  })

  it('ignores invalid view mode strings', () => {
    store['laputa-view-mode'] = 'split-screen'
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.view_mode).toBeNull()
  })

  // 5. Tag colors migration
  it('migrates populated tag colors', () => {
    store['laputa:tag-color-overrides'] = JSON.stringify({ project: '#ff0000' })
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.tag_colors).toEqual({ project: '#ff0000' })
  })

  it('ignores empty tag colors object', () => {
    store['laputa:tag-color-overrides'] = JSON.stringify({})
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.tag_colors).toBeNull()
  })

  // 6. Status colors migration
  it('migrates populated status colors', () => {
    store['laputa:status-color-overrides'] = JSON.stringify({ done: '#00ff00', wip: '#ffaa00' })
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.status_colors).toEqual({ done: '#00ff00', wip: '#ffaa00' })
  })

  it('ignores empty status colors object', () => {
    store['laputa:status-color-overrides'] = JSON.stringify({})
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.status_colors).toBeNull()
  })

  // 7. Property display modes migration
  it('migrates populated property display modes', () => {
    store['laputa:display-mode-overrides'] = JSON.stringify({ tags: 'inline' })
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.property_display_modes).toEqual({ tags: 'inline' })
  })

  it('ignores empty property display modes object', () => {
    store['laputa:display-mode-overrides'] = JSON.stringify({})
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.property_display_modes).toBeNull()
  })

  // 8. Hidden sections migration
  it('migrates populated hidden sections array', () => {
    store['laputa-hidden-sections'] = JSON.stringify(['backlinks', 'properties'])
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.hidden_sections).toEqual(['backlinks', 'properties'])
  })

  it('ignores empty hidden sections array', () => {
    store['laputa-hidden-sections'] = JSON.stringify([])
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.hidden_sections).toBeNull()
  })

  // 9. Existing config values are NOT overwritten
  it('does not overwrite existing config values with localStorage data', () => {
    store['laputa:zoom-level'] = '120'
    store['laputa-view-mode'] = 'all'
    store['laputa:tag-color-overrides'] = JSON.stringify({ x: '#fff' })
    store['laputa:status-color-overrides'] = JSON.stringify({ y: '#000' })
    store['laputa:display-mode-overrides'] = JSON.stringify({ z: 'compact' })
    store['laputa-hidden-sections'] = JSON.stringify(['nav'])

    const existing = makeConfig({
      zoom: 0.9,
      view_mode: 'editor-only',
      tag_colors: { existing: '#aaa' },
      status_colors: { existing: '#bbb' },
      property_display_modes: { existing: 'full' },
      hidden_sections: ['sidebar'],
    })

    const result = migrateLocalStorageToVaultConfig(existing)
    expect(result.zoom).toBe(0.9)
    expect(result.view_mode).toBe('editor-only')
    expect(result.tag_colors).toEqual({ existing: '#aaa' })
    expect(result.status_colors).toEqual({ existing: '#bbb' })
    expect(result.property_display_modes).toEqual({ existing: 'full' })
    expect(result.hidden_sections).toEqual(['sidebar'])
  })

  // 10. loaded=null (no vault config file yet) — uses defaults then migrates
  it('migrates from localStorage when loaded is null', () => {
    store['laputa:zoom-level'] = '110'
    store['laputa-view-mode'] = 'editor-list'
    const result = migrateLocalStorageToVaultConfig(null)
    expect(result.zoom).toBe(1.1)
    expect(result.view_mode).toBe('editor-list')
  })

  // 11. Migration flag is set after migration
  it('sets migration flag so next call returns unchanged', () => {
    store['laputa:zoom-level'] = '80'
    const first = migrateLocalStorageToVaultConfig(makeConfig())
    expect(first.zoom).toBe(0.8)
    expect(store['laputa:config-migrated-to-vault']).toBe('1')

    const second = migrateLocalStorageToVaultConfig(makeConfig())
    expect(second.zoom).toBeNull()
  })

  // 12. localStorage.getItem throws — handles gracefully
  it('returns base config when localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => { throw new Error('SecurityError') }),
      setItem: vi.fn(),
    })
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result).toEqual(makeConfig())
  })

  // 13. JSON parse error in colors — skips that field
  it('skips fields with invalid JSON without affecting other migrations', () => {
    store['laputa:tag-color-overrides'] = '{bad json'
    store['laputa:zoom-level'] = '90'
    const result = migrateLocalStorageToVaultConfig(makeConfig())
    expect(result.tag_colors).toBeNull()
    expect(result.zoom).toBe(0.9)
  })
})
