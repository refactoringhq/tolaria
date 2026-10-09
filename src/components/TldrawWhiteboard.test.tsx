import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { TldrawWhiteboard } from './TldrawWhiteboard'
import { TooltipProvider } from './ui/tooltip'

interface MockTldrawProps {
  assetUrls: MockAssetUrls
  components?: {
    Canvas?: ComponentType
  }
  onMount: (editor: Editor) => () => void
  user?: MockTldrawUser
}

interface MockTldrawUser {
  userPreferences: {
    get: () => { colorScheme?: string }
  }
}

interface MockAssetUrls {
  embedIcons: Record<string, string>
  fonts: Record<string, string>
  icons: Record<string, string>
  translations: Record<string, string>
}

interface MockCreateTLStoreOptions {
  onMount?: (editor: Editor) => undefined | (() => void)
}

interface MockTldrawStore {
  document: unknown
  getStoreSnapshot: ReturnType<typeof vi.fn>
  listen: ReturnType<typeof vi.fn>
}

const tldrawMock = vi.hoisted(() => ({
  DefaultCanvas: vi.fn(),
  Tldraw: vi.fn(),
  defaultHandleExternalTldrawContent: vi.fn(),
  useEditor: vi.fn(),
}))

const tldrawStoreMock = vi.hoisted(() => ({
  createTLStore: vi.fn(() => {
    const store: MockTldrawStore = {
      document: { records: {} },
      getStoreSnapshot: vi.fn(() => store.document),
      listen: vi.fn(() => vi.fn()),
    }
    return store
  }),
  getSnapshot: vi.fn((store: { document?: unknown }) => ({ document: store.document ?? { records: {} } })),
  loadSnapshot: vi.fn((store: { document?: unknown }, snapshot: unknown) => {
    store.document = snapshot
  }),
}))

const assetImportMock = vi.hoisted(() => ({
  getAssetUrlsByImport: vi.fn((formatAssetUrl: (assetUrl?: string) => string) => ({
    embedIcons: {},
    fonts: {
      tldraw_draw: formatAssetUrl('/assets/Shantell_Sans-Informal_Regular.woff2'),
    },
    icons: {
      'tool-pencil': `${formatAssetUrl('/assets/0_merged.svg')}#tool-pencil`,
    },
    translations: {
      en: formatAssetUrl(undefined),
    },
  })),
}))

vi.mock('@tldraw/assets/imports.vite', () => assetImportMock)

vi.mock('tldraw', async () => {
  const { createElement } = await import('react')

  tldrawMock.Tldraw.mockImplementation(({ assetUrls }: MockTldrawProps) =>
    createElement('div', {
      'data-testid': 'mock-tldraw',
      'data-draw-font-url': assetUrls.fonts.tldraw_draw,
    })
  )

  return {
    Box: class Box {
      x: number
      y: number
      w: number
      h: number

      constructor(x: number, y: number, w: number, h: number) {
        this.x = x
        this.y = y
        this.w = w
        this.h = h
      }
    },
    DefaultCanvas: tldrawMock.DefaultCanvas,
    Tldraw: tldrawMock.Tldraw,
    createTLStore: tldrawStoreMock.createTLStore,
    defaultUserPreferences: {
      colorScheme: 'light',
      locale: 'en',
    },
    defaultHandleExternalTldrawContent: tldrawMock.defaultHandleExternalTldrawContent,
    getSnapshot: tldrawStoreMock.getSnapshot,
    loadSnapshot: tldrawStoreMock.loadSnapshot,
    useTldrawUser: vi.fn(({ userPreferences }: { userPreferences: { colorScheme: string } }) => ({
      setUserPreferences: vi.fn(),
      userPreferences: {
        get: () => userPreferences,
      },
    })),
    useEditor: tldrawMock.useEditor,
  }
})

function renderedTldrawAssetUrls(): MockAssetUrls {
  const props = tldrawMock.Tldraw.mock.calls[0]?.[0] as MockTldrawProps
  expect(props.assetUrls).toBeDefined()
  return props.assetUrls
}

function renderedTldrawProps(): MockTldrawProps {
  const props = tldrawMock.Tldraw.mock.lastCall?.[0] as MockTldrawProps
  expect(props).toBeDefined()
  return props
}

