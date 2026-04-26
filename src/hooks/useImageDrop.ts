import { useEffect, useRef, useState, type RefObject } from 'react'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'
import { useTauriDragDropEvent, type TauriDragDropEvent } from './useTauriDragDropEvent'

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff']

type ImageUrlHandler = (url: string) => void

function hasImageFiles(dt: DataTransfer): boolean {
  for (let i = 0; i < dt.items.length; i++) {
    if (dt.items[i].kind === 'file' && IMAGE_MIME_TYPES.includes(dt.items[i].type)) return true
  }
  return false
}

function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.includes(ext)
}

/** Upload an image file — saves to vault/attachments in Tauri, returns data URL in browser */
export async function uploadImageFile(file: File, vaultPath?: string): Promise<string> {
  if (isTauri() && vaultPath) {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    const savedPath = await invoke<string>('save_image', {
      vaultPath,
      filename: file.name,
      data: base64,
    })
    return convertFileSrc(savedPath)
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Copy a dropped file (by OS path) into vault/attachments and return its asset URL. */
async function copyImageToVault(sourcePath: string, vaultPath: string): Promise<string> {
  const savedPath = await invoke<string>('copy_image_to_vault', { vaultPath, sourcePath })
  return convertFileSrc(savedPath)
}

function insertDroppedImages(
  imagePaths: string[],
  vaultPath: string | undefined,
  onImageUrl: ImageUrlHandler | undefined,
): void {
  if (imagePaths.length === 0) return
  if (!vaultPath || !onImageUrl) return

  for (const sourcePath of imagePaths) {
    void copyImageToVault(sourcePath, vaultPath).then(onImageUrl)
  }
}

interface UseImageDropOptions {
  containerRef: RefObject<HTMLDivElement | null>
  /** Called with an asset URL for each image dropped via Tauri native drag-drop. */
  onImageUrl?: (url: string) => void
  vaultPath?: string
}

function useLatestImageDropRefs(onImageUrl: ImageUrlHandler | undefined, vaultPath: string | undefined) {
  const onImageUrlRef = useRef(onImageUrl)
  const vaultPathRef = useRef(vaultPath)

  useEffect(() => { onImageUrlRef.current = onImageUrl }, [onImageUrl])
  useEffect(() => { vaultPathRef.current = vaultPath }, [vaultPath])

  return { onImageUrlRef, vaultPathRef }
}

function useHtmlImageDropFeedback(
  containerRef: RefObject<HTMLDivElement | null>,
  setIsDragOver: (isDragOver: boolean) => void,
) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer || !hasImageFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      if (!container.contains(e.relatedTarget as Node)) setIsDragOver(false)
    }

    const handleDrop = () => setIsDragOver(false)

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('drop', handleDrop)
    }
  }, [containerRef, setIsDragOver])
}

function handleNativeImageDrop(
  event: TauriDragDropEvent,
  vaultPath: string | undefined,
  onImageUrl: ImageUrlHandler | undefined,
): void {
  if (event.payload.type !== 'drop') return
  insertDroppedImages(event.payload.paths.filter(isImagePath), vaultPath, onImageUrl)
}

export function useImageDrop({ containerRef, onImageUrl, vaultPath }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false)
  const { onImageUrlRef, vaultPathRef } = useLatestImageDropRefs(onImageUrl, vaultPath)

  useHtmlImageDropFeedback(containerRef, setIsDragOver)
  useTauriDragDropEvent((event) => {
    setIsDragOver(false)
    handleNativeImageDrop(event, vaultPathRef.current, onImageUrlRef.current)
  })

  return { isDragOver }
}
