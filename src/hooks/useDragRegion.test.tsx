import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDragRegion } from './useDragRegion'

const startDragging = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ startDragging }),
}))

function DragRegionHarness() {
  const { onMouseDown } = useDragRegion()

  return (
    <div data-testid="drag-surface" onMouseDown={onMouseDown}>
      <div data-testid="no-drag-card" data-no-drag>
        <button type="button">Action</button>
      </div>
    </div>
  )
}

describe('useDragRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts dragging from the background surface', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByTestId('drag-surface'), { button: 0 })

    expect(startDragging).toHaveBeenCalledOnce()
  })

  it('does not start dragging from no-drag containers', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByTestId('no-drag-card'), { button: 0 })

    expect(startDragging).not.toHaveBeenCalled()
  })

  it('does not start dragging from interactive descendants', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Action' }), { button: 0 })

    expect(startDragging).not.toHaveBeenCalled()
  })

  it('ignores non-primary mouse buttons', () => {
    render(<DragRegionHarness />)

    fireEvent.mouseDown(screen.getByTestId('drag-surface'), { button: 1 })

    expect(startDragging).not.toHaveBeenCalled()
  })
})
