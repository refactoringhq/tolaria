import { Directory, File } from 'expo-file-system'
import git from 'isomorphic-git'
import { createExpoGitFileSystem } from '../workspace/git/expoGitFileSystem'
import { createGitVault } from '../workspace/git/gitVault'
import { expoWorkspaceFileSystem } from '../workspace/expoWorkspaceFileSystem'

const author = { name: 'Native QA', email: 'qa@example.invalid' }

export async function assertNativeGitRecovery(root: Directory) {
  const directory = new Directory(root, 'checkout-recovery')
  directory.create()
  const context = { fs: createExpoGitFileSystem(directory.uri), dir: '/vault' }
  await git.init({ ...context, defaultBranch: 'main' })
  new File(directory, 'a.md').write('# Before A\n')
  new File(directory, 'b.md').write('# Before B\n')
  const before = await createGitVault(context).checkpoint(author)
  await git.branch({ ...context, ref: 'remote' })
  await git.checkout({ ...context, ref: 'remote' })
  new File(directory, 'a.md').write('# After A\n')
  new File(directory, 'b.md').write('# After B\n')
  const target = await createGitVault(context).checkpoint(author)
  await git.checkout({ ...context, ref: 'main' })
  const failing = interruptWrite(context.fs)
  await expectFailure(() => createGitVault({ ...context, fs: failing }).integrate(target.oid))
  if (await git.resolveRef({ ...context, ref: 'HEAD' }) !== before.oid) throw new Error('checkoutAdvancedEarly')
  await assertWorkspaceBlocked(directory)
  const recovered = await createGitVault(context).checkpoint(author)
  if (recovered.changedFiles !== 0 || recovered.oid !== target.oid) throw new Error('checkoutRecoveryCommitMismatch')
  if (new File(directory, 'b.md').textSync() !== '# After B\n') throw new Error('checkoutRecoveryContentMismatch')
  expoWorkspaceFileSystem.readVaultFiles(directory.uri)
  return true
}

function interruptWrite(fs: ReturnType<typeof createExpoGitFileSystem>) {
  return { promises: { ...fs.promises, writeFile: async (path: string, content: string | Uint8Array) => {
    if (path === '/vault/b.md') throw new Error('simulatedDeviceWriteFailure')
    return fs.promises.writeFile(path, content)
  } } }
}

async function assertWorkspaceBlocked(directory: Directory) {
  await expectFailure(() => expoWorkspaceFileSystem.readVaultFiles(directory.uri))
  await expectFailure(() => expoWorkspaceFileSystem.writeTextFile(directory.uri, 'a.md', '# Must not write\n'))
  if (new File(directory, 'a.md').textSync() === '# Must not write\n') throw new Error('checkoutWasEditable')
}

async function expectFailure(operation: () => unknown) {
  try { await operation() } catch { return }
  throw new Error('expectedRecoveryGuardFailure')
}
