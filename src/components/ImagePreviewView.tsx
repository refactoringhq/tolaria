import { convertFileSrc } from '@tauri-apps/api/core'
import { isTauri } from '../mock-tauri'

interface ImagePreviewViewProps {
  /** Absolute path to the vault root */
  vaultPath: string
  /** Vault-relative path to the image file */
  path: string
}

/**
 * Full-area image viewer for standalone image files (PNG, JPG, SVG, etc.).
 * Renders the image centered with natural dimensions, scrollable if larger than the pane.
 */
export function ImagePreviewView({ vaultPath, path }: ImagePreviewViewProps) {
  const absolutePath = `${vaultPath}/${path}`
  const src = isTauri() ? convertFileSrc(absolutePath) : path

  return (
    <div
      className="flex flex-1 items-center justify-center overflow-auto"
      style={{ padding: '2rem', minHeight: 0 }}
      data-testid="image-preview-view"
    >
      <img
        src={src}
        alt=""
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          borderRadius: '0.375rem',
          display: 'block',
        }}
      />
    </div>
  )
}
