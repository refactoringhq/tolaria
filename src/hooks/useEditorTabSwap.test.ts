import { describe, it, expect } from 'vitest'
import { extractEditorBody, getH1TextFromBlocks, replaceTitleInFrontmatter } from './useEditorTabSwap'

describe('extractEditorBody', () => {
  it('strips frontmatter and preserves H1 heading for new note content', () => {
    const content = '---\ntitle: Untitled note\ntype: Note\nstatus: Active\n---\n\n# Untitled note\n\n'
    expect(extractEditorBody(content)).toBe('# Untitled note\n\n')
  })

  it('strips frontmatter and preserves H1 with body content', () => {
    const content = '---\ntitle: Test\n---\n# Test\n\nBody text here.'
    expect(extractEditorBody(content)).toBe('# Test\n\nBody text here.')
  })

  it('preserves H1 and body content after frontmatter', () => {
    const content = '---\ntitle: My Note\ntype: Note\n---\n\n# My Note\n\nFirst paragraph.\n\nSecond paragraph.'
    expect(extractEditorBody(content)).toBe('# My Note\n\nFirst paragraph.\n\nSecond paragraph.')
  })

  it('handles content without frontmatter', () => {
    const content = '# Just a Heading\n\nSome body text.'
    expect(extractEditorBody(content)).toBe('# Just a Heading\n\nSome body text.')
  })

  it('handles content without frontmatter or heading', () => {
    const content = 'Just plain text.'
    expect(extractEditorBody(content)).toBe('Just plain text.')
  })

  it('handles completely empty content', () => {
    expect(extractEditorBody('')).toBe('')
  })

  it('handles frontmatter-only content', () => {
    const content = '---\ntitle: Empty\n---\n'
    expect(extractEditorBody(content)).toBe('')
  })

  it('preserves wikilinks in body', () => {
    const content = '---\ntitle: Test\n---\n\n# Test\n\nSee [[Other Note]] for details.'
    expect(extractEditorBody(content)).toBe('# Test\n\nSee [[Other Note]] for details.')
  })

  it('preserves non-leading headings', () => {
    const content = '---\ntitle: Test\n---\n\nSome intro text.\n\n# A Heading\n\nMore text.'
    expect(extractEditorBody(content)).toBe('Some intro text.\n\n# A Heading\n\nMore text.')
  })

  it('preserves H1 for buildNoteContent output', () => {
    const content = '---\ntitle: My Project\ntype: Project\nstatus: Active\n---\n\n# My Project\n\n'
    expect(extractEditorBody(content)).toBe('# My Project\n\n')
  })
})

describe('getH1TextFromBlocks', () => {
  it('returns text from H1 heading block', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'My Title', styles: {} }],
    }]
    expect(getH1TextFromBlocks(blocks)).toBe('My Title')
  })

  it('returns null for empty blocks', () => {
    expect(getH1TextFromBlocks([])).toBeNull()
  })

  it('returns null for non-heading first block', () => {
    const blocks = [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Just text' }],
    }]
    expect(getH1TextFromBlocks(blocks)).toBeNull()
  })

  it('returns null for H2 heading', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 2 },
      content: [{ type: 'text', text: 'Subtitle' }],
    }]
    expect(getH1TextFromBlocks(blocks)).toBeNull()
  })

  it('concatenates multiple text spans', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ],
    }]
    expect(getH1TextFromBlocks(blocks)).toBe('Hello World')
  })

  it('returns null for empty H1 content', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [],
    }]
    expect(getH1TextFromBlocks(blocks)).toBeNull()
  })

  it('returns null for whitespace-only H1', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: '   ' }],
    }]
    expect(getH1TextFromBlocks(blocks)).toBeNull()
  })

  it('returns null when blocks is null/undefined', () => {
    expect(getH1TextFromBlocks(null as unknown as unknown[])).toBeNull()
    expect(getH1TextFromBlocks(undefined as unknown as unknown[])).toBeNull()
  })

  it('filters non-text inline content', () => {
    const blocks = [{
      type: 'heading',
      props: { level: 1 },
      content: [
        { type: 'text', text: 'Title' },
        { type: 'wikilink', props: { target: 'linked' } },
      ],
    }]
    expect(getH1TextFromBlocks(blocks)).toBe('Title')
  })
})

describe('replaceTitleInFrontmatter', () => {
  it('replaces title value in frontmatter', () => {
    const fm = '---\ntitle: Old Title\ntype: Note\n---\n\n'
    expect(replaceTitleInFrontmatter(fm, 'New Title')).toBe('---\ntitle: New Title\ntype: Note\n---\n\n')
  })

  it('handles title with extra spaces after colon', () => {
    const fm = '---\ntitle:   Old Title\n---\n'
    expect(replaceTitleInFrontmatter(fm, 'New Title')).toBe('---\ntitle:   New Title\n---\n')
  })

  it('returns unchanged frontmatter when no title line exists', () => {
    const fm = '---\ntype: Note\n---\n'
    expect(replaceTitleInFrontmatter(fm, 'New Title')).toBe('---\ntype: Note\n---\n')
  })

  it('replaces only the title line, not other fields', () => {
    const fm = '---\ntitle: Old\ntype: Note\nstatus: Active\n---\n\n'
    expect(replaceTitleInFrontmatter(fm, 'Updated')).toBe('---\ntitle: Updated\ntype: Note\nstatus: Active\n---\n\n')
  })

  it('handles empty string as frontmatter', () => {
    expect(replaceTitleInFrontmatter('', 'Title')).toBe('')
  })
})
