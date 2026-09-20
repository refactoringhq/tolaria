import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CodeBlockLanguageControls } from './codeBlockLanguageControls'

function codeBlockDom() {
  const editorElement = document.createElement('div')
  editorElement.className = 'bn-editor'
  editorElement.setAttribute('contenteditable', 'false')

  const blockContainer = document.createElement('div')
  blockContainer.dataset.nodeType = 'blockContainer'
  blockContainer.dataset.id = 'code-block-1'

  const blockContent = document.createElement('div')
  blockContent.className = 'bn-block-content'
  blockContent.dataset.contentType = 'codeBlock'

  const nativeControl = document.createElement('select')
  nativeControl.disabled = true
  nativeControl.append(new Option('Plain Text', 'text'), new Option('C++', 'cpp'))
  nativeControl.value = 'text'

  const controlHost = document.createElement('div')
  controlHost.appendChild(nativeControl)
  blockContent.appendChild(controlHost)
  blockContainer.appendChild(blockContent)
  editorElement.appendChild(blockContainer)
  document.body.appendChild(editorElement)

  return { editorElement, nativeControl }
}

describe('CodeBlockLanguageControls', () => {
  it('replaces a stale disabled native picker with a live shadcn language control', async () => {
    const { editorElement, nativeControl } = codeBlockDom()
    const controlRect = vi.spyOn(nativeControl, 'getBoundingClientRect').mockReturnValue({
      height: 28,
      left: 12,
      top: 24,
    } as DOMRect)
    editorElement.remove()
    const editor = {
      domElement: editorElement.parentElement,
      getBlock: vi.fn(() => ({ id: 'code-block-1', type: 'codeBlock' })),
      isEditable: false,
      onChange: vi.fn(() => vi.fn()),
      updateBlock: vi.fn(),
    }

    render(<CodeBlockLanguageControls editor={editor as never} />)

    await act(async () => {
      editor.domElement = editorElement
      document.body.appendChild(editorElement)
    })

    const trigger = await waitFor(() => {
      const control = document.querySelector('[data-slot="select-trigger"]')
      if (!control || control.tagName !== 'BUTTON') throw new Error('Language trigger was unavailable')
      return control
    })
    const overlay = trigger.closest('[data-code-block-id]')
    expect(overlay).toHaveAttribute('data-code-block-id', 'code-block-1')
    expect(overlay?.parentElement).toBe(document.body)
    expect(overlay).toHaveStyle({ left: '12px', minHeight: '28px', top: '24px' })
    expect(trigger).toBeDisabled()
    expect(nativeControl).toBeDisabled()

    const scrollFrames: FrameRequestCallback[] = []
    const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      scrollFrames.push(callback)
      return scrollFrames.length
    })
    controlRect.mockReturnValue({ height: 28, left: 36, top: 8 } as DOMRect)
    editor.getBlock.mockClear()
    fireEvent.scroll(editorElement)
    expect(scrollFrames).toHaveLength(1)
    act(() => scrollFrames.shift()?.(0))
    expect(editor.getBlock).not.toHaveBeenCalled()
    expect(overlay).toHaveStyle({ left: '36px', minHeight: '28px', top: '8px' })
    frame.mockRestore()

    await act(async () => {
      editor.isEditable = true
      editorElement.setAttribute('contenteditable', 'true')
    })
    await waitFor(() => expect(trigger).toBeEnabled())

    fireEvent.click(trigger)
    expect(await screen.findByRole('option', { name: 'Bash' })).toBeVisible()
    fireEvent.click(await screen.findByRole('option', { name: 'C++' }))

    expect(editor.updateBlock).toHaveBeenCalledWith('code-block-1', {
      props: { language: 'cpp' },
    })
  })
})
