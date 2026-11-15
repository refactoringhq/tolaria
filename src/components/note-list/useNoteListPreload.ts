import { useEffect } from 'react'
import { prefetchNoteContent } from '../../hooks/useTabManagement'
import type { VaultEntry } from '../../types'
import { isDeletedNoteEntry } from './noteListUtils'

const PRELOAD_LIMIT = 6
const ADJACENT_RADIUS = 3
const PRELOAD_START_DELAY_MS = 350
const PRELOAD_STEP_DELAY_MS = 180

function preloadCandidates(entries: VaultEntry[], selectedPath: string | null) {
  const selectedIndex = entries.findIndex((entry) => entry.path === selectedPath)
  const start = Math.max(0, selectedIndex - ADJACENT_RADIUS)
  const end = selectedIndex >= 0
    ? Math.min(entries.length, selectedIndex + ADJACENT_RADIUS + 1)
    : Math.min(entries.length, PRELOAD_LIMIT)
  return entries.slice(start, end)
    .map((entry, offset) => ({ entry, index: start + offset }))
    .sort((left, right) => selectedIndex < 0 ? 0 : Math.abs(left.index - selectedIndex) - Math.abs(right.index - selectedIndex))
    .map(({ entry }) => entry)
    .filter((entry) => entry.path !== selectedPath && !isDeletedNoteEntry(entry) && entry.fileKind !== 'binary')
    .slice(0, PRELOAD_LIMIT)
}

export function useNoteListPreload(entries: VaultEntry[], selectedPath: string | null) {
  useEffect(() => {
    const candidates = preloadCandidates(entries, selectedPath)
    if (candidates.length === 0) return

    let stepTimer: number | null = null
    let candidateIndex = 0
    const startTimer = window.setTimeout(() => {
      const preloadNext = () => {
        const entry = candidates.at(candidateIndex)
        if (!entry) return
        const parsedBlockPreload = candidateIndex === 0
        candidateIndex += 1
        prefetchNoteContent(entry, { parsedBlockPreload })
        stepTimer = window.setTimeout(preloadNext, PRELOAD_STEP_DELAY_MS)
      }
      preloadNext()
    }, PRELOAD_START_DELAY_MS)

    return () => {
      window.clearTimeout(startTimer)
      if (stepTimer !== null) window.clearTimeout(stepTimer)
    }
  }, [entries, selectedPath])
}
