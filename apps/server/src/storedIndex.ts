import type { BlobStore } from './store.ts'
import type { Vault } from './vault.ts'

/** How one index is kept in the blob store. */
export interface IndexFormat {
  key: string
  version: number
  /** For messages: "vault index", "search index". */
  name: string
  /** The field that holds the indexed items: "entries", "notes". */
  items: string
}

/** What an index is built over. */
export interface IndexParts {
  vault: Vault
  store: BlobStore
  log: (message: string) => void
}

export interface StoredIndex<T> {
  head: string
  items: T[]
}

/** After a change, an index is written to the store at most this often (and on shutdown). */
export const INDEX_WRITE_DELAY_MS = 30_000

function malformed(format: IndexFormat, reason: string): Error {
  return new Error(`${format.name} is malformed: ${reason}`)
}

function parseJson(format: IndexFormat, bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'))
  } catch {
    throw malformed(format, 'not valid JSON')
  }
}

function storedRecord(format: IndexFormat, value: unknown): Record<string, unknown> {
  if (value instanceof Object && 'version' in value) return value as Record<string, unknown>
  throw malformed(format, 'not an index object')
}

function storedHead(format: IndexFormat, head: unknown): string {
  if (typeof head === 'string' && head !== '') return head
  throw malformed(format, 'no head commit')
}

function storedItems<T>(format: IndexFormat, items: unknown): T[] {
  if (Array.isArray(items)) return items as T[]
  throw malformed(format, `no list of ${format.items}`)
}

/** The index is server state read back from storage: nothing in it is trusted unchecked. */
export function parseStoredIndex<T>(format: IndexFormat, bytes: Uint8Array | null): StoredIndex<T> | null {
  if (!bytes) return null
  const record = storedRecord(format, parseJson(format, bytes))
  if (record.version !== format.version) throw new Error(`unsupported ${format.name} version: ${String(record.version)}`)
  return { head: storedHead(format, record.head), items: storedItems<T>(format, record[format.items]) }
}

/** Reads the stored index; one that cannot be used is reported and rebuilt, not fatal. */
export async function readStoredIndex<T>(store: BlobStore, format: IndexFormat, log: (message: string) => void): Promise<StoredIndex<T> | null> {
  try {
    return parseStoredIndex<T>(format, await store.get(format.key))
  } catch (error) {
    log(`rebuilding the ${format.name}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export function writeIndex<T>(store: BlobStore, format: IndexFormat, index: StoredIndex<T>): Promise<void> {
  return store.put(format.key, Buffer.from(JSON.stringify({ version: format.version, head: index.head, [format.items]: index.items })))
}

/**
 * Writes an index to the store some time after it changed, not on the save that changed it:
 * serializing every note of a large vault takes longer than the save itself. The stored copy
 * names the commit it was taken at, so one that lags behind is brought up to date on the next
 * start (`changesSince`), and nothing is lost when the process stops before the write.
 */
export class DeferredWrite {
  private readonly write: () => Promise<void>
  private readonly delayMs: number
  private readonly log: (message: string) => void
  private timer: NodeJS.Timeout | null = null
  private running: Promise<void> = Promise.resolve()

  constructor(options: { write: () => Promise<void>; delayMs: number; log: (message: string) => void }) {
    this.write = options.write
    this.delayMs = options.delayMs
    this.log = options.log
  }

  schedule(): void {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.running = this.running.then(() => this.write()).catch((error: unknown) => {
        this.log(`index not saved: ${error instanceof Error ? error.message : String(error)}`)
      })
    }, this.delayMs)
    this.timer.unref()
  }

  /** Writes now whatever is pending. */
  async flush(): Promise<void> {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    await this.running
    await this.write()
  }
}
