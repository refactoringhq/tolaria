import type { createWorkspaceSyncEditors } from '../workspaceSyncEditors'
import { withSavedWorkspace } from './workspaceWriteQueue'

type SavedVaultOperation = {
  editors: ReturnType<typeof createWorkspaceSyncEditors>
  rootUri?: string
  run: () => Promise<unknown>
  refresh: (selectedNoteId?: string) => void
}

export async function runSavedVaultOperation({ editors, rootUri, run, refresh }: SavedVaultOperation) {
  const selectedNoteId = editors.selectedNoteId()
  const resume = await editors.prepare()
  let saved = false
  try {
    if (rootUri) await withSavedWorkspace(rootUri, async () => {})
    saved = true
    editors.beginReplacement()
    await run()
  } finally {
    // Once disk is authoritative, stale editor callbacks must never resume.
    if (saved) refresh(selectedNoteId)
    else resume()
  }
}
