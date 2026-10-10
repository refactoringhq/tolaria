/* global console, process, setTimeout, clearTimeout */
import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitTestEnvironment, startGitTestServer } from '../src/workspace/git/gitTestServer.ts'

const root = await mkdtemp(join(tmpdir(), 'tolaria-native-git-'))
const gitOptions = { env: gitTestEnvironment(), stdio: 'pipe' }
const remote = join(root, 'team', 'vault.git')
const seed = join(root, 'seed')
const standalone = process.argv.includes('--standalone')
const bundleId = standalone ? 'com.tolaria.mobile.dev' : 'host.exp.Exponent'
let server
let timeout

function runGit(args) {
  return execFileSync('git', args, gitOptions)
}

async function createFixture() {
  await mkdir(remote, { recursive: true })
  await mkdir(seed)
  runGit(['init', '--bare', '--initial-branch=main', remote])
  runGit(['init', '--initial-branch=main', seed])
  await writeFile(join(seed, 'note.md'), '---\ncustom: original\n---\n# Initial\n')
  await writeFile(join(seed, 'deleted.md'), '# Remove me in the first working copy\n')
  runGit(['-C', seed, 'add', '.'])
  runGit(['-C', seed, '-c', 'user.name=Native QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'Fixture'])
  runGit(['-C', seed, 'push', remote, 'main'])
}

async function readProof(request, response, resolve, reject) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  response.end('ok')
  try {
    resolve(JSON.parse(Buffer.concat(chunks).toString()))
  } catch (error) {
    reject(error)
  }
}

try {
  await createFixture()
  let resolveProof
  let rejectProof
  const proof = new Promise((resolve, reject) => {
    resolveProof = resolve
    rejectProof = reject
    timeout = setTimeout(() => reject(new Error('Native Git proof timed out')), 150_000)
  })
  server = await startGitTestServer(root, (request, response) => {
    if (request.url !== '/proof') return false
    void readProof(request, response, resolveProof, rejectProof).catch(rejectProof)
    return true
  })
  const scheme = standalone ? 'tolaria:///' : 'exp://127.0.0.1:8081/--/'
  const url = `${scheme}?source=fixture&gitProbe=${encodeURIComponent(server.url)}&qaRun=native-git`
  try {
    execFileSync('xcrun', ['simctl', 'terminate', 'booted', bundleId], { stdio: 'pipe' })
  } catch { /* Expo may not be running. */ }
  execFileSync('xcrun', ['simctl', 'openurl', 'booted', url])
  const result = await proof
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed || (standalone && !result.nativeFiles)) process.exitCode = 1
} finally {
  clearTimeout(timeout)
  await server?.close()
  await rm(root, { recursive: true, force: true })
}
