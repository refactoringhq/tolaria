import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useStickToBottom } from './useStickToBottom'

const VIEWPORT_HEIGHT = 200
const ROW_HEIGHT = 100

function Transcript({ turns, turnKey = turns.length }: { turns: string[]; turnKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useStickToBottom(containerRef, { turnKey, contentKey: turns })
  return (
    <div ref={containerRef} data-testid="transcript">
      {turns.map((turn, index) => <p key={index}>{turn}</p>)}
    </div>
  )
}

// jsdom has no layout, so derive scrollHeight from the visible rows and clamp scrollTop like a
// browser. `rubberBand` is the macOS overscroll past the bottom edge, which reads as extra scrollTop.
const layout = { rubberBand: 0 }

function mockLayout(element: HTMLElement) {
  let scrollTop = 0
  layout.rubberBand = 0
  const scrollHeight = () => element.querySelectorAll(':scope > :not([hidden])').length * ROW_HEIGHT
  const clamp = (value: number) => Math.min(Math.max(0, value), Math.max(0, scrollHeight() - VIEWPORT_HEIGHT))
  Object.defineProperties(element, {
    clientHeight: { configurable: true, get: () => VIEWPORT_HEIGHT },
    scrollHeight: { configurable: true, get: scrollHeight },
    scrollTop: {
      configurable: true,
      get: () => clamp(scrollTop) + layout.rubberBand,
      set: (value: number) => { scrollTop = clamp(value) },
    },
  })
}

// A real scroll starts with input (here a wheel tick); layout shifts move scrollTop with none.
function userScrollsTo(element: HTMLElement, top: number) {
  fireEvent.wheel(element, { deltaY: top - element.scrollTop })
  element.scrollTop = top
  fireEvent.scroll(element)
}

function layoutShiftsTo(element: HTMLElement, top: number) {
  element.scrollTop = top
  fireEvent.scroll(element)
}

function renderTranscript(turns: string[]) {
  const view = render(<Transcript turns={turns} />)
  const element = screen.getByTestId('transcript')
  mockLayout(element)
  view.rerender(<Transcript turns={[...turns]} />)
  return {
    element,
    rerender: (next: string[], turnKey?: unknown) => view.rerender(<Transcript turns={next} turnKey={turnKey} />),
  }
}

describe('useStickToBottom', () => {
  it('follows streaming content while the user stays at the bottom', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c'])
    expect(element.scrollTop).toBe(100)

    rerender(['a', 'b', 'c', 'd'])

    expect(element.scrollTop).toBe(200)
  })

  it('leaves the scroll position alone after the user scrolls up to read an earlier answer', () => {
    const { element, rerender } = renderTranscript(['first prompt', 'first answer', 'follow-up', 'streaming'])
    userScrollsTo(element, 0)

    rerender(['first prompt', 'first answer', 'follow-up', 'streaming more'])
    rerender(['first prompt', 'first answer', 'follow-up', 'streaming even more'])

    expect(element.scrollTop).toBe(0)
  })

  it('unpins on a small upward scroll that is still near the bottom', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c', 'd'])
    userScrollsTo(element, 190)

    rerender(['a', 'b', 'c', 'd more'])

    expect(element.scrollTop).toBe(190)
  })

  it('stays pinned when content collapsing clamps the scroll position', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c', 'd'])
    element.querySelector('p')?.setAttribute('hidden', '')
    fireEvent.scroll(element)

    rerender(['a', 'b', 'c', 'd', 'e', 'f'], 4)

    expect(element.scrollTop).toBe(300)
  })

  it('stays pinned when the browser moves the scroll position without user input', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c', 'd'])
    rerender(['a', 'b', 'c', 'd', 'new prompt'], 'new-turn')
    layoutShiftsTo(element, 250)

    rerender(['a', 'b', 'c', 'd', 'new prompt', 'streaming'], 'new-turn')

    expect(element.scrollTop).toBe(400)
  })

  it('re-pins after scrolling down into the bottom edge, even as the view bounces back', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c', 'd'])
    userScrollsTo(element, 0)
    userScrollsTo(element, 200)
    // Momentum keeps sending downward wheel ticks while the rubber-band settles back up.
    layout.rubberBand = 20
    fireEvent.wheel(element, { deltaY: 8 })
    fireEvent.scroll(element)
    layout.rubberBand = 0
    fireEvent.wheel(element, { deltaY: 2 })
    fireEvent.scroll(element)

    rerender(['a', 'b', 'c', 'd', 'e'], 4)

    expect(element.scrollTop).toBe(300)
  })

  it('re-pins once the user scrolls back to the bottom', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c'])
    userScrollsTo(element, 0)
    userScrollsTo(element, 100)

    rerender(['a', 'b', 'c', 'd'])

    expect(element.scrollTop).toBe(200)
  })

  it('re-pins when a new turn starts', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c'])
    userScrollsTo(element, 0)

    rerender(['a', 'b', 'c', 'new prompt'])

    expect(element.scrollTop).toBe(200)
  })

  it('re-pins when the latest turn is replaced without the count changing', () => {
    const { element, rerender } = renderTranscript(['a', 'b', 'c', 'd'])
    userScrollsTo(element, 0)

    rerender(['a', 'b', 'c', 'regenerated'], 'regenerated-id')

    expect(element.scrollTop).toBe(200)
  })
})
