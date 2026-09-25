import type { ReactNode } from 'react'
import {
  ArrowSquareOut,
  ClipboardText,
  FileDashed,
  FilePdf,
  FolderOpen,
  ImageSquare,
  Link,
  SpeakerHigh,
  Video,
  WarningCircle,
} from '@phosphor-icons/react'
import { translate, type AppLocale } from '../lib/i18n'
import type { VaultEntry } from '../types'
import type { FilePreviewKind } from '../utils/filePreview'
import { PdfFilePreview } from './PdfFilePreview'
import { Button } from './ui/button'

interface FilePreviewFallbackProps {
  icon: 'warning' | 'file'
  title: string
  description: string
  canOpenExternal?: boolean
  onOpenExternal: () => void
}

const EMPTY_CAPTIONS_TRACK = 'data:text/vtt,WEBVTT'

function fallbackContentForPreviewKind(
  previewKind: FilePreviewKind | null,
): Omit<FilePreviewFallbackProps, 'onOpenExternal'> {
  if (previewKind === 'image') {
    return {
      icon: 'warning',
      title: 'Image preview failed',
      description: 'Tolaria could not render this image file in the preview.',
    }
  }

  if (previewKind === 'pdf') {
    return {
      icon: 'warning',
      title: 'PDF preview failed',
      description: 'Tolaria could not render this PDF file in the preview.',
    }
  }

  return {
    icon: 'file',
    title: 'Preview unavailable',
    description: 'Tolaria does not have an in-app preview for this file type.',
  }
}

const FILE_PREVIEW_ICONS = new Map<FilePreviewKind, ReactNode>([
  ['image', <ImageSquare size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />],
  ['pdf', <FilePdf size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />],
  ['audio', <SpeakerHigh size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />],
  ['video', <Video size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />],
])
const DEFAULT_FILE_PREVIEW_ICON = (
  <FileDashed size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
)

function FilePreviewHeaderIcon({ previewKind }: { previewKind: FilePreviewKind | null }) {
  return previewKind === null ? DEFAULT_FILE_PREVIEW_ICON : FILE_PREVIEW_ICONS.get(previewKind) ?? DEFAULT_FILE_PREVIEW_ICON
}

function FilePreviewFallback({
  icon,
  title,
  description,
  canOpenExternal = true,
  onOpenExternal,
}: FilePreviewFallbackProps) {
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
      <Button type="button" variant="outline" size="sm" onClick={onOpenExternal} disabled={!canOpenExternal}>
        <ArrowSquareOut size={15} />
        Open in default app
      </Button>
    </div>
  )
}

export function FilePreviewHeader(options: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  canUseFileActions: boolean
  fileTypeLabel: string
  locale?: AppLocale
  onOpenExternal: () => void
  onRevealFile?: () => void
  onCopyFilePath?: () => void
  onCopyDeepLink?: () => void
}) {
  const {
    entry,
    previewKind,
    canUseFileActions,
    fileTypeLabel,
    locale = 'en',
    onOpenExternal,
    onRevealFile,
    onCopyFilePath,
    onCopyDeepLink,
  } = options
  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        <FilePreviewHeaderIcon previewKind={previewKind} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[14px] font-semibold text-foreground">{entry.title}</h1>
          <p className="m-0 text-[11px] text-muted-foreground">{fileTypeLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRevealFile && (
          <Button type="button" variant="ghost" size="sm" onClick={onRevealFile} disabled={!canUseFileActions}>
            <FolderOpen size={15} />
            Reveal
          </Button>
        )}
        {onCopyFilePath && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopyFilePath} disabled={!canUseFileActions}>
            <ClipboardText size={15} />
            Copy path
          </Button>
        )}
        {onCopyDeepLink && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopyDeepLink} disabled={!canUseFileActions}>
            <Link size={15} />
            {translate(locale, 'filePreview.copyDeepLink')}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onOpenExternal} disabled={!canUseFileActions}>
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

function FilePreviewMediaFrame({ children, video = false }: { children: ReactNode; video?: boolean }) {
  return (
    <div
      className={`flex h-full items-center justify-center ${video ? 'min-h-[320px] bg-black p-4' : 'min-h-[260px] p-6'}`}
    >
      {children}
    </div>
  )
}

function FilePreviewMedia({
  entry,
  mediaKind,
  mediaSrc,
  onMediaError,
}: {
  entry: VaultEntry
  mediaKind: 'audio' | 'video'
  mediaSrc: string
  onMediaError: () => void
}) {
  if (mediaKind === 'audio') {
    return (
      <FilePreviewMediaFrame>
        <audio
          controls
          preload="metadata"
          src={mediaSrc}
          className="w-full max-w-2xl"
          data-testid="audio-file-preview"
          onError={onMediaError}
        >
          <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" default />
        </audio>
      </FilePreviewMediaFrame>
    )
  }

  return (
    <FilePreviewMediaFrame video>
      <video
        controls
        preload="metadata"
        src={mediaSrc}
        title={entry.title}
        className="max-h-full max-w-full"
        data-testid="video-file-preview"
        onError={onMediaError}
      >
        <track kind="captions" src={EMPTY_CAPTIONS_TRACK} srcLang="en" label="No captions available" default />
      </video>
    </FilePreviewMediaFrame>
  )
}

function shouldRenderImagePreview(isImage: boolean, imageSrc: string | null, imageFailed: boolean): imageSrc is string {
  return isImage && imageSrc !== null && !imageFailed
}

export function FilePreviewBody(options: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  assetSrc: string | null
  imageFailed: boolean
  canOpenExternal: boolean
  onImageError: () => void
  onAudioError: () => void
  onVideoError: () => void
  onPdfError: () => void
  onOpenExternal: () => void
}) {
  const {
    entry,
    previewKind,
    assetSrc,
    imageFailed,
    canOpenExternal,
    onImageError,
    onAudioError,
    onVideoError,
    onPdfError,
    onOpenExternal,
  } = options
  if (shouldRenderImagePreview(previewKind === 'image', assetSrc, imageFailed)) {
    return <FilePreviewImage entry={entry} imageSrc={assetSrc} onImageError={onImageError} />
  }

  if (previewKind === 'pdf' && assetSrc !== null) {
    const fallback = fallbackContentForPreviewKind('pdf')
    return (
      <PdfFilePreview
        key={assetSrc}
        source={assetSrc}
        title={entry.title}
        onError={onPdfError}
        fallback={
          <FilePreviewFallback
            icon={fallback.icon}
            title={fallback.title}
            description={fallback.description}
            onOpenExternal={onOpenExternal}
          />
        }
      />
    )
  }

  if (previewKind === 'audio' && assetSrc !== null) {
    return <FilePreviewMedia entry={entry} mediaKind="audio" mediaSrc={assetSrc} onMediaError={onAudioError} />
  }

  if (previewKind === 'video' && assetSrc !== null) {
    return <FilePreviewMedia entry={entry} mediaKind="video" mediaSrc={assetSrc} onMediaError={onVideoError} />
  }

  const fallback = fallbackContentForPreviewKind(previewKind)

  return (
    <FilePreviewFallback
      icon={fallback.icon}
      title={fallback.title}
      description={fallback.description}
      canOpenExternal={canOpenExternal}
      onOpenExternal={onOpenExternal}
    />
  )
}
