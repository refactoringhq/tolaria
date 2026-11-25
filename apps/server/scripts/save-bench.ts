// Measures what a user waits for when saving a note in a vault connected to a git remote
// (GitHub in practice), the way `infra/perf.md` in tolaria-cloud measures warm latency: one
// priming request, then sequential saves over keep-alive, timed to the whole response body.
// Also records how long each commit takes to show up on the remote, and saves while the remote
// is unreachable. It writes to the remote: use a throwaway repository or branch.
//
//   pnpm run server:save-bench <remote-url> [branch] [saves] [blocked-saves]
//
// With a local bare repository as the remote, BENCH_FETCH_DELAY_MS and BENCH_PUSH_DELAY_MS add
// a fixed delay to every fetch and push, standing in for GitHub's round trips.
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROUTES } from '../../../packages/protocol/src/index.ts'
import { ChangeEmitter } from '../src/changeEmitter.ts'
import { git } from '../src/git.ts'
import { createVaultServer } from '../src/server.ts'
import { LocalDiskStore } from '../src/store.ts'
import { Vault } from '../src/vault.ts'

/** The bench's own server, on loopback for this run only, gets a fresh token every run. */
const TOKEN = randomBytes(24).toString('hex')
const NOTE = 'bench/save-latency.md'
/** An address that drops every packet: git hangs on it until its own timeout. */
const UNREACHABLE_URL = 'https://10.255.255.1/unreachable.git'
const POLL_MS = 250
const VISIBLE_TIMEOUT_MS = 120_000
const PAUSE_BETWEEN_SAVES_MS = 300
/** The bench only ever sends saves to its own server, which listens on loopback. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost'])

interface BenchTarget {
  remoteUrl: string
  branch: string
  saves: number
  blockedSaves: number
}

interface Ack {
  ms: number
  /** The server's own pull + commit + push time, from `Server-Timing`. */
  serverMs: number
  at: number
  status: number
  commit: string
  etag: string
}

interface Session {
  base: URL
  vaultDir: string
  remoteUrl: string
  branch: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** What one save sends: the note's new content, based on the revision `etag` (null: any). */
interface Edit {
  body: string
  etag: string | null
}

/** Sends `edit` to `url`, refusing anything but the bench's own server on loopback. */
async function putNote(url: URL, { body, etag }: Edit): Promise<Response> {
  if (LOOPBACK_HOSTS.has(url.hostname)) {
    return fetch(url, { method: 'PUT', body, headers: { authorization: `Bearer ${TOKEN}`, 'if-match': etag ?? '*' } })
  }
  throw new Error(`the bench saves only to its own server on loopback, not ${url.host}`)
}

/** One PUT of the note, to the bench's own server on loopback. */
async function save({ session, edit: { body, etag } }: { session: Session; edit: Edit }): Promise<Ack> {
  const started = performance.now()
  const response = await putNote(new URL(`${ROUTES.files}/${NOTE}`, session.base), { body, etag })
  const reply = (await response.json()) as { commit?: string }
  const ms = performance.now() - started
  const serverMs = [...(response.headers.get('server-timing') ?? '').matchAll(/dur=([\d.]+)/g)].reduce((sum, match) => sum + Number(match[1]), 0)
  return { ms, serverMs, at: Date.now(), status: response.status, commit: reply.commit ?? '', etag: response.headers.get('etag') ?? '' }
}

/** `count` saves in a row, each based on the one before, with a pause as between autosaves. */
async function saveSeries(session: Session, series: { count: number; label: string }): Promise<Ack[]> {
  const acks: Ack[] = []
  let etag: string | null = null
  for (let index = 0; index < series.count; index++) {
    const ack = await save({ session, edit: { body: `# Save latency\n\n${series.label} save ${index} at ${new Date().toISOString()}\n`, etag } })
    if (ack.status !== 200 && ack.status !== 201) throw new Error(`${series.label} save ${index} failed with ${ack.status}`)
    etag = ack.etag
    acks.push(ack)
    await sleep(PAUSE_BETWEEN_SAVES_MS)
  }
  return acks
}

/** The remote's branch head, read straight from the remote (never through the server's clone). */
function remoteHead(session: Session): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['ls-remote', session.remoteUrl, `refs/heads/${session.branch}`], (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout.split('\t')[0] ?? '')
    })
  })
}


/** One reading of the remote's head, and when it was taken. */
interface Sighting {
  at: number
  head: string
}

/** Whether the remote, as seen then, had the acknowledged commit. */
async function contains(session: Session, { head }: Sighting, { commit }: Ack): Promise<boolean> {
  if (!head) return false
  const result = await git(session.vaultDir, ['merge-base', '--is-ancestor', commit, head], { okCodes: [1, 128] })
  return result.code === 0
}

/** Reads the remote's head every `POLL_MS` while saves go on, until `stop()`. */
function watchRemote(session: Session): { sightings: Sighting[]; stop: () => void } {
  const sightings: Sighting[] = []
  let watching = true
  const poll = async () => {
    while (watching) {
      const head = await remoteHead(session).catch(() => '')
      sightings.push({ at: Date.now(), head })
      await sleep(POLL_MS)
    }
  }
  void poll()
  return { sightings, stop: () => (watching = false) }
}

