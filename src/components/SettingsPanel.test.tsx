import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'
import type { Settings } from '../types'

const emptySettings: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: null,
  github_username: null,
}

const populatedSettings: Settings = {
  anthropic_key: 'sk-ant-api03-test123',
  openai_key: 'sk-openai-test456',
  google_key: null,
  github_token: null,
  github_username: null,
}

describe('SettingsPanel', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <SettingsPanel open={false} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when open', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('AI Provider Keys')).toBeInTheDocument()
    expect(screen.getByText(/stored locally/)).toBeInTheDocument()
  })

  it('shows three key fields with labels', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Google AI')).toBeInTheDocument()
  })

  it('populates fields from settings', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    const openaiInput = screen.getByTestId('settings-key-openai') as HTMLInputElement
    const googleInput = screen.getByTestId('settings-key-google-ai') as HTMLInputElement

    expect(anthropicInput.value).toBe('sk-ant-api03-test123')
    expect(openaiInput.value).toBe('sk-openai-test456')
    expect(googleInput.value).toBe('')
  })

  it('calls onSave with trimmed keys on save', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: '  sk-ant-test  ' } })

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: 'sk-ant-test',
      openai_key: null,
      google_key: null,
      github_token: null,
      github_username: null,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('converts empty/whitespace keys to null', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    // Clear the anthropic key field
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: '   ' } })

    fireEvent.click(screen.getByTestId('settings-save'))

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: null,
      openai_key: 'sk-openai-test456',
      google_key: null,
      github_token: null,
      github_username: null,
    })
  })

  it('calls onClose when Cancel is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTitle('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves on Cmd+Enter', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    const anthropicInput = screen.getByTestId('settings-key-anthropic')
    fireEvent.change(anthropicInput, { target: { value: 'sk-ant-test' } })
    fireEvent.keyDown(screen.getByTestId('settings-panel'), { key: 'Enter', metaKey: true })

    expect(onSave).toHaveBeenCalledWith({
      anthropic_key: 'sk-ant-test',
      openai_key: null,
      google_key: null,
      github_token: null,
      github_username: null,
    })
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    fireEvent.click(screen.getByTestId('settings-panel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('clears a key field when X button is clicked', () => {
    render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const clearBtn = screen.getByTestId('clear-anthropic')
    fireEvent.click(clearBtn)

    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(anthropicInput.value).toBe('')
  })

  it('shows keyboard shortcut hint in footer', () => {
    render(
      <SettingsPanel open={true} settings={emptySettings} onSave={onSave} onClose={onClose} />
    )
    expect(screen.getByText(/to open settings/)).toBeInTheDocument()
  })

  it('resets fields when reopened with different settings', () => {
    const { rerender } = render(
      <SettingsPanel open={true} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    // Verify initial state
    const anthropicInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(anthropicInput.value).toBe('sk-ant-api03-test123')

    // Close and reopen with different settings
    rerender(
      <SettingsPanel open={false} settings={populatedSettings} onSave={onSave} onClose={onClose} />
    )
    const newSettings: Settings = { ...emptySettings, anthropic_key: 'new-key' }
    rerender(
      <SettingsPanel open={true} settings={newSettings} onSave={onSave} onClose={onClose} />
    )
    const updatedInput = screen.getByTestId('settings-key-anthropic') as HTMLInputElement
    expect(updatedInput.value).toBe('new-key')
  })
})
