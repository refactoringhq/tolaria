import { withWorkspaceOperation } from './workspaceOperationQueue'
import { recoverNativeWorkspaceText } from '../workspaceTextRecovery'

type WorkspaceWrite = () => void | Promise<void>
const unsaved = new Map<string, WorkspaceWrite[]>()

/** Retains failed writes in order; a successful unrelated edit cannot erase them. */
export function persistWorkspaceOperations(root: string, operations: WorkspaceWrite[]) {
  return withWorkspaceOperation(root, async () => {
    const pending = unsaved.get(root) ?? []
    pending.push(...operations)
    unsaved.set(root, pending)
    await flushWorkspaceWrites(root)
  })
}

export function withSavedWorkspace<T>(root: string, operation: () => Promise<T>): Promise<T> {
  return withWorkspaceOperation(root, async () => {
    await flushWorkspaceWrites(root)
    recoverNativeWorkspaceText(root)
    return operation()
  })
}

async function flushWorkspaceWrites(root: string) {
  const pending = unsaved.get(root)
  while (pending?.length) {
    await pending[0]()
    pending.shift()
  }
  unsaved.delete(root)
}
