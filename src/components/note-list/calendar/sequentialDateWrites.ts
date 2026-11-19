import type { VaultEntry } from '../../../types'
import { type DateWrite, entryDateValue } from './calendarModel'

/** The newest list and writer, refreshed after every render. */
export interface LatestDateWriter {
  entries: VaultEntry[]
  writeDate: (entry: VaultEntry, write: DateWrite) => Promise<void>
}

export interface LatestDateWriterRef {
  current: LatestDateWriter
}

/** Frames to wait for the list to show a write before giving up on the next one (about two seconds). */
const MAX_WAIT_FRAMES = 120

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function listShows(entries: VaultEntry[], path: string, write: DateWrite): boolean {
  const entry = entries.find((candidate) => candidate.path === path)
  return entry !== undefined && entryDateValue(entry, write.property) === write.value
}

async function waitUntilListShows(latest: LatestDateWriterRef, path: string, write: DateWrite): Promise<boolean> {
  for (let frame = 0; frame < MAX_WAIT_FRAMES; frame += 1) {
    if (listShows(latest.current.entries, path, write)) return true
    await nextFrame()
  }
  return false
}

/**
 * Writes a range's dates one at a time. Each write waits until the list shows the previous one, then goes
 * through the newest writer, so the second write never patches the note from a snapshot taken before the
 * first and the note keeps both new dates in memory, not only on disk.
 */
export async function writeDatesInOrder(entry: VaultEntry, writes: DateWrite[], latest: LatestDateWriterRef): Promise<boolean> {
  for (const write of writes) {
    await latest.current.writeDate(entry, write)
    if (!(await waitUntilListShows(latest, entry.path, write))) return false
  }
  return true
}
