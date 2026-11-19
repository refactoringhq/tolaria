import { describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../../../test-utils/noteListTestUtils'
import type { VaultEntry } from '../../../types'
import { type LatestDateWriterRef, writeDatesInOrder } from './sequentialDateWrites'

const launch = makeEntry({ path: '/v/launch.md', title: 'Launch', properties: { start: '2026-11-19', end: '2026-11-21' } })
const writes = [{ property: 'start', value: '2026-11-24' }, { property: 'end', value: '2026-11-26' }]

function liveList(): { latest: LatestDateWriterRef; writers: string[] } {
  const writers: string[] = []
  const latest: LatestDateWriterRef = { current: { entries: [launch], writeDate: async () => undefined } }
  let generation = 0
  const makeWriter = (name: string) => async (entry: VaultEntry, write: { property: string; value: string }) => {
    writers.push(`${name}:${write.property}`)
    const updated = { ...entry, properties: { ...latest.current.entries[0].properties, [write.property]: write.value } }
    generation += 1
    latest.current = { entries: [updated], writeDate: makeWriter(`writer${generation}`) }
  }
  latest.current.writeDate = makeWriter('writer0')
  return { latest, writers }
}

describe('writeDatesInOrder', () => {
  it('writes each date through the newest writer once the list shows the previous one', async () => {
    const { latest, writers } = liveList()
    await expect(writeDatesInOrder(launch, writes, latest)).resolves.toBe(true)
    expect(writers).toEqual(['writer0:start', 'writer1:end'])
    expect(latest.current.entries[0].properties).toEqual({ start: '2026-11-24', end: '2026-11-26' })
  })

  it('stops before the end date when the list never shows the start date', async () => {
    const writeDate = vi.fn().mockResolvedValue(undefined)
    const latest: LatestDateWriterRef = { current: { entries: [launch], writeDate } }
    await expect(writeDatesInOrder(launch, writes, latest)).resolves.toBe(false)
    expect(writeDate).toHaveBeenCalledTimes(1)
  })
})
