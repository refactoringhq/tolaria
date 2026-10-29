import { describe, expect, it, vi } from 'vitest'
import { createMobileAnalytics, type MobileAnalyticsEvent } from './mobileAnalytics'

function setup() {
  const send = vi.fn<(_body: unknown, _signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined)
  const createId = vi.fn(() => 'anonymous-session')
  return { send, createId, analytics: createMobileAnalytics({ send, createId, configured: true, platform: 'ios' }) }
}

describe('consent-bound mobile analytics', () => {
  it('records link activation kind without note targets or URLs', () => {
    const { analytics, send } = setup()
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_note_link_activated', kind: 'wikilink' })
    expect(send.mock.calls[0]?.[0]).toEqual({
      event: 'mobile_note_link_activated', distinct_id: 'anonymous-session',
      properties: { $process_person_profile: false, $geoip_disable: true, platform: 'ios', kind: 'wikilink' },
    })
  })

  it('records editor tool discovery without queries or document content', () => {
    const { analytics, send } = setup()
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_editor_tool_opened', tool: 'find' })
    expect(send.mock.calls[0]?.[0]).toEqual({ event: 'mobile_editor_tool_opened', distinct_id: 'anonymous-session',
      properties: { $process_person_profile: false, $geoip_disable: true, platform: 'ios', tool: 'find' } })
  })
  it('does no work and creates no identifier before consent', () => {
    const { analytics, send, createId } = setup()
    analytics.capture({ name: 'mobile_note_swipe_used', action: 'archive' })
    expect(send).not.toHaveBeenCalled()
    expect(createId).not.toHaveBeenCalled()
  })

  it('sends only predefined properties and disables person profiles and GeoIP', () => {
    const { analytics, send } = setup()
    analytics.setEnabled(true)
    const event: MobileAnalyticsEvent & { title: string; path: string } = {
      name: 'mobile_note_swipe_used', action: 'favorite', title: 'Private', path: '/vault/private.md',
    }
    analytics.capture(event)
    expect(send.mock.calls[0]?.[0]).toEqual({
      event: 'mobile_note_swipe_used',
      distinct_id: 'anonymous-session',
      properties: { $process_person_profile: false, $geoip_disable: true,
        platform: 'ios', action: 'favorite' },
    })
  })

  it('aborts pending requests on opt-out and discards the anonymous identifier', () => {
    const { analytics, send, createId } = setup()
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_setting_changed', setting: 'theme' })
    const signal = send.mock.calls[0]?.[1]
    analytics.setEnabled(false)
    expect(signal?.aborted).toBe(true)
    analytics.capture({ name: 'mobile_setting_changed', setting: 'theme' })
    expect(send).toHaveBeenCalledTimes(1)
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_setting_changed', setting: 'theme' })
    expect(createId).toHaveBeenCalledTimes(2)
  })

  it('does not enable an unconfigured build', () => {
    const send = vi.fn(async () => {})
    const analytics = createMobileAnalytics({ send, createId: () => 'unused', configured: false, platform: 'android' })
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_git_operation_requested', operation: 'commit' })
    expect(send).not.toHaveBeenCalled()
  })

  it('drops transport failures without surfacing errors in the app', async () => {
    const send = vi.fn(async () => { throw new Error('offline') })
    const analytics = createMobileAnalytics({ send, createId: () => 'anonymous', configured: true, platform: 'ios' })
    analytics.setEnabled(true)
    analytics.capture({ name: 'mobile_git_operation_requested', operation: 'sync' })
    await Promise.resolve()
    await Promise.resolve()
    analytics.setEnabled(false)
  })

  it('bounds in-flight events and aborts stalled requests after five seconds', () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const send = vi.fn((_body: unknown, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<void>(() => {})
    })
    const analytics = createMobileAnalytics({ send, createId: () => 'anonymous', configured: true, platform: 'ios' })
    try {
      analytics.setEnabled(true)
      for (let index = 0; index < 20; index++) analytics.capture({ name: 'mobile_note_swipe_used', action: 'favorite' })
      expect(send).toHaveBeenCalledTimes(8)
      vi.advanceTimersByTime(5_000)
      expect(signals.every(signal => signal.aborted)).toBe(true)
    } finally {
      analytics.setEnabled(false)
      vi.useRealTimers()
    }
  })
})
