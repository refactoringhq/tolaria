/* global console, process, setTimeout, clearTimeout */
import { execFileSync } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { gitTestEnvironment, startGitTestServer } from '../src/workspace/git/gitTestServer.ts'

const root = await mkdtemp(join(tmpdir(), 'tolaria-native-git-'))
const gitOptions = { env: gitTestEnvironment(), stdio: 'pipe' }
const remote = join(root, 'team', 'vault.git')
const seed = join(root, 'seed')
const standalone = process.argv.includes('--standalone')
const bundleId = standalone ? 'com.tolaria.mobile.dev' : 'host.exp.Exponent'
const fileCount = Number(process.env.TOLARIA_GIT_QA_FILES ?? 2)
if (!Number.isInteger(fileCount) || fileCount < 2 || fileCount > 10_000) {
  throw new Error('TOLARIA_GIT_QA_FILES must be an integer from 2 to 10000')
}
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
  await createLargeFixture()
  runGit(['-C', seed, 'add', '.'])
  runGit(['-C', seed, '-c', 'user.name=Native QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'Fixture'])
  runGit(['-C', seed, 'push', remote, 'main'])
}

async function createLargeFixture() {
  for (let index = 2; index < fileCount; index += 1) {
    const folder = join(seed, `folder-${index % 20}`)
    await mkdir(folder, { recursive: true })
    const lines = Array.from({ length: 64 }, (_, line) =>
      createHash('sha256').update(`fixture-${index}-${line}`).digest('hex'))
    await writeFile(join(folder, `note-${index}.md`), `---\ntype: Note\n---\n# Note ${index}\n\n${lines.join('\n')}\n`)
  }
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
    timeout = setTimeout(() => reject(new Error('Native Git proof timed out')), fileCount > 2 ? 600_000 : 150_000)
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
  console.log(JSON.stringify({ fileCount, ...result }, null, 2))
  if (!result.passed || (standalone && !result.nativeFiles)) process.exitCode = 1
} finally {
  clearTimeout(timeout)
  await server?.close()
  await rm(root, { recursive: true, force: true })
}
