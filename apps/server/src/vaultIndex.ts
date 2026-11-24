import type { VaultEntry, VaultFile } from '../../../packages/vault-index/src/index.ts'
import { buildVaultIndex } from '../../../packages/vault-index/src/index.ts'
import type { VaultChange } from './gitSync.ts'
import type { VaultPath } from './paths.ts'
import { putByPath, removeByPath, sortByPath } from './pathOrder.ts'
import type { BlobStore } from './store.ts'
import { DeferredWrite, INDEX_WRITE_DELAY_MS, type IndexFormat, type IndexParts, readStoredIndex, type StoredIndex, writeIndex } from './storedIndex.ts'
import type { Vault } from './vault.ts'

export const INDEX_KEY = 'vault-index.json'
const FORMAT: IndexFormat = { key: INDEX_KEY, version: 1, name: 'vault index', items: 'entries' }
/** Above this many changed files since the stored index, a rebuild is about as fast. */
const CATCH_UP_LIMIT = 500

/**
 * Maintains an incremental index of vault entries. The index is rebuilt from git on startup
 * if missing or stale, and updated incrementally on vault changes (write, pull, rename).
 */
export class VaultIndex {
  private readonly vault: Vault
  private readonly store: BlobStore
  private readonly persist: DeferredWrite
  private head: string
  private entries: VaultEntry[]
  private dirty = false

  private constructor({ vault, store, log }: IndexParts, { head, items }: StoredIndex<VaultEntry>) {
    this.vault = vault
    this.store = store
    this.head = head
    this.entries = sortByPath(items)
    this.persist = new DeferredWrite({ write: () => this.save(), delayMs: INDEX_WRITE_DELAY_MS, log })
  }

  /**
   * Loads the stored index and brings it up to the vault's head, or builds it from every file
   * when there is none, it cannot be read, or catching up would touch more than
   * `CATCH_UP_LIMIT` files.
   */
  static async open(vault: Vault, store: BlobStore, log: (message: string) => void = () => {}): Promise<VaultIndex> {
    const parts = { vault, store, log }
    const currentHead = await vault.head()
    const stored = await readStoredIndex<VaultEntry>(store, FORMAT, log)
    if (stored) {
      const index = new VaultIndex(parts, stored)
      if (stored.head === currentHead) return index
      const changes = await vault.changesSince(stored.head, CATCH_UP_LIMIT)
      if (changes) {
        await index.catchUp(currentHead, changes)
        log(`vault index caught up with ${changes.length} changed file(s)`)
        return index
      }
    }
    const index = new VaultIndex(parts, { head: currentHead, items: await VaultIndex.buildFromVault(vault) })
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

  /** Updates the index incrementally based on vault changes; the store copy follows later. */
  async apply(changes: VaultChange[]): Promise<void> {
    if (changes.length === 0) return
    this.head = await this.vault.head()
    await this.applyEach(changes)
    if (this.dirty) this.persist.schedule()
  }

  /** Writes the index to the store now, if it changed since the last write. */
  flush(): Promise<void> {
    return this.persist.flush()
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
      putByPath(this.entries, newEntry)
      this.dirty = true
    } catch {
      // File might have been deleted or is not readable, skip it
      this.removeEntry(path)
    }
  }

  private removeEntry(path: VaultPath): void {
    if (removeByPath(this.entries, path)) this.dirty = true
  }

  private async save(): Promise<void> {
    if (!this.dirty) return
    this.dirty = false
    await writeIndex(this.store, FORMAT, { head: this.head, items: this.entries }).catch((error: unknown) => {
      this.dirty = true
      throw error
    })
  }
}
