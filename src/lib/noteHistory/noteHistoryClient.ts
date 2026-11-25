import type { RemoteNoteHistory } from '../../../packages/collab-client/src/remoteHistory'
import { createRemoteHistory } from '../../../packages/collab-client/src/remoteVaultBackend'
import { createVaultBackend, hasRemoteVault, remoteVaultConfig } from '../vaultBackend'

export type { RemoteNoteHistory }

/** Note history lives on the Tolaria remote: null on the desktop and the mock browser build. */
export function noteHistoryClient(): RemoteNoteHistory | null {
  const remote = hasRemoteVault() ? remoteVaultConfig() : null
  return remote ? createRemoteHistory(remote) : null
}

/** The note as the server has it now, what a checkpoint is compared with. */
export async function currentNoteContent(path: string): Promise<string> {
  return (await createVaultBackend('').files.read(path)).content
}

/** Shown in the note's menu only where there is a history to show. */
export function hasNoteHistory(): boolean {
  return hasRemoteVault()
}
