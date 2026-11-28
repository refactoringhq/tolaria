import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ResizeHandle } from './ResizeHandle'
import { TooltipProvider } from './ui/tooltip'

it('collapses on click and resizes on drag', () => {
  const onResize = vi.fn()
  const onCollapse = vi.fn()
  render(
    <TooltipProvider>
      <ResizeHandle
        onResize={onResize}
        collapse={{ label: 'sidebar.action.collapse', action: onCollapse }}
      />
    </TooltipProvider>,
  )
  const handle = screen.getByRole('button', { name: 'Collapse sidebar' })

  fireEvent.mouseDown(handle, { button: 0, clientX: 20 })
  fireEvent.mouseUp(handle, { button: 0, clientX: 20 })
  fireEvent.click(handle, { detail: 1 })
  expect(onCollapse).toHaveBeenCalledOnce()
  expect(onResize).not.toHaveBeenCalled()

  fireEvent.mouseDown(handle, { button: 0, clientX: 20 })
  fireEvent.mouseMove(document, { buttons: 1, clientX: 44 })
  fireEvent.mouseUp(handle, { button: 0, clientX: 44 })
  fireEvent.click(handle, { detail: 1 })
  expect(onResize).toHaveBeenCalledExactlyOnceWith(24)
  expect(onCollapse).toHaveBeenCalledOnce()

  fireEvent.click(handle, { detail: 0 })
  expect(onCollapse).toHaveBeenCalledTimes(2)
})
