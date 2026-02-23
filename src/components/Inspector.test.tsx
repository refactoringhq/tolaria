import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Inspector } from './Inspector'
import type { VaultEntry, GitCommit } from '../types'

const mockEntry: VaultEntry = {
  path: '/vault/project/test.md',
  filename: 'test.md',
  title: 'Test Project',
  isA: 'Project',
  aliases: [],
  belongsTo: ['[[responsibility/grow-newsletter]]'],
  relatedTo: ['[[topic/software-development]]'],
  status: 'Active',
  owner: 'Luca Rossi',
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1707900000,
  createdAt: null,
  fileSize: 1024,
  snippet: '',
  relationships: {},
  icon: null,
  color: null,
    order: null,
}

const mockContent = `---
title: Test Project
is_a: Project
Status: Active
Owner: Luca Rossi
Cadence: Weekly
tags: [React, TypeScript, Tauri]
Belongs to:
  - "[[responsibility/grow-newsletter]]"
Related to:
  - "[[topic/software-development]]"
---

# Test Project

This is a test note with some words to count.
`

const referrerEntry: VaultEntry = {
  path: '/vault/note/referrer.md',
  filename: 'referrer.md',
  title: 'Referrer Note',
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
  modifiedAt: 1707900000,
  createdAt: null,
  fileSize: 200,
  snippet: '',
  relationships: {},
  icon: null,
  color: null,
    order: null,
}

const allContent: Record<string, string> = {
  '/vault/note/referrer.md': '# Referrer\n\nSee [[Test Project]] for details.',
  '/vault/project/test.md': '# Test Project\n\nSome content.',
}

const now = Math.floor(Date.now() / 1000)
const mockGitHistory: GitCommit[] = [
  { hash: 'a1b2c3d4e5f6a7b8', shortHash: 'a1b2c3d', message: 'Update test with latest changes', author: 'Luca Rossi', date: now - 86400 * 2 },
  { hash: 'e4f5g6h7i8j9k0l1', shortHash: 'e4f5g6h', message: 'Add new section to test', author: 'Luca Rossi', date: now - 86400 * 5 },
  { hash: 'i7j8k9l0m1n2o3p4', shortHash: 'i7j8k9l', message: 'Create test', author: 'Luca Rossi', date: now - 86400 * 12 },
]

const defaultProps = {
  collapsed: false,
  onToggle: () => {},
  entry: null as VaultEntry | null,
  content: null as string | null,
  entries: [] as VaultEntry[],
  allContent: {} as Record<string, string>,
  gitHistory: [] as GitCommit[],
  onNavigate: () => {},
}

