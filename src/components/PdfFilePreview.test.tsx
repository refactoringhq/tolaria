import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PdfFilePreview } from './PdfFilePreview'

const { loadPdfDocumentMock, pdfCanvasContextMock } = vi.hoisted(() => ({
  loadPdfDocumentMock: vi.fn(),
  pdfCanvasContextMock: vi.fn(() => ({} as CanvasRenderingContext2D)),
}))

vi.mock('../utils/pdfPreviewRuntime', () => ({
  loadPdfDocument: loadPdfDocumentMock,
  pdfCanvasContext: pdfCanvasContextMock,
}))

function mockDocument(pageCount = 2) {
  const renderTask = { cancel: vi.fn(), promise: Promise.resolve() }
  const page = {
    cleanup: vi.fn(),
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ height: 1_000 * scale, width: 800 * scale })),
    render: vi.fn(() => renderTask),
  }
  const document = {
    destroy: vi.fn(() => Promise.resolve()),
    getPage: vi.fn(() => Promise.resolve(page)),
    numPages: pageCount,
  }
  return { document, page, renderTask }
}

describe('PdfFilePreview', () => {
  let revealObservedPage: () => void

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class implements IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        revealObservedPage = () => callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this,
        )
      }

      disconnect = vi.fn()
      observe = vi.fn()
      takeRecords = vi.fn(() => [])
      unobserve = vi.fn()
      root = null
      rootMargin = ''
      thresholds = []
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders every PDF page through the app-owned canvas renderer', async () => {
    const { document, page } = mockDocument()
    loadPdfDocumentMock.mockResolvedValue(document)

    render(
      <PdfFilePreview
        fallback={<div>fallback</div>}
        onError={vi.fn()}
        source="asset://localhost/report.pdf"
        title="report.pdf"
      />,
    )

    await waitFor(() => expect(document.getPage).toHaveBeenCalledWith(1))
    act(() => revealObservedPage())
    await waitFor(() => expect(document.getPage).toHaveBeenCalledTimes(2))
    expect(loadPdfDocumentMock).toHaveBeenCalledWith('asset://localhost/report.pdf')
    expect(page.render).toHaveBeenCalledTimes(2)
    expect(screen.getAllByLabelText('report.pdf')).toHaveLength(3)
  })

  it('destroys the loaded document when the preview closes', async () => {
    const { document } = mockDocument(1)
    loadPdfDocumentMock.mockResolvedValue(document)

    const preview = render(
      <PdfFilePreview fallback={<div>fallback</div>} onError={vi.fn()} source="asset://report.pdf" title="report.pdf" />,
    )
    await waitFor(() => expect(document.getPage).toHaveBeenCalledWith(1))

    preview.unmount()

    expect(document.destroy).toHaveBeenCalledTimes(1)
  })

  it('shows the supplied fallback and reports a load failure', async () => {
    const onError = vi.fn()
    loadPdfDocumentMock.mockRejectedValue(new Error('invalid PDF'))

    render(
      <PdfFilePreview
        fallback={<div>PDF preview failed</div>}
        onError={onError}
        source="asset://broken.pdf"
        title="broken.pdf"
      />,
    )

    expect(await screen.findByText('PDF preview failed')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
