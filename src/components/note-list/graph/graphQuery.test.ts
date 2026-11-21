import { describe, expect, it } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import { matchesGraphQuery, parseGraphQuery } from './graphQuery'

const launch = makeEntry({ title: 'Launch Plan', isA: 'Project', status: 'Active', properties: { Owner: 'Ada', Tags: ['q3', 'web'] } })
const ada = makeEntry({ title: 'Ada', isA: 'Person', status: null, properties: { status: 'busy' } })

function matches(query: string, entry = launch) {
  return matchesGraphQuery(entry, parseGraphQuery(query))
}

describe('graph query', () => {
  it('matches everything when empty and titles by case-insensitive substring', () => {
    expect(matches('')).toBe(true)
    expect(matches('launch')).toBe(true)
    expect(matches('PLAN')).toBe(true)
    expect(matches('roadmap')).toBe(false)
  })

  it('matches the note type with type:', () => {
    expect(matches('type:project')).toBe(true)
    expect(matches('type:person')).toBe(false)
    expect(matches('is:per', ada)).toBe(true)
  })

  it('matches properties by key, case-insensitively, including list values and the status', () => {
    expect(matches('owner:ada')).toBe(true)
    expect(matches('tags:web')).toBe(true)
    expect(matches('owner:grace')).toBe(false)
    expect(matches('status:active')).toBe(true)
    expect(matches('status:busy', ada)).toBe(true)
    expect(matches('missing:x')).toBe(false)
  })

  it('needs every term to match and treats a dangling colon as text', () => {
    expect(matches('launch type:project')).toBe(true)
    expect(matches('launch type:person')).toBe(false)
    expect(parseGraphQuery('note:')).toEqual([{ key: null, value: 'note:' }])
  })
})
