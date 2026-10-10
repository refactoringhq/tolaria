import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommitMessageTemplateSettings } from './CommitMessageTemplateSettings'
import { createTranslator } from '../lib/i18n'
import type { CommitMessageTemplate } from '../types'

const t = createTranslator('en')

const EXISTING_TEMPLATE: CommitMessageTemplate = {
  id: 'tpl-1',
  name: 'Daily sync',
  titleTemplate: 'docs: update',
  bodyTemplate: 'Daily body',
}

function renderSettings(templates: CommitMessageTemplate[] = []) {
  const onTemplatesChange = vi.fn()
  render(
    <CommitMessageTemplateSettings
      templates={templates}
      onTemplatesChange={onTemplatesChange}
      t={t}
    />,
  )
  return { onTemplatesChange }
}

function openEditor() {
  fireEvent.click(screen.getByTestId('commit-template-add'))
}

function fillEditor({ name, title, body }: { name: string; title: string; body: string }) {
  fireEvent.change(screen.getByLabelText('Template name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Commit title template'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('Commit body template'), { target: { value: body } })
}

describe('CommitMessageTemplateSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the management section heading and description', () => {
    renderSettings()
    expect(screen.getByText('Push message templates')).toBeInTheDocument()
    expect(screen.getByText(/Create reusable templates/)).toBeInTheDocument()
  })

  it('shows an empty state when no templates exist', () => {
    renderSettings([])
    expect(screen.getByTestId('commit-templates-empty')).toBeInTheDocument()
  })

  it('lists existing templates with edit and delete actions', () => {
    renderSettings([EXISTING_TEMPLATE])
    expect(screen.getByText('Daily sync')).toBeInTheDocument()
    expect(screen.getByText('docs: update')).toBeInTheDocument()
    expect(screen.getByTestId('commit-template-edit-tpl-1')).toBeInTheDocument()
    expect(screen.getByTestId('commit-template-delete-tpl-1')).toBeInTheDocument()
  })

  it('creates a template through the editor dialog', () => {
    const { onTemplatesChange } = renderSettings([])
    openEditor()
    fillEditor({ name: 'Weekly', title: 'chore: weekly {date}', body: 'Body {branch}' })
    fireEvent.click(screen.getByTestId('commit-template-editor-save'))

    expect(onTemplatesChange).toHaveBeenCalledTimes(1)
    const created = onTemplatesChange.mock.calls[0][0]
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      name: 'Weekly',
      titleTemplate: 'chore: weekly {date}',
      bodyTemplate: 'Body {branch}',
    })
    expect(created[0].id).not.toBe('')
    expect(screen.queryByTestId('commit-template-editor')).not.toBeInTheDocument()
  })

  it('shows validation errors for blank name and title template', () => {
    const { onTemplatesChange } = renderSettings([])
    openEditor()
    fillEditor({ name: '   ', title: '', body: '' })
    fireEvent.click(screen.getByTestId('commit-template-editor-save'))

    expect(screen.getByText('Enter a template name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a commit title template.')).toBeInTheDocument()
    expect(onTemplatesChange).not.toHaveBeenCalled()
  })

  it('explains supported variables in the editor', () => {
    renderSettings([])
    openEditor()
    expect(screen.getByText(/You can use \{date\}, \{branch\} and \{vault\}/)).toBeInTheDocument()
  })

  it('edits an existing template', () => {
    const { onTemplatesChange } = renderSettings([EXISTING_TEMPLATE])
    fireEvent.click(screen.getByTestId('commit-template-edit-tpl-1'))

    expect(screen.getByLabelText('Template name')).toHaveValue('Daily sync')
    fillEditor({ name: 'Daily sync v2', title: 'docs: update v2', body: 'Body v2' })
    fireEvent.click(screen.getByTestId('commit-template-editor-save'))

    expect(onTemplatesChange).toHaveBeenCalledTimes(1)
    expect(onTemplatesChange.mock.calls[0][0]).toEqual([
      { id: 'tpl-1', name: 'Daily sync v2', titleTemplate: 'docs: update v2', bodyTemplate: 'Body v2' },
    ])
  })

  it('deletes a template after confirmation', () => {
    const { onTemplatesChange } = renderSettings([EXISTING_TEMPLATE])
    fireEvent.click(screen.getByTestId('commit-template-delete-tpl-1'))

    expect(screen.getByText(/Delete the "Daily sync" template/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    expect(onTemplatesChange).toHaveBeenCalledTimes(1)
    expect(onTemplatesChange.mock.calls[0][0]).toEqual([])
  })

  it('cancels deletion without changes', () => {
    const { onTemplatesChange } = renderSettings([EXISTING_TEMPLATE])
    fireEvent.click(screen.getByTestId('commit-template-delete-tpl-1'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onTemplatesChange).not.toHaveBeenCalled()
  })
})
