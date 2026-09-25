import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { loadPdfDocument, pdfCanvasContext, type PdfDocument, type PdfRenderTask } from '../utils/pdfPreviewRuntime'

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

function usePageVisibility(pageRef: RefObject<HTMLDivElement | null>, eager: boolean): boolean {
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    const element = pageRef.current
    if (visible || !element) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [pageRef, visible])

  return visible
}

function renderScale(pageWidth: number, availableWidth: number): number {
  const targetWidth = Math.min(Math.max(availableWidth - PAGE_HORIZONTAL_PADDING, 1), MAX_PAGE_WIDTH)
  return targetWidth / pageWidth
}

function configureCanvas(canvas: HTMLCanvasElement, viewport: { height: number; width: number }): number {
  const outputScale = Math.max(window.devicePixelRatio, 1)
  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  return outputScale
}

async function paintPdfPage(options: PdfPageRenderOptions, state: PdfPageRenderState): Promise<void> {
  const { availableWidth, canvas, document, pageNumber } = options
  const page = await document.getPage(pageNumber)
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
  await state.task.promise.finally(() => page.cleanup())
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
  const visible = usePageVisibility(pageRef, pageNumber === 1)

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

export function PdfFilePreview({ fallback, onError, source, title }: PdfFilePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PdfDocument | null>(null)
  const [failed, setFailed] = useState(false)
  const availableWidth = usePreviewWidth(previewRef)
  const pageNumbers = useMemo(
    () => Array.from({ length: document?.numPages ?? 0 }, (_, index) => index + 1),
    [document?.numPages],
  )

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
