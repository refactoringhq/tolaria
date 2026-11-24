import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { VaultPath } from '../src/paths.ts'
import { INDEX_KEY as SEARCH_INDEX_KEY, SearchIndex } from '../src/searchIndex.ts'
import { LocalDiskStore } from '../src/store.ts'
import type { Vault } from '../src/vault.ts'
import { VaultIndex } from '../src/vaultIndex.ts'
import { createFixture, type Fixture, text } from './helpers.ts'

// A save updates the indexes in memory; their stored copies follow later (TOL-424), because
// serializing every note of a large vault took longer than the save itself.

let fixture: Fixture
let messages: string[]

beforeEach(async () => {
  fixture = await createFixture()
  messages = []
})

afterEach(() => fixture.cleanup())

async function openBoth(vault: Vault, store: LocalDiskStore): Promise<{ index: VaultIndex; search: SearchIndex }> {
  const log = (message: string): void => {
    messages.push(message)
  }
  return { index: await VaultIndex.open(vault, store, log), search: await SearchIndex.open(vault, store, log) }
}

describe('stored indexes', () => {
  it('are written some time after a save, not during it, and catch up from an older copy', async () => {
    const vault = await fixture.openVault({ fetchIntervalMs: 0 })
    const store = new LocalDiskStore(join(fixture.root, 'state'))
    const { index, search } = await openBoth(vault, store)
    vault.onChange((changes) => index.apply(changes))
    vault.onChange((changes) => search.apply(changes))
    const storedBefore = await store.get(SEARCH_INDEX_KEY)

    const { etag } = await vault.read('welcome.md' as VaultPath)
    await vault.write('welcome.md' as VaultPath, text('# Welcome\n\nNow about quokkas.\n'), { kind: 'match', etag })
    expect((await search.search('quokkas', 10)).results).toHaveLength(1)
    expect(index.getAll().head).toBe(await vault.head())
    expect(await store.get(SEARCH_INDEX_KEY)).toEqual(storedBefore)

    // Stopped before the deferred write: the stored copy names its commit and catches up.
    const restarted = await openBoth(vault, store)
    expect((await restarted.search.search('quokkas', 10)).results).toHaveLength(1)
    expect(messages).toContain('search index caught up with 1 changed file(s)')

    await search.flush()
    const flushed = JSON.parse(Buffer.from((await store.get(SEARCH_INDEX_KEY)) as Uint8Array).toString())
    expect(flushed.head).toBe(await vault.head())
  })
})
