const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'tiff', 'tif',
])

/**
 * Returns true if the path's extension is a viewable image format.
 * Used to unlock binary image files for preview instead of blocking them.
 */
export function isImagePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}
