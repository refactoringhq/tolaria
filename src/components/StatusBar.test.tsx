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

  it('shows "Add vault..." option when onAddVault is provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onAddVault={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Add vault...')).toBeInTheDocument()
  })

  it('calls onAddVault when "Add vault..." is clicked', () => {
    const onAddVault = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onAddVault={onAddVault} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Add vault...'))

    expect(onAddVault).toHaveBeenCalledOnce()
  })

  it('shows remove buttons when onRemoveVault is provided and multiple vaults exist', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onRemoveVault={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    const removeButtons = screen.getAllByTitle(/Remove .+ from list/)
    expect(removeButtons.length).toBe(2)
  })

  it('does not show remove buttons with single vault', () => {
    const singleVault = [{ label: 'Only', path: '/only' }]
    render(<StatusBar noteCount={100} vaultPath="/only" vaults={singleVault} onSwitchVault={vi.fn()} onRemoveVault={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.queryByTitle(/Remove .+ from list/)).not.toBeInTheDocument()
  })

  it('calls onRemoveVault with correct path when remove button is clicked', () => {
    const onRemoveVault = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onRemoveVault={onRemoveVault} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    const removeWork = screen.getByTitle('Remove Work Vault from list')
    fireEvent.click(removeWork)

    expect(onRemoveVault).toHaveBeenCalledWith('/Users/luca/Work')
  })

  it('does not show "Add vault..." when onAddVault is not provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.queryByText('Add vault...')).not.toBeInTheDocument()
  })
})
