import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { VaultEntry } from '../types'
import type { AppLocale } from '../lib/i18n'
import { trackFilePreviewAction, trackFilePreviewFailed, trackFilePreviewOpened } from '../lib/productAnalytics'
import { filePreviewKind, previewFileTypeLabel, type FilePreviewKind } from '../utils/filePreview'
import { useExternalMediaPreview } from '../utils/mediaPreviewRuntime'
import { focusNoteListContainer } from '../utils/neighborhoodHistory'
import { openLocalFile } from '../utils/url'
import { FilePreviewBody, FilePreviewHeader } from './FilePreviewContent'

interface FilePreviewProps {
  entry: VaultEntry
  locale?: AppLocale
  onCopyFilePath?: (path: string) => void
  onCopyDeepLink?: (entry: VaultEntry) => void
  onOpenExternalFile?: (path: string) => void
  onRevealFile?: (path: string) => void
}

interface FilePreviewState {
  canUseFileActions: boolean
  previewKind: FilePreviewKind | null
  previewPath: string | null
}

let pdfPreviewLoadSequence = 0

function nextPdfPreviewLoadKey(): string {
  pdfPreviewLoadSequence += 1
  return String(pdfPreviewLoadSequence)
}

function appendPdfPreviewLoadKey(assetSrc: string, loadKey: string): string {
  const hashIndex = assetSrc.indexOf('#')
  const baseSrc = hashIndex === -1 ? assetSrc : assetSrc.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : assetSrc.slice(hashIndex)
  const separator = baseSrc.includes('?') ? '&' : '?'
  return `${baseSrc}${separator}tolaria_pdf_preview=${encodeURIComponent(loadKey)}${hash}`
}

function filePreviewPath(path: unknown): string | null {
  if (typeof path !== 'string') return null
  return path.trim().length > 0 ? path : null
}

function filePreviewState(entry: VaultEntry): FilePreviewState {
  const previewPath = filePreviewPath(entry.path)
  if (previewPath === null) {
    return { canUseFileActions: false, previewKind: null, previewPath }
  }

  const previewEntry = previewPath === entry.path ? entry : { ...entry, path: previewPath }
  return {
    canUseFileActions: true,
    previewKind: filePreviewKind(previewEntry),
    previewPath,
  }
}

function filePreviewAssetSrc(
  previewKind: FilePreviewKind | null,
  previewPath: string | null,
  pdfPreviewLoadKey: string,
): string | null {
  if (!previewKind || previewPath === null) return null

  let src: string
  try {
    src = convertFileSrc(previewPath)
  } catch (error) {
    console.warn('[file-preview] Failed to prepare asset preview source:', error)
    return null
  }

  return previewKind === 'pdf' ? appendPdfPreviewLoadKey(src, pdfPreviewLoadKey) : src
}

function usePdfPreviewLoadKey(): string {
  const [loadKey] = useState(nextPdfPreviewLoadKey)
  return loadKey
}

function useFilePreviewFailureState(entryPath: string) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null)
  const [failedMediaPath, setFailedMediaPath] = useState<string | null>(null)

  const handleImageError = useCallback(() => {
    setFailedImagePath(entryPath)
    trackFilePreviewFailed('image')
  }, [entryPath])
  const handleAudioError = useCallback(() => {
    setFailedMediaPath(entryPath)
    trackFilePreviewFailed('audio')
  }, [entryPath])
  const handleVideoError = useCallback(() => {
    setFailedMediaPath(entryPath)
    trackFilePreviewFailed('video')
  }, [entryPath])
  const handlePdfError = useCallback(() => {
    trackFilePreviewFailed('pdf')
  }, [])

  return {
    imageFailed: failedImagePath === entryPath,
    mediaFailed: failedMediaPath === entryPath,
    handleImageError,
    handleAudioError,
    handleVideoError,
    handlePdfError,
  }
}

function useFilePreviewActions({
  entry,
  entryPath,
  onCopyFilePath,
  onCopyDeepLink,
  onOpenExternalFile,
  onRevealFile,
  previewKind,
}: {
  entry: VaultEntry
  entryPath: string
  onCopyFilePath?: (path: string) => void
  onCopyDeepLink?: (entry: VaultEntry) => void
  onOpenExternalFile?: (path: string) => void
  onRevealFile?: (path: string) => void
  previewKind: FilePreviewKind | null
}) {
  const handleOpenExternal = useCallback(() => {
    trackFilePreviewAction('open_external', previewKind)
    if (onOpenExternalFile) {
      onOpenExternalFile(entryPath)
      return
    }

    void openLocalFile(entryPath).catch((error) => {
      console.warn('Failed to open file with default app:', error)
    })
  }, [entryPath, onOpenExternalFile, previewKind])

  const handleRevealFile = useCallback(() => {
    trackFilePreviewAction('reveal', previewKind)
    onRevealFile?.(entryPath)
  }, [entryPath, onRevealFile, previewKind])

  const handleCopyFilePath = useCallback(() => {
    trackFilePreviewAction('copy_path', previewKind)
    onCopyFilePath?.(entryPath)
  }, [entryPath, onCopyFilePath, previewKind])

  const handleCopyDeepLink = useCallback(() => {
    trackFilePreviewAction('copy_deep_link', previewKind)
    onCopyDeepLink?.(entry)
  }, [entry, onCopyDeepLink, previewKind])

  return {
    handleOpenExternal,
    handleRevealFile,
    handleCopyFilePath,
    handleCopyDeepLink,
  }
}

