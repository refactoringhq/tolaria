import { useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/url', async () => {
  const actual = await vi.importActual('../utils/url') as typeof import('../utils/url')
  return { ...actual, openLocalFile: vi.fn().mockResolvedValue(undefined) }
})

import { openLocalFile } from '../utils/url'
import { useEditorImageActivation } from './useEditorImageActivation'

const mockOpenLocalFile = vi.mocked(openLocalFile)

function Harness() {
  const containerRef = useRef<HTMLDivElement>(null)
  useEditorImageActivation(containerRef)
  return <div ref={containerRef} data-testid="editor-image-container" />
}

function renderHarness() {
  render(<Harness />)
  return screen.getByTestId('editor-image-container') as HTMLDivElement
}

function appendImage(container: HTMLElement, src: string) {
  const img = document.createElement('img')
  img.setAttribute('src', src)
  container.appendChild(img)
  return img
}

describe('useEditorImageActivation', () => {
  beforeEach(() => {
    mockOpenLocalFile.mockClear()
  })

  it('opens asset-protocol images on Cmd+click', () => {
    const container = renderHarness()
    const src = `asset://localhost/${encodeURIComponent('/vault/attachments/skazkoterapiya/IMAGE 2022-10-15 15:47:07.jpg')}`
    const img = appendImage(container, src)

    fireEvent.click(img, { metaKey: true })

    expect(mockOpenLocalFile).toHaveBeenCalledWith('/vault/attachments/skazkoterapiya/IMAGE 2022-10-15 15:47:07.jpg')
  })

  it('opens http-asset-protocol images on Cmd+click', () => {
    const container = renderHarness()
    const src = `http://asset.localhost/${encodeURIComponent('/vault/attachments/legacy.png')}`
    const img = appendImage(container, src)

    fireEvent.click(img, { metaKey: true })

    expect(mockOpenLocalFile).toHaveBeenCalledWith('/vault/attachments/legacy.png')
  })

  it('also opens on Ctrl+click', () => {
    const container = renderHarness()
    const src = `asset://localhost/${encodeURIComponent('/vault/attachments/file.png')}`
    const img = appendImage(container, src)

    fireEvent.click(img, { ctrlKey: true })

    expect(mockOpenLocalFile).toHaveBeenCalledWith('/vault/attachments/file.png')
  })

  it('does nothing on a plain click', () => {
    const container = renderHarness()
    const src = `asset://localhost/${encodeURIComponent('/vault/attachments/file.png')}`
    const img = appendImage(container, src)

    fireEvent.click(img)

    expect(mockOpenLocalFile).not.toHaveBeenCalled()
  })

  it('ignores Cmd+click on non-image elements', () => {
    const container = renderHarness()
    const div = document.createElement('div')
    container.appendChild(div)

    fireEvent.click(div, { metaKey: true })

    expect(mockOpenLocalFile).not.toHaveBeenCalled()
  })

  it('ignores Cmd+click on images without an asset-protocol src', () => {
    const container = renderHarness()
    const img = appendImage(container, 'https://example.com/image.png')

    fireEvent.click(img, { metaKey: true })

    expect(mockOpenLocalFile).not.toHaveBeenCalled()
  })

  it('opens the image when Cmd+click lands on a BlockNote resize handle', () => {
    const container = renderHarness()
    const block = document.createElement('div')
    block.setAttribute('data-content-type', 'image')
    const wrapper = document.createElement('div')
    wrapper.className = 'bn-visual-media-wrapper'
    const img = document.createElement('img')
    img.setAttribute('src', `asset://localhost/${encodeURIComponent('/vault/attachments/nested.png')}`)
    wrapper.appendChild(img)
    const resizeHandle = document.createElement('div')
    resizeHandle.className = 'bn-resize-handle'
    wrapper.appendChild(resizeHandle)
    block.appendChild(wrapper)
    container.appendChild(block)

    fireEvent.click(resizeHandle, { metaKey: true })

    expect(mockOpenLocalFile).toHaveBeenCalledWith('/vault/attachments/nested.png')
  })

  it('ignores Cmd+click on images outside the editor container', () => {
    renderHarness()
    const outsideImg = document.createElement('img')
    outsideImg.setAttribute('src', `asset://localhost/${encodeURIComponent('/vault/outside.png')}`)
    document.body.appendChild(outsideImg)

    fireEvent.click(outsideImg, { metaKey: true })

    expect(mockOpenLocalFile).not.toHaveBeenCalled()
    outsideImg.remove()
  })
})
