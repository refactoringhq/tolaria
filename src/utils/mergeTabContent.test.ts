import { describe, it, expect } from 'vitest'
import { mergeTabContent } from './mergeTabContent'

describe('mergeTabContent', () => {
  it('adds tab content when allContent is empty', () => {
    const result = mergeTabContent({}, [
      { entry: { path: '/vault/a.md' }, content: '# Hello\nBody text' },
    ])
    expect(result['/vault/a.md']).toBe('# Hello\nBody text')
  })

  it('overrides allContent with tab content (editor state is fresher)', () => {
    const result = mergeTabContent(
      { '/vault/a.md': 'old saved content' },
      [{ entry: { path: '/vault/a.md' }, content: 'current editor content' }],
    )
    expect(result['/vault/a.md']).toBe('current editor content')
  })

  it('preserves allContent for paths without open tabs', () => {
    const result = mergeTabContent(
      { '/vault/b.md': 'other note content' },
      [{ entry: { path: '/vault/a.md' }, content: '# Hello' }],
    )
    expect(result['/vault/b.md']).toBe('other note content')
    expect(result['/vault/a.md']).toBe('# Hello')
  })

  it('returns original object when no tabs have content to merge', () => {
    const original = { '/vault/a.md': 'content' }
    expect(mergeTabContent(original, [])).toBe(original)
  })

  it('skips tabs with empty content', () => {
    const original = { '/vault/a.md': 'content' }
    const result = mergeTabContent(original, [
      { entry: { path: '/vault/b.md' }, content: '' },
    ])
    expect(result).toBe(original)
    expect(result['/vault/b.md']).toBeUndefined()
  })

  it('handles multiple tabs', () => {
    const result = mergeTabContent({}, [
      { entry: { path: '/vault/a.md' }, content: 'Note A' },
      { entry: { path: '/vault/b.md' }, content: 'Note B' },
    ])
    expect(result['/vault/a.md']).toBe('Note A')
    expect(result['/vault/b.md']).toBe('Note B')
  })

  it('does not mutate the original allContent object', () => {
    const original = { '/vault/a.md': 'old' }
    const result = mergeTabContent(original, [
      { entry: { path: '/vault/a.md' }, content: 'new' },
    ])
    expect(original['/vault/a.md']).toBe('old')
    expect(result['/vault/a.md']).toBe('new')
    expect(result).not.toBe(original)
  })
})
