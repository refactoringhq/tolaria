import type { EditorBridge } from '@10play/tentap-editor'
import { expect, it, vi } from 'vitest'
import { createMobileEditorDocumentBridge } from './MobileWysiwygDocumentReads.native'

const sdk = vi.hoisted(() => ({ onMessage: vi.fn(() => false) }))
vi.mock('@10play/tentap-editor', () => ({
  BridgeExtension: class { constructor(options: object) { Object.assign(this, options) } },
  CoreBridge: { name: 'coreBridge', extendEditorInstance: () => ({}), onEditorMessage: sdk.onMessage },
  CoreEditorActionType: { EditorReady: 'editor-ready' },
}))

it('routes native link actions and leaves unrelated messages to CoreBridge', () => {
  const onLinkTap = vi.fn()
  const bridge = createMobileEditorDocumentBridge([], onLinkTap)
  const editor = { getEditorState: () => ({}) } as unknown as EditorBridge
  const onEditorMessage = bridge.extensions.at(-1)?.onEditorMessage

  expect(onEditorMessage?.({
    type: 'action',
    payload: { type: 'mobile-open-link', payload: { href: 'https://example.com' } },
  }, editor)).toBe(true)
  expect(onLinkTap).toHaveBeenCalledWith('https://example.com')

  onEditorMessage?.({ type: 'unrelated', payload: null }, editor)
  expect(sdk.onMessage).toHaveBeenLastCalledWith({ type: 'unrelated', payload: null }, editor)
})
