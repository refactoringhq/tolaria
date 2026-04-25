import { describe, expect, it } from 'vitest'
import { insertWikilinkAtCursor } from './rawEditorInsertions'

describe('insertWikilinkAtCursor', () => {
  it('inserts a wikilink at the current cursor position', () => {
    expect(insertWikilinkAtCursor('Before ', 7, 'projects/alpha')).toEqual({
      text: 'Before [[projects/alpha]]',
      cursor: 25,
    })
  })

  it('preserves trailing text after the cursor', () => {
    expect(insertWikilinkAtCursor('Before after', 7, 'projects/alpha')).toEqual({
      text: 'Before [[projects/alpha]]after',
      cursor: 25,
    })
  })
})
