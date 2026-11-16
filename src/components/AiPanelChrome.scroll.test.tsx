import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiPanelMessageHistory } from './AiPanelChrome'

vi.mock('./AiMessage', () => ({
  AiMessage: (props: { response?: string }) => <div data-testid="ai-message">{props.response}</div>,
}))

const messages = [
  { id: 'first', userMessage: 'Summarize', actions: [], response: 'First answer' },
  { id: 'second', userMessage: 'Follow up', actions: [], response: 'Streaming', isStreaming: true },
]

// jsdom has no layout: give the transcript 600px of content in a 200px viewport.
function mockLayout(element: HTMLElement) {
  let scrollTop = 0
  Object.defineProperties(element, {
    clientHeight: { configurable: true, get: () => 200 },
    scrollHeight: { configurable: true, get: () => 600 },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => { scrollTop = Math.min(Math.max(0, value), 400) },
    },
  })
}

function renderHistory(isActive: boolean) {
  render(
    <AiPanelMessageHistory
      agentLabel="Claude Code"
      agentReadiness="ready"
      messages={messages}
      isActive={isActive}
      hasContext
    />,
  )
  const transcript = screen.getAllByTestId('ai-message')[0].parentElement as HTMLElement
  mockLayout(transcript)
  transcript.scrollTop = 400
  fireEvent.scroll(transcript)
  return transcript
}

function scrollUp(transcript: HTMLElement) {
  fireEvent.wheel(transcript, { deltaY: -400 })
  transcript.scrollTop = 0
  fireEvent.scroll(transcript)
}

describe('AiPanelMessageHistory jump to latest', () => {
  it('offers a jump to the latest content after scrolling up, and re-pins on click', () => {
    const transcript = renderHistory(true)
    expect(screen.queryByTestId('ai-jump-to-latest')).not.toBeInTheDocument()

    scrollUp(transcript)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to latest' }))

    expect(transcript.scrollTop).toBe(400)
    expect(screen.queryByTestId('ai-jump-to-latest')).not.toBeInTheDocument()
  })

  it('stays hidden when the scroll position moves without user input, as after sending', () => {
    const transcript = renderHistory(true)
    transcript.scrollTop = 350
    fireEvent.scroll(transcript)

    expect(screen.queryByTestId('ai-jump-to-latest')).not.toBeInTheDocument()
  })

  it('is also offered when scrolled up with no response in progress', () => {
    scrollUp(renderHistory(false))

    expect(screen.getByRole('button', { name: 'Jump to latest' })).toBeInTheDocument()
  })
})
