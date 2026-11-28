import { describe, expect, it } from 'vitest'
import { requiredFixture } from '../fixtures/requiredFixture'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import { applyMobileWorkspaceEdit } from './mobileWorkspaceEditing'
import {
  mobileFolderSuggestions,
  mobileDefaultListPropertyDisplay,
  mobileListPropertySuggestions,
  mobilePropertyKeySuggestions,
  mobilePropertyValueSuggestions,
  mobileRelationshipKeySuggestions,
  mobileRelationshipTargetSuggestions,
  mobileSortablePropertySuggestions,
  mobileTypeSuggestions,
  mobileViewFieldSuggestions,
  mobileViewValueSuggestionItems,
  mobileViewValueSuggestions,
  shouldShowMobileRelationshipCreateTarget,
} from './mobileWorkspaceSuggestions'

describe('mobile workspace suggestions', () => {
  it('suggests safe desktop property keys and existing custom keys', () => {
    const withPriority = applyMobileWorkspaceEdit(workspaceScenarioForId('default'), {
      key: 'Priority',
      noteId: 'open-source-project',
      type: 'updateProperty',
      value: 'High',
    })
    const selectedNote = withPriority.notes.find((note) => note.id === 'workflow-orchestration') ?? null

    expect(mobilePropertyKeySuggestions(withPriority.notes, selectedNote, '')).toEqual(
      expect.arrayContaining(['date', 'url', 'icon', 'Priority']),
    )
    expect(mobilePropertyKeySuggestions(withPriority.notes, selectedNote, 'prio')).toEqual(['Priority'])
    expect(mobilePropertyKeySuggestions(withPriority.notes, selectedNote, '')).not.toContain('Status')
    expect(mobilePropertyKeySuggestions(withPriority.notes, selectedNote, '')).not.toContain('status')
    expect(mobilePropertyKeySuggestions(withPriority.notes, selectedNote, '')).not.toContain('URL')
  })

  it('does not suggest the desktop icon property when the selected note already has one', () => {
    const scenario = workspaceScenarioForId('default')
    const selectedNote = {
      ...requiredFixture(scenario.notes.find((note) => note.id === 'workflow-orchestration')),
      icon: 'star',
    }

    expect(mobilePropertyKeySuggestions(scenario.notes, selectedNote, '')).not.toContain('icon')
    expect(mobilePropertyValueSuggestions([selectedNote], 'icon', '')).toEqual(['star'])
  })

  it('suggests Type-defined properties before they exist on note instances', () => {
    const scenario = workspaceScenarioForId('default')
    const selectedNote = scenario.notes.find((note) => note.id === 'workflow-orchestration') ?? null

    expect(mobilePropertyKeySuggestions(scenario.notes, selectedNote, '', {
      Essay: {
        properties: {
          EmptyList: [],
          has: 'Milestone',
          Priority: 'High',
        },
      },
    })).toEqual(expect.arrayContaining(['Priority']))
    expect(mobilePropertyKeySuggestions(scenario.notes, selectedNote, '', {
      Essay: {
        properties: {
          EmptyList: [],
          has: 'Milestone',
          Priority: 'High',
        },
      },
    })).not.toEqual(expect.arrayContaining(['EmptyList', 'has']))
  })

  it('suggests existing property values for the selected key', () => {
    const withPriority = applyMobileWorkspaceEdit(workspaceScenarioForId('default'), {
      key: 'Priority',
      noteId: 'workflow-orchestration',
      type: 'updateProperty',
      value: 'High',
    })

    expect(mobilePropertyValueSuggestions(withPriority.notes, 'Priority', '')).toContain('High')
    expect(mobilePropertyValueSuggestions(withPriority.notes, 'Status', 'ship')).toEqual(['Shipped'])
  })

  it('suggests Type-defined property values before they exist on note instances', () => {
    const scenario = workspaceScenarioForId('default')
    const selectedNote = scenario.notes.find((note) => note.id === 'workflow-orchestration') ?? null
    const typeDefinitions = {
      Essay: {
        properties: {
          Areas: ['Design', 'Research'],
          Priority: 'High',
        },
      },
      Procedure: {
        properties: {
          Priority: 'Low',
        },
      },
    }

    const options = { selectedNote, typeDefinitions }

    expect(mobilePropertyValueSuggestions(scenario.notes, 'Priority', 'hi', 'string', options)).toEqual(['High'])
    expect(mobilePropertyValueSuggestions(scenario.notes, 'Areas', 'res', 'list', options)).toEqual(['Research'])
  })

  it('uses the active comma segment for every list-valued property suggestion query', () => {
    const withAreas = applyMobileWorkspaceEdit(workspaceScenarioForId('default'), {
      key: 'Areas',
      noteId: 'workflow-orchestration',
      type: 'updateProperty',
      value: ['Design', 'Research'],
    })

    expect(mobilePropertyValueSuggestions(withAreas.notes, 'Areas', 'Design, res', 'list')).toEqual(['Research'])
    expect(mobilePropertyValueSuggestions(withAreas.notes, 'Areas', 'Design, de', 'list')).toEqual([])
    expect(mobilePropertyValueSuggestions(withAreas.notes, 'Areas', 'Design, res', 'string')).toEqual([])

    const withCommaArea = applyMobileWorkspaceEdit(workspaceScenarioForId('default'), {
      key: 'Areas',
      noteId: 'workflow-orchestration',
      type: 'updateProperty',
      value: ['AI, UX', 'Research'],
    })

    expect(mobilePropertyValueSuggestions(withCommaArea.notes, 'Areas', '"AI, UX", res', 'list')).toEqual(['Research'])
    expect(mobilePropertyValueSuggestions(withCommaArea.notes, 'Areas', '"AI, UX", ai', 'list')).toEqual([])
  })

  it('suggests canonical relationship keys plus custom vault relationship keys', () => {
    const suggestions = mobileRelationshipKeySuggestions(workspaceScenarioForId('default').notes, '')

    expect(suggestions.slice(0, 3)).toEqual(['belongs_to', 'related_to', 'has'])
    expect(mobileRelationshipKeySuggestions(workspaceScenarioForId('default').notes, 'ment')).toEqual(['Mentions'])
  })

  it('suggests Type-defined relationship keys before they exist on note instances', () => {
    const scenario = workspaceScenarioForId('default')
    const selectedNote = scenario.notes.find((note) => note.id === 'workflow-orchestration') ?? null

    expect(mobileRelationshipKeySuggestions(scenario.notes, '', selectedNote, {
      Essay: {
        properties: {
          has: 'Milestone',
          'has-part': 'Chapter',
        },
        relationships: {
          depends_on: ['[[Mobile UI]]'],
        },
      },
    })).toEqual(expect.arrayContaining(['depends_on', 'has', 'has-part']))
  })

  it('suggests relationship targets by desktop note identity fields', () => {
    const notes = [
      {
        ...requiredFixture(workspaceScenarioForId('default').notes[0]),
        aliases: ['Weekly Review'],
        id: 'journal/cafe-notes.md',
        path: 'journal/cafe-notes.md',
        tags: ['Travel'],
        title: 'Café Notes',
        type: 'Journal',
      },
      {
        ...requiredFixture(workspaceScenarioForId('default').notes[1]),
        archived: true,
        aliases: ['Archived Weekly'],
        id: 'archive/weekly.md',
        path: 'archive/weekly.md',
        title: 'Archived Weekly',
      },
    ]

    expect(mobileRelationshipTargetSuggestions(notes, 'Cafe').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, 'weekly review').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, 'cafe-notes.md').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, '[[journal/cafe-notes]]').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, '[[Cafe Notes.md]]').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, 'travel').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, 'cns').map((note) => note.id)).toEqual(['journal/cafe-notes.md'])
    expect(mobileRelationshipTargetSuggestions(notes, 'archived weekly')).toEqual([])
  })

  it('ranks relationship targets by desktop note identity tiers', () => {
    const base = requiredFixture(workspaceScenarioForId('default').notes[0])
    const notes = [
      { ...base, aliases: ['Refactoring'], id: 'ideas', path: 'ideas.md', title: 'Refactoring Ideas' },
      { ...base, aliases: [], id: 'manual', path: 'manual.md', title: 'Refactoring Manual' },
      { ...base, aliases: [], id: 'refactoring', path: 'refactoring.md', title: 'Refactoring' },
    ]

    expect(mobileRelationshipTargetSuggestions(notes, 'Refactoring').map((note) => note.id)).toEqual([
      'refactoring',
      'ideas',
      'manual',
    ])
  })

  it('shows relationship target creation only when the title does not resolve to an existing note', () => {
    const notes = workspaceScenarioForId('default').notes

    expect(shouldShowMobileRelationshipCreateTarget(notes, '')).toBe(false)
    expect(shouldShowMobileRelationshipCreateTarget(notes, 'Open Source')).toBe(true)
    expect(shouldShowMobileRelationshipCreateTarget(notes, 'How I Run an Open Source Project')).toBe(false)
    expect(shouldShowMobileRelationshipCreateTarget(notes, 'Tolaria/Mobile UI/How I Run an Open Source Project')).toBe(false)
    expect(shouldShowMobileRelationshipCreateTarget(notes, '[[Tolaria/Mobile UI/How I Run an Open Source Project]]')).toBe(false)
  })

  it('suggests active relationship targets before typing and excludes existing targets', () => {
    const scenario = applyMobileWorkspaceEdit(workspaceScenarioForId('default'), {
      key: 'related_to',
      noteId: 'workflow-orchestration',
      targetRef: '[[Tolaria/Mobile UI/How I Run an Open Source Project]]',
      targetTitle: 'How I Run an Open Source Project',
      type: 'addRelationship',
    })
    const selectedNote = scenario.notes.find((note) => note.id === 'workflow-orchestration') ?? null

    expect(mobileRelationshipTargetSuggestions(scenario.notes, '', {
      relationshipKey: 'related_to',
      selectedNote,
    }).map((note) => note.id)).toEqual(['release-2026-05-02'])
    expect(mobileRelationshipTargetSuggestions(scenario.notes, '', {
      relationshipKey: 'has',
      selectedNote,
    }).map((note) => note.id)).toEqual(['open-source-project', 'release-2026-05-02'])
  })

  it('suggests retargeting types and folders excluding the selected note destination', () => {
    const notes = workspaceScenarioForId('default').notes
    const selectedNote = notes[2] ?? null

    expect(mobileTypeSuggestions(notes, selectedNote, '')).toEqual(['Essay', 'Procedure'])
    expect(mobileFolderSuggestions(notes, selectedNote, '')).toEqual(['Tolaria/Mobile UI'])
    expect(mobileFolderSuggestions(notes, selectedNote, 'mobile')).toEqual(['Tolaria/Mobile UI'])
  })

  it('suggests explicit empty folder paths when moving notes', () => {
    const notes = workspaceScenarioForId('default').notes
    const selectedNote = {
      ...requiredFixture(notes[0]),
      path: 'Writing/Essays/current.md',
    }

    expect(mobileFolderSuggestions(notes, selectedNote, 'draft', [
      'Writing/Essays',
      'Writing/Drafts',
      'Research/Empty',
    ])).toEqual(['Writing/Drafts'])
    expect(mobileFolderSuggestions(notes, selectedNote, 'empty', [
      'Research/Empty',
    ])).toEqual(['Research/Empty'])
  })

  it('suggests desktop saved-view fields and values from notes', () => {
    const notes = workspaceScenarioForId('default').notes

    expect(mobileViewFieldSuggestions(notes, '').slice(0, 5)).toEqual([
      'type',
      'status',
      'title',
      'favorite',
      'body',
    ])
    expect(mobileViewFieldSuggestions(notes, '')).toEqual(
      expect.arrayContaining(['filename', 'archived', 'tags']),
    )
    expect(mobileViewFieldSuggestions(notes, 'file')).toEqual(['filename'])
    expect(mobileViewFieldSuggestions(notes, 'arch')).toEqual(['archived'])
    expect(mobileViewFieldSuggestions(notes, 'tag')).toEqual(['tags'])
    expect(mobileViewFieldSuggestions(notes, 'bel')).toContain('belongs_to')
    expect(mobileViewFieldSuggestions(notes, 'isa')).toEqual([])
    expect(mobileViewValueSuggestions(notes, 'type', 'ess')).toEqual(['Essay'])
    expect(mobileViewValueSuggestions(notes, 'isa', 'pro')).toEqual(['Procedure'])
    expect(mobileViewValueSuggestions(notes, 'filename', 'workflow')).toEqual(['Workflow Orchestration Essay.md'])
    expect(mobileViewValueSuggestions(notes, 'archived', 'fal')).toEqual(['false'])
    expect(mobileViewValueSuggestions(notes, 'tags', 'design')).toEqual(['Design'])
    expect(mobileViewValueSuggestions(notes, 'belongs_to', 'mvp')).toContain('Tolaria MVP')
  })

  it('suggests Type-defined saved-view fields before they exist on note instances', () => {
    const notes = workspaceScenarioForId('default').notes
    const typeDefinitions = {
      Essay: {
        properties: {
          EmptyList: [],
          Priority: 'High',
          has: 'Milestone',
        },
        relationships: {
          'Belongs to': ['[[Roadmap]]'],
          depends_on: ['[[Mobile UI]]'],
          related_to: [],
        },
      },
    }

    expect(mobileViewFieldSuggestions(notes, '', typeDefinitions)).toEqual(
      expect.arrayContaining(['Priority', 'depends_on']),
    )
    expect(mobileViewFieldSuggestions(notes, 'has', typeDefinitions)).toEqual(['has'])
    expect(mobileViewFieldSuggestions(notes, '', typeDefinitions)).not.toContain('EmptyList')
    expect(mobileListPropertySuggestions(notes, '', typeDefinitions)).toEqual(
      expect.arrayContaining(['Priority', 'has', 'depends_on']),
    )
    expect(mobileViewFieldSuggestions(notes, 'Belongs', typeDefinitions)).toEqual(['Belongs to'])
    expect(mobileListPropertySuggestions(notes, 'Belongs', typeDefinitions)).toEqual(['Belongs to'])
    expect(mobileSortablePropertySuggestions(notes, '', typeDefinitions)).toContain('Priority')
    expect(mobileSortablePropertySuggestions(notes, '', typeDefinitions)).not.toEqual(
      expect.arrayContaining(['has', 'depends_on']),
    )
  })

  it('suggests Type-defined saved-view values before they exist on note instances', () => {
    const notes = workspaceScenarioForId('default').notes
    const typeDefinitions = {
      Essay: {
        properties: {
          Priority: 'High',
        },
        relationships: {
          depends_on: ['[[Tolaria/Mobile UI/How I Run an Open Source Project]]'],
        },
      },
    }

    expect(mobileViewValueSuggestions(notes, 'Priority', 'hi', typeDefinitions)).toEqual(['High'])
    expect(mobileViewValueSuggestionItems(notes, 'depends_on', 'open', typeDefinitions)).toEqual([
      expect.objectContaining({
        label: 'How I Run an Open Source Project',
        meta: '[[Tolaria/Mobile UI/How I Run an Open Source Project]]',
        value: '[[Tolaria/Mobile UI/How I Run an Open Source Project]]',
      }),
    ])
  })

  it('labels Type-defined relationship values through desktop wikilink target normalization', () => {
    const notes = workspaceScenarioForId('default').notes.map((note, index) => index === 0
      ? {
          ...note,
          aliases: ['Weekly Review'],
          id: 'journal/cafe-notes.md',
          path: 'journal/cafe-notes.md',
          title: 'Café Notes',
        }
      : note)
    const typeDefinitions = {
      Essay: {
        relationships: {
          depends_on: [' [[Cafe Notes.md]] '],
        },
      },
    }

    expect(mobileViewValueSuggestionItems(notes, 'depends_on', 'cafe', typeDefinitions)).toEqual([
      expect.objectContaining({
        label: 'Café Notes',
        meta: ' [[Cafe Notes.md]] ',
        value: '[[Cafe Notes.md]]',
      }),
    ])
  })

  it('suggests saved-view relationship values as display titles backed by canonical refs', () => {
    const notes = workspaceScenarioForId('default').notes.map((note) => note.id === 'workflow-orchestration'
      ? {
          ...note,
          relationships: [{
            key: 'belongs_to',
            kind: 'belongsTo' as const,
            values: [
              {
                ref: '[[Projects/Tolaria MVP]]',
                title: 'Tolaria MVP',
                type: 'Project',
                typeTone: 'purple' as const,
              },
              {
                ref: '[[Archive/Tolaria MVP]]',
                title: 'Tolaria MVP',
                type: 'Project',
                typeTone: 'purple' as const,
              },
            ],
          }],
        }
      : note)

    expect(mobileViewValueSuggestionItems(notes, 'belongs_to', 'mvp')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Tolaria MVP',
          meta: '[[Projects/Tolaria MVP]]',
          value: '[[Projects/Tolaria MVP]]',
        }),
        expect.objectContaining({
          label: 'Tolaria MVP',
          meta: '[[Archive/Tolaria MVP]]',
          value: '[[Archive/Tolaria MVP]]',
        }),
      ]),
    )
  })

  it('suggests desktop note-list display properties and derives type defaults', () => {
    const scenario = workspaceScenarioForId('default')
    const notes = applyMobileWorkspaceEdit(scenario, {
      key: 'Priority',
      noteId: 'workflow-orchestration',
      type: 'updateProperty',
      value: 'High',
    }).notes

    expect(mobileListPropertySuggestions(notes, '')).toEqual(
      expect.arrayContaining(['belongs_to', 'Mentions', 'Priority', 'status', 'tags']),
    )
    const sortableProperties = mobileSortablePropertySuggestions(notes, '')
    expect(sortableProperties).toContain('Priority')
    expect(sortableProperties).not.toContain('belongs_to')
    expect(sortableProperties).not.toContain('Mentions')
    expect(sortableProperties).not.toContain('status')
    expect(sortableProperties).not.toContain('tags')
    expect(mobileListPropertySuggestions(notes, 'bel')).toEqual(['belongs_to'])
    expect(mobileDefaultListPropertyDisplay(notes, {
      Essay: { listPropertiesDisplay: ['status', 'belongs_to'] },
      Procedure: { listPropertiesDisplay: ['tags', 'status'] },
    })).toEqual(['status', 'belongs_to', 'tags'])
  })
})
