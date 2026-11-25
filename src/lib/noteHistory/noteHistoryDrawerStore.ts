import { useSyncExternalStore } from 'react'

/** Which note's history drawer is open (TOL-421): one at a time, opened from the note's menu. */

let openPath: string | null = null
const listeners = new Set<() => void>()

function publish(next: string | null): void {
  openPath = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): string | null {
  return openPath
}

export function openNoteHistory(path: string): void {
  publish(path)
}

export function closeNoteHistory(): void {
  publish(null)
}

/** The path of the note whose history is open, or null. */
export function useNoteHistoryPath(): string | null {
  return useSyncExternalStore(subscribe, snapshot)
}