function isMediaPreviewKind(previewKind: FilePreviewKind | null): boolean {
  return previewKind === 'audio' || previewKind === 'video'
}

function previewKindForBody(
  previewKind: FilePreviewKind | null,
  mediaFailed: boolean,
  externalMediaPreview: boolean,
): FilePreviewKind | null {
  if (mediaFailed || (externalMediaPreview && isMediaPreviewKind(previewKind))) return null
  return previewKind
}

function FilePreviewLayout(options: {
  actions: ReturnType<typeof useFilePreviewActions>
  assetSrc: string | null
  canUseFileActions: boolean
  entry: VaultEntry
  externalMediaPreview: boolean
  failures: ReturnType<typeof useFilePreviewFailureState>
  fileTypeLabel: string
  locale: AppLocale
  onCopyDeepLink?: (entry: VaultEntry) => void
  onCopyFilePath?: (path: string) => void
  onRevealFile?: (path: string) => void
  previewKind: FilePreviewKind | null
  previewRef: RefObject<HTMLElement | null>
}) {
  const { actions, assetSrc, canUseFileActions, entry, externalMediaPreview, failures, fileTypeLabel, locale,
    onCopyDeepLink, onCopyFilePath, onRevealFile, previewKind, previewRef } = options
  return (
    <section ref={previewRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
      data-testid="file-preview" aria-label={`Preview ${entry.title}`}>
      <FilePreviewHeader entry={entry} previewKind={previewKind} canUseFileActions={canUseFileActions}
        fileTypeLabel={fileTypeLabel} locale={locale} onOpenExternal={actions.handleOpenExternal}
        onRevealFile={onRevealFile ? actions.handleRevealFile : undefined}
        onCopyFilePath={onCopyFilePath ? actions.handleCopyFilePath : undefined}
        onCopyDeepLink={onCopyDeepLink ? actions.handleCopyDeepLink : undefined} />
      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <FilePreviewBody entry={entry}
          previewKind={previewKindForBody(previewKind, failures.mediaFailed, externalMediaPreview)}
          assetSrc={assetSrc} imageFailed={failures.imageFailed} canOpenExternal={canUseFileActions}
          onImageError={failures.handleImageError} onAudioError={failures.handleAudioError}
          onVideoError={failures.handleVideoError} onPdfError={failures.handlePdfError}
          onOpenExternal={actions.handleOpenExternal} />
      </div>
    </section>
  )
}

export function FilePreview({
  entry,
  locale = 'en',
  onCopyFilePath,
  onCopyDeepLink,
  onOpenExternalFile,
  onRevealFile,
}: FilePreviewProps) {
  const previewRef = useRef<HTMLElement | null>(null)
  const { canUseFileActions, previewKind, previewPath } = filePreviewState(entry)
  const pdfPreviewLoadKey = usePdfPreviewLoadKey()
  const assetSrc = useMemo(() => {
    return filePreviewAssetSrc(previewKind, previewPath, pdfPreviewLoadKey)
  }, [pdfPreviewLoadKey, previewKind, previewPath])
  const fileTypeLabel = previewFileTypeLabel(entry)
  const externalMediaPreview = useExternalMediaPreview()
  const failures = useFilePreviewFailureState(previewPath ?? '')
  const actions = useFilePreviewActions({
    entry,
    entryPath: previewPath ?? '',
    onCopyFilePath,
    onCopyDeepLink,
    onOpenExternalFile,
    onRevealFile,
    previewKind,
  })

  useEffect(() => {
    void previewPath
    trackFilePreviewOpened(previewKind)
  }, [previewPath, previewKind])

  useEffect(() => {
    previewRef.current?.setAttribute('tabindex', '0')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      focusNoteListContainer(document)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <FilePreviewLayout actions={actions} assetSrc={assetSrc} canUseFileActions={canUseFileActions}
    entry={entry} externalMediaPreview={externalMediaPreview} failures={failures} fileTypeLabel={fileTypeLabel}
    locale={locale} onCopyDeepLink={onCopyDeepLink} onCopyFilePath={onCopyFilePath} onRevealFile={onRevealFile}
    previewKind={previewKind} previewRef={previewRef} />
}
