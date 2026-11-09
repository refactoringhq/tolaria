// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FolderOpenFailure } from '../folderOpenFailure'
import { pickNativeWorkspaceDirectory } from '../nativeWorkspacePicker'
import { useMobileVaults } from './useMobileVaults'

const state = vi.hoisted(() => ({
  active: {
    selection: {
      vaultAlias: 'owned',
      vaultLabel: 'Fixture',
      vaultRootUri: 'file:///owned',
    },
    git: null,
  },
  capture: vi.fn(),
  refresh: vi.fn(async () => {}),
  linked: false,
  syncLinked: vi.fn(),
  noticeShow: vi.fn(),
  ledger: {
    record: {
      phase: null,
      status: 'diverged',
      lastCommitId: 'abc',
      error: 'conflict',
      lastSuccessAt: 100,
      lastFailureAt: 200,
    },
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
vi.mock('../nativeWorkspacePicker', () => ({
  pickNativeWorkspaceDirectory: vi.fn(),
}))
vi.mock('./useManagedVaultCatalog', () => ({
  useManagedVaultCatalog: () => ({
    restored: state.active,
    pending: false,
    error: null,
    vaults: [],
    localVaults: [],
    reload: vi.fn(),
  }),
}))
vi.mock('./useGitHubAccount', () => ({
  useGitHubAccount: () => ({ currentSession: vi.fn(), cancelSignIn: vi.fn() }),
}))
vi.mock('../../settings/useMobileSettings', () => ({
  useMobileSettings: () => ({
    ready: true,
    opened: false,
    settings: { autoGit: false },
  }),
}))
vi.mock('../../analytics/useMobileAnalytics', () => ({
  useMobileAnalytics: () => ({ capture: state.capture }),
}))
vi.mock('../../analytics/useMobileDiscoveryEvents', () => ({
  useMobileVaultEvents: vi.fn(),
}))
vi.mock('../useVaultSyncLedger', () => ({
  useVaultSyncLedger: () => state.ledger,
}))
vi.mock('../useVaultNotices', () => ({
  useVaultNotices: () => ({ show: state.noticeShow, recovered: vi.fn() }),
}))
vi.mock('../linkedWorkspace', () => ({
  isWorkspaceLinked: () => state.linked,
  syncLinkedWorkspace: (...args: unknown[]) => state.syncLinked(...args),
}))
vi.mock('./usePreparedVaultRefresh', () => ({
  usePreparedVaultRefresh: () => ({ failed: false, refresh: state.refresh }),
}))
vi.mock('./useMobileAutoGit', () => ({ useMobileAutoGit: vi.fn() }))
vi.mock('../useLinkedFolderSync', () => ({ useLinkedFolderSync: vi.fn() }))

let root: ReturnType<typeof createRoot>
let current: ReturnType<typeof useMobileVaults> | undefined
function Harness() {
  const controller = useMobileVaults()
  useLayoutEffect(() => {
    current = controller
  }, [controller])
  return null
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  state.linked = false
  state.syncLinked.mockResolvedValue({ conflict: false, changed: false })
  current = undefined
  root = createRoot(document.createElement('div'))
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})

it('shows a folder-specific failure without overwriting the active vault sync history or selection', async () => {
  vi.mocked(pickNativeWorkspaceDirectory).mockRejectedValue(
    new FolderOpenFailure('import', new Error('private filename')),
  )
  await act(async () => {
    await current?.openFolder()
  })
  expect(current?.error).toBe('mobile.vaults.folderReadFailed')
  expect(current?.active).toBe(state.active)
  expect(current?.status).toBe('diverged')
  expect(state.ledger.setProblem).not.toHaveBeenCalled()
  expect(state.ledger.setStatus).not.toHaveBeenCalled()
  expect(state.capture).toHaveBeenCalledExactlyOnceWith({
    name: 'mobile_folder_open_failed',
    stage: 'import',
  })
})

it('keeps cancellation quiet and preserves a previous sync problem', async () => {
  vi.mocked(pickNativeWorkspaceDirectory).mockResolvedValue(null)
  await act(async () => {
    await current?.openFolder()
  })
  expect(current?.error).toBeNull()
  expect(current?.active).toBe(state.active)
  expect(state.ledger.setProblem).not.toHaveBeenCalled()
  expect(state.ledger.setStatus).not.toHaveBeenCalled()
  expect(state.capture).not.toHaveBeenCalled()
})

it('surfaces an unavailable linked-folder provider as an actionable background sync notice', async () => {
  state.linked = true
  state.syncLinked.mockRejectedValue(new Error('linkedFolderUnavailable'))
  await act(async () => root.render(createElement(Harness)))

  await act(async () => {
    await current?.sync()
  })

  expect(state.ledger.setProblem).toHaveBeenCalledWith('provider')
  expect(state.ledger.setStatus).toHaveBeenCalledWith('failed')
  expect(state.noticeShow).toHaveBeenCalledWith('provider')
  expect(current?.error).toBe('mobile.vaults.folderUnavailable')
})

it('surfaces wrapped folder-access failures during background sync without exposing the cause', async () => {
  state.linked = true
  state.syncLinked.mockRejectedValue(
    new FolderOpenFailure('prepare', new Error('private provider path')),
  )
  await act(async () => root.render(createElement(Harness)))

  await act(async () => {
    await current?.sync()
  })

  expect(state.ledger.setProblem).toHaveBeenCalledWith('provider')
  expect(state.ledger.setStatus).toHaveBeenCalledWith('failed')
  expect(state.noticeShow).toHaveBeenCalledWith('provider')
  expect(current?.error).toBe('mobile.vaults.folderReadFailed')
})
