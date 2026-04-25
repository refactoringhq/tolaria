import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { InlineWikilinkInput } from './InlineWikilinkInput'

let tauriMode = false

// JSDOM does not implement elementFromPoint — install a configurable stub.
const elementFromPointMock = vi.fn<[number, number], Element | null>(() => null)
beforeAll(() => {
  Object.defineProperty(document, 'elementFromPoint', {
    value: elementFromPointMock,
    writable: true,
    configurable: true,
  })
})

vi.mock('../mock-tauri', () => ({
  isTauri: () => tauriMode,
}))

type DropPayload = { paths: string[]; position: { x: number; y: number } }
type DropCallback = (event: { payload: DropPayload }) => void
let capturedDropHandler: DropCallback | undefined

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    listen: vi.fn((_eventName: string, cb: DropCallback) => {
      capturedDropHandler = cb
      return Promise.resolve(() => { capturedDropHandler = undefined })
    }),
  }),
}))

function renderInput(onChange = vi.fn()) {
  render(
    <InlineWikilinkInput
      entries={[]}
      value=""
      onChange={onChange}
      dataTestId="test-input"
    />,
  )
  return { onChange }
}

describe('InlineWikilinkInput — Tauri file drop', () => {
  beforeEach(() => {
    tauriMode = true
    capturedDropHandler = undefined
  })

  afterEach(() => {
    tauriMode = false
    capturedDropHandler = undefined
  })

  it('registers a tauri://drag-drop listener when running in Tauri', async () => {
    renderInput()
    await waitFor(() => expect(capturedDropHandler).toBeDefined())
  })

  it('inserts a dropped folder path into the input', async () => {
    const onChange = vi.fn()
    renderInput(onChange)
    await waitFor(() => expect(capturedDropHandler).toBeDefined())

    const input = screen.getByTestId('test-input')
    // Simulate the drop landing on the input element
    elementFromPointMock.mockReturnValue(input)

    act(() => {
      capturedDropHandler!({
        payload: { paths: ['/Users/alice/Projects/my-folder'], position: { x: 100, y: 200 } },
      })
    })

    expect(onChange).toHaveBeenCalledWith('/Users/alice/Projects/my-folder')
  })

  it('inserts multiple dropped paths joined by newlines', async () => {
    const onChange = vi.fn()
    renderInput(onChange)
    await waitFor(() => expect(capturedDropHandler).toBeDefined())

    const input = screen.getByTestId('test-input')
    elementFromPointMock.mockReturnValue(input)

    act(() => {
      capturedDropHandler!({
        payload: {
          paths: ['/Users/alice/a', '/Users/alice/b'],
          position: { x: 100, y: 200 },
        },
      })
    })

    expect(onChange).toHaveBeenCalledWith('/Users/alice/a\n/Users/alice/b')
  })

  it('ignores drops that land outside the input element', async () => {
    const onChange = vi.fn()
    renderInput(onChange)
    await waitFor(() => expect(capturedDropHandler).toBeDefined())

    // Simulate drop landing elsewhere (e.g. the editor)
    const otherEl = document.createElement('div')
    elementFromPointMock.mockReturnValue(otherEl)

    act(() => {
      capturedDropHandler!({
        payload: { paths: ['/Users/alice/folder'], position: { x: 50, y: 50 } },
      })
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does nothing when paths array is empty', async () => {
    const onChange = vi.fn()
    renderInput(onChange)
    await waitFor(() => expect(capturedDropHandler).toBeDefined())

    act(() => {
      capturedDropHandler!({ payload: { paths: [], position: { x: 100, y: 200 } } })
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not register a listener when not running in Tauri', async () => {
    tauriMode = false
    renderInput()
    // Give the effect time to run
    await act(async () => { await new Promise(r => setTimeout(r, 50)) })
    expect(capturedDropHandler).toBeUndefined()
  })
})
