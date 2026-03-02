import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import type { VaultOption } from './StatusBar'

vi.mock('../utils/url', async () => {
  const actual = await vi.importActual('../utils/url')
  return { ...actual, openExternalUrl: vi.fn().mockResolvedValue(undefined) }
})

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & { openExternalUrl: ReturnType<typeof vi.fn> }

const vaults: VaultOption[] = [
  { label: 'Main Vault', path: '/Users/luca/Laputa' },
  { label: 'Work Vault', path: '/Users/luca/Work' },
]

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays note count', () => {
    render(<StatusBar noteCount={9200} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('9,200 notes')).toBeInTheDocument()
  })

  it('displays build number when provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} buildNumber="b223" />)
    expect(screen.getByText('b223')).toBeInTheDocument()
  })

  it('displays fallback build number when not provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('b?')).toBeInTheDocument()
  })

  it('does not display branch name', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByText('main')).not.toBeInTheDocument()
  })

  it('shows clickable commit hash that opens URL via openExternalUrl', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        lastCommitInfo={{ shortHash: 'a3f9b1c', commitUrl: 'https://github.com/owner/repo/commit/abc123' }}
      />
    )
    const link = screen.getByTestId('status-commit-link')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('SPAN')
    expect(screen.getByText('a3f9b1c')).toBeInTheDocument()

    fireEvent.click(link)
    expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/owner/repo/commit/abc123')
  })

  it('shows non-clickable commit hash when no commitUrl', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        lastCommitInfo={{ shortHash: 'b4e2d8f', commitUrl: null }}
      />
    )
    const span = screen.getByTestId('status-commit-hash')
    expect(span).toBeInTheDocument()
    expect(span.tagName).toBe('SPAN')
    expect(screen.getByText('b4e2d8f')).toBeInTheDocument()
  })

  it('hides commit hash when lastCommitInfo is null', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} lastCommitInfo={null} />
    )
    expect(screen.queryByTestId('status-commit-link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-commit-hash')).not.toBeInTheDocument()
  })

  it('displays active vault name', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('Main Vault')).toBeInTheDocument()
  })

  it('shows fallback "Vault" when vault path does not match', () => {
    render(<StatusBar noteCount={100} vaultPath="/unknown/path" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('Vault')).toBeInTheDocument()
  })

  it('opens vault menu on click and shows all vault options', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)

    // Click the vault button to open menu
    fireEvent.click(screen.getByTitle('Switch vault'))

    expect(screen.getByText('Work Vault')).toBeInTheDocument()
  })

  it('calls onSwitchVault when selecting a different vault', () => {
    const onSwitchVault = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={onSwitchVault} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    // Click "Work Vault"
    fireEvent.click(screen.getByText('Work Vault'))

    expect(onSwitchVault).toHaveBeenCalledWith('/Users/luca/Work')
  })

  it('closes vault menu when clicking outside', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Work Vault')).toBeInTheDocument()

    // Click outside the menu
    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('Work Vault')).not.toBeInTheDocument()
  })

  it('toggles vault menu open and closed', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)

    const vaultButton = screen.getByTitle('Switch vault')
    fireEvent.click(vaultButton)
    expect(screen.getByText('Work Vault')).toBeInTheDocument()

    // Click again to close
    fireEvent.click(vaultButton)
    expect(screen.queryByText('Work Vault')).not.toBeInTheDocument()
  })

  it('shows "Open local folder" option in vault menu', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Open local folder')).toBeInTheDocument()
  })

  it('calls onOpenLocalFolder when clicking "Open local folder"', () => {
    const onOpenLocalFolder = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={onOpenLocalFolder} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Open local folder'))
    expect(onOpenLocalFolder).toHaveBeenCalledOnce()
  })

  it('shows add-vault options in vault menu', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        onOpenLocalFolder={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Open local folder')).toBeInTheDocument()
    expect(screen.getByText('Connect GitHub repo')).toBeInTheDocument()
  })

  it('shows modified count when modifiedCount is > 0', () => {
    render(<StatusBar noteCount={100} modifiedCount={3} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByTestId('status-modified-count')).toBeInTheDocument()
    expect(screen.getByText('3 pending')).toBeInTheDocument()
  })

  it('does not show modified count when modifiedCount is 0', () => {
    render(<StatusBar noteCount={100} modifiedCount={0} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-modified-count')).not.toBeInTheDocument()
  })

  it('does not show modified count when modifiedCount is not provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-modified-count')).not.toBeInTheDocument()
  })

  it('closes menu after clicking "Open local folder"', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Open local folder'))
    // Menu should close after clicking an action
    expect(screen.queryByText('Open local folder')).not.toBeInTheDocument()
  })

  it('calls onClickPending when clicking the pending count', () => {
    const onClickPending = vi.fn()
    render(
      <StatusBar noteCount={100} modifiedCount={5} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onClickPending={onClickPending} />
    )
    fireEvent.click(screen.getByTestId('status-modified-count'))
    expect(onClickPending).toHaveBeenCalledOnce()
  })

  it('pending count has title for accessibility', () => {
    render(
      <StatusBar noteCount={100} modifiedCount={3} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onClickPending={vi.fn()} />
    )
    expect(screen.getByTitle('View pending changes')).toBeInTheDocument()
  })
})
