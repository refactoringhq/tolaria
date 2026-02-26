import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoteSearchList } from './NoteSearchList'
import type { NoteSearchResultItem } from './NoteSearchList'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

interface TestItem extends NoteSearchResultItem {
  id: string
}

const items: TestItem[] = [
  { id: '1', title: 'Alpha Project', noteType: 'Project', typeColor: 'var(--accent-blue)', typeLightColor: 'var(--accent-blue-light)' },
  { id: '2', title: 'Beta Notes' },
  { id: '3', title: 'Gamma Experiment', noteType: 'Experiment' },
]

describe('NoteSearchList', () => {
  const onItemClick = vi.fn()
  const onItemHover = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all items with titles', () => {
    render(
      <NoteSearchList
        items={items}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )
    expect(screen.getByText('Alpha Project')).toBeInTheDocument()
    expect(screen.getByText('Beta Notes')).toBeInTheDocument()
    expect(screen.getByText('Gamma Experiment')).toBeInTheDocument()
  })

  it('shows type badge when noteType is present', () => {
    render(
      <NoteSearchList
        items={items}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Experiment')).toBeInTheDocument()
  })

  it('does not show type badge when noteType is absent', () => {
    render(
      <NoteSearchList
        items={[{ id: '2', title: 'Beta Notes' }]}
        selectedIndex={0}
        getItemKey={(item: TestItem) => item.id}
        onItemClick={onItemClick}
      />,
    )
    expect(screen.getByText('Beta Notes')).toBeInTheDocument()
    // No badge element should exist
    expect(screen.queryByText('Note')).not.toBeInTheDocument()
  })

  it('applies typeColor and typeLightColor to badge when provided', () => {
    render(
      <NoteSearchList
        items={[items[0]]}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )
    const badge = screen.getByText('Project')
    expect(badge.style.color).toBe('var(--accent-blue)')
    expect(badge.style.backgroundColor).toBe('var(--accent-blue-light)')
  })

  it('shows empty message when no items', () => {
    render(
      <NoteSearchList
        items={[]}
        selectedIndex={0}
        getItemKey={() => ''}
        onItemClick={onItemClick}
        emptyMessage="No matching notes"
      />,
    )
    expect(screen.getByText('No matching notes')).toBeInTheDocument()
  })

  it('shows default empty message', () => {
    render(
      <NoteSearchList
        items={[]}
        selectedIndex={0}
        getItemKey={() => ''}
        onItemClick={onItemClick}
      />,
    )
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('calls onItemClick when an item is clicked', () => {
    render(
      <NoteSearchList
        items={items}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )
    fireEvent.click(screen.getByText('Beta Notes'))
    expect(onItemClick).toHaveBeenCalledWith(items[1], 1)
  })

  it('calls onItemHover when mouse enters an item', () => {
    render(
      <NoteSearchList
        items={items}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
        onItemHover={onItemHover}
      />,
    )
    fireEvent.mouseEnter(screen.getByText('Gamma Experiment'))
    expect(onItemHover).toHaveBeenCalledWith(2)
  })

  it('highlights selected item with accent background', () => {
    render(
      <NoteSearchList
        items={items}
        selectedIndex={1}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )
    const selectedItem = screen.getByText('Beta Notes').closest('div')!
    expect(selectedItem.className).toContain('bg-accent')

    const unselectedItem = screen.getByText('Alpha Project').closest('div')!
    expect(unselectedItem.className).not.toContain('bg-accent')
  })

  it('calls scrollIntoView on the selected item', () => {
    const scrollMock = vi.fn()
    Element.prototype.scrollIntoView = scrollMock

    const { rerender } = render(
      <NoteSearchList
        items={items}
        selectedIndex={0}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )

    scrollMock.mockClear()

    rerender(
      <NoteSearchList
        items={items}
        selectedIndex={2}
        getItemKey={(item) => item.id}
        onItemClick={onItemClick}
      />,
    )

    expect(scrollMock).toHaveBeenCalledWith({ block: 'nearest' })
  })
})