/** When `ack`'s commit was first seen on the remote, in ms after the save was acknowledged. */
async function firstSeen(session: Session, sightings: Sighting[], ack: Ack): Promise<number | null> {
  for (const sighting of sightings) {
    if (sighting.at >= ack.at && (await contains(session, sighting, ack))) return sighting.at - ack.at
  }
  return null
}

/** Waits until the remote has the last commit, then says when each commit first showed up. */
async function visibilityDelays(session: Session, watch: ReturnType<typeof watchRemote>, acks: Ack[]): Promise<number[]> {
  const last = acks[acks.length - 1]
  const deadline = Date.now() + VISIBLE_TIMEOUT_MS
  while ((await firstSeen(session, watch.sightings.slice(-2), last)) === null) {
    if (Date.now() > deadline) throw new Error('the last commit never reached the remote')
    await sleep(POLL_MS)
  }
  watch.stop()
  const delays: number[] = []
  for (const ack of acks) delays.push((await firstSeen(session, watch.sightings, ack)) ?? Number.NaN)
  return delays
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

function stats(label: string, values: number[]): string {
  const cells = [percentile(values, 0.5), percentile(values, 0.95), Math.max(...values)]
  return `${label.padEnd(34)}${cells.map((value) => value.toFixed(0).padStart(8)).join('')}`
}

async function connectedPhase(session: Session, saves: number): Promise<string[]> {
  await save({ session, edit: { body: '# Save latency\n\npriming\n', etag: null } })
  const watch = watchRemote(session)
  const acks = await saveSeries(session, { count: saves, label: 'connected' })
  const delays = await visibilityDelays(session, watch, acks)
  return [
    stats(`save ack, ${saves} saves`, acks.map((ack) => ack.ms)),
    stats('  of which in the vault', acks.map((ack) => ack.serverMs)),
    stats('commit on remote after ack', delays),
  ]
}

/** Points the server's clone at an address that never answers, or back at the real remote. */
async function blockRemote(session: Session, blocked: boolean): Promise<void> {
  await git(session.vaultDir, ['remote', 'set-url', 'upstream', blocked ? UNREACHABLE_URL : session.remoteUrl])
}

/** Saves while the remote cannot be reached, then how long the commits take once it is back. */
async function blockedPhase(session: Session, saves: number): Promise<string[]> {
  await blockRemote(session, true)
  const acks = await saveSeries(session, { count: saves, label: 'blocked' })
  await blockRemote(session, false)
  const restored = Date.now()
  const delays = await visibilityDelays(session, watchRemote(session), acks)
  const last = acks[acks.length - 1]
  const afterRestore = last.at + delays[delays.length - 1] - restored
  return [
    stats(`save ack, remote blocked, ${saves} saves`, acks.map((ack) => ack.ms)),
    `${'all blocked saves succeeded'.padEnd(34)}${acks.every((ack) => ack.status < 300)}`,
    `${'last commit on remote after unblock'.padEnd(34)}${afterRestore.toFixed(0).padStart(8)} ms`,
  ]
}

async function startServer(vault: Vault, stateDir: string): Promise<{ base: URL; close: () => Promise<void> }> {
  const server = await createVaultServer({ vault, store: new LocalDiskStore(stateDir), token: TOKEN, maxBodyBytes: 1024 * 1024, changes: new ChangeEmitter() })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const close = async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
  return { base: new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}`), close }
}

/** Delays every fetch and push of the server's clone, as a far-away remote would. */
async function simulateRemoteLatency({ vaultDir }: { vaultDir: string }): Promise<void> {
  const delays = [
    { key: 'remote.upstream.uploadpack', ms: process.env.BENCH_FETCH_DELAY_MS, command: 'git-upload-pack' },
    { key: 'remote.upstream.receivepack', ms: process.env.BENCH_PUSH_DELAY_MS, command: 'git-receive-pack' },
  ]
  for (const { key, ms, command } of delays) {
    if (ms) await git(vaultDir, ['config', key, `sleep ${Number(ms) / 1000}; ${command}`])
  }
}

async function bench(target: BenchTarget): Promise<void> {
  const data = await mkdtemp(join(tmpdir(), 'tolaria-save-bench-'))
  const vaultDir = join(data, 'vault')
  const vault = await Vault.open({ dir: vaultDir, remoteUrl: target.remoteUrl, branch: target.branch, log: (line) => process.stderr.write(`${line}\n`) })
  await simulateRemoteLatency({ vaultDir })
  const server = await startServer(vault, join(data, 'state'))
  try {
    const session: Session = { base: server.base, vaultDir, remoteUrl: target.remoteUrl, branch: target.branch }
    const lines = [...(await connectedPhase(session, target.saves)), ...(await blockedPhase(session, target.blockedSaves))]
    process.stdout.write(`${new Date().toISOString()} ${target.branch}\n${''.padEnd(34)}     p50     p95     max (ms)\n${lines.join('\n')}\n`)
  } finally {
    await server.close()
    await vault.flushAndPush()
    await rm(data, { recursive: true, force: true })
  }
}

function count(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (Number.isInteger(value) && value > 0) return value
  throw new Error('save counts must be positive integers')
}

async function main(): Promise<void> {
  const [remoteUrl, branch = 'main', saves, blockedSaves] = process.argv.slice(2)
  if (!remoteUrl) throw new Error('usage: save-bench.ts <remote-url> [branch] [saves] [blocked-saves]')
  await bench({ remoteUrl, branch, saves: count(saves) ?? 30, blockedSaves: count(blockedSaves) ?? 5 })
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
