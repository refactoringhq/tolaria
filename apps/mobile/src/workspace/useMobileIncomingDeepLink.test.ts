// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import type { MobileDeepLinkVaultChoice } from './mobileDeepLinks'
import { useIncomingDeepLinkNavigation } from './useIncomingDeepLinkNavigation'
import { useMobileIncomingDeepLink } from './useMobileIncomingDeepLink'

const linking = vi.hoisted(() => ({
  initialUrl: null as string | null,
  initialUrlPromise: null as Promise<string | null> | null,
  listener: null as ((event: { url: string }) => void) | null,
  addEventListener: vi.fn(),
  getInitialURL: vi.fn(),
}))

vi.mock('react-native', () => ({
  Linking: {
    addEventListener: linking.addEventListener,
    getInitialURL: linking.getInitialURL,
  },
}))

let root: ReturnType<typeof createRoot> | undefined

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  linking.initialUrl = null
  linking.listener = null
  linking.addEventListener.mockImplementation((_type, callback) => {
    linking.listener = callback
    return { remove: vi.fn() }
  })
  linking.getInitialURL.mockImplementation(() => linking.initialUrlPromise ?? Promise.resolve(linking.initialUrl))
})

afterEach(async () => {
  await act(async () => root?.unmount())
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useMobileIncomingDeepLink', () => {
  it('routes a cold-start link to the exact note path in the selected vault', async () => {
    const snapshot = workspaceScenarioForId('default')
    const note = snapshot.notes[0]
    const path = note.path ?? note.id
    const vaultLabel = snapshot.source?.label ?? 'Laputa Vault'
    linking.initialUrl = `tolaria://${slug(vaultLabel)}/${encodePath(path)}`
    const choice = { id: vaultLabel, label: vaultLabel, selected: true, select: vi.fn() }
    const state = await renderHook([choice], snapshot)
    expect(state().navigation?.noteId).toBe(note.id)
    expect(state().notice).toBeNull()
  })

  it('handles a warm deep link and leaves QA launch URLs to their existing route', async () => {
    const snapshot = workspaceScenarioForId('default')
    const note = snapshot.notes[0]
    const path = note.path ?? note.id
    const vaultLabel = snapshot.source?.label ?? 'Laputa Vault'
    const choice = { id: vaultLabel, label: vaultLabel, selected: true, select: vi.fn() }
    const state = await renderHook([choice], snapshot)
    await act(async () => linking.listener?.({ url: 'tolaria://mobile-ui-lab?layoutProbe=1' }))
    expect(state().navigation).toBeNull()
    await act(async () => linking.listener?.({ url: `tolaria://${slug(vaultLabel)}/${encodePath(path)}` }))
    expect(state().navigation?.noteId).toBe(note.id)
  })

  it('shows a localized nonblocking message when the linked vault is not present', async () => {
    const snapshot = workspaceScenarioForId('default')
    const state = await renderHook([
      { id: 'work', label: 'Work', selected: true, select: vi.fn() },
    ], snapshot)
    await act(async () => linking.listener?.({ url: 'tolaria://missing-vault/Note.md' }))
    expect(state().notice).toBeTruthy()
    expect(state().navigation).toBeNull()
  })

  it('does not select a vault after its workspace unmounts before link resolution', async () => {
    const snapshot = workspaceScenarioForId('default')
    const select = vi.fn(async () => {})
    await renderHook([{ id: 'work', label: 'Work', selected: false, select }], snapshot)

    await act(async () => {
      flushSync(() => linking.listener?.({ url: noteUrl('Work', 'Note.md') }))
      root?.unmount()
      await Promise.resolve()
    })

    expect(select).not.toHaveBeenCalled()
  })

  it('keeps the newest warm link when a delayed cold-start URL resolves later', async () => {
    const snapshot = workspaceScenarioForId('default')
    const [older, newer] = snapshot.notes
    const vaultLabel = snapshot.source?.label ?? 'Laputa Vault'
    let resolveInitial!: (url: string) => void
    linking.initialUrlPromise = new Promise((resolve) => { resolveInitial = resolve })
    const state = await renderHook([
      { id: vaultLabel, label: vaultLabel, selected: true, select: vi.fn() },
    ], snapshot)

    await act(async () => linking.listener?.({ url: noteUrl(vaultLabel, newer.path ?? newer.id) }))
    await act(async () => resolveInitial(noteUrl(vaultLabel, older.path ?? older.id)))

    expect(state().navigation?.noteId).toBe(newer.id)
  })

  it('keeps a vault-selection failure when the picker rerenders before rejection', async () => {
    const snapshot = workspaceScenarioForId('default')
    let rejectSelection!: (error: Error) => void
    const select = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSelection = reject }))
    const choices = [{ id: 'work', label: 'Work', selected: false, select }]
    const state = await renderHook(choices, snapshot)

    await act(async () => linking.listener?.({ url: 'tolaria://work/Note.md' }))
    await act(async () => state.rerender([...choices]))
    await act(async () => rejectSelection(new Error('vault unavailable')))

    expect(state().notice).toBeTruthy()
  })

  it('emits a fresh navigation request when the same note link is repeated', async () => {
    const snapshot = workspaceScenarioForId('default')
    const note = snapshot.notes[0]
    const vaultLabel = snapshot.source?.label ?? 'Laputa Vault'
    const url = noteUrl(vaultLabel, note.path ?? note.id)
    const state = await renderHook([
      { id: vaultLabel, label: vaultLabel, selected: true, select: vi.fn() },
    ], snapshot)

    await act(async () => linking.listener?.({ url }))
    const firstRequest = state().navigation?.requestId
    await act(async () => state().acknowledgeNavigation(firstRequest ?? -1))
    expect(state().navigation).toBeNull()
    await act(async () => linking.listener?.({ url }))

    expect(state().navigation?.noteId).toBe(note.id)
    expect(state().navigation?.requestId).toBeGreaterThan(firstRequest ?? 0)
  })

  it('dispatches resolved links through the mounted workspace navigation callback', async () => {
    const navigate = vi.fn()
    const acknowledge = vi.fn()
    function Probe() {
      useIncomingDeepLinkNavigation({ noteId: 'target-note', requestId: 7 }, navigate, acknowledge)
      return null
    }
    root = createRoot(document.createElement('div'))

    await act(async () => root?.render(createElement(Probe)))

    expect(navigate).toHaveBeenCalledWith('target-note')
    expect(acknowledge).toHaveBeenCalledWith(7)
  })
})

async function renderHook(choices: MobileDeepLinkVaultChoice[], snapshot: ReturnType<typeof workspaceScenarioForId>) {
  let current: ReturnType<typeof useMobileIncomingDeepLink> | undefined
  let currentChoices = choices
  function Probe() {
    const result = useMobileIncomingDeepLink({ choices: currentChoices }, snapshot)
    useEffect(() => { current = result }, [result])
    return null
  }
  root = createRoot(document.createElement('div'))
  await act(async () => root?.render(createElement(Probe)))
  await act(async () => { await Promise.resolve() })
  const rerender = async (nextChoices: MobileDeepLinkVaultChoice[]) => {
    currentChoices = nextChoices
    await act(async () => root?.render(createElement(Probe)))
    await act(async () => { await Promise.resolve() })
  }
  const state = () => {
    if (!current) throw new Error('Hook result missing')
    return current
  }
  return Object.assign(state, { rerender })
}

function noteUrl(vaultLabel: string, path: string) {
  return `tolaria://${slug(vaultLabel)}/${encodePath(path)}`
}

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

function encodePath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}
