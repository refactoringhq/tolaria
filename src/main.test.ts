import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'

type ReactRootErrorInfo = { componentStack?: string }
type ReactRootOptions = {
  onCaughtError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
  onUncaughtError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
  onRecoverableError?: (error: unknown, errorInfo: ReactRootErrorInfo) => void
}

const mocks = vi.hoisted(() => {
  const render = vi.fn()
  const createRoot = vi.fn(() => ({ render }))
  const sentryHandler = vi.fn()
  const reactErrorHandler = vi.fn(() => sentryHandler)
  const getShortcutEventInit = vi.fn(() => ({ key: 'x' }))

  return {
    createRoot,
    getShortcutEventInit,
    reactErrorHandler,
    render,
    sentryHandler,
  }
})

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }))
vi.mock('@sentry/react', () => ({ reactErrorHandler: mocks.reactErrorHandler }))
vi.mock('./App.tsx', () => ({
  default: () => createElement('div', { 'data-testid': 'mock-app' }),
}))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))
vi.mock('./hooks/appCommandDispatcher', () => ({
  APP_COMMAND_EVENT_NAME: 'laputa:command',
  isAppCommandId: (id: string) => id === 'known-command',
  isNativeMenuCommandId: (id: string) => id === 'native-command',
}))
vi.mock('./hooks/appCommandCatalog', () => ({
  getShortcutEventInit: mocks.getShortcutEventInit,
}))

async function importEntrypoint() {
  await import('./main')
}

function rootOptions(): ReactRootOptions {
  const options = mocks.createRoot.mock.calls[0]?.[1]
  if (!options) throw new Error('createRoot was not called with root options')
  return options
}

describe('main entrypoint', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('captures React root errors through Sentry with component stack context', async () => {
    await importEntrypoint()

    expect(mocks.reactErrorHandler).toHaveBeenCalledOnce()
    expect(mocks.createRoot).toHaveBeenCalledWith(
      document.getElementById('root'),
      expect.objectContaining({
        onCaughtError: expect.any(Function),
        onUncaughtError: expect.any(Function),
        onRecoverableError: expect.any(Function),
      }),
    )

    const error = new Error('Maximum update depth exceeded')
    rootOptions().onCaughtError?.(error, { componentStack: '\n    in App' })

    expect(mocks.sentryHandler).toHaveBeenCalledWith(error, { componentStack: '\n    in App' })
  }, 10_000)

  it('normalizes missing React component stacks before handing errors to Sentry', async () => {
    await importEntrypoint()

    const error = new Error('recoverable render error')
    rootOptions().onRecoverableError?.(error, {})

    expect(mocks.sentryHandler).toHaveBeenCalledWith(error, { componentStack: '' })
  })
})
