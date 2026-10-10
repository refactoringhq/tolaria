import { Directory, File } from 'expo-file-system'
import { expoWorkspaceFileSystem as fileSystem } from '../workspace/expoWorkspaceFileSystem'

export async function assertNativeWorkspaceWriteErrors(root: Directory) {
  const source = new File(root, 'source.md')
  const existing = new File(root, 'existing.md')
  source.write('source')
  existing.write('existing')
  await expectRejected(() => fileSystem.moveTextFile(root.uri, source.name, existing.name))
  await expectRejected(() => fileSystem.moveTextFile(root.uri, 'missing.md', 'destination.md'))
  await expectRejected(() => fileSystem.writeTextFile(root.uri, '../outside.md', 'blocked'))
  await expectRejected(() => fileSystem.writeTextFile(root.uri, '.git/config', 'blocked'))
  const missing = new Directory(root, 'missing-vault')
  await expectRejected(() => { fileSystem.readVaultFiles(missing.uri) })
  await expectRejected(() => { fileSystem.readVaultDirectories(missing.uri) })
  if (await source.text() !== 'source' || await existing.text() !== 'existing') throw new Error('failedMoveChangedFiles')
}

async function expectRejected(operation: () => void | Promise<void>) {
  try { await operation() } catch { return }
  throw new Error('workspaceOperationIncorrectlySucceeded')
}
