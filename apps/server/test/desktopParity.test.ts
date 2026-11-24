import { readFile, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { buildVaultIndex, type VaultEntry } from '../../../packages/vault-index/src/index.ts'
import { type ParityGolden, runParityScript } from './desktopParityRunner.ts'

/**
 * Desktop parity for notes created and edited on the web (TOL-228). The scripted edits run
 * through the web client and the server; what each step leaves is checked in as
 * `fixtures/desktop-parity/steps.json`, which `src-tauri/tests/web_desktop_parity.rs` replays
 * through the desktop's own writers and reader. The desktop's reading after every step is
 * `entries.json`; the web's vault index must read every step the same way.
 * Regenerate both with `apps/server/scripts/regenerate-desktop-parity.sh`.
 */

const FIXTURES = new URL('./fixtures/desktop-parity/', import.meta.url)
const REGENERATE = process.env.REGENERATE_GOLDEN === '1'

/** What the desktop shows for an entry, by field; `null` in a step's change for one that is gone. */
type Reading = Record<string, Record<string, unknown>>
type ReadingChange = Record<string, Record<string, unknown> | null>

/** The fields the web's index has, with the value the desktop has when the index leaves one out. */
const WEB_FIELDS: Record<keyof Omit<VaultEntry, 'path' | 'filename'>, unknown> = {
  title: '',
  isA: null,
  aliases: [],
  belongsTo: [],
  status: null,
  fileSize: 0,
  snippet: '',
  relationships: {},
  wordCount: 0,
  outgoingLinks: [],
  hasH1: false,
  fileKind: 'markdown',
}

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8')) as T
}

function applyChange<T>(state: Map<string, T>, change: Record<string, T | null>): void {
  for (const [path, value] of Object.entries(change)) {
    if (value === null) state.delete(path)
    else state.set(path, value)
  }
}

/** The vault after each step: its notes and the attachments uploaded so far. */
function* vaultAfterEachStep({ seed, steps, attachments }: ParityGolden): Generator<Map<string, Buffer>> {
  const files = new Map(Object.entries(seed).map(([path, content]) => [path, Buffer.from(content)]))
  for (const step of steps) {
    applyChange(files, Object.fromEntries(Object.entries(step.changed).map(([path, content]) => [path, content === null ? null : Buffer.from(content)])))
    if (step.stored) files.set(step.stored, Buffer.from(attachments[step.stored], 'base64'))
    yield files
  }
}

function webReading(files: Map<string, Buffer>): Reading {
  const vaultFiles = [...files].map(([relativePath, bytes]) => ({ relativePath, content: bytes.toString('utf8'), size: bytes.length, createdAt: null, modifiedAt: null }))
  const fields = Object.entries(WEB_FIELDS) as [keyof VaultEntry, unknown][]
  return Object.fromEntries(buildVaultIndex(vaultFiles).map((entry) => [entry.path, Object.fromEntries(fields.map(([key, empty]) => [key, entry[key] ?? empty]))]))
}

/**
 * Known drift, to be fixed in the web index on its own card: a note without a type is
 * untyped on the desktop, while the web index calls it a `Note` with a `Type` relationship.
 */
function withKnownDrift(entry: Record<string, unknown>): Record<string, unknown> {
  if (entry.isA !== null || entry.fileKind !== 'markdown') return entry
  return { ...entry, isA: 'Note', relationships: { ...(entry.relationships as object), Type: ['[[note]]'] } }
}

function desktopFields(reading: Map<string, Record<string, unknown>>): Reading {
  const pick = (entry: Record<string, unknown>) => Object.fromEntries(Object.keys(WEB_FIELDS).map((key) => [key, entry[key]]))
  return Object.fromEntries([...reading].map(([path, entry]) => [path, withKnownDrift(pick(entry))]))
}

describe('notes created and edited on the web, as the desktop has them', () => {
  it('leave the files of the golden script, step by step', async () => {
    const run = await runParityScript()
    if (REGENERATE) await writeFile(new URL('steps.json', FIXTURES), `${JSON.stringify(run, null, 2)}\n`)
    const golden = await fixture<ParityGolden>('steps.json')

    expect(run.steps.length).toBeGreaterThanOrEqual(30)
    expect(run.seed).toEqual(golden.seed)
    expect(run.attachments).toEqual(golden.attachments)
    for (const [index, step] of run.steps.entries()) {
      expect(step, `step ${index + 1}: ${step.op} ${step.path}`).toEqual(golden.steps[index])
    }
    expect(run.steps).toHaveLength(golden.steps.length)
  }, 120_000)

  it('are read by the web index the way the desktop reads them, after every step', async () => {
    const golden = await fixture<ParityGolden>('steps.json')
    const desktopChanges = await fixture<ReadingChange[]>('entries.json')
    const desktop = new Map<string, Record<string, unknown>>()

    expect(desktopChanges).toHaveLength(golden.steps.length)
    let step = 0
    for (const files of vaultAfterEachStep(golden)) {
      applyChange(desktop, desktopChanges[step])
      step += 1
      // The seed's `pixel.bin` is not a note: the desktop suite leaves it out.
      files.delete('attachments/pixel.bin')
      expect(webReading(files), `after step ${step}`).toEqual(desktopFields(desktop))
    }
  })
})
