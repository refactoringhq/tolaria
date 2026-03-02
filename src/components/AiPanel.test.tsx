import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiPanel } from './AiPanel'
import type { VaultEntry } from '../types'

// Mock the hooks and utils to isolate component tests
vi.mock('../hooks/useAiAgent', () => ({
  useAiAgent: () => ({
    messages: [],
    status: 'idle',
    sendMessage: vi.fn(),
    clearConversation: vi.fn(),
  }),
}))

vi.mock('../utils/ai-chat', () => ({
  nextMessageId: () => `msg-${Date.now()}`,
}))

const makeEntry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  path: '/vault/note/test.md',
  filename: 'test.md',
  title: 'Test Note',
  isA: 'Note',
  aliases: [],
  belongsTo: [],
  relatedTo: [],
  status: null,
  owner: null,
  cadence: null,
  archived: false,
  trashed: false,
  trashedAt: null,
  modifiedAt: 1700000000,
  createdAt: 1700000000,
  fileSize: 100,
  snippet: '',
  wordCount: 0,
  relationships: {},
  icon: null,
  color: null,
  order: null,
  outgoingLinks: [],
  ...overrides,
})

describe('AiPanel', () => {
  it('renders panel with AI Chat header', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('AI Chat')).toBeTruthy()
  })

  it('renders data-testid ai-panel', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByTestId('ai-panel')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AiPanel onClose={onClose} vaultPath="/tmp/vault" />)
    const panel = screen.getByTestId('ai-panel')
    const buttons = panel.querySelectorAll('button')
    const closeBtn = Array.from(buttons).find(b => b.title?.includes('Close'))
    expect(closeBtn).toBeTruthy()
    fireEvent.click(closeBtn!)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders empty state without context', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.getByText('Open a note, then ask the AI about it')).toBeTruthy()
  })

  it('renders contextual empty state when active entry is provided', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} allContent={{}} />
    )
    expect(screen.getByText('Ask about this note and its linked context')).toBeTruthy()
  })

  it('shows context bar with active entry title', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} allContent={{}} />
    )
    expect(screen.getByTestId('context-bar')).toBeTruthy()
    expect(screen.getByText('My Note')).toBeTruthy()
  })

  it('shows linked count in context bar when entry has outgoing links', () => {
    const linked = makeEntry({ path: '/vault/linked.md', title: 'Linked Note' })
    const entry = makeEntry({ title: 'My Note', outgoingLinks: ['Linked Note'] })
    render(
      <AiPanel
        onClose={vi.fn()} vaultPath="/tmp/vault"
        activeEntry={entry} entries={[entry, linked]}
        allContent={{}}
      />
    )
    expect(screen.getByText('+ 1 linked')).toBeTruthy()
  })

  it('does not show context bar when no active entry', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    expect(screen.queryByTestId('context-bar')).toBeNull()
  })

  it('renders input field enabled', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).disabled).toBe(false)
  })

  it('has send button disabled when input is empty', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const sendBtn = screen.getByTestId('agent-send')
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows contextual placeholder when active entry exists', () => {
    const entry = makeEntry({ title: 'My Note' })
    render(
      <AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" activeEntry={entry} entries={[entry]} allContent={{}} />
    )
    const input = screen.getByTestId('agent-input') as HTMLInputElement
    expect(input.placeholder).toBe('Ask about this note...')
  })

  it('shows generic placeholder when no active entry', () => {
    render(<AiPanel onClose={vi.fn()} vaultPath="/tmp/vault" />)
    const input = screen.getByTestId('agent-input') as HTMLInputElement
    expect(input.placeholder).toBe('Ask the AI agent...')
  })
})
