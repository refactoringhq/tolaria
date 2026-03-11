import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { extractEditorBody, getH1TextFromBlocks, replaceTitleInFrontmatter, useEditorTabSwap } from './useEditorTabSwap'

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

const blocksA = [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }]
const blocksB = [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }]

function makeTab(path: string, title: string) {
  return {
    entry: { path, title, filename: `${title}.md`, type: 'Note', status: 'Active', aliases: [], isA: '' } as never,
    content: `---\ntitle: ${title}\n---\n\n# ${title}\n\nBody of ${title}.`,
  }
}

function makeMockEditor(docRef: { current: unknown[] }) {
  return {
    document: docRef.current,
    get prosemirrorView() { return {} },
    onMount: (cb: () => void) => { cb(); return () => {} },
    replaceBlocks: vi.fn((_old, newBlocks) => { docRef.current = newBlocks }),
    insertBlocks: vi.fn(),
    blocksToMarkdownLossy: vi.fn(() => ''),
    blocksToHTMLLossy: vi.fn(() => ''),
    tryParseMarkdownToBlocks: vi.fn(() => blocksA),
    _tiptapEditor: { commands: { setContent: vi.fn() } },
    _docRef: docRef,
  }
}

describe('useEditorTabSwap raw mode sync', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('re-parses from tab.content when rawMode transitions from true to false', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath, rawMode }) => useEditorTabSwap({
        tabs, activeTabPath, editor: mockEditor as never, rawMode,
      }),
      { initialProps: { tabs: [tabA], activeTabPath: 'a.md', rawMode: false as boolean } },
    )

    // Initial load — parses and caches blocks
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Enter raw mode
    rerender({ tabs: [tabA], activeTabPath: 'a.md', rawMode: true })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Simulate raw editing: tab content was updated externally
    const updatedTab = {
      ...tabA,
      content: '---\ntitle: Updated Title\n---\n\n# Updated Title\n\nNew body content.',
    }
    mockEditor.tryParseMarkdownToBlocks.mockClear()
    mockEditor.replaceBlocks.mockClear()

    // Exit raw mode with updated content
    rerender({ tabs: [updatedTab], activeTabPath: 'a.md', rawMode: false })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Verify re-parse happened with updated body content
    expect(mockEditor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
      expect.stringContaining('Updated Title'),
    )
    expect(mockEditor.replaceBlocks).toHaveBeenCalled()
  })

  it('does not skip swap when rawMode is on (editor hidden)', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath, rawMode }) => useEditorTabSwap({
        tabs, activeTabPath, editor: mockEditor as never, rawMode,
      }),
      { initialProps: { tabs: [tabA], activeTabPath: 'a.md', rawMode: false as boolean } },
    )

    await act(() => new Promise(r => setTimeout(r, 0)))
    mockEditor.replaceBlocks.mockClear()

    // Enter raw mode and update content
    const updatedTab = { ...tabA, content: '---\ntitle: Changed\n---\n\n# Changed\n\nEdited.' }
    rerender({ tabs: [updatedTab], activeTabPath: 'a.md', rawMode: true })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // While in raw mode, the editor should NOT be updated
    expect(mockEditor.replaceBlocks).not.toHaveBeenCalled()
  })

  it('preserves content through multiple BlockNote→raw→BlockNote cycles', async () => {
    vi.spyOn(document, 'querySelector').mockReturnValue({ scrollTop: 0 } as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath, rawMode }) => useEditorTabSwap({
        tabs, activeTabPath, editor: mockEditor as never, rawMode,
      }),
      { initialProps: { tabs: [tabA], activeTabPath: 'a.md', rawMode: false as boolean } },
    )
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Cycle 1: raw mode on → edit → raw mode off
    rerender({ tabs: [tabA], activeTabPath: 'a.md', rawMode: true })
    await act(() => new Promise(r => setTimeout(r, 0)))

    const edit1 = { ...tabA, content: '---\ntitle: Edit 1\n---\n\n# Edit 1\n\nFirst edit.' }
    mockEditor.tryParseMarkdownToBlocks.mockClear()
    rerender({ tabs: [edit1], activeTabPath: 'a.md', rawMode: false })
    await act(() => new Promise(r => setTimeout(r, 0)))
    expect(mockEditor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
      expect.stringContaining('Edit 1'),
    )

    // Cycle 2: raw mode on → edit → raw mode off
    rerender({ tabs: [edit1], activeTabPath: 'a.md', rawMode: true })
    await act(() => new Promise(r => setTimeout(r, 0)))

    const edit2 = { ...tabA, content: '---\ntitle: Edit 2\n---\n\n# Edit 2\n\nSecond edit.' }
    mockEditor.tryParseMarkdownToBlocks.mockClear()
    rerender({ tabs: [edit2], activeTabPath: 'a.md', rawMode: false })
    await act(() => new Promise(r => setTimeout(r, 0)))
    expect(mockEditor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
      expect.stringContaining('Edit 2'),
    )
  })
})

