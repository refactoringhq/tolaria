import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { describe, expect, it, vi } from 'vitest'
import { useKanbanPanelOutsideClose } from './useKanbanPanelOutsideClose'

function Board({ open, close, onCard }: { open: boolean; close: () => void; onCard?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useKanbanPanelOutsideClose({ rootRef, open, close })
  return (
    <div data-testid="root" ref={rootRef}>
      <header data-testid="header">
        <button type="button">Sort</button>
      </header>
      <section data-testid="lane">
        <button type="button" onClick={onCard}>
          <span>Card B</span>
        </button>
      </section>
      {createPortal(<div data-testid="portal">menu</div>, document.body)}
    </div>
  )
}

function click(element: Element, from = { x: 10, y: 10 }, to = from) {
  fireEvent.pointerDown(element, { clientX: from.x, clientY: from.y })
  fireEvent.click(element, { clientX: to.x, clientY: to.y })
}

describe('useKanbanPanelOutsideClose', () => {
  it('closes the open panel from empty board, lane and header space', () => {
    const close = vi.fn()
    render(<Board open close={close} />)
    click(screen.getByTestId('root'))
    click(screen.getByTestId('lane'))
    click(screen.getByTestId('header'))
    expect(close).toHaveBeenCalledTimes(3)
  })

  it('keeps the panel open when a card or a header control is clicked', () => {
    const close = vi.fn()
    const onCard = vi.fn()
    render(<Board open close={close} onCard={onCard} />)
    click(screen.getByText('Card B'))
    click(screen.getByRole('button', { name: 'Sort' }))
    expect(onCard).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
  })

  it('ignores drags that end on bare board space', () => {
    const close = vi.fn()
    render(<Board open close={close} />)
    click(screen.getByTestId('lane'), { x: 10, y: 10 }, { x: 80, y: 12 })
    fireEvent.pointerDown(screen.getByText('Card B'), { clientX: 10, clientY: 10 })
    fireEvent.click(screen.getByTestId('lane'), { clientX: 10, clientY: 10 })
    expect(close).not.toHaveBeenCalled()
  })

  it('ignores portaled menus and a panel that is already closed', () => {
    const close = vi.fn()
    const { rerender } = render(<Board open close={close} />)
    click(screen.getByTestId('portal'))
    rerender(<Board open={false} close={close} />)
    click(screen.getByTestId('lane'))
    expect(close).not.toHaveBeenCalled()
  })
})
