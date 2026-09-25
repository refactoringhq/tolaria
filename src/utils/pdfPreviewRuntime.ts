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

export async function loadPdfDocument(source: string): Promise<PdfDocument> {
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
