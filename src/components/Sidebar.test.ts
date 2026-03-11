import { describe, it, expect } from 'vitest'
import { buildSectionGroup } from '../utils/sidebarSections'
import { resolveIcon } from '../utils/iconRegistry'
import type { VaultEntry } from '../types'
import { GearSix, CookingPot, FileText } from '@phosphor-icons/react'

const baseEntry: VaultEntry = {
  path: '', filename: '', title: '', isA: null, aliases: [], belongsTo: [], relatedTo: [],
  status: null, owner: null, cadence: null, archived: false, trashed: false, trashedAt: null,
  modifiedAt: null, createdAt: null, fileSize: 0, snippet: '', relationships: {},
  wordCount: 0,
  icon: null, color: null, order: null, sidebarLabel: null, template: null, sort: null,
  view: null, visible: null, outgoingLinks: [], properties: {},
}

describe('buildSectionGroup', () => {
  it('uses type entry icon/color/sidebarLabel for custom type', () => {
    const typeEntryMap: Record<string, VaultEntry> = {
      Config: { ...baseEntry, title: 'Config', isA: 'Type', icon: 'gear-six', color: 'blue', sidebarLabel: 'Config' },
    }
    const group = buildSectionGroup('Config', typeEntryMap)
    expect(group.label).toBe('Config')
    expect(group.customColor).toBe('blue')
    expect(group.Icon).toBe(GearSix)
  })

  it('uses type entry icon/color for custom type with custom icon', () => {
    const typeEntryMap: Record<string, VaultEntry> = {
      Recipe: { ...baseEntry, title: 'Recipe', isA: 'Type', icon: 'cooking-pot', color: 'orange' },
    }
    const group = buildSectionGroup('Recipe', typeEntryMap)
    expect(group.label).toBe('Recipes')
    expect(group.customColor).toBe('orange')
    expect(group.Icon).toBe(CookingPot)
  })

  it('falls back to pluralized name and FileText when no type entry', () => {
    const group = buildSectionGroup('Widget', {})
    expect(group.label).toBe('Widgets')
    expect(group.customColor).toBeNull()
    expect(group.Icon).toBe(FileText)
  })

  it('overrides built-in type icon/color when type entry has custom values', () => {
    const typeEntryMap: Record<string, VaultEntry> = {
      Project: { ...baseEntry, title: 'Project', isA: 'Type', icon: 'rocket', color: 'green', sidebarLabel: 'My Projects' },
    }
    const group = buildSectionGroup('Project', typeEntryMap)
    expect(group.label).toBe('My Projects')
    expect(group.customColor).toBe('green')
    expect(group.Icon).toBe(resolveIcon('rocket'))
  })

  it('uses gray color for Config type', () => {
    const typeEntryMap: Record<string, VaultEntry> = {
      Config: { ...baseEntry, title: 'Config', isA: 'Type', icon: 'gear-six', color: 'gray', sidebarLabel: 'Config' },
    }
    const group = buildSectionGroup('Config', typeEntryMap)
    expect(group.customColor).toBe('gray')
  })

  it('resolves type entry via lowercase key (case-insensitive isA)', () => {
    // When instances have isA: 'config' (lowercase) but type entry title is 'Config'
    const typeEntryMap: Record<string, VaultEntry> = {
      Config: { ...baseEntry, title: 'Config', isA: 'Type', icon: 'gear-six', color: 'gray', sidebarLabel: 'Config' },
      config: { ...baseEntry, title: 'Config', isA: 'Type', icon: 'gear-six', color: 'gray', sidebarLabel: 'Config' },
    }
    const group = buildSectionGroup('config', typeEntryMap)
    expect(group.label).toBe('Config')
    expect(group.customColor).toBe('gray')
    expect(group.Icon).toBe(GearSix)
  })
})
