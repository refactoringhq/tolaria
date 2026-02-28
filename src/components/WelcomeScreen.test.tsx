import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'

const defaultProps = {
  mode: 'welcome' as const,
  defaultVaultPath: '~/Documents/Laputa',
  onCreateVault: vi.fn(),
  onOpenFolder: vi.fn(),
  creating: false,
  error: null,
}

describe('WelcomeScreen', () => {
  describe('welcome mode', () => {
    it('renders welcome title and subtitle', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText('Welcome to Laputa')).toBeInTheDocument()
      expect(screen.getByText(/Wiki-linked knowledge management/)).toBeInTheDocument()
    })

    it('shows create vault and open folder buttons', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent('Create Getting Started vault')
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Open an existing folder')
    })

    it('shows default vault path hint', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText(/will be created in/)).toBeInTheDocument()
      expect(screen.getByText(/~\/Documents\/Laputa/)).toBeInTheDocument()
    })

    it('calls onCreateVault when create button is clicked', () => {
      const onCreateVault = vi.fn()
      render(<WelcomeScreen {...defaultProps} onCreateVault={onCreateVault} />)
      fireEvent.click(screen.getByTestId('welcome-create-vault'))
      expect(onCreateVault).toHaveBeenCalledOnce()
    })

    it('calls onOpenFolder when open folder button is clicked', () => {
      const onOpenFolder = vi.fn()
      render(<WelcomeScreen {...defaultProps} onOpenFolder={onOpenFolder} />)
      fireEvent.click(screen.getByTestId('welcome-open-folder'))
      expect(onOpenFolder).toHaveBeenCalledOnce()
    })

    it('disables buttons while creating', () => {
      render(<WelcomeScreen {...defaultProps} creating={true} />)
      expect(screen.getByTestId('welcome-create-vault')).toBeDisabled()
      expect(screen.getByTestId('welcome-open-folder')).toBeDisabled()
    })

    it('shows loading text while creating', () => {
      render(<WelcomeScreen {...defaultProps} creating={true} />)
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent('Creating vault…')
    })

    it('shows error message when error is set', () => {
      render(<WelcomeScreen {...defaultProps} error="Permission denied" />)
      expect(screen.getByTestId('welcome-error')).toHaveTextContent('Permission denied')
    })

    it('does not show error when error is null', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.queryByTestId('welcome-error')).not.toBeInTheDocument()
    })

    it('does not show path badge in welcome mode', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.queryByText('~/Laputa')).not.toBeInTheDocument()
    })
  })

  describe('vault-missing mode', () => {
    const missingProps = {
      ...defaultProps,
      mode: 'vault-missing' as const,
      missingPath: '~/Laputa',
    }

    it('renders vault not found title', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByText('Vault not found')).toBeInTheDocument()
      expect(screen.getByText(/could not be found on disk/)).toBeInTheDocument()
    })

    it('shows the missing vault path in a badge', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByText('~/Laputa')).toBeInTheDocument()
    })

    it('shows "Choose a different folder" instead of "Open an existing folder"', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Choose a different folder')
    })

    it('does not show vault path hint in vault-missing mode', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.queryByText(/will be created in/)).not.toBeInTheDocument()
    })
  })

  describe('data-testid', () => {
    it('has welcome-screen container testid', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    })
  })
})
