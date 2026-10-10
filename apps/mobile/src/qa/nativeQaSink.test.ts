import { afterEach, expect, it, vi } from 'vitest'
import { logNativeQaProof, nativeQaSinkLogLine, postNativeQaEvent, setNativeQaSinkUrl } from './nativeQaSink'

afterEach(() => { setNativeQaSinkUrl(null); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('sends standalone proof and layout events to the same local collector', () => {
  const fetch = vi.fn().mockResolvedValue({})
  vi.stubGlobal('fetch', fetch)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  setNativeQaSinkUrl('http://127.0.0.1:43210')
  const proof = 'TOLARIA_MOBILE_WYSIWYG_PERSISTENCE_PROBE {"persistedToNativeRepository":true}'
  logNativeQaProof(proof)
  postNativeQaEvent({ id: 'sidebar.panel', platform: 'ios', width: 260, height: 953, x: 0, y: 0 })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ proofLog: proof })
  expect(JSON.parse(fetch.mock.calls[1][1].body).width).toBe(260)
  expect(nativeQaSinkLogLine({ proofLog: proof })).toBe(proof)
})

it.each(['https://example.com', 'http://localhost.example.com', 'http://user:password@127.0.0.1', 'file:///tmp/qa', 'invalid'])('does not transmit QA events to %s', (url) => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  setNativeQaSinkUrl(url)
  postNativeQaEvent({ id: 'private note path' })
  expect(fetch).not.toHaveBeenCalled()
})

it('ignores malformed or unrelated collector events', () => {
  expect(nativeQaSinkLogLine(null)).toBeNull()
  expect(nativeQaSinkLogLine({ proofLog: 'unrelated' })).toBeNull()
  expect(nativeQaSinkLogLine({ id: 'sidebar.panel' })).toBeNull()
  const metric = { id: 'sidebar.panel', platform: 'ios', width: 260, height: 953, x: 0, y: 0 }
  expect(nativeQaSinkLogLine(metric)).toBe(`TOLARIA_MOBILE_LAYOUT_METRIC ${JSON.stringify(metric)}`)
})
