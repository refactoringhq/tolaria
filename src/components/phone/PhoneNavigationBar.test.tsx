import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type PhoneNoteStackControls, publishPhoneNoteStack } from '../../hooks/phoneNoteStackStore'
import { PhoneNavigationBar } from './PhoneNavigationBar'

const trackEvent = vi.fn()
vi.mock('../../lib/telemetry', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }))

function publishPhone(pane: PhoneNoteStackControls['pane']): PhoneNoteStackControls {
  const controls = {
    active: true,
    pane,
    backToList: vi.fn(),
    showNavigation: vi.fn(),
    showList: vi.fn(),
    showNote: vi.fn(),
  }
  act(() => { publishPhoneNoteStack(controls) })
  return controls
}

describe('PhoneNavigationBar', () => {
  afterEach(() => {
    publishPhoneNoteStack(null)
    trackEvent.mockReset()
  })

  it('renders nothing off the phone layout', () => {
    const { container } = render(<PhoneNavigationBar locale="en" placement="list" />)

    expect(container.childElementCount).toBe(0)
  })

  it('opens the navigation pane from the note list and records it', () => {
    const controls = publishPhone('list')
    render(<PhoneNavigationBar locale="en" placement="list" />)

    fireEvent.click(screen.getByRole('button', { name: 'Navigation' }))

    expect(controls.showNavigation).toHaveBeenCalledOnce()
    expect(trackEvent).toHaveBeenCalledWith('phone_navigation_opened')
  })

  it('returns from the navigation pane to the note list', () => {
    const controls = publishPhone('navigation')
    render(<PhoneNavigationBar locale="en" placement="navigation" />)

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))

    expect(controls.showList).toHaveBeenCalledOnce()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('shows only the bar that belongs to the visible pane', () => {
    publishPhone('note')
    const { container } = render(<PhoneNavigationBar locale="en" placement="list" />)

    expect(container.childElementCount).toBe(0)
  })
})
