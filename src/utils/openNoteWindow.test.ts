import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNoteWindowUrl, openNoteInNewWindow } from './openNoteWindow'
import { isTauri } from '../mock-tauri'
import { shouldUseLinuxWindowChrome } from './platform'

const webviewWindowCalls = vi.fn()

vi.mock('../mock-tauri', () => ({
  isTauri: vi.fn(),
}))

vi.mock('./platform', () => ({
  shouldUseLinuxWindowChrome: vi.fn(),
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class MockWebviewWindow {
    constructor(label: string, options: unknown) {
      webviewWindowCalls(label, options)
    }
  },
}))

describe('openNoteWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-14T16:00:00Z'))
    vi.mocked(isTauri).mockReturnValue(false)
    vi.mocked(shouldUseLinuxWindowChrome).mockReturnValue(false)
  })

  it('builds a root-app route that preserves the note window params', () => {
    const url = buildNoteWindowUrl('/vault/Folder/My Note.md', '/Users/luca/Laputa Vault', 'AI / ML')
    const parsed = new URL(url, 'https://tolaria.localhost')

    expect(parsed.pathname).toBe('/')
    expect(parsed.searchParams.get('window')).toBe('note')
    expect(parsed.searchParams.get('path')).toBe('/vault/Folder/My Note.md')
    expect(parsed.searchParams.get('vault')).toBe('/Users/luca/Laputa Vault')
    expect(parsed.searchParams.get('title')).toBe('AI / ML')
  })

  it('does nothing outside Tauri', async () => {
    await openNoteInNewWindow('/vault/test.md', '/vault', 'Test Note')

    expect(webviewWindowCalls).not.toHaveBeenCalled()
  })

  it('opens a new Tauri window with the encoded note route', async () => {
    vi.mocked(isTauri).mockReturnValue(true)

    await openNoteInNewWindow('/vault/Folder/My Note.md', '/Users/luca/Laputa Vault', 'AI / ML')

    expect(webviewWindowCalls).toHaveBeenCalledWith(
      'note-1776182400000',
      expect.objectContaining({
        url: '/?window=note&path=%2Fvault%2FFolder%2FMy+Note.md&vault=%2FUsers%2Fluca%2FLaputa+Vault&title=AI+%2F+ML',
        title: 'AI / ML',
        width: 800,
        height: 700,
        resizable: true,
        titleBarStyle: 'overlay',
        hiddenTitle: true,
        decorations: true,
      }),
    )
  })

  it('drops native decorations when Linux window chrome is active', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(shouldUseLinuxWindowChrome).mockReturnValue(true)

    await openNoteInNewWindow('/vault/linux.md', '/vault', 'Linux Note')

    expect(webviewWindowCalls).toHaveBeenCalledWith(
      'note-1776182400000',
      expect.objectContaining({
        decorations: false,
      }),
    )
  })
})
