import './gitRuntime'
import git, { type FsClient } from 'isomorphic-git'

export type GitAuthor = { name: string; email: string }
export type GitRelationship = 'equal' | 'ahead' | 'behind' | 'diverged'
export type GitVaultContext = { fs: FsClient; dir: string; cache?: object }

export { githubRepositoryUrl } from './githubRepositoryUrl'

export function createGitVault(options: GitVaultContext) {
  const context = { ...options, cache: options.cache ?? {} }
  return {
    checkpoint: (author: GitAuthor) => checkpoint(context, author),
    integrate: (remoteOid: string) => integrate(context, remoteOid),
    relationship: (remoteOid: string) => relationship(context, remoteOid),
  }
}

async function changes(context: GitVaultContext) {
  return (await git.statusMatrix(context)).filter(([, head, worktree, stage]) => head !== worktree || head !== stage)
}

async function checkpoint(context: GitVaultContext, author: GitAuthor) {
  // Do not trust second-resolution stat matches for rapid equal-length edits.
  await git.add({ ...context, filepath: '.', parallel: false })
  const changed = await changes(context)
  for (const [filepath, , worktree] of changed) {
    if (worktree === 0) await git.remove({ ...context, filepath })
  }
  const oid = changed.length
    ? await git.commit({ ...context, author, message: 'Update vault from Tolaria mobile' })
    : await git.resolveRef({ ...context, ref: 'HEAD' })
  return { changedFiles: changed.length, oid }
}

async function relationship(context: GitVaultContext, remoteOid: string): Promise<GitRelationship> {
  const head = await git.resolveRef({ ...context, ref: 'HEAD' })
  if (head === remoteOid) return 'equal'
  if (await git.isDescendent({ ...context, oid: head, ancestor: remoteOid })) return 'ahead'
  if (await git.isDescendent({ ...context, oid: remoteOid, ancestor: head })) return 'behind'
  return 'diverged'
}

async function integrate(context: GitVaultContext, remoteOid: string) {
  if ((await changes(context)).length) throw new Error('dirtyWorkingCopy')
  const state = await relationship(context, remoteOid)
  if (state !== 'behind') return state
  const branch = await git.currentBranch(context)
  if (!branch) throw new Error('detachedHead')
  await git.merge({ ...context, ours: branch, theirs: remoteOid, fastForwardOnly: true })
  await git.checkout({ ...context, ref: branch, nonBlocking: true, batchSize: 20 })
  return 'updated' as const
}
