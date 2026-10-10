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
  const [selection, setSelection] = useState<NativeWorkspaceSelection | null>(null)

  useEffect(() => restoreWorkspace(accessModule, setSelection, setRestorePending), [accessModule])

  const open = useCallback(async (initialUri?: string | null) => {
    const nextSelection = await pickNativeWorkspaceDirectory(initialUri, accessModule)
    if (nextSelection) setSelection(nextSelection)
    return nextSelection
  }, [accessModule])

  return { open, restorePending, selection }
}

function restoreWorkspace(
  accessModule: ReturnType<typeof optionalNativeWorkspaceAccessModule>,
  setSelection: (selection: NativeWorkspaceSelection | null) => void,
  setRestorePending: (pending: boolean) => void,
) {
  if (!accessModule) return

  let mounted = true
  void restoreNativeWorkspaceDirectory(accessModule).then((selection) => {
    if (!mounted) return
    setSelection(selection)
    setRestorePending(false)
  })

  return () => {
    mounted = false
  }
}
