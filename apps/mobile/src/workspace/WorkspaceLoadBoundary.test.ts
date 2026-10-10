// @vitest-environment jsdom
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceLoadBoundary } from './WorkspaceLoadBoundary'

describe('workspace load recovery', () => {
  it('replaces a failed workspace with recovery controls and resets for the next vault', () => {
    const container = document.createElement('div')
    const onCaughtError = vi.fn()
    const root = createRoot(container, { onCaughtError })
    const fallback = createElement('button', null, 'Manage vaults')
    function BrokenWorkspace(): never { throw new Error('unreadable vault') }
    try {
      flushSync(() => root.render(createElement(WorkspaceLoadBoundary, {
        key: 'first', fallback, children: createElement(BrokenWorkspace),
      })))
      expect(container.textContent).toBe('Manage vaults')
      expect(onCaughtError).toHaveBeenCalledOnce()
      flushSync(() => root.render(createElement(WorkspaceLoadBoundary, {
        key: 'second', fallback, children: 'Restored note',
      })))
      expect(container.textContent).toBe('Restored note')
    } finally { root.unmount() }
  })
})
