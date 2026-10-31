import { describe, expect, it } from 'vitest'
import { desktopEditorParity, desktopNoteItemParity, desktopPanelParity, desktopSidebarParity } from './desktopParity'
import { isPhoneViewport, mobileMetrics } from './mobileMetrics'

describe('explicit mobile UI density', () => {
  it('retains canonical desktop metrics at 100 percent', () => {
    expect(mobileMetrics[1].sidebar).toEqual(desktopSidebarParity)
    expect(mobileMetrics[1].noteItem).toEqual(desktopNoteItemParity)
    expect(mobileMetrics[1].editor).toEqual(desktopEditorParity)
  })

  it('scales typography and spacing together at 120 percent', () => {
    const metrics = mobileMetrics[1.2]
    expect(metrics.sidebar.itemTextSize).toBe(15.6)
    expect(metrics.sidebar.itemLabelLineHeight).toBe(21.6)
    expect(metrics.sidebar.itemPadding.withCount.top).toBe(7.2)
    expect(metrics.sidebar.countPillHeight).toBe(24)
    expect(metrics.noteItem.padding.left).toBe(19.2)
    expect(metrics.noteItem.snippetLineHeight).toBe(21.6)
    expect(metrics.editor.bodyFontSize).toBe(18)
    expect(metrics.editor.bodyLineHeight).toBe(27.6)
  })

  it('keeps pane geometry, corner radii, strokes and opacity unchanged', () => {
    const metrics = mobileMetrics[1.2]
    expect(metrics.panel.sidebarWidth).toBe(desktopPanelParity.sidebarWidth)
    expect(metrics.panel.noteListWidth).toBe(desktopPanelParity.noteListWidth)
    expect(metrics.panel.inspectorWidth).toBe(desktopPanelParity.inspectorWidth)
    expect(metrics.sidebar.countPillRadius).toBe(999)
    expect(metrics.noteItem.borderLeftWidth).toBe(3)
    expect(metrics.editor.horizontalRuleThickness).toBe(1)
    expect(metrics.toolbarAction.pressedOpacity).toBe(0.7)
  })

  it('does not mutate desktop tokens and has stable shared identities', () => {
    expect(desktopSidebarParity.itemTextSize).toBe(13)
    expect(desktopNoteItemParity.padding.left).toBe(16)
    expect(mobileMetrics[1.2]).toBe(mobileMetrics[1.2])
    expect(mobileMetrics[1.2].size(44)).toBe(52.8)
  })

  it('uses native phone text and touch-row metrics only in phone-width layouts', () => {
    const { phoneChrome } = mobileMetrics[1.2]
    expect(phoneChrome).toMatchObject({
      noteTitleTextSize: 17,
      noteSnippetTextSize: 15,
      sidebarTextSize: 17,
      sidebarRowHeight: 44,
      folderRowHeight: 44,
    })
    expect(isPhoneViewport(599)).toBe(true)
    expect(isPhoneViewport(600)).toBe(false)
    expect(isPhoneViewport(390, true)).toBe(false)
  })
})
