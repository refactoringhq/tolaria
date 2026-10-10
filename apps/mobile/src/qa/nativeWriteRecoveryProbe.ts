import { requireOptionalNativeModule } from 'expo'
import { createFileSystemWorkspaceRepository } from '../workspace/fileSystemWorkspaceRepository'
import { expoWorkspaceFileSystem } from '../workspace/expoWorkspaceFileSystem'
import { withSavedWorkspace } from '../workspace/git/workspaceWriteQueue'
import { postNativeQaEvent, setNativeQaSinkUrl } from './nativeQaSink'

type Inspection = { rootUri: string; content: string; pending: boolean; privateJournal: boolean }
type NativePhase = 'prepare' | 'prepare-conflict' | 'inspect' | 'cleanup'
type VerificationPhase = 'recover' | 'conflict'
type ProbePhase = Exclude<NativePhase, 'inspect'> | VerificationPhase
type ProbeModule = { runTextRecoveryProbe: (phase: NativePhase) => Promise<Inspection> }
let running = false

/** Cross-launch fixtures are confined to the native module's dedicated QA cache. */
export async function runNativeWriteRecoveryProbe(endpoint: string, phase: string) {
  if (running) return
  running = true
  setNativeQaSinkUrl(new URL('/proof', endpoint).toString())
  try {
    const module = requireOptionalNativeModule<ProbeModule>('TolariaWorkspaceAccess')
    if (!module?.runTextRecoveryProbe) throw new Error('nativeTextRecoveryUnavailable')
    const checks = await runPhase(module, recoveryPhase(phase))
    postNativeQaEvent({ phase, passed: Object.values(checks).every(Boolean), checks })
  } catch (error) {
    postNativeQaEvent({ phase, passed: false, error: error instanceof Error ? error.message : 'unknown' })
  } finally {
    running = false
  }
}

function recoveryPhase(value: string): ProbePhase {
  if (value === 'prepare' || value === 'prepare-conflict' || value === 'cleanup'
    || value === 'recover' || value === 'conflict') return value
  throw new Error('invalidRecoveryProbePhase')
}

async function runPhase(module: ProbeModule, phase: ProbePhase): Promise<Record<string, boolean>> {
  if (phase === 'prepare' || phase === 'prepare-conflict') {
    const prepared = await module.runTextRecoveryProbe(phase)
    return { journalPublished: prepared.pending, privateJournal: prepared.privateJournal }
  }
  if (phase === 'cleanup') {
    await module.runTextRecoveryProbe(phase)
    return { cleaned: true }
  }
  return verifyPendingPhase(module, phase)
}

async function verifyPendingPhase(module: ProbeModule, phase: VerificationPhase) {
  const before = await module.runTextRecoveryProbe('inspect')
  if (!before.pending) throw new Error('missingCrossLaunchRecoveryRecord')
  if (phase === 'recover') return verifyRecovery(module, before)
  return verifyConflict(module, before)
}

function staleRequest(rootUri: string) {
  return {
    source: 'native' as const, vaultRootUri: rootUri,
    workspaceIndex: { directories: [], files: [{
      absolutePath: `${rootUri}/note.md`, relativePath: 'note.md', content: '# Before\n',
      createdAt: 0, modifiedAt: 0, size: 9,
    }] },
  }
}

async function verifyRecovery(module: ProbeModule, before: Inspection) {
  const repository = createFileSystemWorkspaceRepository(expoWorkspaceFileSystem)
  const snapshot = repository.readSnapshot(staleRequest(before.rootUri))
  const after = await module.runTextRecoveryProbe('inspect')
  const checks = {
    staleIndexDiscarded: snapshot.notes[0]?.title === 'Recovered',
    completeFrontmatter: after.content === '---\ncustom: retained\n---\n# Recovered\n',
    journalCleared: !after.pending,
  }
  await module.runTextRecoveryProbe('cleanup')
  return checks
}

async function verifyConflict(module: ProbeModule, before: Inspection) {
  const repository = createFileSystemWorkspaceRepository(expoWorkspaceFileSystem)
  const readRejected = await rejects(() => repository.readSnapshot(staleRequest(before.rootUri)))
  const writeRejected = await rejects(() => expoWorkspaceFileSystem.writeTextFile(before.rootUri, 'other.md', 'must not save'))
  let gitRan = false
  const syncRejected = await rejects(() => withSavedWorkspace(before.rootUri, async () => { gitRan = true }))
  const after = await module.runTextRecoveryProbe('inspect')
  const checks = {
    readRejected, writeRejected, syncRejected, gitBlocked: !gitRan,
    externalEditPreserved: after.content === '# External edit\n', draftRetained: after.pending,
  }
  await module.runTextRecoveryProbe('cleanup')
  return checks
}

async function rejects(action: () => unknown) {
  try { await action(); return false } catch { return true }
}
