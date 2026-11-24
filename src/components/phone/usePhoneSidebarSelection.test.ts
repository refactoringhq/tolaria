import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishPhoneNoteStack } from '../../hooks/phoneNoteStackStore'
import type { VaultEntry } from '../../types'
import { usePhoneSidebarSelection } from './usePhoneSidebarSelection'

const FAVORITE = { path: 'projects/phone.md' } as VaultEntry

function phoneControls() {
  return {
    active: true,
    pane: 'navigation' as const,
    backToList: vi.fn(),
    showNavigation: vi.fn(),
    showList: vi.fn(),
    showNote: vi.fn(),
  }
}

function renderSelection() {
  const handlers = { onSelect: vi.fn(), onSelectFavorite: vi.fn() }
  const { result } = renderHook(() => usePhoneSidebarSelection(handlers))
  return { handlers, result }
}

describe('usePhoneSidebarSelection', () => {
  afterEach(() => { publishPhoneNoteStack(null) })

  it('passes selections through unchanged off the phone layout', () => {
    const { handlers, result } = renderSelection()

    result.current.onSelect({ kind: 'folder', path: 'projects', rootPath: 'projects' })

    expect(handlers.onSelect).toHaveBeenCalledWith({ kind: 'folder', path: 'projects', rootPath: 'projects' })
  })

  it('shows the note list after a phone pick and lists the whole folder', () => {
    const controls = phoneControls()
    act(() => { publishPhoneNoteStack(controls) })
    const { handlers, result } = renderSelection()

    result.current.onSelect({ kind: 'folder', path: 'projects', rootPath: 'projects' })
    result.current.onSelect({ kind: 'sectionGroup', type: 'Project' })

    expect(handlers.onSelect).toHaveBeenNthCalledWith(1, { kind: 'folder', path: 'projects', rootPath: undefined })
    expect(handlers.onSelect).toHaveBeenNthCalledWith(2, { kind: 'sectionGroup', type: 'Project' })
    expect(controls.showList).toHaveBeenCalledTimes(2)
  })

  it('opens a favorite straight into the note pane on the phone', () => {
    const controls = phoneControls()
    act(() => { publishPhoneNoteStack(controls) })
    const { handlers, result } = renderSelection()

    result.current.onSelectFavorite?.(FAVORITE)

    expect(handlers.onSelectFavorite).toHaveBeenCalledWith(FAVORITE)
    expect(controls.showNote).toHaveBeenCalledOnce()
  })

  it('has no favorite handler when the sidebar has none', () => {
    const { result } = renderHook(() => usePhoneSidebarSelection({ onSelect: vi.fn() }))

    expect(result.current.onSelectFavorite).toBeUndefined()
  })
})