function renderedStoreOnMount(): NonNullable<MockCreateTLStoreOptions['onMount']> {
  const createStoreCalls = tldrawStoreMock.createTLStore.mock.calls as [MockCreateTLStoreOptions?][]
  const onMount = createStoreCalls
    .map(([options]) => options?.onMount)
    .find((handler): handler is NonNullable<MockCreateTLStoreOptions['onMount']> =>
      typeof handler === 'function')

  expect(onMount).toEqual(expect.any(Function))
  return onMount
}

function renderedPrimaryStore(): MockTldrawStore {
  const store = tldrawStoreMock.createTLStore.mock.results[0]?.value as MockTldrawStore | undefined
  expect(store).toBeDefined()
  return store
}

function mockEditor(): Editor {
  const container = document.createElement('div')
  const canvas = document.createElement('div')
  canvas.className = 'tl-canvas'
  container.append(canvas)

  const externalContentHandlers = new Map<string, (content: unknown) => Promise<void>>()
  return {
    dispatch: vi.fn(),
    externalContentHandlers,
    getContainer: vi.fn(() => container),
    registerExternalContentHandler: vi.fn((type: string, handler: (content: unknown) => Promise<void>) => {
      externalContentHandlers.set(type, handler)
    }),
    textMeasure: {
      measureElementTextNodeSpans: vi.fn(() => {
        throw new TypeError("undefined is not an object (evaluating 'v.top')")
      }),
    },
    updateViewportScreenBounds: vi.fn(),
  } as unknown as Editor
}

function registeredTldrawPasteHandler(editor: Editor) {
  const handlers = (editor as unknown as {
    externalContentHandlers: Map<string, (content: unknown) => Promise<void>>
  }).externalContentHandlers
  const handler = handlers.get('tldraw')
  expect(handler).toEqual(expect.any(Function))
  return handler as (content: unknown) => Promise<void>
}

function maskedTldrawIcon(mask: string): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'tlui-icon'
  icon.style.setProperty('mask', mask)
  return icon
}

function dispatchUnhandledRejection(reason: unknown): Event {
  const event = new Event('unhandledrejection', { cancelable: true })
  Object.defineProperty(event, 'reason', { value: reason })
  window.dispatchEvent(event)
  return event
}

function measuredTextElement(): HTMLElement {
  const element = document.createElement('div')
  element.textContent = 'Label'
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({
    height: 24,
    width: 88,
  }))
  return element
}

function expectNoCdnUrls(urls: Record<string, string>) {
  Object.values(urls).forEach((url) => {
    expect(url).not.toContain('cdn.tldraw.com')
  })
}

function expectBundledTldrawAssetUrls(assetUrls: MockAssetUrls) {
  expect(assetUrls.fonts.tldraw_draw).toContain('Shantell_Sans-Informal_Regular.woff2')
  expect(assetUrls.icons['tool-pencil']).toContain('0_merged.svg#tool-pencil')
  expect(assetUrls.translations.en).toBe('data:application/json;base64,e30K')
  expectNoCdnUrls(assetUrls.fonts)
  expectNoCdnUrls(assetUrls.icons)
  expectNoCdnUrls(assetUrls.translations)
}

function whiteboardProps(
  overrides: Partial<ComponentProps<typeof TldrawWhiteboard>> = {},
): ComponentProps<typeof TldrawWhiteboard> {
  return {
    boardId: 'board-1',
    height: '520',
    snapshot: '',
    width: '',
    onSizeChange: vi.fn(),
    onSnapshotChange: vi.fn(),
    ...overrides,
  }
}

function renderWhiteboard(overrides: Partial<ComponentProps<typeof TldrawWhiteboard>> = {}) {
  return render(
    <TldrawWhiteboard {...whiteboardProps(overrides)} />,
    { wrapper: TooltipProvider },
  )
}