describe('Inspector', () => {
  it('renders expanded state with "no note selected"', () => {
    render(<Inspector {...defaultProps} />)
    // Header now says "Properties" (not "Inspector")
    expect(screen.getAllByText('Properties').length).toBeGreaterThan(0)
    expect(screen.getByText('No note selected')).toBeInTheDocument()
  })

  it('renders collapsed state without sections', () => {
    render(<Inspector {...defaultProps} collapsed={true} />)
    // When collapsed, no section content is visible
    expect(screen.queryByText('No note selected')).not.toBeInTheDocument()
  })

  it('calls onToggle when toggle button clicked', () => {
    const onToggle = vi.fn()
    render(<Inspector {...defaultProps} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows properties when a note is selected', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    expect(screen.getAllByText('Project').length).toBeGreaterThan(0)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Words')).toBeInTheDocument()
  })

  it('renders status as a colored pill', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    const pill = screen.getByText('Active')
    // Status is rendered as an inline pill with CSS variable-based styles
    expect(pill).toHaveStyle({ borderRadius: '16px' })
  })

  it('computes word count from content minus frontmatter', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    // "# Test Project" + "This is a test note with some words to count." = 13 words
    expect(screen.getByText('13')).toBeInTheDocument()
  })

  it('shows "Add property" button as disabled placeholder', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    const btn = screen.getByText('+ Add property')
    expect(btn).toBeDisabled()
  })

  it('shows cadence when present', () => {
    // Cadence is now read from frontmatter in content (already in mockContent)
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    expect(screen.getByText('Cadence')).toBeInTheDocument()
    expect(screen.getByText('Weekly')).toBeInTheDocument()
  })

  it('shows relationships with clickable links', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    expect(screen.getByText('Belongs to')).toBeInTheDocument()
    expect(screen.getByText('Grow Newsletter')).toBeInTheDocument()
    expect(screen.getByText('Related to')).toBeInTheDocument()
    expect(screen.getByText('Software Development')).toBeInTheDocument()
  })

  it('navigates when a relationship link is clicked', () => {
    const onNavigate = vi.fn()
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Grow Newsletter'))
    expect(onNavigate).toHaveBeenCalledWith('responsibility/grow-newsletter')
  })

  it('shows "No relationships" when entry has no belongsTo/relatedTo', () => {
    const noRels = { ...mockEntry, belongsTo: [], relatedTo: [] }
    const contentNoRels = `---
title: Test Project
is_a: Project
Status: Active
---

# Test Project

This is a test note with some words to count.
`
    render(<Inspector {...defaultProps} entry={noRels} content={contentNoRels} />)
    expect(screen.getByText('No relationships')).toBeInTheDocument()
  })

  it('shows backlinks from notes that reference the current note', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry, referrerEntry]}
        allContent={allContent}
      />
    )
    expect(screen.getByText('Referrer Note')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // count badge
  })

  it('shows "No backlinks" when no notes reference the current note', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry]}
        allContent={{}}
      />
    )
    expect(screen.getByText('No backlinks')).toBeInTheDocument()
  })

  it('navigates when a backlink is clicked', () => {
    const onNavigate = vi.fn()
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry, referrerEntry]}
        allContent={allContent}
        onNavigate={onNavigate}
      />
    )
    fireEvent.click(screen.getByText('Referrer Note'))
    expect(onNavigate).toHaveBeenCalledWith('Referrer Note')
  })

  it('shows git history with commit hashes and messages', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        gitHistory={mockGitHistory}
      />
    )
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument()
    expect(screen.getByText('Update test with latest changes')).toBeInTheDocument()
    expect(screen.getByText('e4f5g6h')).toBeInTheDocument()
    expect(screen.getByText('i7j8k9l')).toBeInTheDocument()
  })

  it('renders commit hashes as clickable buttons', () => {
    const onViewCommitDiff = vi.fn()
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        gitHistory={mockGitHistory}
        onViewCommitDiff={onViewCommitDiff}
      />
    )
    const hashBtn = screen.getByText('a1b2c3d')
    expect(hashBtn.tagName).toBe('BUTTON')
    hashBtn.click()
    expect(onViewCommitDiff).toHaveBeenCalledWith('a1b2c3d4e5f6a7b8')
  })

  it('shows author name in commit rows', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        gitHistory={mockGitHistory}
      />
    )
    const authors = screen.getAllByText('Luca Rossi')
    expect(authors.length).toBeGreaterThan(0)
  })

  it('shows "No revision history" when no commits', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        gitHistory={[]}
      />
    )
    expect(screen.getByText('No revision history')).toBeInTheDocument()
  })

  it('shows separate Info section with read-only metadata', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
      />
    )
    expect(screen.getByText('Info')).toBeInTheDocument()
    expect(screen.getByText('Modified')).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
  })

  it('renders editable properties with interactive styling', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
      />
    )
    const editableRows = screen.getAllByTestId('editable-property')
    expect(editableRows.length).toBeGreaterThan(0)
    editableRows.forEach(row => {
      expect(row.className).toContain('hover:bg-muted')
    })
  })

  it('renders read-only properties with muted non-interactive styling', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
      />
    )
    const readOnlyRows = screen.getAllByTestId('readonly-property')
    expect(readOnlyRows.length).toBe(4) // Modified, Created, Words, Size
    readOnlyRows.forEach(row => {
      expect(row.className).not.toContain('hover:bg-muted')
      expect(row.className).not.toContain('cursor-pointer')
    })
  })
})
