import git, { type HttpClient } from 'isomorphic-git'
import { createGitVault, githubRepositoryUrl, type GitAuthor, type GitVaultContext } from './gitVault'
import { withWorkspaceOperation } from './workspaceOperationQueue'
import { withSavedWorkspace } from './workspaceWriteQueue'

export type GitSyncPhase = 'checkpoint' | 'fetch' | 'checkout' | 'push'
export type GitRemoteOptions = GitVaultContext & {
  http: HttpClient
  token?: string
  onPhase?: (phase: GitSyncPhase) => void
  operationKey?: string
}

export function cloneGitVault(options: GitRemoteOptions, repositoryUrl: string) {
  const url = githubRepositoryUrl(repositoryUrl)
  return withWorkspaceOperation(options.operationKey ?? options.dir, () => git.clone({
    ...transport(options, url),
    url,
    singleBranch: true,
    noTags: true,
    nonBlocking: true,
    batchSize: 20,
  }))
}

export function syncGitVault(options: GitRemoteOptions, author: GitAuthor) {
  return withSavedWorkspace(options.operationKey ?? options.dir, () => syncUnlocked(options, author))
}

async function syncUnlocked(options: GitRemoteOptions, author: GitAuthor) {
  const { fs, dir } = options
  const url = githubRepositoryUrl(String(await git.getConfig({ fs, dir, path: 'remote.origin.url' })))
  const ref = await git.currentBranch({ fs, dir })
  if (!ref) throw new Error('detachedHead')
  const vault = createGitVault({ fs, dir })
  emitPhase(options, 'checkpoint')
  const checkpoint = await vault.checkpoint(author)
  emitPhase(options, 'fetch')
  const connection = transport(options, url)
  await git.fetch({ ...connection, url, ref, singleBranch: true, tags: false })
  const remoteOid = await git.resolveRef({ fs, dir, ref: `refs/remotes/origin/${ref}` })
  emitPhase(options, 'checkout')
  const integrated = await vault.integrate(remoteOid)
  if (integrated === 'diverged') return { kind: 'diverged' as const, changedFiles: checkpoint.changedFiles }
  if (integrated === 'ahead') {
    emitPhase(options, 'push')
    const pushed = await git.push({ ...connection, url, ref, force: false })
    if (!pushed.ok) throw new Error('pushRejected')
  }
  return { kind: 'synced' as const, changedFiles: checkpoint.changedFiles }
}

function emitPhase(options: GitRemoteOptions, phase: GitSyncPhase) {
  options.onPhase?.(phase)
}

function transport({ fs, dir, http, token }: GitRemoteOptions, repositoryUrl: string) {
  return {
    fs,
    dir,
    http,
    onAuth: (url: string) => {
      if (githubRepositoryUrl(url) !== repositoryUrl || !token) return { cancel: true as const }
      return { username: 'x-access-token', password: token }
    },
    onAuthFailure: () => ({ cancel: true as const }),
  }
}
