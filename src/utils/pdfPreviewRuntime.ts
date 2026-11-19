import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFPageProxy, PageViewport, RenderTask } from 'pdfjs-dist/types/src/pdf'

export type PdfPage = PDFPageProxy
export type PdfViewport = PageViewport
export type PdfRenderTask = RenderTask

export interface PdfDocument {
  destroy: () => void | Promise<void>
  getPage: (pageNumber: number) => Promise<PDFPageProxy>
  numPages: number
}

export function pdfCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('PDF canvas is unavailable')
  return context
}

// Previews load only app-generated sources: vault asset URLs, or blobs this app created.
const ASSET_ORIGINS = new Set(['http://asset.localhost', 'https://asset.localhost'])

function isAppPdfSource(url: URL): boolean {
  if (url.username || url.password || url.port) return false
  if (url.protocol === 'asset:') return url.host === 'localhost'
  if (url.protocol === 'blob:') return url.origin === window.location.origin
  return ASSET_ORIGINS.has(url.origin)
}

export function isSupportedPdfSource(source: string): boolean {
  try {
    return isAppPdfSource(new URL(source, window.location.href))
  } catch {
    return false
  }
}

function assertSupportedPdfSource(source: string): void {
  if (!isSupportedPdfSource(source)) throw new Error('Unsupported PDF source')
}

export async function loadPdfDocument(source: string): Promise<PdfDocument> {
  assertSupportedPdfSource(source)
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ url: source })
  const document = await loadingTask.promise
  return {
    destroy: () => loadingTask.destroy(),
    getPage: (pageNumber) => document.getPage(pageNumber),
    numPages: document.numPages,
  }
}
