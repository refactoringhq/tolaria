import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CommitDialog } from './CommitDialog'
import { formatShortcutDisplay } from '../hooks/appCommandCatalog'
import type { CommitMessageTemplate } from '../types'

const CUSTOM_TEMPLATE: CommitMessageTemplate = {
  id: 'tpl-daily',
  name: 'Daily sync',
  titleTemplate: 'docs({vault}): update {date}',
  bodyTemplate: 'Synced {vault} from {branch}.',
}

function installPointerCapturePolyfill() {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {}
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => {}
  }
}

installPointerCapturePolyfill()

describe('CommitDialog', () => {
  const onCommit = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function getActionButton(name = 'Commit & Push') {
    return screen.getByRole('button', { name })
  }

  function getTitleInput() {
    return screen.getByPlaceholderText('Commit title…')
  }

  function getBodyInput() {
    return screen.getByPlaceholderText('Add more detail… (optional)')
  }

  function openTemplatePicker() {
    fireEvent.pointerDown(screen.getByTestId('commit-template-picker'), { button: 0, pointerType: 'mouse' })
  }

  function selectTemplate(name: string) {
    openTemplatePicker()
    fireEvent.click(screen.getByRole('option', { name }))
  }

  it('shows file count badge', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(screen.getByText('3 files changed')).toBeInTheDocument()
  })

  it('shows singular file count', () => {
    render(<CommitDialog open={true} modifiedCount={1} onCommit={onCommit} onClose={onClose} />)
    expect(screen.getByText('1 file changed')).toBeInTheDocument()
  })

  it('disables Commit button when title is empty', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(getActionButton()).toBeDisabled()
  })

  it('enables Commit button when title is typed', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: 'fix: bug fix' } })
    expect(getActionButton()).not.toBeDisabled()
  })

  it('calls onCommit with trimmed title on button click', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: '  fix: bug fix  ' } })
    fireEvent.click(getActionButton())
    expect(onCommit).toHaveBeenCalledWith('fix: bug fix')
  })

  it('joins title and body with a blank line on submit', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: 'fix: bug fix' } })
    fireEvent.change(getBodyInput(), { target: { value: '  More detail here.  ' } })
    fireEvent.click(getActionButton())
    expect(onCommit).toHaveBeenCalledWith('fix: bug fix\n\nMore detail here.')
  })

  it('calls onCommit on Cmd+Enter from the body field', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: 'fix: test' } })
    fireEvent.keyDown(getBodyInput(), { key: 'Enter', metaKey: true })
    expect(onCommit).toHaveBeenCalledWith('fix: test')
  })

  it('calls onClose on Escape', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.keyDown(getTitleInput(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Cancel button click', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onCommit when title is whitespace only', () => {
    render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: '   ' } })
    fireEvent.change(getBodyInput(), { target: { value: 'body without title' } })
    fireEvent.keyDown(getBodyInput(), { key: 'Enter', metaKey: true })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('renders nothing when not open', () => {
    const { container } = render(<CommitDialog open={false} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
  })

  it('pre-populates title with a single-line suggestedMessage', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha, beta" onCommit={onCommit} onClose={onClose} />)
    expect(getTitleInput()).toHaveValue('Update alpha, beta')
    expect(getBodyInput()).toHaveValue('')
  })

  it('splits a multi-line suggestedMessage into title and body', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage={'Update alpha\n\nDetails here'} onCommit={onCommit} onClose={onClose} />)
    expect(getTitleInput()).toHaveValue('Update alpha')
    expect(getBodyInput()).toHaveValue('Details here')
  })

  it('enables Commit button when suggestedMessage is provided', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    expect(getActionButton()).not.toBeDisabled()
  })

  it('submits suggestedMessage on Cmd+Enter without user edits', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    fireEvent.keyDown(getTitleInput(), { key: 'Enter', metaKey: true })
    expect(onCommit).toHaveBeenCalledWith('Update alpha')
  })

  it('allows user to edit the suggested title and body', () => {
    render(<CommitDialog open={true} modifiedCount={3} suggestedMessage="Update alpha" onCommit={onCommit} onClose={onClose} />)
    fireEvent.change(getTitleInput(), { target: { value: 'fix: corrected typo in alpha' } })
    fireEvent.change(getBodyInput(), { target: { value: 'extra context' } })
    fireEvent.click(getActionButton())
    expect(onCommit).toHaveBeenCalledWith('fix: corrected typo in alpha\n\nextra context')
  })

  it('generates a message into the title field and focuses it', async () => {
    const onGenerateMessage = vi.fn().mockResolvedValue('Update generated draft')
    render(
      <CommitDialog
        open={true}
        modifiedCount={3}
        onGenerateMessage={onGenerateMessage}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Generate commit message from diff' }))

    await waitFor(() => expect(getTitleInput()).toHaveValue('Update generated draft'))
    await waitFor(() => expect(getTitleInput()).toHaveFocus())
    fireEvent.change(getTitleInput(), { target: { value: 'Update edited draft' } })
    fireEvent.click(getActionButton())

    expect(onGenerateMessage).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('Update edited draft')
  })

  it('splits a multi-line generated message into title and body', async () => {
    const onGenerateMessage = vi.fn().mockResolvedValue('Generated title\n\nGenerated body')
    render(
      <CommitDialog
        open={true}
        modifiedCount={3}
        onGenerateMessage={onGenerateMessage}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Generate commit message from diff' }))

    await waitFor(() => expect(getTitleInput()).toHaveValue('Generated title'))
    expect(getBodyInput()).toHaveValue('Generated body')
  })

  it('applies a generated message from command-palette state updates', async () => {
    const { rerender } = render(
      <CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />,
    )

    rerender(
      <CommitDialog
        open={true}
        modifiedCount={3}
        generatedMessage="Update from command palette"
        generatedMessageKey={1}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    await waitFor(() => expect(getTitleInput()).toHaveValue('Update from command palette'))
    await waitFor(() => expect(getTitleInput()).toHaveFocus())
  })

  it('disables generation while a message is being drafted', () => {
    render(
      <CommitDialog
        open={true}
        modifiedCount={3}
        isGeneratingMessage={true}
        onGenerateMessage={vi.fn()}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('button', { name: 'Generate commit message from diff' })).toBeDisabled()
    expect(screen.getByText('Generating…')).toBeInTheDocument()
  })

  it('switches to local-only copy when commitMode is local', () => {
    const submitShortcut = formatShortcutDisplay({ display: '⌘↵' })
    render(<CommitDialog open={true} modifiedCount={2} commitMode="local" onCommit={onCommit} onClose={onClose} />)

    expect(screen.getByRole('heading', { name: 'Commit' })).toBeInTheDocument()
    expect(screen.getByText('This vault has no git remote configured. Tolaria will create a local commit only.')).toBeInTheDocument()
    expect(screen.getByText(`${submitShortcut} to commit locally`)).toBeInTheDocument()
    expect(getActionButton('Commit')).toBeDisabled()
  })

  it('shows a repository selector when multiple repositories are available', () => {
    render(
      <CommitDialog
        open={true}
        modifiedCount={2}
        repositories={[
          { path: '/default', label: 'Default', defaultForNewNotes: true },
          { path: '/work', label: 'Work', defaultForNewNotes: false },
        ]}
        selectedRepositoryPath="/work"
        onRepositoryChange={vi.fn()}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    expect(screen.getByTestId('commit-repository-select')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('shows the commit author and warns when repository config overrides global identity', () => {
    render(
      <CommitDialog
        open={true}
        modifiedCount={2}
        authorIdentity={{
          name: 'Unexpected User',
          email: 'unexpected@example.com',
          source: 'repository',
          warning: 'local_overrides_global',
        }}
        onCommit={onCommit}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('Commit author')).toBeInTheDocument()
    expect(screen.getByText('Unexpected User <unexpected@example.com>')).toBeInTheDocument()
    expect(screen.getByText("Repository Git author differs from your global Git author. Cancel and update this vault's git config before committing if it looks wrong.")).toBeInTheDocument()
  })

  describe('template picker', () => {
    it('always offers the built-in default template', () => {
      render(<CommitDialog open={true} modifiedCount={3} onCommit={onCommit} onClose={onClose} />)
      openTemplatePicker()
      expect(screen.getByRole('option', { name: 'Default' })).toBeInTheDocument()
    })

    it('lists custom templates ahead of the default template', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          templates={[CUSTOM_TEMPLATE]}
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      openTemplatePicker()
      const options = screen.getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual(['Daily sync', 'Default'])
    })

    it('fills title and body with rendered variables on selection', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          templates={[CUSTOM_TEMPLATE]}
          branch="main"
          vaultName="notes"
          dateDisplayFormat="iso"
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      selectTemplate('Daily sync')
      expect(getTitleInput()).toHaveValue(`docs(notes): update ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`)
      expect(getBodyInput()).toHaveValue('Synced notes from main.')
    })

    it('keeps unknown variables as-is when applying a template', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          templates={[{ ...CUSTOM_TEMPLATE, titleTemplate: 'fix {issue} on {branch}' }]}
          branch="main"
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      selectTemplate('Daily sync')
      expect(getTitleInput()).toHaveValue('fix {issue} on main')
    })

    it('lets the user keep editing after applying a template', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          templates={[CUSTOM_TEMPLATE]}
          branch="main"
          vaultName="notes"
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      selectTemplate('Daily sync')
      fireEvent.change(getTitleInput(), { target: { value: 'docs(notes): manual title' } })
      fireEvent.click(getActionButton())
      expect(onCommit).toHaveBeenCalledWith('docs(notes): manual title\n\nSynced notes from main.')
    })

    it('applies the default template when selected', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          branch="dev"
          vaultName="notes"
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      selectTemplate('Default')
      expect(getTitleInput().value).toContain('notes')
      expect(getTitleInput().value).not.toContain('{vault}')
      expect(getBodyInput().value).toContain('dev')
    })

    it('does not pre-fill from templates when the dialog opens', () => {
      render(
        <CommitDialog
          open={true}
          modifiedCount={3}
          templates={[CUSTOM_TEMPLATE]}
          suggestedMessage="Update alpha"
          onCommit={onCommit}
          onClose={onClose}
        />,
      )
      expect(getTitleInput()).toHaveValue('Update alpha')
      expect(getBodyInput()).toHaveValue('')
    })
  })
})
