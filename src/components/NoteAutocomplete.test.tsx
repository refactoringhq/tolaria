import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoteAutocomplete } from './NoteAutocomplete'
import type { VaultEntry } from '../types'

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: 'Active',
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  relationships: {},
  icon: null,
  color: null,
  order: null,
  ...overrides,
})

const entries = [
  makeEntry({ path: '/vault/project/alpha.md', filename: 'alpha.md', title: 'Alpha Project', isA: 'Project' }),
  makeEntry({ path: '/vault/person/luca.md', filename: 'luca.md', title: 'Luca', isA: 'Person' }),
  makeEntry({ path: '/vault/topic/ai.md', filename: 'ai.md', title: 'AI Research', isA: 'Topic' }),
  makeEntry({ path: '/vault/note/plain.md', filename: 'plain.md', title: 'Plain Note', isA: null }),
  makeEntry({ path: '/vault/person/alice.md', filename: 'alice.md', title: 'Alice Smith', isA: 'Person', aliases: ['Alice'] }),
]

const personTypeEntry = makeEntry({
  path: '/vault/type/person.md', filename: 'person.md', title: 'Person',
  isA: 'Type', color: 'yellow', icon: 'user',
})
const typeEntryMap: Record<string, VaultEntry> = { Person: personTypeEntry }

describe('NoteAutocomplete', () => {
  const onChange = vi.fn()
  const onSelect = vi.fn()
  const onEscape = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders input with placeholder', () => {
    render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="" onChange={onChange} onSelect={onSelect} placeholder="Note title" testId="test-input" />,
    )
    expect(screen.getByPlaceholderText('Note title')).toBeInTheDocument()
  })

  it('does not show dropdown for short queries', () => {
    render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="A" onChange={onChange} onSelect={onSelect} />,
    )
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument()
  })

  it('shows matching entries when query is long enough', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Al" onChange={onChange} onSelect={onSelect} />,
    )
    // Simulate opening the dropdown by focusing and typing
    const input = container.querySelector('input')!
    fireEvent.focus(input)
    expect(screen.getByText('Alpha Project')).toBeInTheDocument()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('shows note type badge for typed entries', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Luca" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    expect(screen.getByText('Luca')).toBeInTheDocument()
    expect(screen.getByText('Person')).toBeInTheDocument()
  })

  it('does not show type badge for plain notes', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Plain" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    expect(screen.getByText('Plain Note')).toBeInTheDocument()
    // Should not render any type badge
    const typeLabels = container.querySelectorAll('.wikilink-menu__type')
    expect(typeLabels.length).toBe(0)
  })

  it('applies type color from typeEntryMap', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Luca" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    const typeLabel = container.querySelector('.wikilink-menu__type')
    expect(typeLabel).toBeTruthy()
    expect((typeLabel as HTMLElement).style.color).toBe('var(--accent-yellow)')
  })

  it('calls onSelect when clicking a dropdown item', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Alpha" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    fireEvent.click(screen.getByText('Alpha Project'))
    expect(onSelect).toHaveBeenCalledWith('Alpha Project')
  })

  it('navigates dropdown with arrow keys', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Al" onChange={onChange} onSelect={onSelect} />,
    )
    const input = container.querySelector('input')!
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // First item should be selected
    const selectedItem = container.querySelector('.wikilink-menu__item--selected')
    expect(selectedItem).toBeTruthy()
  })

  it('selects highlighted item with Enter', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Al" onChange={onChange} onSelect={onSelect} />,
    )
    const input = container.querySelector('input')!
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('Alpha Project')
  })

  it('calls onEscape when Escape is pressed', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="test" onChange={onChange} onSelect={onSelect} onEscape={onEscape} />,
    )
    const input = container.querySelector('input')!
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalled()
  })

  it('matches on aliases', () => {
    const { container } = render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="Alice" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('limits results to MAX_RESULTS', () => {
    const manyEntries = Array.from({ length: 20 }, (_, i) =>
      makeEntry({ path: `/vault/note/${i}.md`, filename: `${i}.md`, title: `Note ${i}`, isA: null }),
    )
    const { container } = render(
      <NoteAutocomplete entries={manyEntries} typeEntryMap={{}} value="Note" onChange={onChange} onSelect={onSelect} />,
    )
    fireEvent.focus(container.querySelector('input')!)
    const items = container.querySelectorAll('.wikilink-menu__item')
    expect(items.length).toBe(10) // MAX_RESULTS
  })

  it('submits raw value with Enter when no item is selected', () => {
    render(
      <NoteAutocomplete entries={entries} typeEntryMap={typeEntryMap} value="custom text" onChange={onChange} onSelect={onSelect} />,
    )
    const input = screen.getByDisplayValue('custom text')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('custom text')
  })
})
