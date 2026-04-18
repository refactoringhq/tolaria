import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'

const dragRegionMouseDown = vi.fn()

vi.mock('../hooks/useDragRegion', () => ({
  useDragRegion: () => ({ onMouseDown: dragRegionMouseDown }),
}))

const defaultProps = {
  mode: 'welcome' as const,
  defaultVaultPath: '~/Documents/Laputa',
  onCreateVault: vi.fn(),
  onRetryCreateVault: vi.fn(),
  onCreateNewVault: vi.fn(),
  onOpenFolder: vi.fn(),
  isOffline: false,
  creatingAction: null as 'template' | 'empty' | null,
  error: null,
  canRetryTemplate: false,
}

describe('WelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('welcome mode', () => {
    it('renders welcome title and subtitle', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText('Welcome to Tolaria')).toBeInTheDocument()
      expect(screen.getByText(/Wiki-linked knowledge management/)).toBeInTheDocument()
    })

    it('shows all three option buttons', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-create-new')).toHaveTextContent('Create a new vault')
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Open existing vault')
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent('Get started with a template')
    })

    it('focuses the first action for keyboard users', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-create-new')).toHaveFocus()
    })

    it('shows default vault path in template option description', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByText(/~\/Documents\/Laputa/)).toBeInTheDocument()
    })

    it('shows offline guidance and disables the template option when offline', () => {
      render(<WelcomeScreen {...defaultProps} isOffline={true} />)
      expect(screen.getByTestId('welcome-create-vault')).toBeDisabled()
      expect(screen.getByText(/Requires internet — clone later/)).toBeInTheDocument()
    })

    it('calls onCreateNewVault when create new button is clicked', () => {
      const onCreateNewVault = vi.fn()
      render(<WelcomeScreen {...defaultProps} onCreateNewVault={onCreateNewVault} />)
      fireEvent.click(screen.getByTestId('welcome-create-new'))
      expect(onCreateNewVault).toHaveBeenCalledOnce()
    })

    it('calls onCreateVault when template button is clicked', () => {
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

    it('disables all buttons while creating', () => {
      render(<WelcomeScreen {...defaultProps} creatingAction="template" />)
      expect(screen.getByTestId('welcome-create-new')).toBeDisabled()
      expect(screen.getByTestId('welcome-open-folder')).toBeDisabled()
      expect(screen.getByTestId('welcome-create-vault')).toBeDisabled()
    })

    it('shows loading text on template button while creating', () => {
      render(<WelcomeScreen {...defaultProps} creatingAction="template" />)
      expect(screen.getByTestId('welcome-create-vault')).toHaveTextContent(/Downloading template/)
      expect(screen.getByTestId('welcome-status')).toHaveAttribute('aria-live', 'polite')
    })

    it('shows loading text on create-new button while creating an empty vault', () => {
      render(<WelcomeScreen {...defaultProps} creatingAction="empty" />)
      expect(screen.getByTestId('welcome-create-new')).toHaveTextContent(/Creating vault/)
    })

    it('shows error message when error is set', () => {
      render(<WelcomeScreen {...defaultProps} error="Permission denied" />)
      expect(screen.getByTestId('welcome-error')).toHaveTextContent('Permission denied')
      expect(screen.getByTestId('welcome-error')).toHaveAttribute('aria-live', 'assertive')
    })

    it('does not show error when error is null', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.queryByTestId('welcome-error')).not.toBeInTheDocument()
    })

    it('shows a retry button after template download errors', () => {
      const onRetryCreateVault = vi.fn()
      render(
        <WelcomeScreen
          {...defaultProps}
          error="Could not download Getting Started vault. Check your connection and try again."
          canRetryTemplate={true}
          onRetryCreateVault={onRetryCreateVault}
        />,
      )

      fireEvent.click(screen.getByTestId('welcome-retry-template'))
      expect(onRetryCreateVault).toHaveBeenCalledOnce()
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

    it('does not show the missing vault path in a badge', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.queryByText('~/Laputa')).not.toBeInTheDocument()
    })

    it('shows "Choose a different folder" instead of "Open existing vault"', () => {
      render(<WelcomeScreen {...missingProps} />)
      expect(screen.getByTestId('welcome-open-folder')).toHaveTextContent('Choose a different folder')
    })
  })

  describe('data-testid', () => {
    it('has welcome-screen container testid', () => {
      render(<WelcomeScreen {...defaultProps} />)
      expect(screen.getByTestId('welcome-screen')).toBeInTheDocument()
    })

    it('uses the surrounding surface as a drag region and excludes the card', () => {
      render(<WelcomeScreen {...defaultProps} />)

      const screenContainer = screen.getByTestId('welcome-screen')
      fireEvent.mouseDown(screenContainer)

      expect(dragRegionMouseDown).toHaveBeenCalledOnce()
      expect(screenContainer.querySelector('[data-no-drag]')).not.toBeNull()
    })
  })
})
