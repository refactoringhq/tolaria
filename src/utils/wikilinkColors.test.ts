import { describe, it, expect } from 'vitest'
import type { VaultEntry } from '../types'
import { findEntryByTarget, lookupColorForEntry, resolveWikilinkColor } from './wikilinkColors'

function makeEntry(overrides: Partial<VaultEntry>): VaultEntry {
  return {
    path: '/vault/note.md',
    filename: 'note.md',
    title: 'Note',
    isA: null,
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    owner: null,
    cadence: null,
    archived: false,
    trashed: false,
    trashedAt: null,
    modifiedAt: null,
    createdAt: null,
    fileSize: 100,
    snippet: '',
    relationships: {},
    icon: null,
    color: null,
    order: null,
    ...overrides,
  }
}

const typeProject = makeEntry({ path: '/vault/type/project.md', filename: 'project.md', title: 'Project', isA: 'Type', color: 'red' })
const typePerson = makeEntry({ path: '/vault/type/person.md', filename: 'person.md', title: 'Person', isA: 'Type', color: 'yellow' })
const typeEvent = makeEntry({ path: '/vault/type/event.md', filename: 'event.md', title: 'Event', isA: 'Type', color: 'yellow' })
const typeTopic = makeEntry({ path: '/vault/type/topic.md', filename: 'topic.md', title: 'Topic', isA: 'Type', color: 'green' })
const typeRecipe = makeEntry({ path: '/vault/type/recipe.md', filename: 'recipe.md', title: 'Recipe', isA: 'Type', color: 'orange', icon: 'cooking-pot' })

const projectEntry = makeEntry({ path: '/vault/project/app.md', filename: 'app.md', title: 'Build App', isA: 'Project' })
const personEntry = makeEntry({ path: '/vault/person/alice.md', filename: 'alice.md', title: 'Alice', isA: 'Person', aliases: ['Alice Smith'] })
const eventEntry = makeEntry({ path: '/vault/event/kickoff.md', filename: 'kickoff.md', title: 'Kickoff Meeting', isA: 'Event' })
const topicEntry = makeEntry({ path: '/vault/topic/dev.md', filename: 'dev.md', title: 'Software Development', isA: 'Topic' })
const recipeEntry = makeEntry({ path: '/vault/recipe/pasta.md', filename: 'pasta.md', title: 'Pasta Carbonara', isA: 'Recipe' })
const untypedEntry = makeEntry({ path: '/vault/note/random.md', filename: 'random.md', title: 'Random Thought' })

const allEntries = [typeProject, typePerson, typeEvent, typeTopic, typeRecipe, projectEntry, personEntry, eventEntry, topicEntry, recipeEntry, untypedEntry]

describe('findEntryByTarget', () => {
  it('matches by title', () => {
    expect(findEntryByTarget(allEntries, 'Alice')).toBe(personEntry)
  })

  it('matches by filename stem', () => {
    expect(findEntryByTarget(allEntries, 'pasta')).toBe(recipeEntry)
  })

  it('matches by alias', () => {
    expect(findEntryByTarget(allEntries, 'Alice Smith')).toBe(personEntry)
  })

  it('handles pipe syntax (display name)', () => {
    expect(findEntryByTarget(allEntries, 'Alice|Alice S.')).toBe(personEntry)
  })

  it('returns undefined for non-existent target', () => {
    expect(findEntryByTarget(allEntries, 'Non Existent')).toBeUndefined()
  })
})

describe('lookupColorForEntry', () => {
  it('returns Project color (red) for a Project entry', () => {
    expect(lookupColorForEntry(allEntries, projectEntry)).toBe('var(--accent-red)')
  })

  it('returns Person color (yellow) for a Person entry', () => {
    expect(lookupColorForEntry(allEntries, personEntry)).toBe('var(--accent-yellow)')
  })

  it('returns Event color (yellow) for an Event entry', () => {
    expect(lookupColorForEntry(allEntries, eventEntry)).toBe('var(--accent-yellow)')
  })

  it('returns Topic color (green) for a Topic entry', () => {
    expect(lookupColorForEntry(allEntries, topicEntry)).toBe('var(--accent-green)')
  })

  it('returns custom color (orange) for a Recipe entry via Type color', () => {
    expect(lookupColorForEntry(allEntries, recipeEntry)).toBe('var(--accent-orange)')
  })

  it('returns default blue for an entry with no type', () => {
    expect(lookupColorForEntry(allEntries, untypedEntry)).toBe('var(--accent-blue)')
  })
})

describe('resolveWikilinkColor', () => {
  it('returns type color for a known typed note', () => {
    const result = resolveWikilinkColor(allEntries, 'Build App')
    expect(result.isBroken).toBe(false)
    expect(result.color).toBe('var(--accent-red)')
  })

  it('returns broken link for a non-existent target', () => {
    const result = resolveWikilinkColor(allEntries, 'Does Not Exist')
    expect(result.isBroken).toBe(true)
    expect(result.color).toBe('var(--text-muted)')
  })

  it('returns default color for an untyped note', () => {
    const result = resolveWikilinkColor(allEntries, 'Random Thought')
    expect(result.isBroken).toBe(false)
    expect(result.color).toBe('var(--accent-blue)')
  })

  it('returns default color when entries list is empty', () => {
    const result = resolveWikilinkColor([], 'Anything')
    expect(result.isBroken).toBe(false)
    expect(result.color).toBe('var(--accent-blue)')
  })

  it('resolves alias-based wikilink target', () => {
    const result = resolveWikilinkColor(allEntries, 'Alice Smith')
    expect(result.isBroken).toBe(false)
    expect(result.color).toBe('var(--accent-yellow)')
  })

  it('resolves pipe-syntax wikilink target', () => {
    const result = resolveWikilinkColor(allEntries, 'Alice|Alice S.')
    expect(result.isBroken).toBe(false)
    expect(result.color).toBe('var(--accent-yellow)')
  })
})
