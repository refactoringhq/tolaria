import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import type { VaultOption } from './StatusBar'
vi.mock('../utils/url', async () => {
  const actual = await vi.importActual('../utils/url')
  return { ...actual, openExternalUrl: vi.fn().mockResolvedValue(undefined) }
})

const { openExternalUrl } = await import('../utils/url') as typeof import('../utils/url') & { openExternalUrl: ReturnType<typeof vi.fn> }

const vaults: VaultOption[] = [
  { label: 'Main Vault', path: '/Users/luca/Laputa' },
  { label: 'Work Vault', path: '/Users/luca/Work' },
]

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays note count', () => {
    render(<StatusBar noteCount={9200} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('9,200 notes')).toBeInTheDocument()
  })

  it('displays build number when provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} buildNumber="b223" />)
    expect(screen.getByText('b223')).toBeInTheDocument()
  })

  it('displays fallback build number when not provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByText('b?')).toBeInTheDocument()
  })

  it('calls onCheckForUpdates when clicking build number', () => {
    const onCheckForUpdates = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} buildNumber="b281" onCheckForUpdates={onCheckForUpdates} />)
    fireEvent.click(screen.getByTestId('status-build-number'))
    expect(onCheckForUpdates).toHaveBeenCalledOnce()
  })

  it('build number has "Check for updates" title', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} buildNumber="b281" onCheckForUpdates={vi.fn()} />)
    expect(screen.getByTitle('Check for updates')).toBeInTheDocument()
  })

  it('does not display branch name', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByText('main')).not.toBeInTheDocument()
  })

  it('shows Feedback button when callback is provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenFeedback={vi.fn()} />)
    expect(screen.getByTestId('status-feedback')).toBeInTheDocument()
    expect(screen.getByText('Feedback')).toBeInTheDocument()
  })

  it('calls onOpenFeedback when Feedback is clicked', () => {
    const onOpenFeedback = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenFeedback={onOpenFeedback} />)
    fireEvent.click(screen.getByTestId('status-feedback'))
    expect(onOpenFeedback).toHaveBeenCalledOnce()
  })

  it('shows clickable commit hash that opens URL via openExternalUrl', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        lastCommitInfo={{ shortHash: 'a3f9b1c', commitUrl: 'https://github.com/owner/repo/commit/abc123' }}
      />
    )
    const link = screen.getByTestId('status-commit-link')
    expect(link).toBeInTheDocument()
    expect(link.tagName).toBe('SPAN')
    expect(screen.getByText('a3f9b1c')).toBeInTheDocument()

    fireEvent.click(link)
    expect(openExternalUrl).toHaveBeenCalledWith('https://github.com/owner/repo/commit/abc123')
  })

  it('shows non-clickable commit hash when no commitUrl', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        lastCommitInfo={{ shortHash: 'b4e2d8f', commitUrl: null }}
      />
    )
    const span = screen.getByTestId('status-commit-hash')
    expect(span).toBeInTheDocument()
    expect(span.tagName).toBe('SPAN')
    expect(screen.getByText('b4e2d8f')).toBeInTheDocument()
  })

  it('hides commit hash when lastCommitInfo is null', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} lastCommitInfo={null} />
    )
    expect(screen.queryByTestId('status-commit-link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-commit-hash')).not.toBeInTheDocument()
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

  it('shows "Open local folder" option in vault menu', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Open local folder')).toBeInTheDocument()
  })

  it('calls onOpenLocalFolder when clicking "Open local folder"', () => {
    const onOpenLocalFolder = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={onOpenLocalFolder} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Open local folder'))
    expect(onOpenLocalFolder).toHaveBeenCalledOnce()
  })

  it('shows add-vault options in vault menu', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        onOpenLocalFolder={vi.fn()}
        onConnectGitHub={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    expect(screen.getByText('Open local folder')).toBeInTheDocument()
    expect(screen.getByText('Connect GitHub repo')).toBeInTheDocument()
  })

  it('shows Changes badge with count when modifiedCount is > 0', () => {
    render(<StatusBar noteCount={100} modifiedCount={3} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.getByTestId('status-modified-count')).toBeInTheDocument()
    expect(screen.getByText('Changes')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not show Changes badge when modifiedCount is 0', () => {
    render(<StatusBar noteCount={100} modifiedCount={0} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-modified-count')).not.toBeInTheDocument()
  })

  it('does not show Changes badge when modifiedCount is not provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-modified-count')).not.toBeInTheDocument()
  })

  it('closes menu after clicking "Open local folder"', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onOpenLocalFolder={vi.fn()} />
    )
    fireEvent.click(screen.getByTitle('Switch vault'))
    fireEvent.click(screen.getByText('Open local folder'))
    // Menu should close after clicking an action
    expect(screen.queryByText('Open local folder')).not.toBeInTheDocument()
  })

  it('calls onClickPending when clicking the pending count', () => {
    const onClickPending = vi.fn()
    render(
      <StatusBar noteCount={100} modifiedCount={5} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onClickPending={onClickPending} />
    )
    fireEvent.click(screen.getByTestId('status-modified-count'))
    expect(onClickPending).toHaveBeenCalledOnce()
  })

  it('pending count has title for accessibility', () => {
    render(
      <StatusBar noteCount={100} modifiedCount={3} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onClickPending={vi.fn()} />
    )
    expect(screen.getByTitle('View pending changes')).toBeInTheDocument()
  })

  it('shows MCP warning badge when status is not_installed', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="not_installed" />
    )
    expect(screen.getByTestId('status-mcp')).toBeInTheDocument()
    expect(screen.getByTitle('MCP server not installed — click to install')).toBeInTheDocument()
  })

  it('shows MCP warning badge when status is no_claude_cli', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="no_claude_cli" />
    )
    expect(screen.getByTestId('status-mcp')).toBeInTheDocument()
    expect(screen.getByTitle('Claude CLI not found — install it first')).toBeInTheDocument()
  })

  it('hides MCP badge when status is installed', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="installed" />
    )
    expect(screen.queryByTestId('status-mcp')).not.toBeInTheDocument()
  })

  it('hides MCP badge when status is checking', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="checking" />
    )
    expect(screen.queryByTestId('status-mcp')).not.toBeInTheDocument()
  })

  it('hides MCP badge when no mcpStatus prop provided', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />
    )
    expect(screen.queryByTestId('status-mcp')).not.toBeInTheDocument()
  })

  it('calls onInstallMcp when clicking MCP badge with not_installed status', () => {
    const onInstallMcp = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="not_installed" onInstallMcp={onInstallMcp} />
    )
    fireEvent.click(screen.getByTestId('status-mcp'))
    expect(onInstallMcp).toHaveBeenCalledOnce()
  })

  it('does not call onInstallMcp when clicking MCP badge with no_claude_cli status', () => {
    const onInstallMcp = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} mcpStatus="no_claude_cli" onInstallMcp={onInstallMcp} />
    )
    fireEvent.click(screen.getByTestId('status-mcp'))
    expect(onInstallMcp).not.toHaveBeenCalled()
  })

  it('shows Pull required label when syncStatus is pull_required', () => {
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} syncStatus="pull_required" />
    )
    expect(screen.getByText('Pull required')).toBeInTheDocument()
  })

  it('calls onPullAndPush when clicking Pull required badge', () => {
    const onPullAndPush = vi.fn()
    render(
      <StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} syncStatus="pull_required" onPullAndPush={onPullAndPush} />
    )
    fireEvent.click(screen.getByTestId('status-sync'))
    expect(onPullAndPush).toHaveBeenCalledOnce()
  })

  it('shows git status popup when clicking idle sync badge', () => {
    render(
      <StatusBar
        noteCount={100}
        vaultPath="/Users/luca/Laputa"
        vaults={vaults}
        onSwitchVault={vi.fn()}
        syncStatus="idle"
        remoteStatus={{ branch: 'main', ahead: 2, behind: 1, hasRemote: true }}
      />
    )
    fireEvent.click(screen.getByTestId('status-sync'))
    expect(screen.getByTestId('git-status-popup')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText(/2 ahead/)).toBeInTheDocument()
    expect(screen.getByText(/1 behind/)).toBeInTheDocument()
  })

  it('shows Pulse badge in status bar', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} isGitVault />)
    expect(screen.getByTestId('status-pulse')).toBeInTheDocument()
    expect(screen.getByText('Pulse')).toBeInTheDocument()
  })

  it('calls onClickPulse when clicking Pulse badge', () => {
    const onClickPulse = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} isGitVault onClickPulse={onClickPulse} />)
    fireEvent.click(screen.getByTestId('status-pulse'))
    expect(onClickPulse).toHaveBeenCalledOnce()
  })

  it('disables Pulse badge when isGitVault is false', () => {
    const onClickPulse = vi.fn()
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} isGitVault={false} onClickPulse={onClickPulse} />)
    fireEvent.click(screen.getByTestId('status-pulse'))
    expect(onClickPulse).not.toHaveBeenCalled()
  })

  it('shows Commit button in status bar', () => {
    const onCommitPush = vi.fn()
    render(<StatusBar noteCount={100} modifiedCount={5} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onCommitPush={onCommitPush} />)
    expect(screen.getByTestId('status-commit-push')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('status-commit-push'))
    expect(onCommitPush).toHaveBeenCalledOnce()
  })

  it('shows Commit button even when no modified files', () => {
    render(<StatusBar noteCount={100} modifiedCount={0} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} onCommitPush={vi.fn()} />)
    expect(screen.getByTestId('status-commit-push')).toBeInTheDocument()
  })

  it('hides Commit button when no onCommitPush callback', () => {
    render(<StatusBar noteCount={100} modifiedCount={5} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-commit-push')).not.toBeInTheDocument()
  })

  it('shows Claude Code badge when installed', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} claudeCodeStatus="installed" claudeCodeVersion="1.0.20" />)
    const badge = screen.getByTestId('status-claude-code')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Claude Code')).toBeInTheDocument()
    expect(badge.getAttribute('title')).toBe('Claude Code 1.0.20')
  })

  it('shows Claude Code missing badge with warning when missing', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} claudeCodeStatus="missing" />)
    const badge = screen.getByTestId('status-claude-code')
    expect(badge).toBeInTheDocument()
    expect(screen.getByText('Claude Code missing')).toBeInTheDocument()
    expect(badge.getAttribute('title')).toBe('Claude Code not found — click to install')
  })

  it('opens install URL when clicking missing Claude Code badge', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} claudeCodeStatus="missing" />)
    fireEvent.click(screen.getByTestId('status-claude-code'))
    expect(openExternalUrl).toHaveBeenCalledWith('https://docs.anthropic.com/en/docs/claude-code')
  })

  it('opens install URL on Enter key for missing Claude Code badge', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} claudeCodeStatus="missing" />)
    fireEvent.keyDown(screen.getByTestId('status-claude-code'), { key: 'Enter' })
    expect(openExternalUrl).toHaveBeenCalledWith('https://docs.anthropic.com/en/docs/claude-code')
  })

  it('hides Claude Code badge when status is checking', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} claudeCodeStatus="checking" />)
    expect(screen.queryByTestId('status-claude-code')).not.toBeInTheDocument()
  })

  it('hides Claude Code badge when no claudeCodeStatus prop provided', () => {
    render(<StatusBar noteCount={100} vaultPath="/Users/luca/Laputa" vaults={vaults} onSwitchVault={vi.fn()} />)
    expect(screen.queryByTestId('status-claude-code')).not.toBeInTheDocument()
  })

})
