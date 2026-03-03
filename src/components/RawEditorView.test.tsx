import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { RawEditorView } from './RawEditorView'
import { extractWikilinkQuery, detectYamlError } from '../utils/rawEditorUtils'

// Minimal VaultEntry factory
function entry(title: string, path = `/vault/note/${title}.md`) {
  return {
    path, filename: `${title}.md`, title, isA: 'Note',
    aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
    cadence: null, archived: false, trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0, snippet: '', wordCount: 0,
    relationships: {}, icon: null, color: null, order: null,
    sidebarLabel: null, template: null, outgoingLinks: [],
    properties: {},
  }
}

const defaultProps = {
  content: '---\ntitle: My Note\n---\n\n# My Note\n\nSome content.',
  path: '/vault/note/my-note.md',
  entries: [entry('Project Alpha'), entry('Meeting Notes')],
  onContentChange: vi.fn(),
  onSave: vi.fn(),
}

describe('extractWikilinkQuery', () => {
  it('returns null when no [[ trigger', () => {
    expect(extractWikilinkQuery('hello world', 5)).toBeNull()
  })

  it('returns empty string immediately after [[', () => {
    const text = 'see [['
    expect(extractWikilinkQuery(text, text.length)).toBe('')
  })

  it('returns query after [[', () => {
    const text = 'see [[Proj'
    expect(extractWikilinkQuery(text, text.length)).toBe('Proj')
  })

  it('returns null when ]] closes the link', () => {
    const text = '[[Proj]]'
    expect(extractWikilinkQuery(text, text.length)).toBeNull()
  })

  it('returns null when newline is in query', () => {
    const text = '[[Proj\ncontinued'
    expect(extractWikilinkQuery(text, text.length)).toBeNull()
  })

  it('handles cursor before end of text', () => {
    // cursor at 6 = after "[[Proj" (before the space)
    const text = '[[Proj after'
    expect(extractWikilinkQuery(text, 6)).toBe('Proj')
  })
})

describe('detectYamlError', () => {
  it('returns null for content without frontmatter', () => {
    expect(detectYamlError('# Title\n\nSome content.')).toBeNull()
  })

  it('returns null for valid frontmatter', () => {
    expect(detectYamlError('---\ntitle: My Note\n---\n\n# Title')).toBeNull()
  })

  it('returns error for unclosed frontmatter', () => {
    const error = detectYamlError('---\ntitle: My Note\n\n# Title')
    expect(error).toContain('Unclosed frontmatter')
  })

  it('returns error for tab indentation in frontmatter', () => {
    const error = detectYamlError('---\n\ttitle: My Note\n---\n')
    expect(error).toContain('tab indentation')
  })

  it('returns null for content not starting with ---', () => {
    expect(detectYamlError('Not frontmatter')).toBeNull()
  })
})

describe('RawEditorView', () => {
  it('renders textarea with the provided content', () => {
    render(<RawEditorView {...defaultProps} />)
    const textarea = screen.getByTestId('raw-editor-textarea')
    expect(textarea).toBeInTheDocument()
    expect((textarea as HTMLTextAreaElement).value).toBe(defaultProps.content)
  })

  it('calls onContentChange when user types (debounced)', async () => {
    vi.useFakeTimers()
    const onContentChange = vi.fn()
    render(<RawEditorView {...defaultProps} onContentChange={onContentChange} />)
    const textarea = screen.getByTestId('raw-editor-textarea')

    fireEvent.change(textarea, { target: { value: '---\ntitle: Changed\n---\n\n# Changed' } })

    // Should not be called immediately
    expect(onContentChange).not.toHaveBeenCalled()

    // After debounce
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(onContentChange).toHaveBeenCalledWith(
      defaultProps.path,
      '---\ntitle: Changed\n---\n\n# Changed'
    )

    vi.useRealTimers()
  })

  it('shows YAML error banner for unclosed frontmatter', () => {
    render(<RawEditorView {...defaultProps} content="---\ntitle: Bad\n\n# Title" />)
    expect(screen.getByTestId('raw-editor-yaml-error')).toBeInTheDocument()
    expect(screen.getByTestId('raw-editor-yaml-error')).toHaveTextContent('Unclosed frontmatter')
  })

  it('does not show YAML error for valid content', () => {
    render(<RawEditorView {...defaultProps} />)
    expect(screen.queryByTestId('raw-editor-yaml-error')).not.toBeInTheDocument()
  })

  it('calls onSave when Cmd+S is pressed', () => {
    const onSave = vi.fn()
    render(<RawEditorView {...defaultProps} onSave={onSave} />)
    const textarea = screen.getByTestId('raw-editor-textarea')
    fireEvent.keyDown(textarea, { key: 's', metaKey: true })
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('calls onSave when Ctrl+S is pressed', () => {
    const onSave = vi.fn()
    render(<RawEditorView {...defaultProps} onSave={onSave} />)
    const textarea = screen.getByTestId('raw-editor-textarea')
    fireEvent.keyDown(textarea, { key: 's', ctrlKey: true })
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('has monospaced font family applied', () => {
    render(<RawEditorView {...defaultProps} />)
    const textarea = screen.getByTestId('raw-editor-textarea') as HTMLTextAreaElement
    expect(textarea.style.fontFamily).toContain('monospace')
  })
})
