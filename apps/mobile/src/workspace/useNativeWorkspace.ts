import { useCallback, useContext, useEffect, useState } from 'react'
import { NativeWorkspaceContext } from './NativeWorkspaceContext'
import { optionalNativeWorkspaceAccessModule } from './nativeWorkspaceAccess'
import {
  pickNativeWorkspaceDirectory,
  restoreNativeWorkspaceDirectory,
  type NativeWorkspaceSelection,
} from './nativeWorkspacePicker'

export function useNativeWorkspace() {
  return useContext(NativeWorkspaceContext)
}

export function useLocalWorkspaceRestore() {
  const [accessModule] = useState(optionalNativeWorkspaceAccessModule)
  const [restorePending, setRestorePending] = useState(accessModule !== null)
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [selection, setSelection] = useState<NativeWorkspaceSelection | null>(null)

  useEffect(() => restoreWorkspace(accessModule, setSelection, setRestorePending, setRestoreFailed), [accessModule])

  const open = useCallback(async (initialUri?: string | null) => {
    const nextSelection = await pickNativeWorkspaceDirectory(initialUri, accessModule)
    if (nextSelection) setSelection(nextSelection)
    return nextSelection
  }, [accessModule])

  return { open, restorePending, restoreFailed, selection }
}

function restoreWorkspace(
  accessModule: ReturnType<typeof optionalNativeWorkspaceAccessModule>,
  setSelection: (selection: NativeWorkspaceSelection | null) => void,
  setRestorePending: (pending: boolean) => void,
  setRestoreFailed: (failed: boolean) => void,
) {
  if (!accessModule) return

  let mounted = true
  void restoreNativeWorkspaceDirectory(accessModule).then((selection) => {
    if (!mounted) return
    setSelection(selection)
  }).catch(() => { if (mounted) setRestoreFailed(true) })
    .finally(() => { if (mounted) setRestorePending(false) })

  return () => {
    mounted = false
  }
}
