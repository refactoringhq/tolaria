import { describe, expect, it, vi } from 'vitest'
import type { EditorBridge } from '@10play/tentap-editor'
import {
  activateNativeEditorChanges,
  canSyncInitialContent,
  nativeInitialContentReady,
  type NativeTentapEditorRefs,
  setNativeEditorContentSilently,
} from './MobileWysiwygEditorLifecycle.native'

describe('native WYSIWYG initial content sync', () => {
  it('does not autofocus a bridge before its native WebView has finished loading', () => {
    const refs = {
      editorRef: { current: { getEditorState: () => ({ isReady: true }) } },
      documentReads: { isReady: () => true },
      initialContentSyncRef: { current: { isReady: () => true } },
      webViewLoadedRef: { current: false },
    } as unknown as NativeTentapEditorRefs
    expect(nativeInitialContentReady(refs)).toBe(false)
    refs.webViewLoadedRef.current = true
    expect(nativeInitialContentReady(refs)).toBe(true)
  })

  it('never falls back to an update-emitting content setter during hydration', () => {
    const setContent = vi.fn()
    const setContentSilently = vi.fn()

    expect(setNativeEditorContentSilently({ setContent } as unknown as EditorBridge, '<p>Legacy bridge</p>')).toBe(false)
    expect(setContent).not.toHaveBeenCalled()
    expect(setNativeEditorContentSilently({ setContentSilently } as unknown as EditorBridge, '<p>Silent bridge</p>')).toBe(true)
    expect(setContentSilently).toHaveBeenCalledWith('<p>Silent bridge</p>')
  })

  it('accepts editor changes only after explicit user interaction', () => {
    const acceptsEditorChangesRef = { current: false }

    activateNativeEditorChanges({ acceptsEditorChangesRef } as NativeTentapEditorRefs)

    expect(acceptsEditorChangesRef.current).toBe(true)
  })

  it('allows a disk reread after a touch until an editor change is accepted', () => {
    const refs = {
      acceptsEditorChangesRef: { current: false },
      hasAcceptedEditorChangeRef: { current: false },
    } as NativeTentapEditorRefs

    activateNativeEditorChanges(refs)
    expect(canSyncInitialContent(refs)).toBe(true)

    refs.hasAcceptedEditorChangeRef.current = true
    expect(canSyncInitialContent(refs)).toBe(false)
  })
})
