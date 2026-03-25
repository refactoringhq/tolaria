import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TelemetryConsentDialog } from './TelemetryConsentDialog'

describe('TelemetryConsentDialog', () => {
  it('renders the consent dialog', () => {
    render(<TelemetryConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText('Help improve Laputa')).toBeDefined()
    expect(screen.getByText(/anonymous crash reports/i)).toBeDefined()
  })

  it('calls onAccept when Allow button is clicked', () => {
    const onAccept = vi.fn()
    render(<TelemetryConsentDialog onAccept={onAccept} onDecline={vi.fn()} />)
    fireEvent.click(screen.getByTestId('telemetry-accept'))
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('calls onDecline when No thanks button is clicked', () => {
    const onDecline = vi.fn()
    render(<TelemetryConsentDialog onAccept={vi.fn()} onDecline={onDecline} />)
    fireEvent.click(screen.getByTestId('telemetry-decline'))
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it('shows a details section explaining what data is shared', () => {
    render(<TelemetryConsentDialog onAccept={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText(/no vault content, note titles/i)).toBeDefined()
  })
})
