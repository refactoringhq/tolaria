/** Minimum natural dimension (px) for an image to be considered viewer-worthy.
 *  Filters out tracking pixels and 1×1 spacers that share the <img> tag. */
const MIN_VIEWABLE_DIMENSION = 16

export function getDoubleClickedImageSrc(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLImageElement)) return null
  if (!target.src) return null
  if (isTooSmallToView(target)) return null
  return target.src
}

function isTooSmallToView(image: HTMLImageElement): boolean {
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (width === 0 && height === 0) return false
  return width < MIN_VIEWABLE_DIMENSION && height < MIN_VIEWABLE_DIMENSION
}
