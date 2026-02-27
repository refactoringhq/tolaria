import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDiffMode } from './useDiffMode'

describe('useDiffMode', () => {
  let onLoadDiff: ReturnType<typeof vi.fn>
  let onLoadDiffAtCommit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onLoadDiff = vi.fn()
    onLoadDiffAtCommit = vi.fn()
  })

  function renderDiffHook(activeTabPath: string | null = '/note.md') {
    return renderHook(
      ({ path }) => useDiffMode({ activeTabPath: path, onLoadDiff, onLoadDiffAtCommit }),
      { initialProps: { path: activeTabPath } },
    )
  }

  it('starts with diff mode off', () => {
    const { result } = renderDiffHook()
    expect(result.current.diffMode).toBe(false)
    expect(result.current.diffContent).toBeNull()
    expect(result.current.diffLoading).toBe(false)
  })

  it('toggles diff mode on and loads content', async () => {
    onLoadDiff.mockResolvedValue('diff content here')
    const { result } = renderDiffHook()

    await act(async () => { await result.current.handleToggleDiff() })

    expect(onLoadDiff).toHaveBeenCalledWith('/note.md')
    expect(result.current.diffMode).toBe(true)
    expect(result.current.diffContent).toBe('diff content here')
    expect(result.current.diffLoading).toBe(false)
  })

  it('toggles diff mode off when already on', async () => {
    onLoadDiff.mockResolvedValue('diff')
    const { result } = renderDiffHook()

    await act(async () => { await result.current.handleToggleDiff() })
    expect(result.current.diffMode).toBe(true)

    await act(async () => { await result.current.handleToggleDiff() })
    expect(result.current.diffMode).toBe(false)
    expect(result.current.diffContent).toBeNull()
  })

  it('does nothing when activeTabPath is null', async () => {
    const { result } = renderDiffHook(null)

    await act(async () => { await result.current.handleToggleDiff() })

    expect(onLoadDiff).not.toHaveBeenCalled()
    expect(result.current.diffMode).toBe(false)
  })

  it('does nothing when onLoadDiff is not provided', async () => {
    const { result } = renderHook(() => useDiffMode({ activeTabPath: '/note.md' }))

    await act(async () => { await result.current.handleToggleDiff() })
    expect(result.current.diffMode).toBe(false)
  })

  it('resets diff state when activeTabPath changes', async () => {
    onLoadDiff.mockResolvedValue('diff')
    const { result, rerender } = renderDiffHook('/note-a.md')

    await act(async () => { await result.current.handleToggleDiff() })
    expect(result.current.diffMode).toBe(true)

    rerender({ path: '/note-b.md' })
    expect(result.current.diffMode).toBe(false)
    expect(result.current.diffContent).toBeNull()
  })

  it('handles load error gracefully', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onLoadDiff.mockRejectedValue(new Error('network'))
    const { result } = renderDiffHook()

    await act(async () => { await result.current.handleToggleDiff() })

    expect(result.current.diffMode).toBe(false)
    expect(result.current.diffLoading).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('loads diff at specific commit', async () => {
    onLoadDiffAtCommit.mockResolvedValue('commit diff')
    const { result } = renderDiffHook()

    await act(async () => { await result.current.handleViewCommitDiff('abc123') })

    expect(onLoadDiffAtCommit).toHaveBeenCalledWith('/note.md', 'abc123')
    expect(result.current.diffMode).toBe(true)
    expect(result.current.diffContent).toBe('commit diff')
  })

  it('skips commit diff when no callback', async () => {
    const { result } = renderHook(() => useDiffMode({ activeTabPath: '/note.md' }))

    await act(async () => { await result.current.handleViewCommitDiff('abc123') })
    expect(result.current.diffMode).toBe(false)
  })

  it('handles commit diff error gracefully', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onLoadDiffAtCommit.mockRejectedValue(new Error('fail'))
    const { result } = renderDiffHook()

    await act(async () => { await result.current.handleViewCommitDiff('abc123') })

    expect(result.current.diffMode).toBe(false)
    expect(result.current.diffLoading).toBe(false)
    warn.mockRestore()
  })
})
