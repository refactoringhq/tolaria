// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceScenarioForId } from '../fixtures/workspaceFixtures'
import type { MobileDeepLinkVaultChoice } from './mobileDeepLinks'
import { useMobileIncomingDeepLink } from './useMobileIncomingDeepLink'

const linking = vi.hoisted(() => ({
  initialUrl: null as string | null,
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
  linking.getInitialURL.mockImplementation(async () => linking.initialUrl)
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
    expect(state()).toEqual({ noteId: note.id, notice: null })
  })

  it('handles a warm deep link and leaves QA launch URLs to their existing route', async () => {
    const snapshot = workspaceScenarioForId('default')
    const note = snapshot.notes[0]
    const path = note.path ?? note.id
    const vaultLabel = snapshot.source?.label ?? 'Laputa Vault'
    const choice = { id: vaultLabel, label: vaultLabel, selected: true, select: vi.fn() }
    const state = await renderHook([choice], snapshot)
    await act(async () => linking.listener?.({ url: 'tolaria://mobile-ui-lab?layoutProbe=1' }))
    expect(state().noteId).toBeNull()
    await act(async () => linking.listener?.({ url: `tolaria://${slug(vaultLabel)}/${encodePath(path)}` }))
    expect(state().noteId).toBe(note.id)
  })

  it('shows a localized nonblocking message when the linked vault is not present', async () => {
    const snapshot = workspaceScenarioForId('default')
    const state = await renderHook([
      { id: 'work', label: 'Work', selected: true, select: vi.fn() },
    ], snapshot)
    await act(async () => linking.listener?.({ url: 'tolaria://missing-vault/Note.md' }))
    expect(state().notice).toBeTruthy()
    expect(state().noteId).toBeNull()
  })
})

async function renderHook(choices: MobileDeepLinkVaultChoice[], snapshot: ReturnType<typeof workspaceScenarioForId>) {
  let current: ReturnType<typeof useMobileIncomingDeepLink> | undefined
  function Probe() {
    const result = useMobileIncomingDeepLink({ choices }, snapshot)
    useEffect(() => { current = result }, [result])
    return null
  }
  root = createRoot(document.createElement('div'))
  await act(async () => root?.render(createElement(Probe)))
  await act(async () => { await Promise.resolve() })
  return () => {
    if (!current) throw new Error('Hook result missing')
    return current
  }
}

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')
}

function encodePath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}
