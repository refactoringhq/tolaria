import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import type { VaultOption } from './StatusBar'

const vaults: VaultOption[] = [
  { label: 'Main Vault', path: '/Users/luca/Laputa' },
  { label: 'Work Vault', path: '/Users/luca/Work' },
]

describe('StatusBar', () => {
  it('displays note count', () => {
    render(<StatusBar noteCount={9200} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('9,200 notes')).toBeInTheDocument()
  })

  it('displays version and branch info', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('v0.4.2')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
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

  it('shows "Create new vault" option in vault menu', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onCreateNewVault={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Create new vault')).toBeInTheDocument()
  })

  it('calls onCreateNewVault when clicking "Create new vault"', () => {
    const onCreateNewVault = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onCreateNewVault={onCreateNewVault} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Create new vault'))
    expect(onCreateNewVault).toHaveBeenCalledOnce()
  })

  it('shows all three add-vault options together', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        onOpenLocalFolder={vi.fn()}
        onCreateNewVault={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Open local folder')).toBeInTheDocument()
    expect(screen.getByText('Create new vault')).toBeInTheDocument()
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
})
