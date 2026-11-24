import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STORAGE_KEYS } from '../constants/appStorage'
import { stubPhoneMedia } from '../test-utils/phoneLayout'
import type { SidebarSelection, VaultEntry } from '../types'
import { useActiveNoteLocation } from './useActiveNoteLocation'
import { usePhoneNoteOpener } from './phoneNoteStackStore'
import { BACK_TO_NOTE_LIST_STATE_KEY, PHONE_PANE_ATTRIBUTE } from './usePhoneNoteStack'

const VAULT_PATH = '/Users/mock/demo-vault-v2'
const VAULTS = [{ label: 'demo-vault-v2', path: VAULT_PATH }]
const ENTRIES = ['welcome.md', 'people/ada.md'].map((path) => ({ path }) as VaultEntry)
const [WELCOME, ADA] = ENTRIES
const INBOX: SidebarSelection = { kind: 'filter', filter: 'inbox' }

function useHarness() {
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null)
  const [selection, setSelection] = useState<SidebarSelection>(INBOX)
  const [entries, setEntries] = useState(ENTRIES)
  const [openNote] = useState(() => vi.fn(async (entry: VaultEntry) => { setActiveNotePath(entry.path) }))
  const stack = useActiveNoteLocation({
    activeNotePath,
    enabled: true,
    entries,
    isVaultLoading: false,
    openNote,
    selection,
    setSelection,
    vaultPath: VAULT_PATH,
    vaults: VAULTS,
    views: [],
  })
  const tapNote = usePhoneNoteOpener(openNote)
  return { activeNotePath, openNote, setEntries, stack, tapNote }
}

type Harness = ReturnType<typeof useHarness>

function renderAt(url: string) {
  window.history.replaceState(null, '', url)
  return renderHook(() => useHarness())
}

function noteParam(): string | null {
  return new URLSearchParams(window.location.search).get('note')
}

async function tapInList(current: Harness, entry: VaultEntry) {
  await act(async () => { await current.tapNote(entry) })
}

function popTo(url: string, state: unknown = null) {
  act(() => {
    window.history.replaceState(state, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

describe('usePhoneNoteStack', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_TOLARIA_WEB_BUILD', 'true')
    stubPhoneMedia(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('starts on the list, with the last note open behind it and named nowhere in the URL', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, 'welcome.md')
    const { result } = renderAt('/')

    await waitFor(() => { expect(result.current.activeNotePath).toBe('welcome.md') })
    expect(result.current.stack).toMatchObject({ active: true, pane: 'list' })
    expect(document.documentElement.getAttribute(PHONE_PANE_ATTRIBUTE)).toBe('list')
    await waitFor(() => { expect(window.location.search).toBe('?vault=demo-vault-v2') })
  })

  it('shows a tapped note, the open one included, and pushes its URL', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, 'welcome.md')
    const { result } = renderAt('/')
    await waitFor(() => { expect(window.location.search).toBe('?vault=demo-vault-v2') })
    const pushState = vi.spyOn(window.history, 'pushState')

    await tapInList(result.current, WELCOME)

    expect(result.current.stack.pane).toBe('note')
    expect(document.documentElement.getAttribute(PHONE_PANE_ATTRIBUTE)).toBe('note')
    await waitFor(() => { expect(noteParam()).toBe('welcome.md') })
    expect(pushState).toHaveBeenCalledWith(expect.objectContaining({ [BACK_TO_NOTE_LIST_STATE_KEY]: true }), '', expect.any(String))
  })

  it('goes back to the list on a popped URL without a note, and forward to the note', async () => {
    const { result } = renderAt('/')
    await tapInList(result.current, ADA)
    await waitFor(() => { expect(noteParam()).toBe('people/ada.md') })
    const pushState = vi.spyOn(window.history, 'pushState')

    popTo('/?vault=demo-vault-v2')
    expect(result.current.stack.pane).toBe('list')
    popTo('/?vault=demo-vault-v2&note=people/ada.md')
    await waitFor(() => { expect(result.current.stack.pane).toBe('note') })
    expect(pushState).not.toHaveBeenCalled()
  })

  it('goes back through history when the list pushed the note', async () => {
    const { result } = renderAt('/')
    await waitFor(() => { expect(window.location.search).toBe('?vault=demo-vault-v2') })
    await tapInList(result.current, ADA)
    await waitFor(() => { expect(noteParam()).toBe('people/ada.md') })
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => { popTo('/?vault=demo-vault-v2') })

    act(() => { result.current.stack.backToList() })

    expect(back).toHaveBeenCalled()
    expect(result.current.stack.pane).toBe('list')
  })

  it('opens a shared note URL on the note, and its back control shows the list', async () => {
    const { result } = renderAt('/?note=people/ada.md')
    await waitFor(() => { expect(result.current.activeNotePath).toBe('people/ada.md') })
    expect(result.current.stack.pane).toBe('note')
    const back = vi.spyOn(window.history, 'back')

    act(() => { result.current.stack.backToList() })

    expect(back).not.toHaveBeenCalled()
    expect(result.current.stack.pane).toBe('list')
    await waitFor(() => { expect(noteParam()).toBeNull() })
  })

  it('shows a note opened elsewhere, such as a wikilink or search', async () => {
    localStorage.setItem(APP_STORAGE_KEYS.lastActiveNotePath, 'welcome.md')
    const { result } = renderAt('/')
    await waitFor(() => { expect(result.current.activeNotePath).toBe('welcome.md') })

    await act(async () => { await result.current.openNote(ADA) })

    expect(result.current.stack.pane).toBe('note')
  })

  it('keeps a renamed note on screen', async () => {
    const { result } = renderAt('/')
    await waitFor(() => { expect(window.location.search).toBe('?vault=demo-vault-v2') })
    await tapInList(result.current, ADA)

    act(() => { result.current.setEntries([WELCOME, { path: 'people/ada-lovelace.md' } as VaultEntry]) })
    await act(async () => { await result.current.openNote({ path: 'people/ada-lovelace.md' } as VaultEntry) })

    expect(result.current.stack.pane).toBe('note')
  })

  it('lets go of editor focus on the way back to the list', async () => {
    const editor = document.createElement('div')
    editor.className = 'app__editor'
    const input = document.createElement('input')
    editor.append(input)
    document.body.append(editor)
    const { result } = renderAt('/')
    await tapInList(result.current, ADA)
    input.focus()

    act(() => { result.current.stack.backToList() })

    await waitFor(() => { expect(document.activeElement).not.toBe(input) })
    editor.remove()
  })

  it('passes the opener through untouched off the phone layout, and marks nothing', () => {
    stubPhoneMedia(false)
    const { result, unmount } = renderAt('/')

    expect(result.current.stack.active).toBe(false)
    expect(result.current.tapNote).toBe(result.current.openNote)
    expect(document.documentElement.hasAttribute(PHONE_PANE_ATTRIBUTE)).toBe(false)
    unmount()
  })

  it('clears the page mark when the phone layout goes away', () => {
    const { unmount } = renderAt('/')
    expect(document.documentElement.hasAttribute(PHONE_PANE_ATTRIBUTE)).toBe(true)

    unmount()

    expect(document.documentElement.hasAttribute(PHONE_PANE_ATTRIBUTE)).toBe(false)
  })
})
