import { describe, expect, it } from 'vitest'
import { slugifyPathStem } from './editorTabContent'

describe('slugifyPathStem', () => {
  it('preserves Unicode title stems for untitled rename detection', () => {
    expect(slugifyPathStem('你好')).toBe('你好')
    expect(slugifyPathStem('My Note 你好')).toBe('my-note-你好')
  })

  it('falls back to untitled when no alphanumeric stem remains', () => {
    expect(slugifyPathStem('+++')).toBe('untitled')
  })
})
