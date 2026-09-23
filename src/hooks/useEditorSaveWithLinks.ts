import { startTransition, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { flushSync } from 'react-dom'
import { useEditorSave } from './useEditorSave'
import { splitFrontmatter } from '../utils/wikilinks'
import { deriveLiveTypeTemplatePatch, deriveRawEditorEntryState } from './rawEditorEntryState'
import { deriveDisplayTitleState } from '../utils/noteTitle'
import { detectFrontmatterState } from '../utils/frontmatter'
import { notePathFilename } from '../utils/notePathIdentity'
import type { VaultEntry } from '../types'
import type { AppLocale } from '../lib/i18n'
import type { EditorEntryContentMetadata } from './editorEntryMetadata'
import { requestEditorEntryMetadata } from './editorEntryMetadataWorkerClient'

const EMPTY_DERIVED_ENTRY_STATE_KEY = JSON.stringify(deriveRawEditorEntryState(''))
const DEFERRED_ENTRY_METADATA_FALLBACK_MS = 120

type UpdateEntry = (path: string, patch: Partial<VaultEntry>) => void
type CancelDeferredWork = () => void

interface DeferredEntryMetadataSync {
  content: string
  includeSavedMetadata: boolean
  path: string
}

function shouldSyncFrontmatterState(content: string): boolean {
  const frontmatterState = detectFrontmatterState(content)
  if (frontmatterState === 'invalid') return false
  return !(frontmatterState === 'none' && content.startsWith('---\n'))
}

function frontmatterSyncKey(content: string): string | null {
  if (!shouldSyncFrontmatterState(content)) return null
  return splitFrontmatter(content)[0]
}

function scheduleDeferredWork(callback: () => void): CancelDeferredWork {
  if (typeof window === 'undefined') {
    const timeout = setTimeout(callback, DEFERRED_ENTRY_METADATA_FALLBACK_MS)
    return () => clearTimeout(timeout)
  }

  const idleWindow = window as Window & {
    cancelIdleCallback?: (handle: number) => void
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
  }
  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(() => callback())
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const timeout = window.setTimeout(callback, DEFERRED_ENTRY_METADATA_FALLBACK_MS)
  return () => window.clearTimeout(timeout)
}

function updateEntryInTransition(updateEntry: UpdateEntry, path: string, patch: Partial<VaultEntry>): void {
  startTransition(() => {
    updateEntry(path, patch)
  })
}

function syncLiveMetadata(options: {
  metadata: Partial<EditorEntryContentMetadata>
  path: string
  prevMetadataKeyRef: MutableRefObject<string>
  updateEntry: UpdateEntry
}): void {
  const { metadata, path, prevMetadataKeyRef, updateEntry } = options
  const liveMetadata = {
    outgoingLinks: metadata.outgoingLinks ?? [],
    wordCount: metadata.wordCount ?? 0,
  }
  const key = JSON.stringify(liveMetadata)
  if (key === prevMetadataKeyRef.current) return

  prevMetadataKeyRef.current = key
  updateEntryInTransition(updateEntry, path, liveMetadata)
}

function resolveFrontmatterPatch(options: {
  content: string
  prevFmSourceRef: MutableRefObject<string | null>
}): Partial<VaultEntry> | null {
  const { content, prevFmSourceRef } = options
  const fmSource = frontmatterSyncKey(content)
  if (fmSource === null || fmSource === prevFmSourceRef.current) return null

  prevFmSourceRef.current = fmSource
  return deriveRawEditorEntryState(content)
}

function syncFrontmatterMetadata(options: {
  content: string
  path: string
  prevFmKeyRef: MutableRefObject<string>
  prevFmSourceRef: MutableRefObject<string | null>
  updateEntry: UpdateEntry
}): string | null {
  const { content, path, prevFmKeyRef, prevFmSourceRef, updateEntry } = options
  const frontmatterPatch = resolveFrontmatterPatch({ content, prevFmSourceRef })
  if (!frontmatterPatch) return null

  const frontmatterTitle = typeof frontmatterPatch.title === 'string' ? frontmatterPatch.title : null
  const fmPatch = { ...frontmatterPatch }
  delete fmPatch.title
  const fmKey = JSON.stringify(fmPatch)
  if (fmKey !== prevFmKeyRef.current) {
    prevFmKeyRef.current = fmKey
    updateEntryInTransition(updateEntry, path, fmPatch)
  }
  return frontmatterTitle
}

function syncDisplayTitle(options: {
  content: string
  frontmatterTitle: string | null
  path: string
  prevTitleKeyRef: MutableRefObject<string>
  updateEntry: UpdateEntry
}): void {
  const { content, frontmatterTitle, path, prevTitleKeyRef, updateEntry } = options
  const filename = notePathFilename(path)
  const titlePatch = deriveDisplayTitleState({ content, filename, frontmatterTitle })
  const titleKey = JSON.stringify(titlePatch)
  if (titleKey === prevTitleKeyRef.current) return

  prevTitleKeyRef.current = titleKey
  updateEntryInTransition(updateEntry, path, titlePatch)
}

function syncSavedMetadata(options: {
  metadata: Partial<EditorEntryContentMetadata>
  path: string
  prevMetadataKeyRef: MutableRefObject<string>
  updateEntry: UpdateEntry
}): void {
  const { metadata, path, prevMetadataKeyRef, updateEntry } = options
  prevMetadataKeyRef.current = JSON.stringify({
    outgoingLinks: metadata.outgoingLinks ?? [],
    wordCount: metadata.wordCount ?? 0,
  })
  updateEntryInTransition(updateEntry, path, metadata)
}

function syncDeferredEntryMetadata(options: DeferredEntryMetadataSync & {
  metadata: Partial<EditorEntryContentMetadata>
  prevFmKeyRef: MutableRefObject<string>
  prevFmSourceRef: MutableRefObject<string | null>
  prevMetadataKeyRef: MutableRefObject<string>
  prevTitleKeyRef: MutableRefObject<string>
  updateEntry: UpdateEntry
}): void {
  const {
    content,
    includeSavedMetadata,
    metadata,
    path,
    prevFmKeyRef,
    prevFmSourceRef,
    prevMetadataKeyRef,
    prevTitleKeyRef,
    updateEntry,
  } = options
  if (includeSavedMetadata) {
    syncSavedMetadata({ metadata, path, prevMetadataKeyRef, updateEntry })
  } else if (shouldSyncFrontmatterState(content)) {
    syncLiveMetadata({ metadata, path, prevMetadataKeyRef, updateEntry })
  }
  const frontmatterTitle = syncFrontmatterMetadata({
    content,
    path,
    prevFmKeyRef,
    prevFmSourceRef,
    updateEntry,
  })
  syncDisplayTitle({
    content,
    frontmatterTitle,
    path,
    prevTitleKeyRef,
    updateEntry,
  })
}

function useEditorMetadataSync(updateEntry: UpdateEntry) {
  const pendingMetadataSyncRef = useRef<DeferredEntryMetadataSync | null>(null)
  const cancelMetadataSyncRef = useRef<CancelDeferredWork | null>(null)
  const cancelMetadataRequestRef = useRef<CancelDeferredWork | null>(null)
  const prevMetadataKeyRef = useRef('')
  const prevFmSourceRef = useRef<string | null>(null)
  const prevFmKeyRef = useRef(EMPTY_DERIVED_ENTRY_STATE_KEY)
  const prevTitleKeyRef = useRef('')

  const flushMetadataSync = useCallback(() => {
    const pending = pendingMetadataSyncRef.current
    pendingMetadataSyncRef.current = null
    cancelMetadataSyncRef.current = null
    if (!pending) return

    cancelMetadataRequestRef.current?.()
    cancelMetadataRequestRef.current = requestEditorEntryMetadata(
      pending,
      (metadata) => {
        cancelMetadataRequestRef.current = null
        syncDeferredEntryMetadata({
          ...pending,
          metadata,
          prevFmKeyRef,
          prevFmSourceRef,
          prevMetadataKeyRef,
          prevTitleKeyRef,
          updateEntry,
        })
      },
      (error) => {
        cancelMetadataRequestRef.current = null
        console.warn('[editor] Skipped derived entry metadata because its worker failed:', error)
      },
    )
  }, [updateEntry])

  const scheduleMetadataSync = useCallback((path: string, content: string, includeSavedMetadata: boolean) => {
    pendingMetadataSyncRef.current = { content, includeSavedMetadata, path }
    cancelMetadataSyncRef.current?.()
    cancelMetadataRequestRef.current?.()
    cancelMetadataRequestRef.current = null
    cancelMetadataSyncRef.current = scheduleDeferredWork(flushMetadataSync)
  }, [flushMetadataSync])

  useEffect(() => () => {
    pendingMetadataSyncRef.current = null
    cancelMetadataSyncRef.current?.()
    cancelMetadataRequestRef.current?.()
    cancelMetadataSyncRef.current = null
    cancelMetadataRequestRef.current = null
  }, [])

  return scheduleMetadataSync
}

export function useEditorSaveWithLinks(config: {
  updateEntry: (path: string, patch: Partial<VaultEntry>) => void
  setTabs: Parameters<typeof useEditorSave>[0]['setTabs']
  setToastMessage: (msg: string | null) => void
  onAfterSave: () => void
  onBeforePersist?: (path: string) => void
  onNotePersisted?: (path: string, content: string) => void
  resolvePath?: (path: string) => string
  resolvePathBeforeSave?: (path: string) => Promise<string>
  canPersist?: boolean
  persistenceScope?: string | readonly string[]
  disabledSaveMessage?: string
  locale?: AppLocale
}) {
  const { updateEntry } = config
  const scheduleMetadataSync = useEditorMetadataSync(updateEntry)

  const saveContent = useCallback((path: string, content: string) => {
    scheduleMetadataSync(path, content, true)
  }, [scheduleMetadataSync])
  const editor = useEditorSave({ ...config, updateVaultContent: saveContent })
  const { handleContentChange: rawOnChange } = editor
  const handleContentChange = useCallback((path: string, content: string) => {
    const typeTemplatePatch = deriveLiveTypeTemplatePatch(content)
    if (typeTemplatePatch) {
      flushSync(() => updateEntry(path, typeTemplatePatch))
    }
    rawOnChange(path, content)
    scheduleMetadataSync(path, content, false)
  }, [rawOnChange, scheduleMetadataSync, updateEntry])

  return { ...editor, handleContentChange }
}
