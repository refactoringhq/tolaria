import type { VaultEntry } from '../types'

const IMAGE_PREVIEW_EXTENSIONS = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
])

function extensionFromFilename(filename: string): string | null {
  const lastSegment = filename.split(/[\\/]/u).pop() ?? filename
  const dotIndex = lastSegment.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) return null
  return lastSegment.slice(dotIndex + 1).toLowerCase()
}

export function previewExtension(entry: Pick<VaultEntry, 'filename' | 'path'>): string | null {
  return extensionFromFilename(entry.filename) ?? extensionFromFilename(entry.path)
}

export function isImagePreviewEntry(entry: Pick<VaultEntry, 'fileKind' | 'filename' | 'path'>): boolean {
  if (entry.fileKind !== 'binary') return false
  const extension = previewExtension(entry)
  return extension ? IMAGE_PREVIEW_EXTENSIONS.has(extension) : false
}

export function previewFileTypeLabel(entry: Pick<VaultEntry, 'filename' | 'path'>): string {
  const extension = previewExtension(entry)
  return extension ? `${extension.toUpperCase()} file` : 'File'
}