describe('TldrawWhiteboard', () => {
  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    vi.clearAllMocks()
  })

  it('uses bundled tldraw assets instead of CDN URLs', () => {
    renderWhiteboard()

    expect(screen.getByTestId('mock-tldraw')).toHaveAttribute('data-draw-font-url')
    expect(assetImportMock.getAssetUrlsByImport).toHaveBeenCalledWith(expect.any(Function))
    expectBundledTldrawAssetUrls(renderedTldrawAssetUrls())
  })

  it('passes Tolaria dark mode to tldraw', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')

    renderWhiteboard()

    expect(renderedTldrawProps().user?.userPreferences.get().colorScheme).toBe('dark')
  })

  it('updates the tldraw color scheme when Tolaria theme changes', async () => {
    document.documentElement.setAttribute('data-theme', 'light')

    renderWhiteboard()

    expect(renderedTldrawProps().user?.userPreferences.get().colorScheme).toBe('light')

    act(() => {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.classList.add('dark')
    })

    await waitFor(() => {
      expect(renderedTldrawProps().user?.userPreferences.get().colorScheme).toBe('dark')
    })
  })

  it('installs the text measurement guard before tldraw runtime guards mount', () => {
    renderWhiteboard()

    const editor = mockEditor()
    const cleanupStoreMount = renderedStoreOnMount()(editor)

    expect(editor.textMeasure.measureElementTextNodeSpans(measuredTextElement())).toEqual({
      didTruncate: false,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Label',
      }],
    })

    const cleanupRuntimeMount = renderedTldrawProps().onMount(editor)
    cleanupRuntimeMount()
    expect(editor.textMeasure.measureElementTextNodeSpans(measuredTextElement())).toEqual({
      didTruncate: false,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Label',
      }],
    })

    if (typeof cleanupStoreMount === 'function') cleanupStoreMount()
    expect(() => editor.textMeasure.measureElementTextNodeSpans(measuredTextElement())).toThrow('top')
  })

  it('installs the text measurement guard before the default canvas renders', () => {
    renderWhiteboard()

    const editor = mockEditor()
    tldrawMock.useEditor.mockReturnValue(editor)
    const Canvas = renderedTldrawProps().components?.Canvas
    expect(Canvas).toEqual(expect.any(Function))

    render(<Canvas />)

    expect(tldrawMock.DefaultCanvas).toHaveBeenCalled()
    expect(editor.textMeasure.measureElementTextNodeSpans(measuredTextElement())).toEqual({
      didTruncate: false,
      spans: [{
        box: { h: 24, w: 88, x: 0, y: 0 },
        text: 'Label',
      }],
    })
  })

  it('mirrors tldraw icon masks to WebKit masks while mounted', async () => {
    const styleWrites = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty')
    renderWhiteboard()

    const editor = mockEditor()
    const container = editor.getContainer()
    const initialMask = 'url(/assets/0_merged.svg#tools.select) center 100% / 100% no-repeat'
    const initialIcon = maskedTldrawIcon(initialMask)
    container.append(initialIcon)

    let cleanupRuntimeMount: (() => void) | null = null
    try {
      cleanupRuntimeMount = renderedTldrawProps().onMount(editor)

      expect(styleWrites).toHaveBeenCalledWith('-webkit-mask', initialMask)

      const delayedMask = 'url(/assets/0_merged.svg#style-panel) center 100% / 100% no-repeat'
      const delayedIcon = maskedTldrawIcon(delayedMask)
      container.append(delayedIcon)

      await waitFor(() => {
        expect(styleWrites).toHaveBeenCalledWith('-webkit-mask', delayedMask)
      })
    } finally {
      cleanupRuntimeMount?.()
      styleWrites.mockRestore()
    }
  })

  it('suppresses whiteboard platform permission rejections while mounted', () => {
    renderWhiteboard()

    const cleanup = renderedTldrawProps().onMount(mockEditor())
    const denied = {
      name: 'NotAllowedError',
      message: 'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.',
    }

    act(() => {
      expect(dispatchUnhandledRejection(denied).defaultPrevented).toBe(true)
      expect(dispatchUnhandledRejection(new Error('save failed')).defaultPrevented).toBe(false)
    })

    cleanup()
    expect(dispatchUnhandledRejection(denied).defaultPrevented).toBe(false)
  })

  it('shows a whiteboard fallback when the platform permission is denied', () => {
    renderWhiteboard()

    const cleanup = renderedTldrawProps().onMount(mockEditor())
    const denied = {
      name: 'NotAllowedError',
      message: 'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.',
    }

    act(() => {
      expect(dispatchUnhandledRejection(denied).defaultPrevented).toBe(true)
    })

    expect(screen.getByTestId('tldraw-whiteboard-permission-error')).toHaveTextContent('Whiteboard permission blocked')
    expect(screen.getByTestId('tldraw-whiteboard-permission-error')).toHaveTextContent('reopen the note')

    cleanup()
  })

  it('keeps an incompatible whiteboard paste from reaching the error boundary', async () => {
    tldrawMock.defaultHandleExternalTldrawContent.mockRejectedValueOnce(
      new Error('Could not put content: could not migrate content'),
    )
    renderWhiteboard()

    const editor = mockEditor()
    const cleanupRuntime = renderedTldrawProps().onMount(editor)

    await act(async () => {
      await registeredTldrawPasteHandler(editor)({ type: 'tldraw', content: {} })
    })

    expect(screen.getByTestId('tldraw-whiteboard-paste-error')).toHaveTextContent(
      'Whiteboard content could not be pasted',
    )
    expect(screen.getByTestId('mock-tldraw')).toBeInTheDocument()
    cleanupRuntime()
  })

  it('does not hide unrelated whiteboard paste failures', async () => {
    tldrawMock.defaultHandleExternalTldrawContent.mockRejectedValueOnce(new Error('Unexpected paste failure'))
    renderWhiteboard()

    const editor = mockEditor()
    const cleanupRuntime = renderedTldrawProps().onMount(editor)

    await expect(
      registeredTldrawPasteHandler(editor)({ type: 'tldraw', content: {} }),
    ).rejects.toThrow('Unexpected paste failure')
    expect(screen.queryByTestId('tldraw-whiteboard-paste-error')).not.toBeInTheDocument()
    cleanupRuntime()
  })

  it('prevents whiteboard permission rejections before earlier global listeners observe them', () => {
    const observedDefaultPrevented: boolean[] = []
    const sentryLikeListener = (event: PromiseRejectionEvent) => {
      observedDefaultPrevented.push(event.defaultPrevented)
    }
    window.addEventListener('unhandledrejection', sentryLikeListener)
    let guardCleanup: (() => void) | undefined

    try {
      renderWhiteboard()
      guardCleanup = renderedTldrawProps().onMount(mockEditor())
      const denied = {
        name: 'NotAllowedError',
        message: 'The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.',
      }

      act(() => {
        expect(dispatchUnhandledRejection(denied).defaultPrevented).toBe(true)
      })
      expect(observedDefaultPrevented).toEqual([true])
    } finally {
      guardCleanup?.()
      window.removeEventListener('unhandledrejection', sentryLikeListener)
    }
  })

  it('resets the drawing store when switching to a blank board snapshot', () => {
    const boardASnapshot = { records: { shape: 'from-board-a' } }
    const { rerender } = renderWhiteboard({ snapshot: JSON.stringify(boardASnapshot) })

    expect(tldrawStoreMock.loadSnapshot).toHaveBeenLastCalledWith(expect.any(Object), boardASnapshot)

    rerender(
      <TldrawWhiteboard {...whiteboardProps({ boardId: 'board-2' })} />
    )

    expect(tldrawStoreMock.loadSnapshot).toHaveBeenLastCalledWith(expect.any(Object), { records: {} })
  })

  it('does not read tldraw session snapshots while restoring a blank board', () => {
    tldrawStoreMock.getSnapshot.mockImplementation(() => {
      throw new Error('Session state is not ready yet')
    })

    expect(() => renderWhiteboard()).not.toThrow()

    expect(tldrawStoreMock.loadSnapshot).toHaveBeenLastCalledWith(expect.any(Object), { records: {} })
    expect(tldrawStoreMock.getSnapshot).not.toHaveBeenCalled()
  })

  it('does not read tldraw session snapshots while saving document changes', () => {
    vi.useFakeTimers()
    tldrawStoreMock.getSnapshot.mockImplementation(() => {
      throw new Error('Session state is not ready yet')
    })
    const onSnapshotChange = vi.fn()

    renderWhiteboard({ onSnapshotChange })
    const store = renderedPrimaryStore()
    store.document = { records: { shape: 'changed' } }
    const scheduleSnapshotFlush = store.listen.mock.calls[0]?.[0] as (() => void) | undefined

    expect(scheduleSnapshotFlush).toEqual(expect.any(Function))
    act(() => {
      scheduleSnapshotFlush?.()
      vi.advanceTimersByTime(350)
    })

    expect(onSnapshotChange).toHaveBeenCalledWith('{\n  "records": {\n    "shape": "changed"\n  }\n}\n')
    expect(tldrawStoreMock.getSnapshot).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
