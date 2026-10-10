import type { Directory, Paths } from 'expo-file-system'
import { logNativeQaProof } from './nativeQaSink'
import { expoWorkspaceFileSystem } from '../workspace/expoWorkspaceFileSystem'
import type { MobileWorkspaceWrite } from '../workspace/mobileWorkspaceEditing'
import type { MobileNote } from '../workspace/mobileWorkspaceModel'
import type { ReadOnlyWorkspaceRepository, ReadOnlyWorkspaceRequest } from '../workspace/readOnlyWorkspaceRepository'
import {
  nativeWysiwygMutationProbeInitialContent,
  nativeWysiwygMutationProof,
} from './nativeWysiwygMutationProbe'
import {
  nativeWysiwygPersistenceLogLine,
  nativeWysiwygPersistenceProbeNotePath,
  nativeWysiwygPersistenceProbeVaultLabel,
} from './nativeWysiwygPersistenceProbe'

type ExpoFileSystemModule = {
  Directory: typeof Directory
  Paths: typeof Paths
}

declare const require: (moduleName: string) => ExpoFileSystemModule

const persistenceProbeSeedNote = {
  favorite: true,
  snippet: 'The current narrative and temptation: everything routed through an LLM.',
  status: 'Draft',
  tags: ['Design', 'AI'],
  title: 'Workflow Orchestration Essay',
  type: 'Essay',
} satisfies Pick<MobileNote, 'favorite' | 'snippet' | 'status' | 'tags' | 'title' | 'type'>

export function nativeWysiwygPersistenceProbeRepository(
  baseRepository: ReadOnlyWorkspaceRepository,
): ReadOnlyWorkspaceRepository {
  return {
    persistWrites: async (writes, request) => {
      const probeRequest = nativeWysiwygPersistenceProbeRequest(request)
      await baseRepository.persistWrites(writes, probeRequest)
      logPersistenceProofForProbeWrites(writes, probeRequest)
    },
    readNoteContent: (note, request) => baseRepository.readNoteContent(
      note,
      nativeWysiwygPersistenceProbeRequest(request),
    ),
    readSnapshot: (request) => {
      const probeRequest = nativeWysiwygPersistenceProbeRequest(request)
      seedNativeWysiwygPersistenceProbeVault(probeRequest)
      return baseRepository.readSnapshot(probeRequest)
    },
  }
}

export function nativeWysiwygPersistenceProbeRequest(
  request?: ReadOnlyWorkspaceRequest,
): ReadOnlyWorkspaceRequest {
  return {
    ...request,
    source: 'native',
    vaultLabel: nativeWysiwygPersistenceProbeVaultLabel,
    vaultRootUri: persistenceProbeRootUri() ?? request?.vaultRootUri ?? null,
  }
}

function seedNativeWysiwygPersistenceProbeVault(request: ReadOnlyWorkspaceRequest) {
  const rootUri = request.vaultRootUri
  if (!rootUri) return

  expoWorkspaceFileSystem.writeTextFile(
    rootUri,
    nativeWysiwygPersistenceProbeNotePath,
    nativeWysiwygMutationProbeInitialContent(persistenceProbeSeedNote),
  )
}

function logPersistenceProofForProbeWrites(
  writes: MobileWorkspaceWrite[],
  request: ReadOnlyWorkspaceRequest,
) {
  if (!writes.some(isPersistenceProbeWrite) || !request.vaultRootUri) return

  const content = expoWorkspaceFileSystem.readTextFile(request.vaultRootUri, nativeWysiwygPersistenceProbeNotePath)
  if (content === null) return

  logNativeQaProof(nativeWysiwygPersistenceLogLine({
    mutation: nativeWysiwygMutationProof({ content, noteId: nativeWysiwygPersistenceProbeNotePath }),
    path: nativeWysiwygPersistenceProbeNotePath,
    persistedToNativeRepository: true,
  }))
}

function persistenceProbeRootUri(): string | null {
  try {
    const { Directory, Paths } = require('expo-file-system')
    return new Directory(Paths.document, nativeWysiwygPersistenceProbeVaultLabel).uri
  } catch {
    return null
  }
}

function isPersistenceProbeWrite(write: MobileWorkspaceWrite): boolean {
  return (write.kind === 'saveNote' || write.kind === 'createNote')
    && write.path === nativeWysiwygPersistenceProbeNotePath
}
