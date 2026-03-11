import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './frontmatter'

describe('parseFrontmatter', () => {
  describe('boolean-like Yes/No values', () => {
    it('parses Archived: Yes as true', () => {
      const fm = parseFrontmatter('---\nArchived: Yes\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('parses Archived: No as false', () => {
      const fm = parseFrontmatter('---\nArchived: No\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })

    it('parses Trashed: Yes as true', () => {
      const fm = parseFrontmatter('---\nTrashed: Yes\n---\nBody')
      expect(fm['Trashed']).toBe(true)
    })

    it('parses Trashed: No as false', () => {
      const fm = parseFrontmatter('---\nTrashed: No\n---\nBody')
      expect(fm['Trashed']).toBe(false)
    })

    it('parses yes (lowercase) as true', () => {
      const fm = parseFrontmatter('---\nArchived: yes\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('parses no (lowercase) as false', () => {
      const fm = parseFrontmatter('---\nArchived: no\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })

    it('still parses true as true', () => {
      const fm = parseFrontmatter('---\nArchived: true\n---\nBody')
      expect(fm['Archived']).toBe(true)
    })

    it('still parses false as false', () => {
      const fm = parseFrontmatter('---\nArchived: false\n---\nBody')
      expect(fm['Archived']).toBe(false)
    })
  })
})