describe('useEditorTabSwap scroll position', () => {

  afterEach(() => { vi.restoreAllMocks() })

  it('saves scroll position when switching tabs and restores it when switching back', async () => {
    const scrollEl = { scrollTop: 0 }
    vi.spyOn(document, 'querySelector').mockReturnValue(scrollEl as unknown as Element)
    const rAF = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    // Override document to be dynamic
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')
    const tabB = makeTab('b.md', 'Note B')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: mockEditor as never,
      }),
      { initialProps: { tabs: [tabA, tabB], activeTabPath: 'a.md' } },
    )

    // Flush the microtask for initial content swap
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Simulate scrolling in tab A
    scrollEl.scrollTop = 350

    // Switch to tab B
    rerender({ tabs: [tabA, tabB], activeTabPath: 'b.md' })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // rAF should have been called to set scroll to 0 (new tab, no cached scroll)
    expect(rAF).toHaveBeenCalled()

    // Switch back to tab A
    docRef.current = blocksB // simulate B's content in editor
    scrollEl.scrollTop = 0 // B is at top
    rerender({ tabs: [tabA, tabB], activeTabPath: 'a.md' })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // The last rAF call should restore A's scroll position (350)
    const lastRAFCall = rAF.mock.calls[rAF.mock.calls.length - 1]
    expect(lastRAFCall).toBeDefined()
    // Execute the callback to verify scrollTop is set
    scrollEl.scrollTop = 0
    ;(lastRAFCall[0] as (n: number) => void)(0)
    expect(scrollEl.scrollTop).toBe(350)
  })

  it('defaults to scroll top 0 for newly opened tabs', async () => {
    const scrollEl = { scrollTop: 0 }
    vi.spyOn(document, 'querySelector').mockReturnValue(scrollEl as unknown as Element)
    const rAF = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')

    renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: mockEditor as never,
      }),
      { initialProps: { tabs: [tabA], activeTabPath: 'a.md' } },
    )

    await act(() => new Promise(r => setTimeout(r, 0)))

    // For a fresh tab, scroll should go to 0
    expect(rAF).toHaveBeenCalled()
    expect(scrollEl.scrollTop).toBe(0)
  })

  it('cleans up scroll cache when a tab is closed', async () => {
    const scrollEl = { scrollTop: 100 }
    vi.spyOn(document, 'querySelector').mockReturnValue(scrollEl as unknown as Element)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0 })

    const docRef = { current: blocksA as unknown[] }
    const mockEditor = makeMockEditor(docRef)
    Object.defineProperty(mockEditor, 'document', { get: () => docRef.current })

    const tabA = makeTab('a.md', 'Note A')
    const tabB = makeTab('b.md', 'Note B')

    const { rerender } = renderHook(
      ({ tabs, activeTabPath }) => useEditorTabSwap({
        tabs,
        activeTabPath,
        editor: mockEditor as never,
      }),
      { initialProps: { tabs: [tabA, tabB], activeTabPath: 'a.md' } },
    )
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Switch to B (caches A's scroll at 100)
    rerender({ tabs: [tabA, tabB], activeTabPath: 'b.md' })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Close tab A (only tab B remains)
    rerender({ tabs: [tabB], activeTabPath: 'b.md' })
    await act(() => new Promise(r => setTimeout(r, 0)))

    // Reopen tab A — should start at scroll 0, not the cached 100
    const tabANew = makeTab('a.md', 'Note A')
    scrollEl.scrollTop = 0
    rerender({ tabs: [tabB, tabANew], activeTabPath: 'a.md' })
    await act(() => new Promise(r => setTimeout(r, 0)))

    expect(scrollEl.scrollTop).toBe(0)
  })
})
