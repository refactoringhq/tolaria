// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createEditorSaveGate } from '../editorSaveGate'
import { useMobileVaults } from './useMobileVaults'

const state = vi.hoisted(() => ({
  active: {
    selection: { vaultAlias: 'linked', vaultLabel: 'Synthetic', vaultRootUri: 'file:///linked-synthetic' },
    git: null,
  },
  nativeSync: vi.fn(async () => ({ linked: true, changed: false, conflict: false })),
  refresh: vi.fn(async () => {}),
  noticeShow: vi.fn(),
  ledger: {
    record: { phase: null, status: 'local', lastCommitId: null, error: null, lastSuccessAt: null, lastFailureAt: null },
    ready: true,
    failed: false,
    markDirty: vi.fn(),
    setProblem: vi.fn(),
    setStatus: vi.fn(),
    setPhase: vi.fn(),
    setLastCommitId: vi.fn(),
    pendingCheckpoint: vi.fn(),
    acknowledgePending: vi.fn(),
    complete: vi.fn(),
  },
}))
vi.mock('react-native', () => ({ AppState: { currentState: 'active' } }))
vi.mock('../nativeWorkspaceAccess', () => ({
  optionalNativeWorkspaceAccessModule: () => ({
    importWorkspace: async () => null,
    restoreWorkspace: async () => null,
    isWorkspaceLinked: () => true,
    recoverWorkspaceText: () => false,
    syncLinkedWorkspace: state.nativeSync,
  }),
}))
vi.mock('./useManagedVaultCatalog', () => ({
  useManagedVaultCatalog: () => ({
    restored: state.active, pending: false, error: null, vaults: [], localVaults: [], reload: vi.fn(),
  }),
}))
vi.mock('./useGitHubAccount', () => ({
  useGitHubAccount: () => ({ session: null, currentSession: vi.fn(async () => null), cancelSignIn: vi.fn() }),
}))
vi.mock('../../settings/useMobileSettings', () => ({
  useMobileSettings: () => ({ ready: true, opened: false, settings: { autoGit: false } }),
}))
vi.mock('../../analytics/useMobileAnalytics', () => ({ useMobileAnalytics: () => ({ capture: vi.fn() }) }))
vi.mock('../../analytics/useMobileDiscoveryEvents', () => ({ useMobileVaultEvents: vi.fn() }))
vi.mock('../useVaultSyncLedger', () => ({ useVaultSyncLedger: () => state.ledger }))
vi.mock('../useVaultNotices', () => ({ useVaultNotices: () => ({ show: state.noticeShow, recovered: vi.fn() }) }))
vi.mock('./usePreparedVaultRefresh', () => ({
  usePreparedVaultRefresh: () => ({ failed: false, refresh: state.refresh }),
}))
vi.mock('./useMobileAutoGit', () => ({ useMobileAutoGit: vi.fn() }))
vi.mock('../useLinkedFolderSync', () => ({ useLinkedFolderSync: vi.fn() }))

let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof useMobileVaults> | undefined
function Harness() {
  const controller = useMobileVaults()
  useLayoutEffect(() => { current = controller }, [controller])
  return null
}

function mountedWysiwygEditor() {
  const editable: boolean[] = []
  const commits: string[] = []
  let body = 'Synthetic QA 713'
  const gate = createEditorSaveGate({
    read: async () => body,
    commit: (document: string) => { commits.push(document) },
    setEditable: (value: boolean) => { editable.push(value) },
  })
  return { commits, editable, gate, type: (text: string) => { body = text } }
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  current = undefined
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('syncs a local-only linked folder while a WYSIWYG note is open, twice, and the raw editor can still open', async () => {
  const editor = mountedWysiwygEditor()
  current?.editors.register(editor.gate.prepare, 'synthetic-note')
  expect(current?.linked).toBe(true)

  for (const text of ['Synthetic QA 713 first edit', 'Synthetic QA 713 second edit']) {
    editor.type(text)
    await act(async () => { await current?.sync() })
    expect(editor.commits.at(-1)).toBe(text)

    const resumeRawEditorSwitch = await current?.editors.prepare()
    expect(resumeRawEditorSwitch).toBeTypeOf('function')
    resumeRawEditorSwitch?.()
  }

  expect(state.nativeSync).toHaveBeenCalledTimes(2)
  expect(state.noticeShow).not.toHaveBeenCalled()
  expect(state.ledger.setStatus).not.toHaveBeenCalledWith('failed')
  expect(state.ledger.setStatus).toHaveBeenCalledWith('synced')
  expect(current?.error).toBeNull()
  expect(editor.editable.at(-1)).toBe(true)
})

it('refreshes the open note once when the linked folder changed on disk', async () => {
  state.nativeSync.mockResolvedValueOnce({ linked: true, changed: true, conflict: false })
  const editor = mountedWysiwygEditor()
  current?.editors.register(editor.gate.prepare, 'synthetic-note')

  await act(async () => { await current?.sync() })

  expect(state.noticeShow).not.toHaveBeenCalled()
  expect(state.refresh).toHaveBeenCalledTimes(1)
  expect(state.refresh).toHaveBeenCalledWith(state.active, state.active, 'synthetic-note')
})
