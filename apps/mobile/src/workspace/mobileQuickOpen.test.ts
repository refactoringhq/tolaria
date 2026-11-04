import { describe, expect, it } from 'vitest'
import { requiredFixture } from '../fixtures/requiredFixture'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import {
  mobileQuickOpenMoveIndex,
  mobileQuickOpenRecentNotes,
  mobileQuickOpenResultLimit,
  mobileQuickOpenResults,
  mobileQuickOpenSelectedNote,
  mobileQuickOpenSnippetParts,
  rememberMobileQuickOpenNote,
  rememberMobileQuickOpenSearch,
} from './mobileQuickOpen'
import type { MobileNote } from './mobileWorkspaceModel'

describe('mobile quick open', () => {
  it('returns the first active notes for an empty query', () => {
    const notes = workspaceScenarioForId('default').notes

    expect(
      mobileQuickOpenResults(notes, '')
        .map((note) => note.id)
        .slice(0, 3),
    ).toEqual(['workflow-orchestration', 'open-source-project', 'release-2026-05-02'])
  })

  it('excludes archived notes and caps empty-query results', () => {
    const notes = Array.from({ length: mobileQuickOpenResultLimit + 3 }, (_, index) => ({
      ...requiredFixture(workspaceScenarioForId('default').notes[0]),
      archived: index === 1,
      id: `note-${index}`,
      title: `Note ${index}`,
    }))

    const results = mobileQuickOpenResults(notes, '')

    expect(results).toHaveLength(mobileQuickOpenResultLimit)
    expect(results.map((note) => note.id)).not.toContain('note-1')
  })

  it('matches title, preview, metadata, tags, and path text', () => {
    const notes = workspaceScenarioForId('default').notes

    expect(mobileQuickOpenResults(notes, 'workflow orchestration').map((note) => note.id)).toEqual([
      'workflow-orchestration',
    ])
    expect(mobileQuickOpenResults(notes, 'unexpected success').map((note) => note.id)).toEqual(['open-source-project'])
    expect(mobileQuickOpenResults(notes, 'tolaria/releases').map((note) => note.id)).toEqual(['release-2026-05-02'])
    expect(mobileQuickOpenResults(notes, 'design').map((note) => note.id)).toContain('workflow-orchestration')
    expect(mobileQuickOpenResults(notes, 'procedure').map((note) => note.id)).toContain('open-source-project')
  })

  it('matches desktop quick-open alias and filename forms', () => {
    const note = {
      ...requiredFixture(workspaceScenarioForId('default').notes[0]),
      aliases: ['Weekly Review'],
      id: 'cafe-notes',
      path: 'journal/cafe-notes.md',
      title: 'Café Notes',
    }

    expect(mobileQuickOpenResults([note], 'weekly review').map((result) => result.id)).toEqual(['cafe-notes'])
    expect(mobileQuickOpenResults([note], 'cafe-notes.md').map((result) => result.id)).toEqual(['cafe-notes'])
    expect(mobileQuickOpenResults([note], 'Cafe Notes').map((result) => result.id)).toEqual(['cafe-notes'])
  })

  it('ranks exact title, alias, and prefix matches like desktop quick open', () => {
    const notes = [
      note({ aliases: ['Refactoring'], id: 'ideas', path: 'ideas.md', title: 'Refactoring Ideas' }),
      note({ id: 'manual', path: 'manual.md', title: 'Refactoring Manual' }),
      note({ id: 'refactoring', path: 'refactoring.md', title: 'Refactoring' }),
    ]

    expect(mobileQuickOpenResults(notes, 'Refactoring').map((result) => result.id)).toEqual([
      'refactoring',
      'ideas',
      'manual',
    ])
  })

  it('ranks alias exact matches above title prefix matches', () => {
    const notes = [
      note({ id: 'reference', path: 'reference.md', title: 'Reference Manual' }),
      note({ aliases: ['ref'], id: 'meeting', path: 'meeting.md', title: 'Meeting Notes' }),
    ]

    expect(mobileQuickOpenResults(notes, 'ref').map((result) => result.id)).toEqual(['meeting', 'reference'])
  })

  it('matches desktop quick-open fuzzy and slugified filename forms', () => {
    const notes = [
      note({ id: 'alpha', path: 'projects/alpha-project.md', title: 'Alpha Project' }),
      note({ id: 'workflow', path: 'essays/workflow-orchestration.md', title: 'Workflow Orchestration' }),
    ]

    expect(mobileQuickOpenResults(notes, 'wko').map((result) => result.id)).toEqual(['workflow'])
    expect(mobileQuickOpenResults(notes, 'Alpha Project!').map((result) => result.id)).toEqual(['alpha'])
  })

  it('returns no results for unmatched queries', () => {
    expect(mobileQuickOpenResults(workspaceScenarioForId('default').notes, 'zzzzzzz')).toEqual([])
  })

  it('clamps keyboard selection like desktop quick open', () => {
    expect(mobileQuickOpenMoveIndex(0, 3, 'previous')).toBe(0)
    expect(mobileQuickOpenMoveIndex(0, 3, 'next')).toBe(1)
    expect(mobileQuickOpenMoveIndex(2, 3, 'next')).toBe(2)
    expect(mobileQuickOpenMoveIndex(4, 0, 'next')).toBe(0)
  })

  it('returns the selected note or null', () => {
    const results = mobileQuickOpenResults(workspaceScenarioForId('default').notes, '')

    expect(mobileQuickOpenSelectedNote(results, 1)?.id).toBe('open-source-project')
    expect(mobileQuickOpenSelectedNote(results, 99)).toBeNull()
  })

  it('keeps unique recent searches in most-recent-first order', () => {
    const recent = { searches: [], noteIds: [] }
    const afterFirst = rememberMobileQuickOpenSearch(recent, 'Randy Shoup')
    const afterSecond = rememberMobileQuickOpenSearch(afterFirst, 'design systems')

    expect(rememberMobileQuickOpenSearch(afterSecond, ' randy shoup ')).toEqual({
      searches: ['randy shoup', 'design systems'],
      noteIds: [],
    })
  })

  it('orders recently opened notes and excludes missing or archived notes', () => {
    const notes = [
      note({ id: 'first', title: 'First' }),
      note({ archived: true, id: 'archived', title: 'Archived' }),
      note({ id: 'second', title: 'Second' }),
    ]
    const recent = rememberMobileQuickOpenNote(
      rememberMobileQuickOpenNote({ searches: [], noteIds: ['missing'] }, 'second'),
      'archived',
    )

    expect(mobileQuickOpenRecentNotes(notes, recent).map(({ id }) => id)).toEqual(['second'])
  })

  it('splits matching snippet terms for bold rendering', () => {
    expect(mobileQuickOpenSnippetParts('Randy Shoup spoke at React Summit', 'randy shoup')).toEqual([
      { matched: true, text: 'Randy' },
      { matched: false, text: ' ' },
      { matched: true, text: 'Shoup' },
      { matched: false, text: ' spoke at React Summit' },
    ])
  })
})

function note(overrides: Partial<MobileNote>): MobileNote {
  return {
    ...requiredFixture(workspaceScenarioForId('default').notes[0]),
    aliases: [],
    archived: false,
    relationships: [],
    snippet: '',
    status: '',
    tags: [],
    type: 'Note',
    typeTone: 'gray',
    ...overrides,
  }
}
