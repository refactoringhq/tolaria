import { describe, it, expect } from 'vitest'
import { getTypeColor, getTypeLightColor } from './typeColors'

describe('getTypeColor', () => {
  it('returns hardcoded color for known types', () => {
    expect(getTypeColor('Project')).toBe('var(--accent-red)')
    expect(getTypeColor('Person')).toBe('var(--accent-yellow)')
    expect(getTypeColor('Topic')).toBe('var(--accent-green)')
  })

  it('returns neutral muted color for null type', () => {
    expect(getTypeColor(null)).toBe('var(--muted-foreground)')
  })

  it('returns neutral muted color for unknown type without custom key', () => {
    expect(getTypeColor('UnknownType')).toBe('var(--muted-foreground)')
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
})

describe('getTypeLightColor', () => {
  it('returns hardcoded light color for known types', () => {
    expect(getTypeLightColor('Project')).toBe('var(--accent-red-light)')
    expect(getTypeLightColor('Person')).toBe('var(--accent-yellow-light)')
  })

  it('returns neutral muted light color for null type', () => {
    expect(getTypeLightColor(null)).toBe('var(--muted)')
  })

  it('returns neutral muted light color for unknown type without custom key', () => {
    expect(getTypeLightColor('UnknownType')).toBe('var(--muted)')
  })

  it('uses custom color key for light variant', () => {
    expect(getTypeLightColor('Recipe', 'purple')).toBe('var(--accent-purple-light)')
  })
})
