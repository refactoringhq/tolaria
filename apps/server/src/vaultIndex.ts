import type { VaultEntry, VaultFile } from '../../../packages/vault-index/src/index.ts'
import { buildVaultIndex } from '../../../packages/vault-index/src/index.ts'
import type { VaultChange } from './gitSync.ts'
import type { VaultPath } from './paths.ts'
import type { BlobStore } from './store.ts'
import type { Vault } from './vault.ts'

export const INDEX_KEY = 'vault-index.json'
const INDEX_VERSION = 1
/** Above this many changed files since the stored index, a rebuild is about as fast. */
const CATCH_UP_LIMIT = 500

interface StoredIndex {
  version: number
  head: string
  entries: VaultEntry[]
}

function malformed(reason: string): Error {
  return new Error(`vault index is malformed: ${reason}`)
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'))
  } catch {
    throw malformed('not valid JSON')
  }
}

function storedFields(value: unknown): Partial<Record<keyof StoredIndex, unknown>> {
  if (value instanceof Object && 'version' in value) return value
  throw malformed('not an index object')
}

/** The index is server state read back from storage: nothing in it is trusted unchecked. */
function parseIndex(bytes: Uint8Array | null): { head: string; entries: VaultEntry[] } | null {
  if (!bytes) return null
  const { version, head, entries } = storedFields(parseJson(bytes))
  if (version !== INDEX_VERSION) throw new Error(`unsupported vault index version: ${String(version)}`)
  if (typeof head !== 'string' || head === '') throw malformed('no head commit')
  if (!Array.isArray(entries)) throw malformed('no list of entries')
  return { head, entries }
}

/** Reads the stored index; one that cannot be used is reported and rebuilt, not fatal. */
async function readStored(store: BlobStore, log: (message: string) => void): Promise<{ head: string; entries: VaultEntry[] } | null> {
  try {
    return parseIndex(await store.get(INDEX_KEY))
  } catch (error) {
    log(`rebuilding the vault index: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Maintains an incremental index of vault entries. The index is rebuilt from git on startup
 * if missing or stale, and updated incrementally on vault changes (write, pull, rename).
 */
export class VaultIndex {
  private readonly vault: Vault
  private readonly store: BlobStore
  private head: string
  private entries: VaultEntry[]
  private dirty = false

  private constructor(vault: Vault, store: BlobStore, head: string, entries: VaultEntry[]) {
    this.vault = vault
    this.store = store
    this.head = head
    this.entries = entries
  }

  /**
   * Loads the stored index and brings it up to the vault's head, or builds it from every file
   * when there is none, it cannot be read, or catching up would touch more than
   * `CATCH_UP_LIMIT` files.
   */
  static async open(vault: Vault, store: BlobStore, log: (message: string) => void = () => {}): Promise<VaultIndex> {
    const currentHead = await vault.info().then((info) => info.head)
    const stored = await readStored(store, log)
    if (stored) {
      const index = new VaultIndex(vault, store, stored.head, stored.entries)
      if (stored.head === currentHead) return index
      const changes = await vault.changesSince(stored.head, CATCH_UP_LIMIT)
      if (changes) {
        await index.catchUp(currentHead, changes)
        log(`vault index caught up with ${changes.length} changed file(s)`)
        return index
      }
    }
    const index = new VaultIndex(vault, store, currentHead, await VaultIndex.buildFromVault(vault))
    index.dirty = true
    await index.save()
    return index
  }

  private static async buildFromVault(vault: Vault): Promise<VaultEntry[]> {
    const { files } = await vault.list()
    const vaultFiles: VaultFile[] = await Promise.all(
      files.map(async (file) => {
        const { bytes } = await vault.read(file.path as VaultPath)
        return {
          relativePath: file.path,
          content: bytes.toString('utf8'),
          size: file.size,
          createdAt: null,
          modifiedAt: null,
        }
      })
    )
    return buildVaultIndex(vaultFiles)
  }

  /** Returns all entries with the current ETag (vault head). */
  getAll(): { head: string; entries: VaultEntry[] } {
    return { head: this.head, entries: this.entries }
  }

  /** Returns changed and deleted entries since the given head. */
  async getDelta(since: string): Promise<{ head: string; changed: VaultEntry[]; deleted: string[] }> {
    // Get all paths that changed between since and current head
    const changedPaths = new Set(await this.vault.diff(since, this.head))
    
    // Find entries that match changed paths
    const changed: VaultEntry[] = []
    const currentPaths = new Set(this.entries.map(e => e.path))
    const deleted: string[] = []
    
    for (const path of changedPaths) {
      const entry = this.entries.find(e => e.path === path)
      if (entry) {
        changed.push(entry)
      } else if (!currentPaths.has(path)) {
        // Path was in the diff but not in current entries = deleted
        deleted.push(path)
      }
    }
    
    return { head: this.head, changed, deleted }
  }

  /** Updates the index incrementally based on vault changes. */
  async apply(changes: VaultChange[]): Promise<void> {
    if (changes.length === 0) return
    
    // Update head from vault
    this.head = await this.vault.info().then((info) => info.head)
    await this.applyEach(changes)
    await this.save()
  }

  private async catchUp(head: string, changes: VaultChange[]): Promise<void> {
    this.head = head
    this.dirty = true
    await this.applyEach(changes)
    await this.save()
  }

  private async applyEach(changes: VaultChange[]): Promise<void> {
    for (const change of changes) {
      if (change.kind === 'upsert') {
        await this.updateEntry(change.path)
      } else if (change.kind === 'delete') {
        this.removeEntry(change.path)
      } else {
        // rename: remove old, add new
        this.removeEntry(change.from)
        await this.updateEntry(change.to)
      }
    }
  }

  private async updateEntry(path: VaultPath): Promise<void> {
    try {
      const { bytes } = await this.vault.read(path)
      const file: VaultFile = {
        relativePath: path,
        content: bytes.toString('utf8'),
        size: bytes.length,
        createdAt: null,
        modifiedAt: null,
      }
      const [newEntry] = buildVaultIndex([file])
      
      // Remove old entry if exists
      this.entries = this.entries.filter(e => e.path !== path)
      // Add new entry
      this.entries.push(newEntry)
      // Re-sort
      this.entries.sort((a, b) => a.path.localeCompare(b.path))
      
      this.dirty = true
    } catch {
      // File might have been deleted or is not readable, skip it
      this.removeEntry(path)
    }
  }

  private removeEntry(path: VaultPath): void {
    const before = this.entries.length
    this.entries = this.entries.filter(e => e.path !== path)
    if (this.entries.length < before) this.dirty = true
  }

  private async save(): Promise<void> {
    if (!this.dirty) return
    const stored: StoredIndex = {
      version: INDEX_VERSION,
      head: this.head,
      entries: this.entries,
    }
    await this.store.put(INDEX_KEY, Buffer.from(JSON.stringify(stored)))
    this.dirty = false
  }
}
