import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useNearViewportOnce } from '../hooks/useNearViewportOnce'
import { loadPdfDocument, type PdfDocument, type PdfRenderTask, pdfCanvasContext } from '../utils/pdfPreviewRuntime'

interface PdfFilePreviewProps {
  fallback: ReactNode
  onError: () => void
  source: string
  title: string
}

interface PdfPageCanvasProps {
  availableWidth: number
  document: PdfDocument
  onError: () => void
  pageNumber: number
  title: string
}

interface PdfPageRenderOptions extends Omit<PdfPageCanvasProps, 'title'> {
  canvas: HTMLCanvasElement
}

interface PdfPageRenderState {
  cancelled: boolean
  task: PdfRenderTask | null
}

const DEFAULT_PAGE_WIDTH = 800
const MAX_PAGE_WIDTH = 1_200
const PAGE_HORIZONTAL_PADDING = 48
// A crafted PDF can claim any page count; preview at most this many pages.
const MAX_PREVIEW_PAGES = 2_000
// Stay within the smallest common webview canvas limit (4096 x 4096).
const MAX_CANVAS_PIXELS = 16_777_216

function usePreviewWidth(previewRef: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_PAGE_WIDTH)

  useEffect(() => {
    const element = previewRef.current
    if (!element) return undefined

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries
      setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [previewRef])

  return width
}

function previewPageCount(pageCount = 0): number {
  return Number.isSafeInteger(pageCount) ? Math.min(Math.max(pageCount, 0), MAX_PREVIEW_PAGES) : 0
}

function renderScale(pageWidth: number, availableWidth: number): number {
  const targetWidth = Math.min(Math.max(availableWidth - PAGE_HORIZONTAL_PADDING, 1), MAX_PAGE_WIDTH)
  return targetWidth / pageWidth
}

function canvasOutputScale(viewport: { height: number; width: number }): number {
  const area = viewport.width * viewport.height
  if (!Number.isFinite(area) || area <= 0) throw new Error('Invalid PDF page size')
  return Math.min(Math.max(window.devicePixelRatio, 1), Math.sqrt(MAX_CANVAS_PIXELS / area))
}

function configureCanvas(canvas: HTMLCanvasElement, viewport: { height: number; width: number }): number {
  const outputScale = canvasOutputScale(viewport)
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  return outputScale
}

async function paintPdfPage(options: PdfPageRenderOptions, state: PdfPageRenderState): Promise<void> {
  const { availableWidth, canvas, document, pageNumber } = options
  const page = await document.getPage(pageNumber)
  try {
    if (state.cancelled) return
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: renderScale(baseViewport.width, availableWidth) })
    const outputScale = configureCanvas(canvas, viewport)
    state.task = page.render({
      canvas,
      canvasContext: pdfCanvasContext(canvas),
      transform: [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    })
    await state.task.promise
  } finally {
    page.cleanup()
  }
}

function startPdfPageRender(options: PdfPageRenderOptions): () => void {
  const state: PdfPageRenderState = { cancelled: false, task: null }
  void paintPdfPage(options, state).catch(() => {
    if (!state.cancelled) options.onError()
  })
  return () => {
    state.cancelled = true
    state.task?.cancel()
  }
}

function PdfPageCanvas({ availableWidth, document, onError, pageNumber, title }: PdfPageCanvasProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = useNearViewportOnce(pageRef, { eager: pageNumber === 1 })

  useEffect(() => {
    if (!visible) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    return startPdfPageRender({ availableWidth, canvas, document, onError, pageNumber })
  }, [availableWidth, document, onError, pageNumber, visible])

  return (
    <div ref={pageRef} className="flex min-h-32 justify-center" data-pdf-page={pageNumber}>
      {visible && <canvas ref={canvasRef} aria-label={title} className="max-w-full bg-white shadow-sm" />}
    </div>
  )
}

interface PdfDocumentState {
  document: PdfDocument | null
  failed: boolean
}

function usePdfDocument(source: string, onError: () => void): PdfDocumentState {
  const [document, setDocument] = useState<PdfDocument | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let loadedDocument: PdfDocument | null = null
    void loadPdfDocument(source)
      .then((nextDocument) => {
        loadedDocument = nextDocument
        if (active) setDocument(nextDocument)
        else void nextDocument.destroy()
      })
      .catch(() => {
        if (!active) return
        setFailed(true)
        onError()
      })

    return () => {
      active = false
      if (loadedDocument) void loadedDocument.destroy()
    }
  }, [onError, source])

  return { document, failed }
}

export function PdfFilePreview({ fallback, onError, source, title }: PdfFilePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const { document, failed } = usePdfDocument(source, onError)
  const availableWidth = usePreviewWidth(previewRef)
  const pageNumbers = useMemo(
    () => Array.from({ length: previewPageCount(document?.numPages) }, (_, index) => index + 1),
    [document?.numPages],
  )

  if (failed) return fallback

  return (
    <section
      ref={previewRef}
      className="h-full min-h-[320px] overflow-auto bg-muted/20 py-6"
      data-testid="pdf-file-preview"
      data-pdf-source={source}
      aria-busy={document === null}
      aria-label={title}
    >
      <div className="mx-auto flex max-w-[1248px] flex-col gap-4 px-6">
        {document && pageNumbers.map((pageNumber) => (
          <PdfPageCanvas
            key={pageNumber}
            availableWidth={availableWidth}
            document={document}
            onError={onError}
            pageNumber={pageNumber}
            title={title}
          />
        ))}
      </div>
    </section>
  )
}
