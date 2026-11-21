import { describe, it, expect } from 'vitest'
import { getTypeColor, getTypeLightColor, getTypeTextColor, hasTypeHue, buildTypeEntryMap } from './typeColors'
import type { VaultEntry } from '../types'

describe('getTypeColor', () => {
  it('returns hardcoded color for known types', () => {
    expect(getTypeColor('Project')).toBe('var(--accent-red)')
    expect(getTypeColor('Person')).toBe('var(--accent-yellow)')
    expect(getTypeColor('Topic')).toBe('var(--accent-green)')
  })

  it('returns the neutral gray accent for null type', () => {
    expect(getTypeColor(null)).toBe('var(--accent-gray)')
  })

  it('returns the neutral gray accent for unknown type without custom key', () => {
    expect(getTypeColor('UnknownType')).toBe('var(--accent-gray)')
  })

  it('uses custom color key over hardcoded map', () => {
    expect(getTypeColor('Project', 'green')).toBe('var(--accent-green)')
  })

  it('uses custom color key for unknown type', () => {
    expect(getTypeColor('Recipe', 'orange')).toBe('var(--accent-orange)')
  })

  it('ignores invalid custom color key', () => {
    expect(getTypeColor('Project', 'invalid')).toBe('var(--accent-red)')
  })

  it('uses gray custom color key', () => {
    expect(getTypeColor('Config', 'gray')).toBe('var(--accent-gray)')
  })

  it('snaps CSS color values that are not palette keys to the nearest palette hue', () => {
    expect(getTypeColor('Idea', '#22d3ee')).toBe('var(--accent-teal)')
    expect(getTypeColor('Idea', '#e11d48')).toBe('var(--accent-red)')
    expect(getTypeColor('Idea', '#9ca3af')).toBe('var(--accent-gray)')
  })
})

describe('getTypeLightColor', () => {
  it('returns hardcoded light color for known types', () => {
    expect(getTypeLightColor('Project')).toBe('var(--accent-red-light)')
    expect(getTypeLightColor('Person')).toBe('var(--accent-yellow-light)')
  })

  it('returns the neutral gray fill for null type', () => {
    expect(getTypeLightColor(null)).toBe('var(--accent-gray-light)')
  })

  it('returns the neutral gray fill for unknown type without custom key', () => {
    expect(getTypeLightColor('UnknownType')).toBe('var(--accent-gray-light)')
  })

  it('uses custom color key for light variant', () => {
    expect(getTypeLightColor('Recipe', 'purple')).toBe('var(--accent-purple-light)')
  })

  it('uses gray custom color key for light variant', () => {
    expect(getTypeLightColor('Config', 'gray')).toBe('var(--accent-gray-light)')
  })

  it('uses the snapped palette fill for CSS color values that are not palette keys', () => {
    expect(getTypeLightColor('Idea', '#22d3ee')).toBe('var(--accent-teal-light)')
  })
})

describe('getTypeTextColor', () => {
  it('returns the chip label step of the type hue', () => {
    expect(getTypeTextColor('Project')).toBe('var(--accent-red-text)')
    expect(getTypeTextColor('Recipe', 'yellow')).toBe('var(--accent-yellow-text)')
    expect(getTypeTextColor(null)).toBe('var(--accent-gray-text)')
  })
})

describe('hasTypeHue', () => {
  it('is false only when nothing picks a hue', () => {
    expect(hasTypeHue('Project')).toBe(true)
    expect(hasTypeHue('Recipe', 'gray')).toBe(true)
    expect(hasTypeHue('Recipe', '#22d3ee')).toBe(true)
    expect(hasTypeHue('Recipe')).toBe(false)
    expect(hasTypeHue(null, 'not-a-color')).toBe(false)
  })
})

const baseEntry: VaultEntry = {
  path: '', filename: '', title: '', isA: null, aliases: [], belongsTo: [], relatedTo: [],
  status: null, archived: false,
  modifiedAt: null, createdAt: null, fileSize: 0, snippet: '', relationships: {},
  wordCount: 0,
  icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
  view: null, visible: null, outgoingLinks: [], properties: {},
}

describe('buildTypeEntryMap', () => {
  it('indexes Type entries by title and lowercase', () => {
    const entries: VaultEntry[] = [
      { ...baseEntry, title: 'Recipe', isA: 'Type', color: 'orange', icon: 'cooking-pot' },
      { ...baseEntry, title: 'My Note', isA: 'Note' },
      { ...baseEntry, title: 'Evergreen', isA: 'Type', color: 'green', icon: 'leaf' },
    ]
    const map = buildTypeEntryMap(entries)
    expect(map.Recipe.color).toBe('orange')
    expect(map.recipe.color).toBe('orange')
    expect(map.Evergreen.icon).toBe('leaf')
    expect(map.evergreen.icon).toBe('leaf')
  })

  it('returns empty map when no Type entries exist', () => {
    const entries: VaultEntry[] = [
      { ...baseEntry, title: 'A Note', isA: 'Note' },
    ]
    expect(buildTypeEntryMap(entries)).toEqual({})
  })

  it('preserves sidebarLabel in type entry via exact and lowercase keys', () => {
    const entries: VaultEntry[] = [
      { ...baseEntry, title: 'Config', isA: 'Type', icon: 'gear-six', color: 'gray', sidebarLabel: 'Config' },
    ]
    const map = buildTypeEntryMap(entries)
    expect(map.Config.sidebarLabel).toBe('Config')
    expect(map.config.sidebarLabel).toBe('Config')
    expect(map.config.icon).toBe('gear-six')
    expect(map.config.color).toBe('gray')
  })
})
