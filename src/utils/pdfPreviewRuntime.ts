import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFPageProxy, PageViewport, RenderTask } from 'pdfjs-dist/types/src/pdf'

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

// Previews load only app-generated sources: vault assets, in-memory blobs, or the app's own origin.
const LOCAL_PDF_PROTOCOLS = new Set(['asset:', 'blob:', 'data:'])
const ASSET_ORIGIN = 'http://asset.localhost'

function isAppPdfSource(url: URL): boolean {
  if (LOCAL_PDF_PROTOCOLS.has(url.protocol)) return true
  return url.origin === ASSET_ORIGIN || url.origin === window.location.origin
}

function assertSupportedPdfSource(source: string): void {
  if (!isAppPdfSource(new URL(source, window.location.href))) throw new Error('Unsupported PDF source')
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
