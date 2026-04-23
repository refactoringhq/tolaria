import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CreateTypeDialog } from './CreateTypeDialog'

describe('CreateTypeDialog', () => {
  it('renders dialog when open', () => {
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={() => {}} />)
    expect(screen.getByText('Create New Type')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...')).toBeInTheDocument()
  })

  it('does not render dialog when closed', () => {
    render(<CreateTypeDialog open={false} onClose={() => {}} onCreate={() => {}} />)
    expect(screen.queryByText('Create New Type')).not.toBeInTheDocument()
  })

  it('disables Create button when name is empty', () => {
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={() => {}} />)
    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).toBeDisabled()
  })

  it('enables Create button when name is entered', () => {
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...'), { target: { value: 'Recipe' } })
    const createButton = screen.getByRole('button', { name: 'Create' })
    expect(createButton).not.toBeDisabled()
  })

  it('calls onCreate with trimmed name on submit', () => {
    const onCreate = vi.fn()
    const onClose = vi.fn()
    render(<CreateTypeDialog open={true} onClose={onClose} onCreate={onCreate} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...'), { target: { value: '  Recipe  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onCreate).toHaveBeenCalledWith('Recipe')
  })

  it('closes after create completes', async () => {
    const onClose = vi.fn()
    render(<CreateTypeDialog open={true} onClose={onClose} onCreate={() => Promise.resolve()} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...'), { target: { value: 'Recipe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays open when create reports a handled collision', async () => {
    const onClose = vi.fn()
    const onCreate = vi.fn().mockResolvedValue(false)
    render(<CreateTypeDialog open={true} onClose={onClose} onCreate={onCreate} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...'), { target: { value: 'Recipe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Recipe'))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Create New Type')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<CreateTypeDialog open={true} onClose={onClose} onCreate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('submits on Enter key', () => {
    const onCreate = vi.fn()
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={onCreate} />)
    const input = screen.getByPlaceholderText('e.g. Recipe, Book, Habit...')
    fireEvent.change(input, { target: { value: 'Book' } })
    fireEvent.submit(input.closest('form')!)
    expect(onCreate).toHaveBeenCalledWith('Book')
  })

  it('does not submit when name is whitespace only', () => {
    const onCreate = vi.fn()
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={onCreate} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByPlaceholderText('e.g. Recipe, Book, Habit...').closest('form')!)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('prefills the name when initialName is provided', () => {
    render(<CreateTypeDialog open={true} onClose={() => {}} onCreate={() => {}} initialName="Hotel" />)

    expect(screen.getByDisplayValue('Hotel')).toBeInTheDocument()
  })
})
