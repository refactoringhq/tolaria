import { invoke } from '@tauri-apps/api/core'
import { trackEvent } from '../lib/telemetry'
import { isTauri } from '../mock-tauri'
import { webAttachmentPath } from '../utils/vaultAttachments'
import { isPathInsideVaultRoot } from '../utils/vaultPathContainment'
import { getCachedNoteContentEntry } from './noteContentCache'

// 移除前的宽限期：期间撤销、剪切后粘贴等操作重新引用附件时，文件根本不会被动。
const ATTACHMENT_REMOVAL_DELAY_MS = 10_000
const MARKDOWN_DESTINATION_PATTERN = /\]\(\s*(<[^>\n]*>|[^)\n]*)\)/g
const HTML_SOURCE_PATTERN = /\b(?:src|href)\s*=\s*["']([^"'\n]*)["']/gi
const MARKDOWN_TITLE_PATTERN = /\s+(["']).*\1$/

type AttachmentPath = string
type CleanupKey = string
type TimerHandle = ReturnType<typeof setTimeout>

type AttachmentRemovalResult = {
  backupPath: string | null
  removed: boolean
}

type RemovedAttachment = {
  attachmentPath: AttachmentPath
  backupPath: string
  vaultPath: string
}

type AttachmentTarget = {
  attachmentPath: AttachmentPath
  vaultPath: string
}

export type NoteAttachmentSnapshot = {
  content: string
  path: string
  vaultPath: string
}

export type AttachmentCleanupDependencies = {
  delayMs: number
  enabled: () => boolean
  invokeCommand: <T>(command: string, args: Record<string, unknown>) => Promise<T>
  readCachedContent: (path: string) => string | null
  track: (event: string) => void
}

function destinationUrl(rawDestination: string): string {
  const trimmed = rawDestination.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return trimmed.slice(1, -1)
  return trimmed.replace(MARKDOWN_TITLE_PATTERN, '')
}

function collectAttachmentPaths(content: string, pattern: RegExp, references: Set<AttachmentPath>): void {
  for (const match of content.matchAll(pattern)) {
    const attachmentPath = webAttachmentPath({ url: destinationUrl(match[1]) })
    if (attachmentPath) references.add(attachmentPath)
  }
}

/** 笔记 Markdown 中以 `attachments/...` 形式引用的附件（库内相对路径）。 */
export function noteAttachmentReferences(content: string): Set<AttachmentPath> {
  const references = new Set<AttachmentPath>()
  if (!content.includes('attachments/')) return references
  collectAttachmentPaths(content, MARKDOWN_DESTINATION_PATTERN, references)
  collectAttachmentPaths(content, HTML_SOURCE_PATTERN, references)
  return references
}

/** 包含该笔记的库根目录；多库嵌套时取最深的那个。 */
export function vaultRootForNote(path: string, scope: string | readonly string[] | undefined): string | null {
  const roots = typeof scope === 'string' ? [scope] : scope ?? []
  const matches = roots.filter(root => root.trim() !== '' && isPathInsideVaultRoot(path, root))
  return matches.reduce<string | null>(
    (deepest, root) => (deepest === null || root.length > deepest.length ? root : deepest),
    null,
  )
}

function cleanupKey({ attachmentPath, vaultPath }: AttachmentTarget): CleanupKey {
  return `${vaultPath}\u0000${attachmentPath}`
}

function removedReferences(previous: Set<AttachmentPath>, next: Set<AttachmentPath>): AttachmentPath[] {
  return [...previous].filter(reference => !next.has(reference))
}

export function createAttachmentCleanup(dependencies: AttachmentCleanupDependencies) {
  const knownReferences = new Map<string, Set<AttachmentPath>>()
  const pendingRemovals = new Map<CleanupKey, TimerHandle>()
  const inflightRemovals = new Map<CleanupKey, Promise<void>>()
  const removedAttachments = new Map<CleanupKey, RemovedAttachment>()

  async function removeAttachment(target: AttachmentTarget): Promise<void> {
    try {
      const result = await dependencies.invokeCommand<AttachmentRemovalResult>(
        'remove_unreferenced_attachment',
        { ...target },
      )
      if (!result.removed || !result.backupPath) return
      removedAttachments.set(cleanupKey(target), { ...target, backupPath: result.backupPath })
      dependencies.track('attachment_removed')
    } catch (error) {
      console.warn('[attachment] Failed to remove unreferenced attachment:', error)
    }
  }

  function runRemoval(target: AttachmentTarget): void {
    const key = cleanupKey(target)
    pendingRemovals.delete(key)
    const removal = removeAttachment(target).finally(() => inflightRemovals.delete(key))
    inflightRemovals.set(key, removal)
  }

  function scheduleRemoval(target: AttachmentTarget): void {
    const key = cleanupKey(target)
    if (pendingRemovals.has(key)) return
    pendingRemovals.set(key, setTimeout(() => runRemoval(target), dependencies.delayMs))
  }

  async function restoreAttachment(key: CleanupKey): Promise<void> {
    const removed = removedAttachments.get(key)
    if (!removed) return
    removedAttachments.delete(key)
    try {
      await dependencies.invokeCommand<string>('restore_removed_attachment', { ...removed })
      dependencies.track('attachment_restored')
    } catch (error) {
      console.warn('[attachment] Failed to restore removed attachment:', error)
    }
  }

  function reclaimAttachment(target: AttachmentTarget): void {
    const key = cleanupKey(target)
    const timer = pendingRemovals.get(key)
    if (timer !== undefined) {
      clearTimeout(timer)
      pendingRemovals.delete(key)
    }
    const inflight = inflightRemovals.get(key) ?? Promise.resolve()
    void inflight.then(() => restoreAttachment(key))
  }

  function hasTrackedAttachments(): boolean {
    return pendingRemovals.size > 0 || inflightRemovals.size > 0 || removedAttachments.size > 0
  }

  function reclaimReferences(vaultPath: string, references: Set<AttachmentPath>): void {
    for (const attachmentPath of references) reclaimAttachment({ attachmentPath, vaultPath })
  }

  /** 保存前记录笔记上一次落盘时的附件引用（若尚未记录）。 */
  function rememberBeforePersist(path: string): void {
    if (knownReferences.has(path)) return
    const cached = dependencies.readCachedContent(path)
    if (typeof cached === 'string') knownReferences.set(path, noteAttachmentReferences(cached))
  }

  /** 笔记落盘后：重新出现的引用取消移除或恢复文件，消失的引用排队移除。 */
  function handlePersisted({ content, path, vaultPath }: NoteAttachmentSnapshot): void {
    const next = noteAttachmentReferences(content)
    const previous = knownReferences.get(path)
    knownReferences.set(path, next)
    if (!dependencies.enabled()) return
    reclaimReferences(vaultPath, next)
    if (!previous) return
    for (const attachmentPath of removedReferences(previous, next)) {
      scheduleRemoval({ attachmentPath, vaultPath })
    }
  }

  /** 编辑过程中（尚未保存）一旦重新引用附件，就立即取消移除或恢复文件。 */
  function handleContentChanged({ content, vaultPath }: NoteAttachmentSnapshot): void {
    if (!dependencies.enabled() || !hasTrackedAttachments()) return
    reclaimReferences(vaultPath, noteAttachmentReferences(content))
  }

  return { handleContentChanged, handlePersisted, rememberBeforePersist }
}

export const attachmentCleanup = createAttachmentCleanup({
  delayMs: ATTACHMENT_REMOVAL_DELAY_MS,
  enabled: isTauri,
  invokeCommand: (command, args) => invoke(command, args),
  readCachedContent: (path) => {
    const value = getCachedNoteContentEntry(path)?.value
    return typeof value === 'string' ? value : null
  },
  track: (event) => trackEvent(event),
})
