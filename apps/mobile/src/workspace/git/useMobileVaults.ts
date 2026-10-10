import { useCallback, useEffect, useRef, useState } from 'react'
import { pickNativeWorkspaceDirectory } from '../nativeWorkspacePicker'
import { useLocalWorkspaceRestore } from '../useNativeWorkspace'
import { createWorkspaceSyncEditors } from '../workspaceSyncEditors'
import { activateManagedGitVault, cloneManagedGitVault, managedGitConnection, managedGitSelection } from './managedGitStorage'
import type { ManagedGitVault } from './managedGitVaults'
import { nativeGitHttp } from './nativeGitHttp'
import { runSavedVaultOperation } from './savedVaultOperation'
import { useGitHubAccount } from './useGitHubAccount'
import { useManagedVaultCatalog, type ActiveVault } from './useManagedVaultCatalog'
import type { GitSyncPhase } from './gitRemote'

export type VaultSyncState = 'local' | 'pending' | 'synced' | 'diverged' | 'failed'

export function useMobileVaults() {
  const local = useLocalWorkspaceRestore()
  const catalog = useManagedVaultCatalog()
  const account = useGitHubAccount()
  const [editors] = useState(createWorkspaceSyncEditors)
  const [override, setOverride] = useState<ActiveVault | null>(null)
  const active = override ?? catalog.restored ?? { selection: catalog.error ? null : local.selection, git: null }
  const [revision, setRevision] = useState(0)
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<GitSyncPhase | 'clone' | null>(null)
  const [status, setStatus] = useState<VaultSyncState>('pending')
  const [error, setError] = useState(false)
  const running = useRef(false)
  const restorePending = local.restorePending || catalog.pending
  useEffect(() => editors.subscribeDirty(() => setStatus('pending')), [editors])
  useEffect(() => {
    if (!local.restoreFailed && !catalog.error) return
    if (catalog.pending || catalog.restored) return
    setError(true)
    setOpened(true)
  }, [local.restoreFailed, catalog.error, catalog.pending, catalog.restored])

  const open = useCallback(async () => { editors.setBlocked(true); setOpened(true) }, [editors])
  const close = () => {
    if (running.current) return
    account.cancelSignIn()
    editors.setBlocked(false)
    setOpened(false)
  }

  const perform = async (task: () => Promise<ActiveVault | null>) => {
    if (running.current || restorePending) return
    running.current = true
    editors.setBlocked(true)
    setBusy(true)
    setOpened(true)
    setError(false)
    let next = active
    try {
      await runSavedVaultOperation({
        editors, rootUri: active.selection?.vaultRootUri,
        run: async () => { next = await task() ?? active },
        refresh: (selectedNoteId) => {
          setOverride(refreshedVault(next, active, selectedNoteId))
          setRevision((value) => value + 1)
        },
      })
    } catch {
      setError(true)
      setStatus('failed')
      setOpened(true)
    } finally {
      running.current = false
      setBusy(false)
      setPhase(null)
    }
  }

  const select = async (vault: ManagedGitVault) => {
    const selection = await managedGitSelection(vault)
    await activateManagedGitVault(vault.id)
    setStatus('pending')
    return { git: vault, selection }
  }
  const openFolder = () => perform(async () => {
    const selection = await pickNativeWorkspaceDirectory(active.selection?.vaultRootUri)
    if (!selection) return null
    await activateManagedGitVault(null)
    setStatus('local')
    return { selection, git: null }
  })
  const clone = (url: string) => perform(async () => {
    setPhase('clone')
    const session = await account.currentSession()
    const vault = await cloneManagedGitVault(url, nativeGitHttp, session?.accessToken)
    await catalog.reload()
    return select(vault)
  })
  const sync = () => perform(async () => {
    if (!active.git) return null
    const session = await account.currentSession()
    const { syncGitVault } = await import('./gitRemote')
    const result = await syncGitVault({
      ...managedGitConnection(active.git), http: nativeGitHttp,
      token: session?.accessToken, onPhase: setPhase,
    }, session
      ? { name: session.login, email: `${session.userId}+${session.login}@users.noreply.github.com` }
      : { name: 'Tolaria mobile', email: 'mobile@tolaria.app' })
    setStatus(result.kind)
    return null
  })

  return {
    account, active, busy, catalog, close, clone, editors, error, open, opened,
    openFolder, phase, restorePending, revision, status, sync,
    select: (vault: ManagedGitVault) => perform(() => select(vault)),
  }
}

function refreshedVault(next: ActiveVault, previous: ActiveVault, selectedNoteId?: string): ActiveVault {
  if (!next.selection) return next
  const selection = { ...next.selection, index: undefined }
  if (selection.vaultRootUri === previous.selection?.vaultRootUri) selection.selectedNoteId = selectedNoteId
  return { ...next, selection }
}
