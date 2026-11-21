import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useNearViewportOnce } from '../hooks/useNearViewportOnce'
import { isSupportedPdfSource, loadPdfDocument, type PdfDocument, type PdfPage, type PdfRenderTask, pdfCanvasContext } from '../utils/pdfPreviewRuntime'

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

interface PdfPageSize {
  height: number
  width: number
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
// A crafted PDF can claim any page size; cap the laid-out height and each canvas edge.
const MAX_PAGE_HEIGHT = 16_384
// The smallest common webview canvas edge; capping both edges also bounds the area.
const MAX_CANVAS_EDGE = 4_096

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

function renderScale(page: PdfPageSize, availableWidth: number): number {
  const targetWidth = Math.min(Math.max(availableWidth - PAGE_HORIZONTAL_PADDING, 1), MAX_PAGE_WIDTH)
  return Math.min(targetWidth / page.width, MAX_PAGE_HEIGHT / page.height)
}

function canvasOutputScale(viewport: PdfPageSize): number {
  const longestEdge = Math.max(viewport.width, viewport.height)
  if (!Number.isFinite(longestEdge) || !(Math.min(viewport.width, viewport.height) > 0)) {
    throw new Error('Invalid PDF page size')
  }
  return Math.min(Math.max(window.devicePixelRatio, 1), MAX_CANVAS_EDGE / longestEdge)
}

function configureCanvas(canvas: HTMLCanvasElement, viewport: PdfPageSize): number {
  const outputScale = canvasOutputScale(viewport)
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  return outputScale
}

async function drawPdfPage(page: PdfPage, options: PdfPageRenderOptions, state: PdfPageRenderState): Promise<void> {
  if (state.cancelled) return
  const { availableWidth, canvas } = options
  const baseViewport = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: renderScale(baseViewport, availableWidth) })
  const outputScale = configureCanvas(canvas, viewport)
  state.task = page.render({
    canvas,
    canvasContext: pdfCanvasContext(canvas),
    transform: [outputScale, 0, 0, outputScale, 0, 0],
    viewport,
  })
  await state.task.promise
}

// Clean the page up on every path, including a rejected or invalid render.
async function paintPdfPage(options: PdfPageRenderOptions, state: PdfPageRenderState): Promise<void> {
  const page = await options.document.getPage(options.pageNumber)
  return drawPdfPage(page, options, state).finally(() => page.cleanup())
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
      {visible && <canvas ref={canvasRef} aria-label={title} className="max-w-full bg-[var(--white)] shadow-sm" />}
    </div>
  )
}

interface PdfDocumentState {
  document: PdfDocument | null
  failed: boolean
}

interface PdfSourceState extends PdfDocumentState {
  source: string
}

const LOADING_DOCUMENT: PdfDocumentState = { document: null, failed: false }

// State is keyed by source and cleared with its document, so a reload never shows a stale or destroyed result.
function usePdfDocument(source: string, onError: () => void): PdfDocumentState {
  const [state, setState] = useState<PdfSourceState | null>(null)

  useEffect(() => {
    let active = true
    let loadedDocument: PdfDocument | null = null
    const load = isSupportedPdfSource(source) ? loadPdfDocument(source) : Promise.reject(new Error('Unsupported PDF source'))
    void load
      .then((nextDocument) => {
        loadedDocument = nextDocument
        if (active) setState({ document: nextDocument, failed: false, source })
        else void nextDocument.destroy()
      })
      .catch(() => {
        if (!active) return
        setState({ document: null, failed: true, source })
        onError()
      })

    return () => {
      active = false
      if (!loadedDocument) return
      void loadedDocument.destroy()
      setState(null)
    }
  }, [onError, source])

  return state?.source === source ? state : LOADING_DOCUMENT
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
      className="h-full min-h-[320px] overflow-auto bg-muted py-6"
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
