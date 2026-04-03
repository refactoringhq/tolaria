import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TitleField } from './TitleField'

describe('TitleField', () => {
  it('renders the title in the input', () => {
    render(<TitleField title="My Note" filename="my-note.md" onTitleChange={() => {}} />)
    expect(screen.getByTestId('title-field-input')).toHaveValue('My Note')
  })

  it('calls onTitleChange on blur with new value', () => {
    const onChange = vi.fn()
    render(<TitleField title="Old Title" filename="old-title.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('New Title')
  })

  it('does not call onTitleChange if title unchanged', () => {
    const onChange = vi.fn()
    render(<TitleField title="Same Title" filename="same-title.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reverts to original title if input is emptied', () => {
    const onChange = vi.fn()
    render(<TitleField title="Keep This" filename="keep-this.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue('Keep This')
  })

  it('shows filename indicator when slug differs and title is focused', () => {
    render(<TitleField title="My Note" filename="wrong-name.md" onTitleChange={() => {}} />)
    // Not shown when unfocused
    expect(screen.queryByTestId('title-field-filename')).not.toBeInTheDocument()
    // Shown when focused
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.getByTestId('title-field-filename')).toHaveTextContent('my-note.md')
  })

  it('does not show filename when slug matches and not editing', () => {
    render(<TitleField title="My Note" filename="my-note.md" onTitleChange={() => {}} />)
    expect(screen.queryByTestId('title-field-filename')).not.toBeInTheDocument()
  })

  it('disables input when editable is false', () => {
    render(<TitleField title="Read Only" filename="read-only.md" editable={false} onTitleChange={() => {}} />)
    expect(screen.getByTestId('title-field-input')).toBeDisabled()
  })

  it('commits title on Enter key', () => {
    const onChange = vi.fn()
    render(<TitleField title="Before" filename="before.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'After' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // In jsdom, blur() after keyDown needs explicit blur event
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('After')
  })

  it('reverts on Escape key', () => {
    const onChange = vi.fn()
    render(<TitleField title="Original" filename="original.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    // Escape reverts value and blurs
    expect(input).toHaveValue('Original')
  })

  it('shows new title optimistically after commit (before prop updates)', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TitleField title="Old Title" filename="old-title.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.blur(input)
    // After commit, should show new title even though prop is still "Old Title"
    expect(input).toHaveValue('New Title')
    // After prop updates to match, should still show new title
    rerender(<TitleField title="New Title" filename="new-title.md" onTitleChange={onChange} />)
    expect(input).toHaveValue('New Title')
  })

  it('resets optimistic title when prop changes from external source', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TitleField title="Title A" filename="title-a.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    // Simulate external title change (e.g., tab switch)
    rerender(<TitleField title="Title B" filename="title-b.md" onTitleChange={onChange} />)
    expect(input).toHaveValue('Title B')
  })

  it('responds to laputa:focus-editor event with selectTitle', () => {
    render(<TitleField title="Focus Me" filename="focus-me.md" onTitleChange={() => {}} />)
    const input = screen.getByTestId('title-field-input')
    window.dispatchEvent(new CustomEvent('laputa:focus-editor', { detail: { selectTitle: true } }))
    expect(document.activeElement).toBe(input)
  })

  it('resets stale localValue when title prop changes after focus', () => {
    // Regression: creating a new note fires focus-editor before React re-renders,
    // so handleFocus captures the OLD note's title into localValue.
    // When React re-renders with the new title, localValue should be cleared.
    const onChange = vi.fn()
    const { rerender } = render(<TitleField title="Old Note" filename="old-note.md" onTitleChange={onChange} />)
    const input = screen.getByTestId('title-field-input')
    // Simulate: focus fires while title prop is still "Old Note"
    fireEvent.focus(input)
    expect(input).toHaveValue('Old Note')
    // React re-renders with new note's title (tab switched)
    rerender(<TitleField title="Untitled note" filename="untitled-note.md" onTitleChange={onChange} />)
    expect(input).toHaveValue('Untitled note')
  })

  it('shows vault-relative path (without .md) only when title is focused', () => {
    render(<TitleField title="ADR" filename="0001-tauri-stack.md" notePath="/Users/luca/Laputa/docs/adr/0001-tauri-stack.md" vaultPath="/Users/luca/Laputa" onTitleChange={() => {}} />)
    // Path hidden by default
    expect(screen.queryByTestId('title-field-path')).not.toBeInTheDocument()
    // Focus title → path appears
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.getByTestId('title-field-path')).toHaveTextContent('docs/adr/0001-tauri-stack')
    // No bare filename shown when path is visible
    expect(screen.queryByTestId('title-field-filename')).not.toBeInTheDocument()
  })

  it('hides path on blur', () => {
    render(<TitleField title="ADR" filename="0001-tauri-stack.md" notePath="/Users/luca/Laputa/docs/adr/0001-tauri-stack.md" vaultPath="/Users/luca/Laputa" onTitleChange={() => {}} />)
    const input = screen.getByTestId('title-field-input')
    fireEvent.focus(input)
    expect(screen.getByTestId('title-field-path')).toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.queryByTestId('title-field-path')).not.toBeInTheDocument()
  })

  it('hides path for notes at vault root even when focused', () => {
    render(<TitleField title="Root Note" filename="root-note.md" notePath="/Users/luca/Laputa/root-note.md" vaultPath="/Users/luca/Laputa" onTitleChange={() => {}} />)
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.queryByTestId('title-field-path')).not.toBeInTheDocument()
  })

  it('hides path when vaultPath is not provided', () => {
    render(<TitleField title="Note" filename="note.md" onTitleChange={() => {}} />)
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.queryByTestId('title-field-path')).not.toBeInTheDocument()
  })

  it('resolves vault-relative path when paths differ by symlink prefix', () => {
    // vaultPath uses symlink /Users/luca/... but notePath is canonical /Volumes/Jupiter/...
    render(<TitleField title="ADR" filename="0001-tauri-stack.md" notePath="/Volumes/Jupiter/Workspace/laputa-app/demo-vault-v2/docs/adr/0001-tauri-stack.md" vaultPath="/Users/luca/Workspace/laputa-app/demo-vault-v2" onTitleChange={() => {}} />)
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.getByTestId('title-field-path')).toHaveTextContent('docs/adr/0001-tauri-stack')
  })

  it('handles vaultPath with trailing slash', () => {
    render(<TitleField title="ADR" filename="0001-tauri-stack.md" notePath="/Users/luca/Laputa/docs/adr/0001-tauri-stack.md" vaultPath="/Users/luca/Laputa/" onTitleChange={() => {}} />)
    fireEvent.focus(screen.getByTestId('title-field-input'))
    expect(screen.getByTestId('title-field-path')).toHaveTextContent('docs/adr/0001-tauri-stack')
  })
})
