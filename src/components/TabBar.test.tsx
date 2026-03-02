import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TabBar } from './TabBar'
import type { VaultEntry } from '../types'

function makeEntry(path: string, title: string): VaultEntry {
  return {
    path, filename: `${title}.md`, title, isA: 'Note',
    aliases: [], belongsTo: [], relatedTo: [],
    status: null, owner: null, cadence: null, archived: false,
    trashed: false, trashedAt: null,
    modifiedAt: null, createdAt: null, fileSize: 0,
    snippet: '', wordCount: 0, relationships: {}, icon: null, color: null, order: null, template: null, outgoingLinks: [],
  }
}

function makeTabs(titles: string[]) {
  return titles.map((t) => ({
    entry: makeEntry(`/vault/${t.toLowerCase()}.md`, t),
    content: `# ${t}`,
  }))
}

describe('TabBar', () => {
  const defaultProps = {
    onSwitchTab: vi.fn(),
    onCloseTab: vi.fn(),
    onCreateNote: vi.fn(),
    onReorderTabs: vi.fn(),
  }

  it('renders all tabs', () => {
    const tabs = makeTabs(['Alpha', 'Beta', 'Gamma'])
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} {...defaultProps} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('marks tabs as draggable', () => {
    const tabs = makeTabs(['Alpha', 'Beta'])
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} {...defaultProps} />)
    const alphaTab = screen.getByText('Alpha').closest('[draggable]')
    expect(alphaTab).toHaveAttribute('draggable', 'true')
  })

  it('calls onReorderTabs on drag and drop', () => {
    const onReorderTabs = vi.fn()
    const tabs = makeTabs(['Alpha', 'Beta', 'Gamma'])
    render(
      <TabBar
        tabs={tabs}
        activeTabPath={tabs[0].entry.path}
        {...defaultProps}
        onReorderTabs={onReorderTabs}
      />
    )

    const alphaTab = screen.getByText('Alpha').closest('[draggable]')!
    const gammaTab = screen.getByText('Gamma').closest('[draggable]')!

    // Simulate drag start on Alpha (index 0)
    fireEvent.dragStart(alphaTab, {
      dataTransfer: { effectAllowed: 'move', setData: vi.fn() },
    })

    // Simulate drag over Gamma (index 2) - cursor past midpoint
    const rect = gammaTab.getBoundingClientRect()
    fireEvent.dragOver(gammaTab, {
      clientX: rect.left + rect.width * 0.75,
      dataTransfer: { dropEffect: 'move' },
    })

    // Drop
    fireEvent.drop(gammaTab, {
      dataTransfer: {},
    })

    // Alpha (0) dragged past Gamma (2) → should reorder from 0 to 2
    expect(onReorderTabs).toHaveBeenCalledWith(0, 2)
  })

  it('does not call onReorderTabs when dropping in same position', () => {
    const onReorderTabs = vi.fn()
    const tabs = makeTabs(['Alpha', 'Beta'])
    render(
      <TabBar
        tabs={tabs}
        activeTabPath={tabs[0].entry.path}
        {...defaultProps}
        onReorderTabs={onReorderTabs}
      />
    )

    const alphaTab = screen.getByText('Alpha').closest('[draggable]')!

    fireEvent.dragStart(alphaTab, {
      dataTransfer: { effectAllowed: 'move', setData: vi.fn() },
    })

    // Drag over same tab
    const rect = alphaTab.getBoundingClientRect()
    fireEvent.dragOver(alphaTab, {
      clientX: rect.left + rect.width / 2,
      dataTransfer: { dropEffect: 'move' },
    })

    fireEvent.drop(alphaTab, { dataTransfer: {} })

    expect(onReorderTabs).not.toHaveBeenCalled()
  })

  it('shows modified indicator dot on modified tabs', () => {
    const tabs = makeTabs(['Alpha', 'Beta'])
    const getNoteStatus = (path: string) => path === tabs[0].entry.path ? 'modified' as const : 'clean' as const
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} getNoteStatus={getNoteStatus} {...defaultProps} />)
    const indicators = screen.getAllByTestId('tab-modified-indicator')
    expect(indicators).toHaveLength(1)
  })

  it('does not show modified indicator when no tabs are modified', () => {
    const tabs = makeTabs(['Alpha', 'Beta'])
    const getNoteStatus = () => 'clean' as const
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} getNoteStatus={getNoteStatus} {...defaultProps} />)
    expect(screen.queryByTestId('tab-modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-new-indicator')).not.toBeInTheDocument()
  })

  it('shows modified indicator on multiple tabs', () => {
    const tabs = makeTabs(['Alpha', 'Beta', 'Gamma'])
    const getNoteStatus = () => 'modified' as const
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} getNoteStatus={getNoteStatus} {...defaultProps} />)
    expect(screen.getAllByTestId('tab-modified-indicator')).toHaveLength(3)
  })

  it('shows green new indicator on new tabs', () => {
    const tabs = makeTabs(['Alpha', 'Beta'])
    const getNoteStatus = (path: string) => path === tabs[0].entry.path ? 'new' as const : 'clean' as const
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} getNoteStatus={getNoteStatus} {...defaultProps} />)
    expect(screen.getAllByTestId('tab-new-indicator')).toHaveLength(1)
    expect(screen.queryByTestId('tab-modified-indicator')).not.toBeInTheDocument()
  })

  it('does not reorder on drag cancel (dragEnd without drop)', () => {
    const onReorderTabs = vi.fn()
    const tabs = makeTabs(['Alpha', 'Beta', 'Gamma'])
    render(
      <TabBar
        tabs={tabs}
        activeTabPath={tabs[0].entry.path}
        {...defaultProps}
        onReorderTabs={onReorderTabs}
      />
    )

    const alphaTab = screen.getByText('Alpha').closest('[draggable]')!
    const betaTab = screen.getByText('Beta').closest('[draggable]')!

    fireEvent.dragStart(alphaTab, {
      dataTransfer: { effectAllowed: 'move', setData: vi.fn() },
    })

    const rect = betaTab.getBoundingClientRect()
    fireEvent.dragOver(betaTab, {
      clientX: rect.left + rect.width * 0.75,
      dataTransfer: { dropEffect: 'move' },
    })

    // Cancel via dragEnd (Escape or release outside tab bar)
    fireEvent.dragEnd(alphaTab)

    expect(onReorderTabs).not.toHaveBeenCalled()
  })

  it('reorders from last toward first position', () => {
    const onReorderTabs = vi.fn()
    const tabs = makeTabs(['Alpha', 'Beta', 'Gamma'])
    render(
      <TabBar
        tabs={tabs}
        activeTabPath={tabs[2].entry.path}
        {...defaultProps}
        onReorderTabs={onReorderTabs}
      />
    )

    const gammaTab = screen.getByText('Gamma').closest('[draggable]')!
    const alphaTab = screen.getByText('Alpha').closest('[draggable]')!

    fireEvent.dragStart(gammaTab, {
      dataTransfer: { effectAllowed: 'move', setData: vi.fn() },
    })

    // jsdom returns zero-sized rects, so clientX always hits "right half"
    // (insert after index 0 → insert index 1). This still validates
    // that dragging the last tab toward the front produces a reorder.
    const rect = alphaTab.getBoundingClientRect()
    fireEvent.dragOver(alphaTab, {
      clientX: rect.left + rect.width * 0.75,
      dataTransfer: { dropEffect: 'move' },
    })

    fireEvent.drop(alphaTab, { dataTransfer: {} })

    // Gamma (2) dragged onto Alpha (0) → reorder from 2 to 1
    expect(onReorderTabs).toHaveBeenCalledWith(2, 1)
  })

  it('shows pending save indicator (pulsing dot) when getNoteStatus returns pendingSave', () => {
    const tabs = makeTabs(['Alpha', 'Beta'])
    const getNoteStatus = (path: string) => path === tabs[0].entry.path ? 'pendingSave' as const : 'clean' as const
    render(<TabBar tabs={tabs} activeTabPath={tabs[0].entry.path} getNoteStatus={getNoteStatus} {...defaultProps} />)
    expect(screen.getAllByTestId('tab-pending-save-indicator')).toHaveLength(1)
    expect(screen.queryByTestId('tab-modified-indicator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-new-indicator')).not.toBeInTheDocument()
  })

  it('switches tab on click', () => {
    const onSwitchTab = vi.fn()
    const tabs = makeTabs(['Alpha', 'Beta'])
    render(
      <TabBar
        tabs={tabs}
        activeTabPath={tabs[0].entry.path}
        {...defaultProps}
        onSwitchTab={onSwitchTab}
      />
    )

    fireEvent.click(screen.getByText('Beta'))
    expect(onSwitchTab).toHaveBeenCalledWith(tabs[1].entry.path)
  })
})
