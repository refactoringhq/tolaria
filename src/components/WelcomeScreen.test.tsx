import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'

describe('WelcomeScreen', () => {
  it('renders welcome message', () => {
    render(<WelcomeScreen onOpenFolder={vi.fn()} onCreateVault={vi.fn()} error={null} />)
    expect(screen.getByText('Welcome to Laputa')).toBeInTheDocument()
    expect(screen.getByText(/Open a folder of markdown files/)).toBeInTheDocument()
  })

  it('renders both action buttons', () => {
    render(<WelcomeScreen onOpenFolder={vi.fn()} onCreateVault={vi.fn()} error={null} />)
    expect(screen.getByText('Open Existing Folder')).toBeInTheDocument()
    expect(screen.getByText('Create New Vault')).toBeInTheDocument()
  })

  it('calls onOpenFolder when "Open Existing Folder" is clicked', () => {
    const onOpenFolder = vi.fn()
    render(<WelcomeScreen onOpenFolder={onOpenFolder} onCreateVault={vi.fn()} error={null} />)
    fireEvent.click(screen.getByText('Open Existing Folder'))
    expect(onOpenFolder).toHaveBeenCalledOnce()
  })

  it('calls onCreateVault when "Create New Vault" is clicked', () => {
    const onCreateVault = vi.fn()
    render(<WelcomeScreen onOpenFolder={vi.fn()} onCreateVault={onCreateVault} error={null} />)
    fireEvent.click(screen.getByText('Create New Vault'))
    expect(onCreateVault).toHaveBeenCalledOnce()
  })

  it('displays error message when error prop is set', () => {
    render(<WelcomeScreen onOpenFolder={vi.fn()} onCreateVault={vi.fn()} error="Folder does not exist" />)
    expect(screen.getByText('Folder does not exist')).toBeInTheDocument()
  })

  it('does not display error when error is null', () => {
    render(<WelcomeScreen onOpenFolder={vi.fn()} onCreateVault={vi.fn()} error={null} />)
    expect(screen.queryByText('Folder does not exist')).not.toBeInTheDocument()
  })
})
