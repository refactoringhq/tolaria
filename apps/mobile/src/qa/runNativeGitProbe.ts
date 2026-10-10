import { Directory, File, Paths } from 'expo-file-system'
import { nativeGitHttp } from '../workspace/git/nativeGitHttp'
import type { HttpClient } from 'isomorphic-git'
import { cloneGitVault, syncGitVault } from '../workspace/git/gitRemote'
import { createExpoGitFileSystem } from '../workspace/git/expoGitFileSystem'
import { gitVirtualRoot } from '../workspace/git/gitFileSystemPaths'

let running = false

/** Disposable device-local working copies; never opens a user-selected vault. */
export async function runNativeGitProbe(endpoint: string) {
  if (running) return
  running = true
  const root = new Directory(Paths.cache, `tolaria-git-qa-${Date.now()}`)
  const started = Date.now()
  try {
    root.create()
    const proof = await roundTrip(root, endpoint)
    await publishProof(endpoint, { ...proof, elapsedMs: Date.now() - started })
  } catch (error) {
    await publishProof(endpoint, { error: error instanceof Error ? error.message : 'unknown', stack: error instanceof Error ? error.stack : null, passed: false })
  } finally {
    if (root.exists) root.delete()
    running = false
  }
}

async function roundTrip(root: Directory, endpoint: string) {
  const first = new Directory(root, 'first')
  const second = new Directory(root, 'second')
  first.create()
  second.create()
  const http: HttpClient = {
    request: (request) => {
      const url = new URL(request.url)
      return nativeGitHttp.request({ ...request, url: `${endpoint}${url.pathname}${url.search}` })
    },
  }
  const connection = (directory: Directory) => ({ fs: createExpoGitFileSystem(directory.uri), dir: gitVirtualRoot, http })
  const repositoryUrl = 'https://github.com/team/vault'
  await cloneGitVault(connection(first), repositoryUrl)
  await cloneGitVault(connection(second), repositoryUrl)
  const content = '---\ncustom: preserved\ntags: [native]\n---\n# Native Git round trip\n'
  new File(first, 'note.md').write(content)
  const attachment = new Uint8Array([0, 255, 1, 128, 10, 0, 250])
  new Directory(first, 'attachments').create()
  new File(first, 'attachments', 'bytes.bin').write(attachment)
  new File(first, 'deleted.md').delete()
  const author = { name: 'Native QA', email: 'qa@example.invalid' }
  const pushed = await syncGitVault(connection(first), author)
  const pulled = await syncGitVault(connection(second), author)
  const saved = await new File(second, 'note.md').text()
  const binary = await new File(second, 'attachments', 'bytes.bin').bytes()
  const binaryPreserved = binary.length === attachment.length && binary.every((byte, index) => byte === attachment[index])
  const deletionPreserved = !new File(second, 'deleted.md').exists
  const passed = saved === content && pushed.kind === 'synced' && pulled.kind === 'synced' && binaryPreserved && deletionPreserved
  return { passed, binaryPreserved, deletionPreserved, pushed: pushed.kind, pulled: pulled.kind }
}

async function publishProof(endpoint: string, proof: Record<string, unknown>) {
  console.info('TOLARIA_NATIVE_GIT_PROOF', JSON.stringify(proof))
  await fetch(`${endpoint}/proof`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proof) })
}
