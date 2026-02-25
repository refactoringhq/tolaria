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
  outgoingLinks: [],
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
  outgoingLinks: ['Test Project'],
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

  it('computes word count from content minus frontmatter and title', () => {
    render(<Inspector {...defaultProps} entry={mockEntry} content={mockContent} />)
    // Title "# Test Project" excluded; body: "This is a test note with some words to count." = 10 words
    expect(screen.getByText('10')).toBeInTheDocument()
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

  it('shows backlinks from notes that reference the current note via outgoingLinks', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry, referrerEntry]}
      />
    )
    expect(screen.getByText('Referrer Note')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument() // count badge
  })

  it('updates backlinks reactively when outgoingLinks changes', () => {
    const { rerender } = render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry, { ...referrerEntry, outgoingLinks: [] }]}
      />
    )
    // Initially no backlinks because referrer has empty outgoingLinks
    expect(screen.getByText('No backlinks')).toBeInTheDocument()

    // Rerender with updated outgoingLinks (simulates adding [[Test Project]] to referrer)
    rerender(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry, { ...referrerEntry, outgoingLinks: ['Test Project'] }]}
      />
    )
    expect(screen.getByText('Referrer Note')).toBeInTheDocument()
  })

  it('shows "No backlinks" when no notes reference the current note', () => {
    render(
      <Inspector
        {...defaultProps}
        entry={mockEntry}
        content={mockContent}
        entries={[mockEntry]}
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

  describe('Referenced By (bidirectional relationships)', () => {
    const targetEntry: VaultEntry = {
      path: '/Users/luca/Laputa/responsibility/grow-newsletter.md',
      filename: 'grow-newsletter.md',
      title: 'Grow Newsletter',
      isA: 'Responsibility',
      aliases: [],
      belongsTo: [],
      relatedTo: [],
      status: 'Active',
      owner: null,
      cadence: null,
      archived: false,
      trashed: false,
      trashedAt: null,
      modifiedAt: 1707900000,
      createdAt: null,
      fileSize: 500,
      snippet: '',
      relationships: { 'Type': ['[[type/responsibility]]'] },
      icon: null,
      color: null,
      order: null,
      outgoingLinks: [],
    }

    const essayEntry: VaultEntry = {
      path: '/Users/luca/Laputa/essay/on-writing.md',
      filename: 'on-writing.md',
      title: 'On Writing Well',
      isA: 'Essay',
      aliases: [],
      belongsTo: ['[[responsibility/grow-newsletter]]'],
      relatedTo: [],
      status: null,
      owner: null,
      cadence: null,
      archived: false,
      trashed: false,
      trashedAt: null,
      modifiedAt: 1707900000,
      createdAt: null,
      fileSize: 300,
      snippet: '',
      relationships: { 'Belongs to': ['[[responsibility/grow-newsletter]]'], 'Type': ['[[type/essay]]'] },
      icon: null,
      color: null,
      order: null,
      outgoingLinks: [],
    }

    const procedureEntry: VaultEntry = {
      path: '/Users/luca/Laputa/procedure/write-essays.md',
      filename: 'write-essays.md',
      title: 'Write Weekly Essays',
      isA: 'Procedure',
      aliases: [],
      belongsTo: ['[[responsibility/grow-newsletter]]'],
      relatedTo: [],
      status: null,
      owner: null,
      cadence: null,
      archived: false,
      trashed: false,
      trashedAt: null,
      modifiedAt: 1707900000,
      createdAt: null,
      fileSize: 400,
      snippet: '',
      relationships: { 'Belongs to': ['[[responsibility/grow-newsletter]]'], 'Type': ['[[type/procedure]]'] },
      icon: null,
      color: null,
      order: null,
      outgoingLinks: [],
    }

    const experimentEntry: VaultEntry = {
      path: '/Users/luca/Laputa/experiment/seo.md',
      filename: 'seo.md',
      title: 'SEO Experiment',
      isA: 'Experiment',
      aliases: [],
      belongsTo: [],
      relatedTo: ['[[responsibility/grow-newsletter]]'],
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
      relationships: { 'Related to': ['[[responsibility/grow-newsletter]]'], 'Type': ['[[type/experiment]]'] },
      icon: null,
      color: null,
      order: null,
      outgoingLinks: [],
    }

    const targetContent = `---
title: Grow Newsletter
is_a: Responsibility
Status: Active
---

# Grow Newsletter
`

    it('shows entries that reference the current note via frontmatter relationships', () => {
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry, essayEntry, procedureEntry, experimentEntry]}

        />
      )
      expect(screen.getByText('On Writing Well')).toBeInTheDocument()
      expect(screen.getByText('Write Weekly Essays')).toBeInTheDocument()
      expect(screen.getByText('SEO Experiment')).toBeInTheDocument()
    })

    it('groups referenced-by entries by relationship key', () => {
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry, essayEntry, experimentEntry]}

        />
      )
      expect(screen.getByText(/via Belongs to/)).toBeInTheDocument()
      expect(screen.getByText(/via Related to/)).toBeInTheDocument()
    })

    it('shows count badge for referenced-by entries', () => {
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry, essayEntry, procedureEntry]}

        />
      )
      // 2 entries reference via Belongs to — badge appears in the Referenced by header
      const allTwos = screen.getAllByText('2')
      expect(allTwos.length).toBeGreaterThanOrEqual(1)
      // At least one "2" is inside a badge (span with ml-1 class)
      expect(allTwos.some(el => el.classList.contains('ml-1'))).toBe(true)
    })

    it('shows "No references" when no entries reference the current note', () => {
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry]}

        />
      )
      expect(screen.getByText('No references')).toBeInTheDocument()
    })

    it('navigates when clicking a referenced-by entry', () => {
      const onNavigate = vi.fn()
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry, essayEntry]}

          onNavigate={onNavigate}
        />
      )
      fireEvent.click(screen.getByText('On Writing Well'))
      expect(onNavigate).toHaveBeenCalledWith('On Writing Well')
    })

    it('skips Type relationships in referenced-by computation', () => {
      const typeEntry: VaultEntry = {
        ...targetEntry,
        path: '/Users/luca/Laputa/type/responsibility.md',
        filename: 'responsibility.md',
        title: 'Responsibility',
        isA: 'Type',
        relationships: {},
      }
      // essayEntry has Type: [[type/responsibility]] — should NOT show as referenced-by
      render(
        <Inspector
          {...defaultProps}
          entry={typeEntry}
          content="---\nIs A: Type\n---\n# Responsibility\n"
          entries={[typeEntry, essayEntry]}

        />
      )
      // On Writing Well references responsibility via "Belongs to" (path match), not via "Type"
      // But the Type entry is at type/responsibility.md, so wikilinks to
      // responsibility/grow-newsletter won't match. Should show "No references"
      expect(screen.getByText('No references')).toBeInTheDocument()
    })

    it('resolves references via aliased wikilinks', () => {
      const aliasedTarget: VaultEntry = {
        ...targetEntry,
        aliases: ['Newsletter'],
      }
      const referrer: VaultEntry = {
        ...essayEntry,
        relationships: { 'Topics': ['[[Newsletter]]'], 'Type': ['[[type/essay]]'] },
      }
      render(
        <Inspector
          {...defaultProps}
          entry={aliasedTarget}
          content={targetContent}
          entries={[aliasedTarget, referrer]}

        />
      )
      expect(screen.getByText('On Writing Well')).toBeInTheDocument()
      expect(screen.getByText(/via Topics/)).toBeInTheDocument()
    })

    it('excludes entries from backlinks when already shown in referenced-by', () => {
      const noteA: VaultEntry = {
        path: '/Users/luca/Laputa/essay/on-writing.md',
        filename: 'on-writing.md',
        title: 'On Writing Well',
        isA: 'Essay',
        aliases: [],
        belongsTo: ['[[responsibility/grow-newsletter]]'],
        relatedTo: [],
        status: null,
        owner: null,
        cadence: null,
        archived: false,
        trashed: false,
        trashedAt: null,
        modifiedAt: 1707900000,
        createdAt: null,
        fileSize: 300,
        snippet: '',
        relationships: { 'Belongs to': ['[[responsibility/grow-newsletter]]'], 'Type': ['[[type/essay]]'] },
        icon: null,
        color: null,
        order: null,
        // Body text also links to grow-newsletter
        outgoingLinks: ['responsibility/grow-newsletter'],
      }
      render(
        <Inspector
          {...defaultProps}
          entry={targetEntry}
          content={targetContent}
          entries={[targetEntry, noteA]}
        />
      )
      // noteA shows in Referenced By (via Belongs to)
      expect(screen.getByText(/via Belongs to/)).toBeInTheDocument()
      expect(screen.getByText('On Writing Well')).toBeInTheDocument()
      // But NOT in Backlinks (even though outgoingLinks matches)
      expect(screen.getByText('No backlinks')).toBeInTheDocument()
    })

    it('does not show self-references', () => {
      const selfRef: VaultEntry = {
        ...targetEntry,
        relationships: {
          ...targetEntry.relationships,
          'Notes': ['[[responsibility/grow-newsletter]]'],
        },
      }
      render(
        <Inspector
          {...defaultProps}
          entry={selfRef}
          content={targetContent}
          entries={[selfRef]}

        />
      )
      expect(screen.getByText('No references')).toBeInTheDocument()
    })
  })
})
