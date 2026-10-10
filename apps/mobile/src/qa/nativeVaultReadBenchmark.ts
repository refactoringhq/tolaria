import { restoreNativeWorkspace } from '../workspace/nativeWorkspaceAccess'
import { buildLocalVaultWorkspaceSnapshot } from '../workspace/localVaultSnapshot'

/** Read-only timing on the already imported app-local copy; reports no note data. */
export async function nativeVaultReadBenchmark() {
  const started = performance.now()
  const workspace = await restoreNativeWorkspace()
  if (!workspace?.index) return null
  const readFinished = performance.now()
  const snapshot = buildLocalVaultWorkspaceSnapshot({
    files: workspace.index.files,
    folderPaths: workspace.index.directories,
    vaultLabel: workspace.label,
    vaultPath: workspace.uri,
  })
  return {
    fileCount: workspace.index.files.length,
    noteCount: snapshot.allNotes?.length ?? snapshot.notes.length,
    nativeReadMs: Math.round(readFinished - started),
    snapshotMs: Math.round(performance.now() - readFinished),
  }
}
