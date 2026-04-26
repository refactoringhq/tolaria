import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ArrowSquareOut, ClipboardText, FileDashed, FolderOpen, ImageSquare, WarningCircle } from '@phosphor-icons/react'
import type { VaultEntry } from '../types'
import { isImagePreviewEntry, previewFileTypeLabel } from '../utils/filePreview'
import { focusNoteListContainer } from '../utils/neighborhoodHistory'
import { openLocalFile } from '../utils/url'
import { Button } from './ui/button'

interface FilePreviewProps {
  entry: VaultEntry
  onCopyFilePath?: (path: string) => void
  onOpenExternalFile?: (path: string) => void
  onRevealFile?: (path: string) => void
}

interface FilePreviewFallbackProps {
  icon: 'warning' | 'file'
  title: string
  description: string
  onOpenExternal: () => void
}

function FilePreviewFallback({ icon, title, description, onOpenExternal }: FilePreviewFallbackProps) {
  const Icon = icon === 'warning' ? WarningCircle : FileDashed

  return (
    <div
      className="flex h-full min-h-[260px] flex-col items-center justify-center gap-4 px-8 text-center"
      data-testid="file-preview-fallback"
    >
      <Icon size={34} className="text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="m-0 text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="m-0 max-w-md text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onOpenExternal}>
        <ArrowSquareOut size={15} />
        Open in default app
      </Button>
    </div>
  )
}

function FilePreviewHeader({
  entry,
  isImage,
  fileTypeLabel,
  onOpenExternal,
  onRevealFile,
  onCopyFilePath,
}: {
  entry: VaultEntry
  isImage: boolean
  fileTypeLabel: string
  onOpenExternal: () => void
  onRevealFile?: () => void
  onCopyFilePath?: () => void
}) {
  const HeaderIcon = isImage ? ImageSquare : FileDashed

  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        <HeaderIcon size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[14px] font-semibold text-foreground">{entry.title}</h1>
          <p className="m-0 text-[11px] text-muted-foreground">{fileTypeLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRevealFile && (
          <Button type="button" variant="ghost" size="sm" onClick={onRevealFile}>
            <FolderOpen size={15} />
            Reveal
          </Button>
        )}
        {onCopyFilePath && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopyFilePath}>
            <ClipboardText size={15} />
            Copy path
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onOpenExternal}>
          <ArrowSquareOut size={15} />
          Open
        </Button>
      </div>
    </div>
  )
}

function FilePreviewImage({
  entry,
  imageSrc,
  onImageError,
}: {
  entry: VaultEntry
  imageSrc: string
  onImageError: () => void
}) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center p-6">
      <img
        src={imageSrc}
        alt={entry.title}
        className="max-h-full max-w-full object-contain"
        data-testid="image-file-preview"
        onError={onImageError}
      />
    </div>
  )
}

function shouldRenderImagePreview(isImage: boolean, imageSrc: string | null, imageFailed: boolean): imageSrc is string {
  return isImage && imageSrc !== null && !imageFailed
}

function FilePreviewBody({
  entry,
  isImage,
  imageSrc,
  imageFailed,
  onImageError,
  onOpenExternal,
}: {
  entry: VaultEntry
  isImage: boolean
  imageSrc: string | null
  imageFailed: boolean
  onImageError: () => void
  onOpenExternal: () => void
}) {
  if (shouldRenderImagePreview(isImage, imageSrc, imageFailed)) {
    return <FilePreviewImage entry={entry} imageSrc={imageSrc} onImageError={onImageError} />
  }

  return (
    <FilePreviewFallback
      icon={isImage ? 'warning' : 'file'}
      title={isImage ? 'Image preview failed' : 'Preview unavailable'}
      description={
        isImage
          ? 'Tolaria could not render this image file in the preview.'
          : 'Tolaria does not have an in-app preview for this file type.'
      }
      onOpenExternal={onOpenExternal}
    />
  )
}

export function FilePreview({
  entry,
  onCopyFilePath,
  onOpenExternalFile,
  onRevealFile,
}: FilePreviewProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const isImage = isImagePreviewEntry(entry)
  const imageSrc = useMemo(() => (isImage ? convertFileSrc(entry.path) : null), [entry.path, isImage])
  const fileTypeLabel = previewFileTypeLabel(entry)
  const handleImageError = useCallback(() => setImageFailed(true), [])

  const handleOpenExternal = useCallback(() => {
    if (onOpenExternalFile) {
      onOpenExternalFile(entry.path)
      return
    }

    void openLocalFile(entry.path).catch((error) => {
      console.warn('Failed to open file with default app:', error)
    })
  }, [entry.path, onOpenExternalFile])

  const handleRevealFile = useCallback(() => {
    onRevealFile?.(entry.path)
  }, [entry.path, onRevealFile])

  const handleCopyFilePath = useCallback(() => {
    onCopyFilePath?.(entry.path)
  }, [entry.path, onCopyFilePath])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    focusNoteListContainer(document)
  }, [])

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
      data-testid="file-preview"
      tabIndex={0}
      role="group"
      aria-label={`Preview ${entry.title}`}
      onKeyDown={handleKeyDown}
    >
      <FilePreviewHeader
        entry={entry}
        isImage={isImage}
        fileTypeLabel={fileTypeLabel}
        onOpenExternal={handleOpenExternal}
        onRevealFile={onRevealFile ? handleRevealFile : undefined}
        onCopyFilePath={onCopyFilePath ? handleCopyFilePath : undefined}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <FilePreviewBody
          entry={entry}
          isImage={isImage}
          imageSrc={imageSrc}
          imageFailed={imageFailed}
          onImageError={handleImageError}
          onOpenExternal={handleOpenExternal}
        />
      </div>
    </section>
  )
}
