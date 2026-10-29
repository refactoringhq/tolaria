import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@10play/tentap-editor/web', () => ({
  BridgeExtension: class { constructor(options: object) { Object.assign(this, options) } },
  LinkBridge: { name: 'link', tiptapExtension: { extend: (options: object) => options } },
  Plugin: class { constructor(options: object) { Object.assign(this, options) } },
  TenTapStartKit: [{ name: 'link' }],
}))

import { handleMobileLinkContextMenu, mobileWikilinkStartKit } from './MobileWysiwygLinkBridge.web'

const originalWindow = globalThis.window

afterEach(() => {
  vi.stubGlobal('window', originalWindow)
})

describe('handleMobileLinkContextMenu', () => {
  it('sends a long-pressed link to the native bridge and suppresses the web context menu', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage } })
    const preventDefault = vi.fn()
    const anchor = { getAttribute: vi.fn(() => 'https://example.com') }
    const target = { closest: vi.fn(() => anchor), parentElement: null }

    expect(handleMobileLinkContextMenu({ target, preventDefault } as unknown as MouseEvent)).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({
      type: 'action',
      payload: { type: 'mobile-open-link', payload: { href: 'https://example.com' } },
    }))
    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it('leaves the context menu alone when the gesture is outside a link', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage } })
    const preventDefault = vi.fn()
    const target = { closest: vi.fn(() => null), parentElement: null }

    expect(handleMobileLinkContextMenu({ target, preventDefault } as unknown as MouseEvent)).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('finds a link when the context menu target is a text node', () => {
    const postMessage = vi.fn()
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage } })
    const preventDefault = vi.fn()
    const anchor = { closest: vi.fn(() => anchor), getAttribute: vi.fn(() => 'https://example.com') }

    expect(handleMobileLinkContextMenu({
      target: { parentElement: anchor },
      preventDefault,
    } as unknown as MouseEvent)).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(expect.stringContaining('https://example.com'))
    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it('installs the link gesture plugin on the TenTap link extension', () => {
    const linkBridge = mobileWikilinkStartKit().find((extension) => extension.name === 'link') as unknown as {
      tiptapExtension: { addProseMirrorPlugins: (this: { parent: () => never[] }) => Array<{ props: unknown }> }
    }

    const plugins = linkBridge.tiptapExtension.addProseMirrorPlugins.call({ parent: () => [] })
    expect(plugins).toHaveLength(1)
    expect(plugins[0].props).toHaveProperty('handleDOMEvents.contextmenu')

    const postMessage = vi.fn()
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage } })
    const preventDefault = vi.fn()
    const target = { closest: () => ({ getAttribute: () => 'tolaria://wikilink/Note' }), parentElement: null }
    const handlers = plugins[0].props as { handleDOMEvents: {
      contextmenu: (view: unknown, event: MouseEvent) => boolean
    } }
    expect(handlers.handleDOMEvents.contextmenu({}, { target, preventDefault } as unknown as MouseEvent)).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(expect.stringContaining('tolaria://wikilink/Note'))
  })
})
