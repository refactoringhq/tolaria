import { useCallback, useEffect, useMemo } from 'react'
import type { VaultEntry } from '../../types'
import type { FrontmatterOpOptions } from '../../hooks/frontmatterOps'
import { isUntitledPath } from '../../hooks/editorTabContent'
import { notePathsMatch } from '../../utils/notePathIdentity'

type FrontmatterValue = string | number | boolean | string[] | null
type ReplayMutation = (entry: VaultEntry) => Promise<unknown>

const PATH_CHANGE_REPLAY_WINDOW_MS = 5_000

interface PendingPathChangeReplay {
  createdAt: number | null
  path: string
  replay: ReplayMutation
  title: string
  timeout: ReturnType<typeof setTimeout>
}

let pendingPathChangeReplay: PendingPathChangeReplay | null = null

function clearPendingPathChangeReplay(): void {
  const pending = pendingPathChangeReplay
  pendingPathChangeReplay = null
  if (pending) clearTimeout(pending.timeout)
}

function schedulePathChangeReplay(entry: VaultEntry, replay: ReplayMutation): void {
  clearPendingPathChangeReplay()
  const timeout = setTimeout(() => {
    if (pendingPathChangeReplay?.replay === replay) pendingPathChangeReplay = null
  }, PATH_CHANGE_REPLAY_WINDOW_MS)
  pendingPathChangeReplay = {
    createdAt: entry.createdAt,
    path: entry.path,
    replay,
    title: entry.title,
    timeout,
  }
}

function replayMatchesEntry(pending: PendingPathChangeReplay, entry: VaultEntry): boolean {
  const creationTimeMatches = pending.createdAt !== null
    && entry.createdAt !== null
    && pending.createdAt === entry.createdAt
  return pending.title === entry.title
    && (creationTimeMatches || isUntitledPath(pending.path))
}

interface InspectorPropertyActionsConfig {
  entry: VaultEntry | null
  onUpdateFrontmatter?: (path: string, key: string, value: FrontmatterValue, options?: FrontmatterOpOptions) => Promise<void>
  onDeleteProperty?: (path: string, key: string, options?: FrontmatterOpOptions) => Promise<void>
  onAddProperty?: (path: string, key: string, value: FrontmatterValue, options?: FrontmatterOpOptions) => Promise<void>
  onCreateMissingType?: (path: string, missingType: string, nextTypeName: string) => Promise<boolean | undefined>
}

function activeEntryOptions(entry: VaultEntry): FrontmatterOpOptions {
  return { requireActivePath: entry.path }
}

function bindUpdateAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onUpdateFrontmatter'],
  scheduleReplay: (entry: VaultEntry, replay: ReplayMutation) => void,
  options: (entry: VaultEntry) => FrontmatterOpOptions | undefined = activeEntryOptions,
) {
  if (!entry || !action) return undefined
  return (key: string, value: FrontmatterValue) => {
    scheduleReplay(entry, (nextEntry) => action(nextEntry.path, key, value, options(nextEntry)))
    return action(entry.path, key, value, options(entry))
  }
}

function bindDeleteAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onDeleteProperty'],
  scheduleReplay: (entry: VaultEntry, replay: ReplayMutation) => void,
) {
  if (!entry || !action) return undefined
  return (key: string) => {
    scheduleReplay(entry, (nextEntry) => action(nextEntry.path, key, activeEntryOptions(nextEntry)))
    return action(entry.path, key, activeEntryOptions(entry))
  }
}

function bindAddAction(
  entry: VaultEntry | null,
  action: InspectorPropertyActionsConfig['onAddProperty'],
  scheduleReplay: (entry: VaultEntry, replay: ReplayMutation) => void,
  options: (entry: VaultEntry) => FrontmatterOpOptions | undefined = activeEntryOptions,
) {
  if (!entry || !action) return undefined
  return (key: string, value: FrontmatterValue) => {
    scheduleReplay(entry, (nextEntry) => action(nextEntry.path, key, value, options(nextEntry)))
    return action(entry.path, key, value, options(entry))
  }
}

function bindMissingTypeAction(
  entry: VaultEntry | null,
  action: ((path: string, missingType: string, nextTypeName: string) => Promise<boolean | undefined>) | undefined,
) {
  const missingType = entry?.isA
  if (!entry || !missingType || !action) return undefined
  return (nextTypeName: string) => action(entry.path, missingType, nextTypeName)
}

function usePathChangeMutationReplay(entry: VaultEntry | null) {
  useEffect(() => {
    const pending = pendingPathChangeReplay
    if (
      !entry
      || !pending
      || !replayMatchesEntry(pending, entry)
      || notePathsMatch(entry.path, pending.path)
    ) return
    clearPendingPathChangeReplay()
    setTimeout(() => {
      void pending.replay(entry).catch((error) => {
        console.error('Failed to replay property mutation after note rename:', error)
      })
    }, 0)
  }, [entry])

  return useCallback(
    (currentEntry: VaultEntry, replay: ReplayMutation) => schedulePathChangeReplay(currentEntry, replay),
    [],
  )
}

export function useInspectorPropertyActions({
  entry,
  onUpdateFrontmatter,
  onDeleteProperty,
  onAddProperty,
  onCreateMissingType,
}: InspectorPropertyActionsConfig) {
  const schedulePathChangeReplay = usePathChangeMutationReplay(entry)
  const handleUpdateProperty = useMemo(
    () => bindUpdateAction(entry, onUpdateFrontmatter, schedulePathChangeReplay),
    [entry, onUpdateFrontmatter, schedulePathChangeReplay],
  )
  const handleUpdatePropertyAfterCreate = useMemo(
    () => bindUpdateAction(entry, onUpdateFrontmatter, schedulePathChangeReplay, () => undefined),
    [entry, onUpdateFrontmatter, schedulePathChangeReplay],
  )
  const handleDeleteProperty = useMemo(
    () => bindDeleteAction(entry, onDeleteProperty, schedulePathChangeReplay),
    [entry, onDeleteProperty, schedulePathChangeReplay],
  )
  const handleAddProperty = useMemo(
    () => bindAddAction(entry, onAddProperty, schedulePathChangeReplay),
    [entry, onAddProperty, schedulePathChangeReplay],
  )
  const handleAddPropertyAfterCreate = useMemo(
    () => bindAddAction(entry, onAddProperty, schedulePathChangeReplay, () => undefined),
    [entry, onAddProperty, schedulePathChangeReplay],
  )
  const handleCreateMissingType = useMemo(
    () => bindMissingTypeAction(entry, onCreateMissingType),
    [entry, onCreateMissingType],
  )

  return {
    handleUpdateProperty,
    handleUpdatePropertyAfterCreate,
    handleDeleteProperty,
    handleAddProperty,
    handleAddPropertyAfterCreate,
    handleCreateMissingType,
  }
}
