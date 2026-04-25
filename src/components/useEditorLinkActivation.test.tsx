import { useRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../utils/url', async () => {
  const actual = await vi.importActual('../utils/url') as typeof import('../utils/url')
  return { ...actual, openExternalUrl: vi.fn().mockResolvedValue(undefined) }
})

import { openExternalUrl } from '../utils/url'
import { useEditorLinkActivation } from './useEditorLinkActivation'

const mockOpenExternalUrl = vi.mocked(openExternalUrl)

function Harness({ onNavigateWikilink }: { onNavigateWikilink: (target: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEditorLinkActivation(containerRef, onNavigateWikilink)
  return <div ref={containerRef} data-testid="editor-link-container" />
}

function renderHarness(onNavigateWikilink = vi.fn()) {
  render(<Harness onNavigateWikilink={onNavigateWikilink} />)
  return {
    container: screen.getByTestId('editor-link-container') as HTMLDivElement,
    onNavigateWikilink,
  }
}

function appendWikilink(container: HTMLElement, target: string) {
  const wikilink = document.createElement('span')
  wikilink.className = 'wikilink'
  wikilink.dataset.target = target
  container.appendChild(wikilink)
  return wikilink
}

function appendEditableWikilink(container: HTMLElement, target: string) {
  const editable = document.createElement('div')
  editable.setAttribute('contenteditable', 'true')
  const wikilink = appendWikilink(editable, target)
  container.appendChild(editable)
  return { editable, wikilink }
}

function appendUrl(container: HTMLElement, href: string) {
  const link = document.createElement('a')
  link.setAttribute('href', href)
  link.textContent = href
  link.addEventListener('click', (event) => {
    if (!(event as MouseEvent).metaKey) event.preventDefault()
  })
  container.appendChild(link)
  return link
}

describe('useEditorLinkActivation', () => {
  beforeEach(() => {
    mockOpenExternalUrl.mockClear()
  })

  it('navigates wikilinks only on Cmd+click', () => {
    const { container, onNavigateWikilink } = renderHarness()
    const wikilink = appendWikilink(container, 'Alpha Project')

    fireEvent.click(wikilink)
    expect(onNavigateWikilink).not.toHaveBeenCalled()

    fireEvent.click(wikilink, { metaKey: true })
    expect(onNavigateWikilink).toHaveBeenCalledWith('Alpha Project')
  })

  it('blurs an active editor before navigating a Cmd-clicked wikilink', () => {
    const { container, onNavigateWikilink } = renderHarness()
    const { editable, wikilink } = appendEditableWikilink(container, 'Alpha Project')

    editable.focus()
    expect(document.activeElement).toBe(editable)

    fireEvent.click(wikilink, { metaKey: true })

    expect(onNavigateWikilink).toHaveBeenCalledWith('Alpha Project')
    expect(document.activeElement).not.toBe(editable)
  })

  it('opens URLs only on Cmd+click', () => {
    const { container } = renderHarness()
    const link = appendUrl(container, 'https://example.com')

    fireEvent.click(link)
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()

    fireEvent.click(link, { metaKey: true })
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('ignores malformed URLs and links inside code blocks', () => {
    const { container, onNavigateWikilink } = renderHarness()
    const codeBlock = document.createElement('div')
    codeBlock.setAttribute('data-content-type', 'codeBlock')
    codeBlock.appendChild(appendWikilink(codeBlock, 'Inside Code'))
    container.appendChild(codeBlock)
    const badLink = appendUrl(container, 'not a url')

    fireEvent.click(codeBlock.firstElementChild!, { metaKey: true })
    fireEvent.click(badLink, { metaKey: true })

    expect(onNavigateWikilink).not.toHaveBeenCalled()
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })

  it('toggles follow-link cursor mode while Cmd is held', () => {
    const { container } = renderHarness()

    expect(container.hasAttribute('data-follow-links')).toBe(false)
    fireEvent.keyDown(window, { key: 'Meta', metaKey: true })
    expect(container.hasAttribute('data-follow-links')).toBe(true)
    fireEvent.keyUp(window, { key: 'Meta' })
    expect(container.hasAttribute('data-follow-links')).toBe(false)
  })
})
