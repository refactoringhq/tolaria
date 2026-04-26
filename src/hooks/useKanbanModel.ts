import { useCallback, useMemo } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { VaultEntry } from '../types'
import {
  CANONICAL_STATUSES,
  customStatusDef,
  getCanonicalStatus,
  statusKeyOf,
  type KanbanStatusDef,
} from '../utils/kanbanStatuses'

export interface KanbanColumn {
  status: KanbanStatusDef
  cards: VaultEntry[]
}

export type UpdateStatusFn = (notePath: string, newStatus: string) => Promise<unknown> | void

function compareEntriesByModifiedDesc(a: VaultEntry, b: VaultEntry): number {
  return (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0)
}

export function groupByStatus(entries: VaultEntry[]): KanbanColumn[] {
  const buckets = new Map<string, VaultEntry[]>()
  for (const status of CANONICAL_STATUSES) {
    buckets.set(status.key, [])
  }
  for (const entry of entries) {
    const key = statusKeyOf(entry.status)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(entry)
  }

  const canonicalKeys = new Set(CANONICAL_STATUSES.map((status) => status.key))
  const customKeys = [...buckets.keys()].filter((key) => !canonicalKeys.has(key)).sort()
  const orderedKeys = [...CANONICAL_STATUSES.map((status) => status.key), ...customKeys]

  return orderedKeys.map((key) => ({
    status: getCanonicalStatus(key) ?? customStatusDef(key),
    cards: (buckets.get(key) ?? []).sort(compareEntriesByModifiedDesc),
  }))
}

export function useKanbanModel(entries: VaultEntry[], onUpdateStatus: UpdateStatusFn) {
  const columns = useMemo<KanbanColumn[]>(() => groupByStatus(entries), [entries])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const notePath = String(event.active.id)
      const targetStatus = event.over ? String(event.over.id) : null
      if (!targetStatus) return
      const entry = entries.find((candidate) => candidate.path === notePath)
      if (!entry) return
      const currentStatus = statusKeyOf(entry.status)
      if (currentStatus === targetStatus) return
      await onUpdateStatus(notePath, targetStatus)
    },
    [entries, onUpdateStatus],
  )

  return { columns, handleDragEnd }
}
