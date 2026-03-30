import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BreadcrumbBar } from './BreadcrumbBar'
import type { VaultEntry } from '../types'

const baseEntry: VaultEntry = {
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: null,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
}

const archivedEntry: VaultEntry = {
  ...baseEntry,
  archived: true,
}

const trashedEntry: VaultEntry = {
  ...baseEntry,
  trashed: true,
  trashedAt: Date.now() / 1000 - 86400 * 5,
}

const defaultProps = {
  wordCount: 100,
  noteStatus: 'clean' as const,
  showDiffToggle: false,
  diffMode: false,
  diffLoading: false,
  onToggleDiff: vi.fn(),
}

describe('BreadcrumbBar — drag region', () => {
  it('has data-tauri-drag-region on the container', () => {
    const { container } = render(<BreadcrumbBar entry={baseEntry} {...defaultProps} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.dataset.tauriDragRegion).toBeDefined()
  })
})

describe('BreadcrumbBar — trash/restore', () => {
  it('shows trash button for non-trashed note', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onTrash={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByTitle('Move to trash (Cmd+Delete)')).toBeInTheDocument()
    expect(screen.queryByTitle('Restore from trash')).not.toBeInTheDocument()
  })

  it('shows restore button for trashed note', () => {
    render(<BreadcrumbBar entry={trashedEntry} {...defaultProps} onTrash={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByTitle('Restore from trash')).toBeInTheDocument()
    expect(screen.queryByTitle('Move to trash (Cmd+Delete)')).not.toBeInTheDocument()
  })

  it('calls onTrash when trash button is clicked', () => {
    const onTrash = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onTrash={onTrash} onRestore={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Move to trash (Cmd+Delete)'))
    expect(onTrash).toHaveBeenCalledOnce()
  })

  it('calls onRestore when restore button is clicked', () => {
    const onRestore = vi.fn()
    render(<BreadcrumbBar entry={trashedEntry} {...defaultProps} onTrash={vi.fn()} onRestore={onRestore} />)
    fireEvent.click(screen.getByTitle('Restore from trash'))
    expect(onRestore).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — pending save indicator', () => {
  it('shows "Saving…" text when noteStatus is pendingSave', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} noteStatus={'pendingSave'} />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('does not show "Saving…" text for clean status', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} noteStatus={'clean'} />)
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
  })
})

describe('BreadcrumbBar — archive/unarchive', () => {
  it('shows archive button for non-archived note', () => {
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    expect(screen.getByTitle('Archive (Cmd+E)')).toBeInTheDocument()
    expect(screen.queryByTitle('Unarchive (Cmd+E)')).not.toBeInTheDocument()
  })

  it('shows unarchive button for archived note', () => {
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onArchive={vi.fn()} onUnarchive={vi.fn()} />)
    expect(screen.getByTitle('Unarchive (Cmd+E)')).toBeInTheDocument()
    expect(screen.queryByTitle('Archive (Cmd+E)')).not.toBeInTheDocument()
  })

  it('calls onArchive when archive button is clicked', () => {
    const onArchive = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} onArchive={onArchive} />)
    fireEvent.click(screen.getByTitle('Archive (Cmd+E)'))
    expect(onArchive).toHaveBeenCalledOnce()
  })

  it('calls onUnarchive when unarchive button is clicked', () => {
    const onUnarchive = vi.fn()
    render(<BreadcrumbBar entry={archivedEntry} {...defaultProps} onUnarchive={onUnarchive} />)
    fireEvent.click(screen.getByTitle('Unarchive (Cmd+E)'))
    expect(onUnarchive).toHaveBeenCalledOnce()
  })
})

describe('BreadcrumbBar — raw editor toggle', () => {
  it('shows Raw editor button with tooltip "Raw editor" when rawMode is off', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    expect(screen.getByTitle('Raw editor')).toBeInTheDocument()
  })

  it('shows "Back to editor" tooltip when rawMode is on', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={true} onToggleRaw={onToggleRaw} />)
    expect(screen.getByTitle('Back to editor')).toBeInTheDocument()
  })

  it('calls onToggleRaw when raw button is clicked', () => {
    const onToggleRaw = vi.fn()
    render(<BreadcrumbBar entry={baseEntry} {...defaultProps} rawMode={false} onToggleRaw={onToggleRaw} />)
    fireEvent.click(screen.getByTitle('Raw editor'))
    expect(onToggleRaw).toHaveBeenCalledOnce()
  })
})
